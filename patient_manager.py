from collections import deque


class PatientManager:
    def __init__(self, bed_count=3, history_size=300):
        self.bed_count = bed_count
        self.history_size = history_size
        self.bed_ids = [f"bed{idx}" for idx in range(1, bed_count + 1)]
        self._index = 0
        self.patients = {}
        self.histories = {}
        for bed_id in self.bed_ids:
            bed_number = bed_id.replace("bed", "")
            self.patients[bed_id] = {
                "patient_id": f"patient_{bed_number}",
                "bed_number": bed_number,
                "weight": None,
                "percentage_remaining": None,
                "load_cell_percentage": None,
                "camera_percentage": None,
                "final_percentage": None,
                "flow_rate": None,
                "time_remaining": None,
                "status": "Unknown",
                "blockage_detected": False,
                "sensor_mismatch": False,
                "drip_mode": "Normal",
                "flow_status": "calculating",
                "flow_warning": False,
                "flow_warning_text": "",
            }
            self.histories[bed_id] = deque(maxlen=history_size)

    def get_next_bed_id(self):
        bed_id = self.bed_ids[self._index]
        self._index = (self._index + 1) % len(self.bed_ids)
        return bed_id

    def update_reading(self, bed_id, weight, timestamp):
        self.patients[bed_id]["weight"] = weight
        self.histories[bed_id].append({"t": timestamp, "w": weight})

    def set_drip_mode(self, bed_id, mode):
        if bed_id in self.patients:
            self.patients[bed_id]["drip_mode"] = mode

    def get_history(self, bed_id):
        return list(self.histories.get(bed_id, []))

    def snapshot(self):
        return {bed_id: dict(data) for bed_id, data in self.patients.items()}
