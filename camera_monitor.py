import threading
import time
from collections import deque

import cv2
import numpy as np
from ultralytics import YOLO


class CameraMonitor:
    def __init__(
        self,
        camera_index=0,
        process_interval=1.0,
        backend=None,
        model_path="best.pt",
    ):
        self.camera_index = camera_index
        self.process_interval = process_interval
        self.backend = backend
        self.model_path = model_path
        self._lock = threading.Lock()
        self._running = False
        self._thread = None
        self._latest_frame = None
        self._latest_percent = None
        self._roi = None  # normalized (x, y, w, h)
        self._percent_history = deque(maxlen=5)
        self._model = None

        try:
            self._model = YOLO(self.model_path)
        except Exception as exc:
            print(f"[Camera] YOLO model load failed: {exc}")
            self._model = None

    def _open_capture(self):
        candidates = []
        if self.backend is not None:
            candidates.append((self.camera_index, self.backend))
        candidates.append((self.camera_index, None))

        # Fallback scan helps discover virtual cameras (e.g., Camo) that are
        # not on the configured index/backend.
        fallback_indices = list(range(0, 12))
        fallback_backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, None]
        for idx in fallback_indices:
            for backend in fallback_backends:
                pair = (idx, backend)
                if pair not in candidates:
                    candidates.append(pair)

        for idx, backend in candidates:
            if backend is None:
                cap = cv2.VideoCapture(idx)
                backend_name = "ANY"
            else:
                cap = cv2.VideoCapture(idx, backend)
                backend_name = (
                    "DSHOW"
                    if backend == cv2.CAP_DSHOW
                    else "MSMF" if backend == cv2.CAP_MSMF else str(backend)
                )
            if cap.isOpened():
                ok, _ = cap.read()
                if ok:
                    print(
                        f"[Camera] Connected on index={idx} backend={backend_name}"
                    )
                    return cap
                cap.release()
        return None

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def get_latest(self):
        with self._lock:
            return self._latest_frame, self._latest_percent

    def set_roi(self, roi):
        with self._lock:
            if roi is None:
                self._roi = None
            else:
                self._roi = {
                    "x": max(0.0, min(1.0, roi.get("x", 0.0))),
                    "y": max(0.0, min(1.0, roi.get("y", 0.0))),
                    "w": max(0.0, min(1.0, roi.get("w", 1.0))),
                    "h": max(0.0, min(1.0, roi.get("h", 1.0))),
                }
            self._percent_history.clear()

    def _run(self):
        while self._running:
            cap = self._open_capture()
            if cap is None:
                print("[Camera] Unable to open webcam. Retrying in 3s...")
                time.sleep(3)
                continue

            disconnected = False
            ret, frame = cap.read()
            while self._running and ret:
                percent, overlay = self._process_frame(frame)
                with self._lock:
                    self._latest_frame = overlay
                    self._latest_percent = percent

                time.sleep(self.process_interval)
                ret, frame = cap.read()

            if not ret:
                disconnected = True

            cap.release()
            if disconnected and self._running:
                print("[Camera] Stream disconnected. Reconnecting...")

    def _process_frame(self, frame):
        h, w = frame.shape[:2]
        overlay = frame.copy()

        with self._lock:
            roi = self._roi

        if roi:
            x = int(roi["x"] * w)
            y = int(roi["y"] * h)
            rw = int(roi["w"] * w)
            rh = int(roi["h"] * h)
            x = max(0, min(w - 1, x))
            y = max(0, min(h - 1, y))
            rw = max(1, min(w - x, rw))
            rh = max(1, min(h - y, rh))
            roi_frame = frame[y : y + rh, x : x + rw]
            roi_h, roi_w = roi_frame.shape[:2]
            cv2.rectangle(overlay, (x, y), (x + rw, y + rh), (255, 255, 255), 1)
        else:
            x, y, rw, rh = 0, 0, w, h
            roi_frame = frame
            roi_h, roi_w = h, w

        if self._model is None:
            return None, overlay

        results = self._model(roi_frame, verbose=False)
        bottle_box = None
        liquid_box = None
        bottle_conf = 0.0
        liquid_conf = 0.0

        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                label = self._model.names.get(cls, str(cls))

                if label == "bottle" and conf > bottle_conf:
                    bottle_box = (x1, y1, x2, y2)
                    bottle_conf = conf
                if label == "liquid" and conf > liquid_conf:
                    liquid_box = (x1, y1, x2, y2)
                    liquid_conf = conf

                cv2.rectangle(roi_frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                cv2.putText(
                    roi_frame,
                    f"{label} {conf:.2f}",
                    (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 0, 0),
                    2,
                )

        if bottle_box and liquid_box:
            bx1, by1, bx2, by2 = bottle_box
            lx1, ly1, lx2, ly2 = liquid_box
            bottle_height = max(1, by2 - by1)
            liquid_height = max(0, ly2 - ly1)
            percent = (liquid_height / bottle_height) * 100.0
            percent = min(100.0, max(0.0, percent))

            self._percent_history.append(percent)
            smooth_percent = sum(self._percent_history) / len(self._percent_history)

            cv2.line(
                roi_frame,
                (bx1, ly1),
                (bx2, ly1),
                (0, 0, 255),
                2,
            )
            cv2.putText(
                roi_frame,
                f"Camera: {smooth_percent:.1f}%",
                (bx1, max(20, ly1 - 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2,
            )
        else:
            smooth_percent = None

        overlay[y : y + rh, x : x + rw] = roi_frame
        return smooth_percent, overlay
