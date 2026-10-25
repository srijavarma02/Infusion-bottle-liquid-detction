def calculate_flow_rate(readings, min_delta=0.5, window_size=20):
    if not readings or len(readings) < 2:
        return None

    recent = readings[-window_size:]
    if len(recent) < 2:
        return None

    # If total change over the window is negligible, treat flow as zero.
    total_change = recent[0]["w"] - recent[-1]["w"]
    if abs(total_change) < min_delta:
        return 0.0

    rates = []

    for i in range(1, len(recent)):
        prev = recent[i - 1]
        curr = recent[i]
        dt = curr["t"] - prev["t"]
        if dt <= 0:
            continue
        delta = prev["w"] - curr["w"]
        if abs(delta) < min_delta:
            continue
        rate = (delta / dt) * 60.0  # g/min
        if rate < 0:
            continue
        rates.append(rate)

    if not rates:
        return 0.0

    return sum(rates) / len(rates)


def predict_time_remaining(current_weight, full_bottle_weight, low_percent_threshold, flow_rate):
    if (
        current_weight is None
        or full_bottle_weight <= 0
        or low_percent_threshold <= 0
        or flow_rate is None
    ):
        return None

    if flow_rate < 0.5:
        return None

    low_weight = full_bottle_weight * (low_percent_threshold / 100.0)
    remaining_weight = current_weight - low_weight
    if remaining_weight <= 0:
        return 0.0

    return remaining_weight / flow_rate
