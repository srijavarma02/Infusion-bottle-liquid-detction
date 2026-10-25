import { MoonIcon, PatientIcon, SunIcon } from "../logs/LogsIcons";

function PatientHeader({
  userName,
  liveConnected,
  subtitle,
  isDark,
  onToggleTheme,
  onLogout,
  relativeUpdatedText,
}) {
  return (
    <header className="patient-header-card">
      <div className="patient-header-card__left">
        <span className="patient-header-card__kicker">Patient Portal</span>
        <h1>My Saline Monitoring</h1>
        <p>{subtitle}</p>
      </div>

      <div className="patient-header-card__right">
        <div className={`patient-connection-pill ${liveConnected ? "is-live" : "is-offline"}`}>
          <span className="patient-connection-pill__dot" />
          {liveConnected ? "Live" : "Disconnected"}
        </div>
        <div className="patient-role-pill">
          <PatientIcon />
          Patient
        </div>
        <div className="patient-name-chip">{userName || "Patient"}</div>
        <button
          type="button"
          className="patient-theme-toggle"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button type="button" className="patient-logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="patient-header-card__timestamp">Last updated: {relativeUpdatedText}</div>
    </header>
  );
}

export default PatientHeader;
