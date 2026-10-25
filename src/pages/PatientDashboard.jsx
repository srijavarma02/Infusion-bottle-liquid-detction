import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AlertPanel from "../components/patient/AlertPanel";
import PatientHeader from "../components/patient/PatientHeader";
import PatientLogsTable from "../components/patient/PatientLogsTable";
import StatusCard from "../components/patient/StatusCard";
import TrendChart from "../components/patient/TrendChart";
import { useAuth } from "../context/AuthContext";
import useTheme from "../hooks/useTheme";
import "../styles/patient.css";

function relativeTimeLabel(lastRefreshAt, nowTick) {
  if (!lastRefreshAt) {
    return "just now";
  }
  const seconds = Math.max(0, Math.floor((nowTick - lastRefreshAt) / 1000));
  if (seconds <= 1) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds} seconds ago`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ago`;
}

function PatientDashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme, isDark } = useTheme();
  const { authFetch, logout, role, user, token } = useAuth();
  const [rows, setRows] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState({});
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveLoading, setLiveLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState(Date.now());
  const [nowTick, setNowTick] = useState(Date.now());

  const patient = useMemo(() => Object.values(patients)[0] || null, [patients]);
  const downloadUrl = token ? `/logs/download?access_token=${encodeURIComponent(token)}` : "/logs/download";

  useEffect(() => {
    document.title = "My Saline Monitoring";
  }, []);

  useEffect(() => {
    let active = true;

    const loadLive = async () => {
      try {
        const response = await authFetch("/api/live");
        if (!response.ok) {
          throw new Error(`Failed to load live data (${response.status})`);
        }
        const payload = await response.json();
        if (!active) {
          return;
        }

        setPatients(payload.patients || {});
        setAlerts(payload.alerts || []);
        setLiveConnected(true);
        setLiveLoading(false);
        setLastRefreshAt(Date.now());
      } catch {
        if (active) {
          setLiveConnected(false);
          setLiveLoading(false);
          setAlerts([]);
        }
      }
    };

    loadLive();
    const intervalId = window.setInterval(loadLive, 3000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [authFetch]);

  useEffect(() => {
    let active = true;

    const loadLogs = async () => {
      try {
        const response = await authFetch("/logs/data");
        if (!response.ok) {
          throw new Error(`Failed to load logs (${response.status})`);
        }
        const payload = await response.json();
        if (active) {
          setRows(Array.isArray(payload.rows) ? payload.rows : []);
          setLogsLoading(false);
          setError("");
        }
      } catch (loadError) {
        if (active) {
          setLogsLoading(false);
          setError(loadError.message);
        }
      }
    };

    loadLogs();
    const intervalId = window.setInterval(loadLogs, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [authFetch]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  if (role && role !== "patient") {
    return <Navigate to="/logs" replace />;
  }

  const subtitle = patient?.timestamp
    ? `Real-time infusion tracking. Reading timestamp: ${patient.timestamp}`
    : "Real-time infusion tracking";

  return (
    <div className={`patient-portal theme-${theme}`}>
      <div className="patient-portal__decor" />
      <main className="patient-portal__container">
        <PatientHeader
          userName={user?.name || user?.email || "Patient"}
          liveConnected={liveConnected}
          subtitle={subtitle}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          relativeUpdatedText={relativeTimeLabel(lastRefreshAt, nowTick)}
          onLogout={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        />

        <StatusCard patient={patient} loading={liveLoading} />

        <section className="patient-grid-2">
          <AlertPanel alerts={alerts} loading={liveLoading} />
          <TrendChart rows={rows} loading={logsLoading} />
        </section>

        <PatientLogsTable rows={rows} loading={logsLoading} error={error} downloadUrl={downloadUrl} />
      </main>
    </div>
  );
}

export default PatientDashboard;
