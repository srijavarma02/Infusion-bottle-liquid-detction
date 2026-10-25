import { BellIcon } from "../logs/LogsIcons";

function getAlertSeverity(text) {
  const normalized = String(text || "").toLowerCase();
  if (normalized.includes("critical") || normalized.includes("block") || normalized.includes("empty")) {
    return "critical";
  }
  return "warning";
}

function AlertPanel({ alerts, loading }) {
  return (
    <section className="patient-panel patient-alert-panel">
      <div className="patient-panel__head">
        <h2>Alerts</h2>
        <p>Only your infusion alerts are shown here.</p>
      </div>

      {loading ? (
        <div className="patient-alert-skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : alerts.length ? (
        <div className="patient-alert-list">
          {alerts.map((alert) => {
            const severity = getAlertSeverity(alert);
            return (
              <article key={alert} className={`patient-alert-card ${severity}`}>
                <span className="patient-alert-card__dot" />
                <div className="patient-alert-card__body">
                  <span className="patient-alert-card__label">
                    {severity === "critical" ? "Critical Alert" : "Warning"}
                  </span>
                  <strong>{alert}</strong>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="patient-empty-state">
          <BellIcon />
          <div>
            <strong>No active alerts</strong>
            <span>Your saline flow looks stable right now.</span>
          </div>
        </div>
      )}
    </section>
  );
}

export default AlertPanel;
