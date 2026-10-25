import os
import re
import threading
import time
import io
import csv
from datetime import datetime

os.environ.setdefault(
    "YOLO_CONFIG_DIR", os.path.join(os.path.dirname(__file__), ".ultralytics")
)

import serial
import cv2
from flask import Flask, g, jsonify, render_template, request, send_file, send_from_directory
from flask_socketio import SocketIO
import pyttsx3

from auth import authenticate_user, create_token
from analytics import calculate_flow_rate, predict_time_remaining
from blockage_detector import update_weight_history, check_blockage
from flow_monitor import get_expected_range, validate_flow_rate
from middleware import require_auth, require_roles
from patient_manager import PatientManager
from data_logger import DataLogger, read_recent_logs
from telegram_notifier import send_notification, is_configured, load_config
from camera_monitor import CameraMonitor

app = Flask(__name__, static_folder="dist/assets", static_url_path="/assets")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "saline-monitor")

DIST_DIR = os.path.join(app.root_path, "dist")
DIST_INDEX = os.path.join(DIST_DIR, "index.html")

socketio = SocketIO(app, async_mode="threading")

SERIAL_PORT = os.environ.get("SERIAL_PORT", "COM3")
BAUD_RATE = int(os.environ.get("BAUD_RATE", "115200"))
PATIENT_COUNT = int(os.environ.get("PATIENT_COUNT", "1"))
LOG_PATH = os.path.join("logs", "saline_log.csv")
ENABLE_SERIAL = os.environ.get("ENABLE_SERIAL", "0") == "1"
ENABLE_CAMERA = os.environ.get("ENABLE_CAMERA", "0") == "1"

LINE_PATTERN = re.compile(r"Weight:\s*([-+]?\d+(?:\.\d+)?)\s*g", re.IGNORECASE)

state_lock = threading.Lock()
manager = PatientManager(bed_count=PATIENT_COUNT)
CAMERA_INDEX = int(os.environ.get("CAMERA_INDEX", "1"))
CAMERA_BACKEND = os.environ.get("CAMERA_BACKEND", "MSMF").upper()
MODEL_PATH = os.environ.get(
    "MODEL_PATH", r"c:\Users\bhanu\OneDrive\Desktop\Summer Internship\best.pt"
)
backend_map = {
    "MSMF": cv2.CAP_MSMF,
    "DSHOW": cv2.CAP_DSHOW,
    "ANY": None,
}
camera_monitor = CameraMonitor(
    camera_index=CAMERA_INDEX,
    backend=backend_map.get(CAMERA_BACKEND, None),
    model_path=MODEL_PATH,
)

full_bottle_weight = 539.0
low_percent_threshold = 15.0

low_alert_events = {}
blockage_alert_events = {}
flow_abnormal_since = {}
flow_abnormal_alerted = {}
telegram_sent = {
    "low_saline": set(),
    "blockage": set(),
    "flow_abnormal": set(),
    "bottle_replaced": set(),
}
last_summary_signature = None
last_weight_by_bed = {}

PATIENT_LOGIN_FALLBACKS = {
    "patient1@test.com": {
        "email": "patient1@test.com",
        "password": "password123",
        "role": "patient",
        "name": "Patient One",
        "patient_id": 1,
    },
    "patient2@test.com": {
        "email": "patient2@test.com",
        "password": "password123",
        "role": "patient",
        "name": "Patient Two",
        "patient_id": 2,
    },
}


def get_remaining_percent(weight):
    if weight is None or full_bottle_weight <= 0:
        return None
    percent = (weight / full_bottle_weight) * 100
    return min(100.0, max(0.0, percent))


def get_status(percent):
    if percent is None:
        return "Unknown"
    if percent > 60:
        return "Full"
    if low_percent_threshold < percent <= 60:
        return "Half"
    return "Low Saline"


def speak_alert(message):
    try:
        engine = pyttsx3.init()
        engine.setProperty("rate", 160)
        engine.say(message)
        engine.runAndWait()
    except Exception as exc:
        print(f"[TTS] Error: {exc}")


def bed_label(bed_id):
    if bed_id.lower().startswith("bed"):
        return f"Bed {bed_id[3:]}"
    return bed_id




def _alert_loop(stop_event, message, interval_seconds):
    while not stop_event.is_set():
        speak_alert(message)
        stop_event.wait(interval_seconds)


def start_repeating_alert(alert_events, bed_id, message, interval_seconds):
    if bed_id not in alert_events or alert_events[bed_id]["active"] is False:
        stop_event = threading.Event()
        alert_events[bed_id] = {"active": True, "event": stop_event}
        bed_message = f"{message} {bed_id.upper()}."
        threading.Thread(
            target=_alert_loop,
            args=(stop_event, bed_message, interval_seconds),
            daemon=True,
        ).start()


def stop_repeating_alert(alert_events, bed_id):
    if bed_id in alert_events and alert_events[bed_id]["active"]:
        alert_events[bed_id]["active"] = False
        alert_events[bed_id]["event"].set()


def build_alert_list(patients):
    alerts = []
    for bed_id, data in patients.items():
        if data.get("status") == "Low Saline":
            alerts.append(f"WARN {bed_id} - Low Saline")
        if data.get("blockage_detected"):
            alerts.append(f"WARN {bed_id} - IV Blockage")
        if data.get("flow_warning"):
            alerts.append(f"WARN {bed_id} - Flow Rate Abnormal")
    return alerts


def emit_update(patients):
    payload = {
        "patients": patients,
        "alerts": build_alert_list(patients),
        "full_bottle_weight": full_bottle_weight,
        "low_percent_threshold": low_percent_threshold,
        "bed_count": len(patients),
        "telegram_configured": is_configured(),
    }
    socketio.emit("patients_update", payload)


def build_live_payload():
    with state_lock:
        patients_snapshot = manager.snapshot()
    return {
        "patients": patients_snapshot,
        "alerts": build_alert_list(patients_snapshot),
        "full_bottle_weight": full_bottle_weight,
        "low_percent_threshold": low_percent_threshold,
        "bed_count": len(patients_snapshot),
        "camera_enabled": ENABLE_CAMERA,
        "telegram_configured": is_configured(),
    }


def get_scoped_patients(user):
    with state_lock:
        patients_snapshot = manager.snapshot()

    if user and user.get("role") == "patient":
        patient_id = user.get("patient_id")
        if patient_id is None:
            return {}
        bed_id = f"bed{patient_id}"
        patient_data = patients_snapshot.get(bed_id)
        return {bed_id: patient_data} if patient_data else {}

    return patients_snapshot


def build_live_payload_for_user(user):
    patients_snapshot = get_scoped_patients(user)
    return {
        "patients": patients_snapshot,
        "alerts": build_alert_list(patients_snapshot),
        "full_bottle_weight": full_bottle_weight,
        "low_percent_threshold": low_percent_threshold,
        "bed_count": len(patients_snapshot),
        "camera_enabled": ENABLE_CAMERA and user.get("role") != "patient",
        "telegram_configured": is_configured(),
    }


def get_scoped_log_rows(user, limit=200):
    rows = read_recent_logs(LOG_PATH, limit=limit)
    if user and user.get("role") == "patient":
        target_bed = f"bed{user.get('patient_id')}"
        return [row for row in rows if row.get("bed_id") == target_bed]
    return rows


def build_admin_payload():
    with state_lock:
        patients_snapshot = manager.snapshot()

    weights = [
        float(data["weight"])
        for data in patients_snapshot.values()
        if data.get("weight") is not None
    ]
    return {
        "bed_count": len(patients_snapshot),
        "average_weight": (sum(weights) / len(weights)) if weights else None,
        "critical_alerts": len(
            [
                data
                for data in patients_snapshot.values()
                if data.get("status") == "Low Saline"
            ]
        ),
        "camera_enabled": ENABLE_CAMERA,
        "serial_enabled": ENABLE_SERIAL,
    }


def refresh_patients_snapshot():
    with state_lock:
        _, camera_percent = camera_monitor.get_latest()
        for bed_id, data in manager.patients.items():
            weight = data.get("weight")
            if weight is None:
                continue
            load_cell_percent = get_remaining_percent(weight)
            if load_cell_percent is not None and camera_percent is not None:
                final_percent = (load_cell_percent + camera_percent) / 2.0
            else:
                final_percent = (
                    load_cell_percent
                    if load_cell_percent is not None
                    else camera_percent
                )
            status = get_status(final_percent)
            sensor_mismatch = False
            if (
                load_cell_percent is not None
                and camera_percent is not None
                and abs(load_cell_percent - camera_percent) > 15
            ):
                sensor_mismatch = True
            readings = manager.get_history(bed_id)
            flow_rate = calculate_flow_rate(readings)
            time_remaining = predict_time_remaining(
                weight, full_bottle_weight, low_percent_threshold, flow_rate
            )
            drip_mode = data.get("drip_mode", "Normal")
            expected_range = get_expected_range(drip_mode)
            flow_status = validate_flow_rate(flow_rate, drip_mode)
            flow_warning = flow_status in ("low", "high")
            flow_warning_text = (
                "Flow too slow." if flow_status == "low" else "Flow too fast."
            )
            data.update(
                {
                    "percentage_remaining": final_percent,
                    "load_cell_percentage": load_cell_percent,
                    "camera_percentage": camera_percent,
                    "final_percentage": final_percent,
                    "status": status,
                    "flow_rate": flow_rate,
                    "time_remaining": time_remaining,
                    "flow_status": flow_status,
                    "flow_warning": flow_warning,
                    "flow_warning_text": flow_warning_text if flow_warning else "",
                    "expected_range": expected_range,
                    "sensor_mismatch": sensor_mismatch,
                }
            )
        return manager.snapshot()


def serial_reader():
    global last_summary_signature
    while True:
        try:
            print(f"[Serial] Connecting to {SERIAL_PORT} at {BAUD_RATE}...")
            with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1) as ser:
                print("[Serial] Connected.")
                while True:
                    try:
                        raw = ser.readline()
                        if not raw:
                            continue
                        line = raw.decode(errors="ignore").strip()
                        match = LINE_PATTERN.search(line)
                        if not match:
                            continue
                        weight = float(match.group(1))
                        now = time.time()
                        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                        with state_lock:
                            bed_id = manager.get_next_bed_id()
                            manager.update_reading(bed_id, weight, now)
                            readings = manager.get_history(bed_id)

                        load_cell_percent = get_remaining_percent(weight)
                        _, camera_percent = camera_monitor.get_latest()
                        if load_cell_percent is not None and camera_percent is not None:
                            final_percent = (load_cell_percent + camera_percent) / 2.0
                        else:
                            final_percent = (
                                load_cell_percent
                                if load_cell_percent is not None
                                else camera_percent
                            )
                        status = get_status(final_percent)
                        sensor_mismatch = False
                        if (
                            load_cell_percent is not None
                            and camera_percent is not None
                            and abs(load_cell_percent - camera_percent) > 15
                        ):
                            sensor_mismatch = True

                        update_weight_history(bed_id, weight, now)
                        low_weight = full_bottle_weight * (low_percent_threshold / 100.0)
                        blockage_detected = check_blockage(bed_id, weight, low_weight)

                        flow_rate = calculate_flow_rate(readings)
                        drip_mode = manager.patients[bed_id]["drip_mode"]
                        expected_range = get_expected_range(drip_mode)
                        flow_status = validate_flow_rate(flow_rate, drip_mode)
                        time_remaining = predict_time_remaining(
                            weight, full_bottle_weight, low_percent_threshold, flow_rate
                        )

                        flow_warning = flow_status in ("low", "high")
                        flow_warning_text = ""
                        if flow_warning:
                            if bed_id not in flow_abnormal_since:
                                flow_abnormal_since[bed_id] = now
                                flow_abnormal_alerted[bed_id] = False
                            if (
                                now - flow_abnormal_since[bed_id] >= 60
                                and not flow_abnormal_alerted.get(bed_id, False)
                            ):
                                flow_abnormal_alerted[bed_id] = True
                                threading.Thread(
                                    target=speak_alert,
                                    args=(
                                        f"Warning. Infusion flow rate abnormal for {bed_id.upper()}.",
                                    ),
                                    daemon=True,
                                ).start()
                            flow_warning_text = (
                                "Flow too slow." if flow_status == "low" else "Flow too fast."
                            )
                        else:
                            flow_abnormal_since.pop(bed_id, None)
                            flow_abnormal_alerted.pop(bed_id, None)

                        if status == "Low Saline":
                            if bed_id not in telegram_sent["low_saline"]:
                                message = (
                                    f"LOW SALINE - {bed_label(bed_id)}\n"
                                    f"Remaining: {final_percent:.1f}%\n"
                                    f"Weight: {weight:.1f} g"
                                )
                                send_notification(message)
                                telegram_sent["low_saline"].add(bed_id)
                        else:
                            telegram_sent["low_saline"].discard(bed_id)

                        if blockage_detected:
                            if bed_id not in telegram_sent["blockage"]:
                                message = f"IV BLOCKAGE - {bed_label(bed_id)}"
                                send_notification(message)
                                telegram_sent["blockage"].add(bed_id)
                        else:
                            telegram_sent["blockage"].discard(bed_id)

                        if flow_warning:
                            if bed_id not in telegram_sent["flow_abnormal"]:
                                expected_text = (
                                    f"{expected_range[0]} - {expected_range[1]} g/min"
                                )
                                actual_text = (
                                    f"{flow_rate:.1f} g/min"
                                    if flow_rate is not None
                                    else "--"
                                )
                                message = (
                                    f"FLOW RATE ABNORMAL - {bed_label(bed_id)}\n"
                                    f"Expected: {expected_text}\n"
                                    f"Actual: {actual_text}"
                                )
                                send_notification(message)
                                telegram_sent["flow_abnormal"].add(bed_id)
                        else:
                            telegram_sent["flow_abnormal"].discard(bed_id)

                        prev_weight = last_weight_by_bed.get(bed_id)
                        if prev_weight is not None:
                            if (
                                weight >= full_bottle_weight * 0.9
                                and prev_weight <= full_bottle_weight * 0.6
                            ):
                                if bed_id not in telegram_sent["bottle_replaced"]:
                                    message = (
                                        f"NEW BOTTLE - {bed_label(bed_id)}\n"
                                        f"Weight: {weight:.1f} g"
                                    )
                                    send_notification(message)
                                    telegram_sent["bottle_replaced"].add(bed_id)
                        if weight < full_bottle_weight * 0.85:
                            telegram_sent["bottle_replaced"].discard(bed_id)
                        last_weight_by_bed[bed_id] = weight

                        if status == "Low Saline":
                            start_repeating_alert(
                                low_alert_events,
                                bed_id,
                                "Attention. Saline bottle is almost empty for",
                                6,
                            )
                        else:
                            stop_repeating_alert(low_alert_events, bed_id)

                        if blockage_detected:
                            start_repeating_alert(
                                blockage_alert_events,
                                bed_id,
                                "Warning. Possible IV blockage detected for",
                                8,
                            )
                        else:
                            stop_repeating_alert(blockage_alert_events, bed_id)

                        with state_lock:
                            manager.patients[bed_id].update(
                                {
                                    "weight": weight,
                                    "percentage_remaining": final_percent,
                                    "load_cell_percentage": load_cell_percent,
                                    "camera_percentage": camera_percent,
                                    "final_percentage": final_percent,
                                    "flow_rate": flow_rate,
                                    "time_remaining": time_remaining,
                                    "status": status,
                                    "sensor_mismatch": sensor_mismatch,
                                    "blockage_detected": blockage_detected,
                                    "flow_status": flow_status,
                                    "flow_warning": flow_warning,
                                    "flow_warning_text": flow_warning_text,
                                    "expected_range": expected_range,
                                    "timestamp": timestamp,
                                }
                            )
                            patients_snapshot = manager.snapshot()

                        active_alerts = build_alert_list(patients_snapshot)
                        if len(active_alerts) >= 1:
                            signature = "|".join(sorted(active_alerts))
                            if signature != last_summary_signature:
                                summary_lines = ["HOSPITAL ALERT SUMMARY"] + active_alerts
                                send_notification("\n".join(summary_lines))
                                last_summary_signature = signature
                        else:
                            last_summary_signature = None

                        emit_update(patients_snapshot)
                    except serial.SerialException as exc:
                        print(f"[Serial] Error: {exc}")
                        break
                    except ValueError:
                        continue
        except serial.SerialException as exc:
            print(f"[Serial] Connection failed: {exc}")

        time.sleep(2)


@app.route("/")
def index():
    return serve_frontend("index.html")


def camera_stream():
    while True:
        frame, _ = camera_monitor.get_latest()
        if frame is None:
            time.sleep(0.2)
            continue
        success, buffer = cv2.imencode(".jpg", frame)
        if not success:
            time.sleep(0.2)
            continue
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
        )


@app.route("/camera")
def camera_feed():
    return app.response_class(camera_stream(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/logs")
def logs_view():
    return serve_frontend()


@app.post("/api/login")
def login_api():
    data = request.get_json(silent=True) or {}
    user = authenticate_user(data.get("email"), data.get("password"))
    if not user:
        fallback_user = PATIENT_LOGIN_FALLBACKS.get((data.get("email") or "").strip().lower())
        if fallback_user and fallback_user["password"] == data.get("password"):
            user = {
                "email": fallback_user["email"],
                "role": fallback_user["role"],
                "name": fallback_user["name"],
                "patient_id": fallback_user["patient_id"],
            }
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token(user, app.config["SECRET_KEY"])
    return jsonify({"token": token, "role": user["role"], "user": user})


@app.get("/api/me")
@require_auth
def me_api():
    return jsonify({"user": g.current_user})


@app.route("/logs/data")
@require_auth
def logs_data():
    rows = get_scoped_log_rows(g.current_user, limit=200)
    return jsonify({"rows": rows})


@app.route("/api/live")
@require_auth
def live_data():
    return jsonify(build_live_payload_for_user(g.current_user))


@app.route("/api/admin/analytics")
@require_roles("admin")
def admin_analytics():
    return jsonify(build_admin_payload())


@app.route("/logs/download")
@require_auth
def logs_download():
    if not os.path.exists(LOG_PATH):
        return "Log file not found", 404
    if g.current_user.get("role") != "patient":
        return send_file(LOG_PATH, as_attachment=True, download_name="saline_log.csv")

    rows = get_scoped_log_rows(g.current_user, limit=1000)
    output = io.StringIO()
    fieldnames = [
        "timestamp",
        "bed_id",
        "weight",
        "load_cell_percentage",
        "camera_percentage",
        "final_percentage",
        "flow_rate",
        "time_remaining",
        "status",
        "blockage_detected",
        "drip_mode",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    buffer = io.BytesIO(output.getvalue().encode("utf-8"))
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name="saline_log.csv", mimetype="text/csv")


@socketio.on("connect")
def on_connect():
    with state_lock:
        patients_snapshot = manager.snapshot()
    emit_update(patients_snapshot)


@socketio.on("set_full_weight")
def on_set_full_weight(data):
    global full_bottle_weight
    try:
        value = float(data.get("full_bottle_weight"))
    except (TypeError, ValueError):
        return
    if value <= 0:
        return
    full_bottle_weight = value
    emit_update(refresh_patients_snapshot())


@app.post("/api/settings/full-weight")
@require_roles("admin")
def set_full_weight_api():
    global full_bottle_weight
    data = request.get_json(silent=True) or {}
    try:
        value = float(data.get("full_bottle_weight"))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid full bottle weight"}), 400
    if value <= 0:
        return jsonify({"error": "invalid full bottle weight"}), 400
    full_bottle_weight = value
    emit_update(refresh_patients_snapshot())
    return jsonify({"ok": True})


@socketio.on("set_low_percent_threshold")
def on_set_low_percent_threshold(data):
    global low_percent_threshold
    try:
        value = float(data.get("low_percent_threshold"))
    except (TypeError, ValueError):
        return
    if value <= 0 or value > 100:
        return
    low_percent_threshold = value
    emit_update(refresh_patients_snapshot())


@app.post("/api/settings/low-threshold")
@require_roles("admin")
def set_low_threshold_api():
    global low_percent_threshold
    data = request.get_json(silent=True) or {}
    try:
        value = float(data.get("low_percent_threshold"))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid low saline threshold"}), 400
    if value <= 0 or value > 100:
        return jsonify({"error": "invalid low saline threshold"}), 400
    low_percent_threshold = value
    emit_update(refresh_patients_snapshot())
    return jsonify({"ok": True})


@socketio.on("set_drip_mode")
def on_set_drip_mode(data):
    bed_id = (data or {}).get("bed_id")
    mode = (data or {}).get("drip_mode")
    if bed_id not in manager.patients:
        return
    if mode not in ("Slow", "Normal", "Fast"):
        return
    manager.set_drip_mode(bed_id, mode)
    emit_update(refresh_patients_snapshot())


@app.post("/api/patients/drip-mode")
@require_roles("admin", "nurse", "doctor")
def set_drip_mode_api():
    data = request.get_json(silent=True) or {}
    bed_id = data.get("bed_id")
    mode = data.get("drip_mode")
    if bed_id not in manager.patients:
        return jsonify({"error": "unknown bed"}), 404
    if mode not in ("Slow", "Normal", "Fast"):
        return jsonify({"error": "invalid drip mode"}), 400
    manager.set_drip_mode(bed_id, mode)
    emit_update(refresh_patients_snapshot())
    return jsonify({"ok": True})


@socketio.on("set_camera_roi")
def on_set_camera_roi(data):
    try:
        roi = {
            "x": float(data.get("x")),
            "y": float(data.get("y")),
            "w": float(data.get("w")),
            "h": float(data.get("h")),
        }
    except (TypeError, ValueError, AttributeError):
        return
    camera_monitor.set_roi(roi)


@app.post("/api/camera/set-roi")
@require_roles("admin")
def set_camera_roi_api():
    data = request.get_json(silent=True) or {}
    try:
        roi = {
            "x": float(data.get("x")),
            "y": float(data.get("y")),
            "w": float(data.get("w")),
            "h": float(data.get("h")),
        }
    except (TypeError, ValueError):
        return jsonify({"error": "invalid roi"}), 400
    camera_monitor.set_roi(roi)
    return jsonify({"ok": True})


@socketio.on("clear_camera_roi")
def on_clear_camera_roi():
    camera_monitor.set_roi(None)


@app.post("/api/camera/clear-roi")
@require_roles("admin")
def clear_camera_roi_api():
    camera_monitor.set_roi(None)
    return jsonify({"ok": True})


@socketio.on("send_test_mobile_alert")
def on_send_test_mobile_alert():
    send_notification("Test Alert: Saline Monitoring System is active.")


@app.post("/api/notifications/test")
@require_roles("admin")
def send_test_notification_api():
    send_notification("Test Alert: Saline Monitoring System is active.")
    return jsonify({"ok": True})


@socketio.on("set_bed_count")
def on_set_bed_count(data):
    # Single load cell deployment: ignore bed count changes.
    return


def serve_frontend(fallback_template=None):
    if os.path.exists(DIST_INDEX):
        return send_file(DIST_INDEX)
    if fallback_template:
        return render_template(fallback_template)
    return "Frontend build not found", 404


@app.route("/<path:path>")
def frontend_files(path):
    asset_path = os.path.join(DIST_DIR, path)
    if os.path.isfile(asset_path):
        return send_from_directory(DIST_DIR, path)
    if os.path.exists(DIST_INDEX):
        return send_file(DIST_INDEX)
    return "Frontend build not found", 404


if __name__ == "__main__":
    logger = DataLogger(LOG_PATH, lambda: manager.snapshot(), interval_seconds=5)
    logger.start()
    if ENABLE_CAMERA:
        camera_monitor.start()
    else:
        print("[Startup] Camera monitoring disabled. Set ENABLE_CAMERA=1 to enable it.")

    if ENABLE_SERIAL:
        threading.Thread(target=serial_reader, daemon=True).start()
    else:
        print("[Startup] Serial monitoring disabled. Set ENABLE_SERIAL=1 to enable it.")

    socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True)
