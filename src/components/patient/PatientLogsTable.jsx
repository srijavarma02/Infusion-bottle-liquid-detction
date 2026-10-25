import { DownloadIcon, TableIcon } from "../logs/LogsIcons";

function statusClass(status) {
  const normalized = String(status || "").toLowerCase().replace(/\s+/g, "-");
  if (normalized.includes("low")) {
    return "is-low";
  }
  if (normalized.includes("half")) {
    return "is-mid";
  }
  if (normalized.includes("full")) {
    return "is-ok";
  }
  return "is-unknown";
}

function PatientLogsTable({ rows, loading, error, downloadUrl }) {
  return (
    <section className="patient-panel patient-logs-panel">
      <div className="patient-panel__head">
        <div>
          <h2>My Logs</h2>
          <p>Only your personal infusion records are listed.</p>
        </div>
        <a className="patient-download-btn" href={downloadUrl}>
          <DownloadIcon />
          Download CSV
        </a>
      </div>

      {error ? <div className="patient-error-banner">{error}</div> : null}

      <div className="patient-table-shell">
        <table className="patient-log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Weight</th>
              <th>Flow Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`sk-${index}`}>
                  <td><span className="patient-cell-skeleton" /></td>
                  <td><span className="patient-cell-skeleton short" /></td>
                  <td><span className="patient-cell-skeleton short" /></td>
                  <td><span className="patient-cell-skeleton short" /></td>
                </tr>
              ))
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={`${row.timestamp}-${row.bed_id}`}>
                  <td>{row.timestamp || "--"}</td>
                  <td>{Number.isFinite(Number(row.weight)) ? `${Number(row.weight).toFixed(1)} g` : "--"}</td>
                  <td>{Number.isFinite(Number(row.flow_rate)) ? `${Number(row.flow_rate).toFixed(2)} g/min` : "--"}</td>
                  <td>
                    <span className={`patient-table-status ${statusClass(row.status)}`}>
                      {row.status || "Unknown"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  <div className="patient-empty-state inline">
                    <TableIcon />
                    <div>
                      <strong>No records yet</strong>
                      <span>Data will appear once new readings are logged.</span>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PatientLogsTable;
