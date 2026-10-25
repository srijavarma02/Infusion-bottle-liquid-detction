import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Chart } from "chart.js/auto";
import AlertCard from "../components/logs/AlertCard";
import CameraPanel from "../components/logs/CameraPanel";
import ChartSection from "../components/logs/ChartSection";
import {
  BellIcon,
  ClockIcon,
  DownloadIcon,
  FlowIcon,
  MoonIcon,
  PatientIcon,
  PercentIcon,
  SettingsIcon,
  SunIcon,
  TableIcon,
  WeightIcon,
} from "../components/logs/LogsIcons";
import LogsTable from "../components/logs/LogsTable";
import PatientCard from "../components/logs/PatientCard";
import SettingsPanel from "../components/logs/SettingsPanel";
import SummaryCard from "../components/logs/SummaryCard";
import { useAuth } from "../context/AuthContext";
import useTheme from "../hooks/useTheme";
import "../styles/logs.css";

function formatValue(value, suffix, digits = 1) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return `${value.toFixed(digits)}${suffix}`;
}

function LogsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme, isDark } = useTheme();
  const { authFetch, logout, role, user, token } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [patients, setPatients] = useState({});
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveLoading, setLiveLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState("");
  const [historyByBed, setHistoryByBed] = useState({});
  const [fullWeightInput, setFullWeightInput] = useState("");
  const [fullWeightHint, setFullWeightHint] = useState("Default full weight: 539 g");
  const [lowPercentInput, setLowPercentInput] = useState("");
  const [lowPercentHint, setLowPercentHint] = useState("Default low threshold: 15%");
  const [telegramStatus, setTelegramStatus] = useState("Telegram Status: Not configured");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraPercentText, setCameraPercentText] = useState("Camera Remaining: --%");
  const [roiRect, setRoiRect] = useState(null);
  const [isSavingFullWeight, setIsSavingFullWeight] = useState(false);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [adminInsights, setAdminInsights] = useState(null);

  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const cameraFeedRef = useRef(null);
  const roiStartRef = useRef(null);
  const roiActiveRef = useRef(false);

  const bedIds = useMemo(() => Object.keys(patients).sort(), [patients]);
  const isAdmin = role === "admin";
  const canAdjustDripMode = role === "admin" || role === "nurse" || role === "doctor";
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
  const downloadUrl = token ? `/logs/download?access_token=${encodeURIComponent(token)}` : "/logs/download";
  const selectedPatient = useMemo(
    () => patients[selectedBed] || patients[bedIds[0]] || null,
    [patients, selectedBed, bedIds]
  );

  if (role === "patient") {
    return <Navigate to="/patient" replace />;
  }

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Current Weight",
        value: formatValue(Number(selectedPatient?.weight), " g"),
        helper: selectedPatient?.timestamp ? `Updated ${selectedPatient.timestamp}` : "Awaiting sensor data",
        icon: <WeightIcon />,
        accent: "blue",
      },
      {
        label: "Remaining %",
        value: formatValue(Number(selectedPatient?.final_percentage), "%"),
        helper: "Combined infusion estimate",
        icon: <PercentIcon />,
        accent: "teal",
      },
      {
        label: "Flow Rate",
        value: formatValue(Number(selectedPatient?.flow_rate), " g/min"),
        helper: selectedPatient?.flow_warning ? selectedPatient.flow_warning_text : "Within expected range",
        icon: <FlowIcon />,
        accent: "violet",
      },
      {
        label: "Estimated Time Left",
        value: Number.isFinite(Number(selectedPatient?.time_remaining))
          ? `${Math.max(0, Math.round(Number(selectedPatient.time_remaining)))} min`
          : "--",
        helper: selectedPatient?.status ? `Status: ${selectedPatient.status}` : "Prediction pending",
        icon: <ClockIcon />,
        accent: "amber",
      },
    ];
  }, [selectedPatient]);

  useEffect(() => {
    document.title = "Live Saline Monitoring";
  }, []);

  useEffect(() => {
    let active = true;

    const loadLiveState = async () => {
      try {
        const response = await authFetch("/api/live");
        if (!response.ok) {
          throw new Error(`Failed to load live state (${response.status})`);
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        const nextPatients = payload.patients || {};
        const nextBedIds = Object.keys(nextPatients).sort();

        setLiveConnected(true);
        setLiveLoading(false);
        setAlerts(payload.alerts || []);
        setPatients(nextPatients);
        setCameraEnabled(Boolean(payload.camera_enabled));
        setTelegramStatus(
          payload.telegram_configured
            ? "Telegram Status: Bot Connected"
            : "Telegram Status: Not configured"
        );

        if (Number.isFinite(payload.full_bottle_weight)) {
          setFullWeightInput(String(payload.full_bottle_weight));
          setFullWeightHint(`Current full weight: ${payload.full_bottle_weight} g`);
        }

        if (Number.isFinite(payload.low_percent_threshold)) {
          setLowPercentInput(String(payload.low_percent_threshold));
          setLowPercentHint(`Current low threshold: ${payload.low_percent_threshold}%`);
        }

        setSelectedBed((current) => {
          if (current && nextBedIds.includes(current)) {
            return current;
          }
          return nextBedIds[0] || "";
        });

        setHistoryByBed((previousHistory) => {
          const nextHistory = { ...previousHistory };

          nextBedIds.forEach((bedId) => {
            const patient = nextPatients[bedId];
            const label = (patient?.timestamp || "").split(" ")[1] || "";
            const weight = Number(patient?.weight);

            if (!nextHistory[bedId]) {
              nextHistory[bedId] = [];
            }

            if (!Number.isFinite(weight) || !label) {
              return;
            }

            const lastPoint = nextHistory[bedId][nextHistory[bedId].length - 1];
            if (lastPoint && lastPoint.label === label && lastPoint.value === weight) {
              return;
            }

            nextHistory[bedId] = [...nextHistory[bedId], { label, value: weight }].slice(-120);
          });

          return nextHistory;
        });

        const spotlightPatient = nextPatients[selectedBed] || nextPatients[nextBedIds[0]];
        if (spotlightPatient && Number.isFinite(spotlightPatient.camera_percentage)) {
          setCameraPercentText(
            `Camera Remaining: ${Number(spotlightPatient.camera_percentage).toFixed(1)}%`
          );
        } else {
          setCameraPercentText("Camera Remaining: --%");
        }
      } catch {
        if (active) {
          setLiveConnected(false);
          setLiveLoading(false);
          setAlerts([]);
        }
      }
    };

    loadLiveState();
    const intervalId = window.setInterval(loadLiveState, 2000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [authFetch, selectedBed]);

  useEffect(() => {
    let active = true;

    const loadLogs = async () => {
      try {
        const response = await authFetch("/logs/data");
        if (!response.ok) {
          throw new Error(`Failed to load logs (${response.status})`);
        }
        const data = await response.json();
        if (active) {
          setRows(Array.isArray(data.rows) ? data.rows : []);
          setError("");
        }
      } catch (loadError) {
        if (active) {
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
    if (!isAdmin) {
      setAdminInsights(null);
      return undefined;
    }

    let active = true;
    const loadAdminInsights = async () => {
      try {
        const response = await authFetch("/api/admin/analytics");
        if (!response.ok) {
          throw new Error("Failed to load admin analytics");
        }
        const payload = await response.json();
        if (active) {
          setAdminInsights(payload);
        }
      } catch {
        if (active) {
          setAdminInsights(null);
        }
      }
    };

    loadAdminInsights();
    const intervalId = window.setInterval(loadAdminInsights, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [authFetch, isAdmin]);

  useEffect(() => {
    if (!chartCanvasRef.current) {
      return undefined;
    }

    const chart = new Chart(chartCanvasRef.current, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Weight (g)",
            data: [],
            borderColor: "#41a1ff",
            backgroundColor: "rgba(65, 161, 255, 0.18)",
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        scales: {
          x: {
            ticks: { maxTicksLimit: 8, color: "#7b92a7" },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#7b92a7" },
            grid: { color: "rgba(115, 143, 166, 0.12)" },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: "index", intersect: false },
        },
      },
    });

    chartInstanceRef.current = chart;

    return () => {
      chart.destroy();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) {
      return;
    }

    const series = historyByBed[selectedBed] || [];
    chart.data.labels = series.map((point) => point.label);
    chart.data.datasets[0].data = series.map((point) => point.value);
    chart.update("none");
  }, [historyByBed, selectedBed]);

  const handleApplyFullWeight = async () => {
    setIsSavingFullWeight(true);
    const value = Number.parseFloat(fullWeightInput);
    if (!Number.isFinite(value) || value <= 0) {
      setFullWeightHint("Please enter a valid positive number.");
      setIsSavingFullWeight(false);
      return;
    }

    try {
      await authFetch("/api/settings/full-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_bottle_weight: value }),
      });
      setFullWeightHint(`Saved full weight: ${value} g`);
    } finally {
      setIsSavingFullWeight(false);
    }
  };

  const handleApplyLowThreshold = async () => {
    setIsSavingThreshold(true);
    const value = Number.parseFloat(lowPercentInput);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      setLowPercentHint("Enter a valid percent between 1 and 100.");
      setIsSavingThreshold(false);
      return;
    }

    try {
      await authFetch("/api/settings/low-threshold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ low_percent_threshold: value }),
      });
      setLowPercentHint(`Saved threshold: ${value}%`);
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const handleSendTelegramTest = async () => {
    setIsTestingTelegram(true);
    try {
      await authFetch("/api/notifications/test", { method: "POST" });
      setTelegramStatus("Telegram Status: Test alert sent");
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleDripModeChange = async (bedId, dripMode) => {
    await authFetch("/api/patients/drip-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bed_id: bedId, drip_mode: dripMode }),
    });
  };

  const setRoiFromEvent = (event, commit = false) => {
    const image = cameraFeedRef.current;
    if (!image || !roiStartRef.current) {
      return;
    }

    const rect = image.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const rx = Math.min(roiStartRef.current.x, x);
    const ry = Math.min(roiStartRef.current.y, y);
    const rw = Math.abs(x - roiStartRef.current.x);
    const rh = Math.abs(y - roiStartRef.current.y);

    if (rw < 10 || rh < 10) {
      if (commit) {
        setRoiRect(null);
      }
      return;
    }

    const nextRect = { x: rx, y: ry, w: rw, h: rh };
    setRoiRect(nextRect);

    if (commit) {
      authFetch("/api/camera/set-roi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: rx / rect.width,
          y: ry / rect.height,
          w: rw / rect.width,
          h: rh / rect.height,
        }),
      });
    }
  };

  const handleCameraMouseDown = (event) => {
    const image = cameraFeedRef.current;
    if (!image) {
      return;
    }

    const rect = image.getBoundingClientRect();
    roiStartRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    roiActiveRef.current = true;
  };

  const handleCameraMouseMove = (event) => {
    if (!roiActiveRef.current) {
      return;
    }
    setRoiFromEvent(event);
  };

  const handleCameraMouseUp = (event) => {
    if (!roiActiveRef.current) {
      return;
    }
    roiActiveRef.current = false;
    setRoiFromEvent(event, true);
  };

  const handleResetRoi = () => {
    setRoiRect(null);
    authFetch("/api/camera/clear-roi", { method: "POST" });
  };

  return (
    <div className={`logs-page theme-${theme}`}>
      <header className="app-header glass-panel">
        <div className="title-block">
          <div className="page-kicker">Critical Care Dashboard</div>
          <div className="title">Live Saline Monitoring</div>
          <div className="subtitle">Real-time infusion intelligence for bedside monitoring</div>
        </div>

        <div className="topbar-actions">
          <div className={`connection-pill ${liveConnected ? "is-live" : "is-offline"}`}>
            <span className="connection-pill__dot" />
            {liveConnected ? "Live" : "Disconnected"}
          </div>
          <div className={`role-pill role-pill--${role || "unknown"}`}>
            {roleLabel}
          </div>
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            className="logout-button"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Logout
          </button>
          <nav className="nav-links">
            <Link to="/">Dashboard</Link>
            <Link className="active" to="/logs">
              Logs
            </Link>
          </nav>
        </div>
      </header>

      <main className="dashboard">
        <section className="hero-grid">
          <div className="hero-copy premium-card">
            <div className="section-heading__eyebrow">Overview</div>
            <h1>Premium ward intelligence for saline delivery.</h1>
            <p>
              Monitor infusion performance, catch abnormal flow earlier, and keep the nursing
              team focused on the patients who need attention first.
            </p>
            <div className="hero-copy__meta">
              <span className="hero-chip">
                <PatientIcon />
                {bedIds.length || 1} monitored bed
              </span>
              <span className="hero-chip">
                <BellIcon />
                {alerts.length} active alerts
              </span>
              <span className="hero-chip">
                <TableIcon />
                {rows.length} log rows
              </span>
            </div>
          </div>

          <div className="summary-grid">
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                value={card.value}
                helper={card.helper}
                accent={card.accent}
                loading={liveLoading}
              />
            ))}
          </div>
        </section>

        <section className="alert-panel-shell">
          <div className="section-heading">
            <div>
              <div className="section-heading__eyebrow">Alerts</div>
              <h2>Attention Required</h2>
            </div>
          </div>

          <div className="alert-stack">
            {alerts.length ? (
              alerts.map((alert) => <AlertCard key={alert} alert={alert} />)
            ) : (
              <div className="alert-empty premium-card">
                <BellIcon />
                <div>
                  <strong>No active alerts</strong>
                  <span>All monitored infusion lines are currently stable.</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="content-grid">
          <div className="content-grid__main">
            <div className="section-heading">
              <div>
                <div className="section-heading__eyebrow">Patient</div>
                <h2>Active Infusion Card</h2>
              </div>
            </div>

            <div className="patient-grid">
              {bedIds.length ? (
                bedIds.map((bedId) => (
                  <PatientCard
                    key={bedId}
                    bedId={bedId}
                    patient={patients[bedId]}
                    onDripModeChange={handleDripModeChange}
                    canManage={canAdjustDripMode}
                  />
                ))
              ) : (
                <section className="premium-card empty-placeholder">
                  <PatientIcon />
                  <div>
                    <strong>No patient data received yet.</strong>
                    <span>The dashboard will populate once the backend receives readings.</span>
                  </div>
                </section>
              )}
            </div>

            <ChartSection
              chartCanvasRef={chartCanvasRef}
              bedIds={bedIds}
              selectedBed={selectedBed}
              onSelectBed={setSelectedBed}
            />

            {cameraEnabled ? (
              <CameraPanel
                cameraFeedRef={cameraFeedRef}
                roiRect={roiRect}
                cameraPercentText={cameraPercentText}
                onMouseDown={handleCameraMouseDown}
                onMouseMove={handleCameraMouseMove}
                onMouseUp={handleCameraMouseUp}
                onMouseLeave={() => {
                  roiActiveRef.current = false;
                }}
                onResetRoi={handleResetRoi}
              />
            ) : null}

            <LogsTable rows={rows} error={error} downloadUrl={downloadUrl} />
          </div>

          <div className="content-grid__side">
            <div className="sticky-column">
              <div className="mini-toolbar premium-card">
                <div className="mini-toolbar__item">
                  <SettingsIcon />
                  <div>
                    <span>System status</span>
                    <strong>{liveConnected ? "Operational" : "Reconnecting"}</strong>
                  </div>
                </div>
                <a className="download-button download-button--ghost" href={downloadUrl}>
                  <DownloadIcon />
                  Export CSV
                </a>
              </div>

              <div className="role-summary premium-card">
                <div className="section-heading__eyebrow">Signed In</div>
                <strong>{user?.name || user?.email}</strong>
                <span>{user?.email}</span>
                <div className={`role-pill role-pill--${role || "unknown"}`}>{roleLabel}</div>
              </div>

              {isAdmin ? (
                <>
                  {adminInsights ? (
                    <div className="admin-insights premium-card">
                      <div className="section-heading__eyebrow">Admin Insight</div>
                      <div className="admin-insights__grid">
                        <div>
                          <span>Avg. Weight</span>
                          <strong>{formatValue(Number(adminInsights.average_weight), " g")}</strong>
                        </div>
                        <div>
                          <span>Critical Alerts</span>
                          <strong>{adminInsights.critical_alerts ?? 0}</strong>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <SettingsPanel
                    fullWeightInput={fullWeightInput}
                    setFullWeightInput={setFullWeightInput}
                    fullWeightHint={fullWeightHint}
                    lowPercentInput={lowPercentInput}
                    setLowPercentInput={setLowPercentInput}
                    lowPercentHint={lowPercentHint}
                    onApplyFullWeight={handleApplyFullWeight}
                    onApplyLowThreshold={handleApplyLowThreshold}
                    onSendTelegramTest={handleSendTelegramTest}
                    isSavingFullWeight={isSavingFullWeight}
                    isSavingThreshold={isSavingThreshold}
                    isTestingTelegram={isTestingTelegram}
                    telegramStatus={telegramStatus}
                  />
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LogsPage;
