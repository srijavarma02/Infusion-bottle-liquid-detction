import csv
import os
import threading
import time


class DataLogger:
    def __init__(self, log_path, snapshot_fn, interval_seconds=5):
        self.log_path = log_path
        self.snapshot_fn = snapshot_fn
        self.interval_seconds = interval_seconds
        self._stop_event = threading.Event()
        self._thread = None

    def start(self):
        os.makedirs(os.path.dirname(self.log_path), exist_ok=True)
        if not os.path.exists(self.log_path):
            with open(self.log_path, "w", newline="", encoding="utf-8") as file:
                writer = csv.writer(file)
                writer.writerow(
                    [
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
                )
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()

    def _run(self):
        while not self._stop_event.is_set():
            self.log_once()
            self._stop_event.wait(self.interval_seconds)

    def log_once(self):
        snapshot = self.snapshot_fn()
        if not snapshot:
            return
        with open(self.log_path, "a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            for bed_id, data in snapshot.items():
                writer.writerow(
                    [
                        data.get("timestamp"),
                        bed_id,
                        data.get("weight"),
                        data.get("load_cell_percentage"),
                        data.get("camera_percentage"),
                        data.get("final_percentage"),
                        data.get("flow_rate"),
                        data.get("time_remaining"),
                        data.get("status"),
                        data.get("blockage_detected"),
                        data.get("drip_mode"),
                    ]
                )


def read_recent_logs(log_path, limit=100):
    if not os.path.exists(log_path):
        return []
    with open(log_path, "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        rows = list(reader)

    allowed_fields = [
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

    sanitized_rows = []
    for row in rows:
        sanitized_row = {field: row.get(field, "") for field in allowed_fields}
        has_timestamp = bool((sanitized_row["timestamp"] or "").strip())
        has_weight = bool((sanitized_row["weight"] or "").strip())
        if not has_timestamp and not has_weight:
          continue
        sanitized_rows.append(sanitized_row)

    return list(reversed(sanitized_rows[-limit:]))
