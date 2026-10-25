def get_expected_range(mode):
    ranges = {
        "Slow": (1.0, 2.0),
        "Normal": (3.0, 5.0),
        "Fast": (6.0, 8.0),
    }
    return ranges.get(mode, ranges["Normal"])


def validate_flow_rate(flow_rate, mode):
    if flow_rate is None:
        return "calculating"

    min_rate, max_rate = get_expected_range(mode)
    if flow_rate < min_rate:
        return "low"
    if flow_rate > max_rate:
        return "high"
    return "ok"
