from collections import deque


_HISTORIES = {}


def _get_history(bed_id):
    if bed_id not in _HISTORIES:
        _HISTORIES[bed_id] = deque(maxlen=600)
    return _HISTORIES[bed_id]


def update_weight_history(bed_id, weight, timestamp):
    if weight is None or timestamp is None:
        return
    history = _get_history(bed_id)
    history.append({"t": timestamp, "w": weight})


def check_blockage(
    bed_id,
    current_weight,
    low_threshold_weight,
    min_change=1.0,
    duration_seconds=30,
):
    if current_weight is None or low_threshold_weight is None:
        return False

    if current_weight <= low_threshold_weight:
        return False

    history = _get_history(bed_id)
    if len(history) < 2:
        return False

    now = history[-1]["t"]
    cutoff = now - duration_seconds

    start_entry = None
    for entry in history:
        if entry["t"] <= cutoff:
            start_entry = entry
        else:
            break

    if start_entry is None:
        return False

    change = abs(current_weight - start_entry["w"])
    return change < min_change
