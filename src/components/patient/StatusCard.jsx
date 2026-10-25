import { ClockIcon, FlowIcon, PercentIcon, WeightIcon } from "../logs/LogsIcons";

function formatValue(value, suffix, digits = 1) {
  if (!Number.isFinite(Number(value))) {
    return "--";
  }
  return `${Number(value).toFixed(digits)}${suffix}`;
}

function progressTone(progressValue) {
  if (progressValue <= 20) {
    return "critical";
  }
  if (progressValue <= 40) {
    return "warning";
  }
  return "safe";
}

function StatusCard({ patient, loading }) {
  const remaining = Number.isFinite(Number(patient?.final_percentage))
    ? Math.max(0, Math.min(100, Number(patient.final_percentage)))
    : 0;
  const tone = progressTone(remaining);
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (remaining / 100) * circumference;

  return (
    <article className={`patient-status-card tone-${tone}`}>
      <div className="patient-status-card__overlay" />
      <div className="patient-status-card__main">
        <div className="patient-status-card__ring-wrap">
          <svg viewBox="0 0 200 200" className="patient-progress-ring" aria-label="Remaining saline percentage">
            <circle cx="100" cy="100" r={radius} className="patient-progress-ring__track" />
            <circle
              cx="100"
              cy="100"
              r={radius}
              className="patient-progress-ring__bar"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div className="patient-progress-ring__label">
            <span>Remaining</span>
            <strong>{loading ? "--" : `${remaining.toFixed(1)}%`}</strong>
          </div>
        </div>

        <div className="patient-status-card__metrics">
          <div className={`patient-metric-card ${loading ? "is-loading" : ""}`}>
            <div className="patient-metric-card__icon">
              <WeightIcon />
            </div>
            <span>Current Weight</span>
            <strong>{loading ? "Loading..." : formatValue(patient?.weight, " g", 1)}</strong>
          </div>

          <div className={`patient-metric-card ${loading ? "is-loading" : ""}`}>
            <div className="patient-metric-card__icon">
              <FlowIcon />
            </div>
            <span>Flow Rate</span>
            <strong>{loading ? "Loading..." : formatValue(patient?.flow_rate, " g/min", 2)}</strong>
          </div>

          <div className={`patient-metric-card ${loading ? "is-loading" : ""}`}>
            <div className="patient-metric-card__icon">
              <ClockIcon />
            </div>
            <span>Estimated Time Left</span>
            <strong>
              {loading
                ? "Loading..."
                : Number.isFinite(Number(patient?.time_remaining))
                ? `${Math.max(0, Math.round(Number(patient.time_remaining)))} min`
                : "--"}
            </strong>
          </div>

          <div className={`patient-metric-card ${loading ? "is-loading" : ""}`}>
            <div className="patient-metric-card__icon">
              <PercentIcon />
            </div>
            <span>Status</span>
            <strong>{loading ? "Loading..." : patient?.status || "Unknown"}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}

export default StatusCard;
