const socket = io();

const patientGrid = document.getElementById("patientGrid");
const alertList = document.getElementById("alertList");
const chartBedSelect = document.getElementById("chartBedSelect");

const fullWeightInput = document.getElementById("fullWeightInput");
const fullWeightButton = document.getElementById("fullWeightButton");
const fullWeightHint = document.getElementById("fullWeightHint");
const lowPercentInput = document.getElementById("lowPercentInput");
const lowPercentButton = document.getElementById("lowPercentButton");
const lowPercentHint = document.getElementById("lowPercentHint");

const telegramStatus = document.getElementById("telegramStatus");
const telegramStatusPanel = document.getElementById("telegramStatusPanel");
const telegramTestButton = document.getElementById("telegramTestButton");

const cameraPercentText = document.getElementById("cameraPercentText");
const cameraFeed = document.getElementById("cameraFeed");
const roiBox = document.getElementById("roiBox");
const clearRoiButton = document.getElementById("clearRoiButton");

const metricWeight = document.getElementById("metricWeight");
const metricRemaining = document.getElementById("metricRemaining");
const metricFlow = document.getElementById("metricFlow");
const metricTime = document.getElementById("metricTime");
const metricDrip = document.getElementById("metricDrip");
const metricStatus = document.getElementById("metricStatus");

const gaugeValue = document.getElementById("gaugeValue");
const levelGauge = document.getElementById("levelGauge");
const bottleProgress = document.getElementById("bottleProgress");

const currentDateTime = document.getElementById("currentDateTime");
const systemStatusText = document.getElementById("systemStatusText");

const themeToggle = document.getElementById("themeToggle");

const STATUS_COLORS = {
  "Full": "var(--success)",
  "Half": "var(--warning)",
  "Low Saline": "var(--danger)",
  "Unknown": "#94a3b8",
};

const historyByBed = {};
let selectedBed = null;
let currentBedIds = [];

function createChart(ctx, label, color) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          borderColor: color,
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          tension: 0.3,
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: { ticks: { maxTicksLimit: 6 } },
        y: { beginAtZero: true },
      },
      plugins: { legend: { display: false } },
    },
  });
}

const weightChart = createChart(
  document.getElementById("weightChart").getContext("2d"),
  "Weight (g)",
  "#2563EB"
);
const flowChart = createChart(
  document.getElementById("flowChart").getContext("2d"),
  "Flow Rate (g/min)",
  "#16A34A"
);
const remainingChart = createChart(
  document.getElementById("remainingChart").getContext("2d"),
  "Remaining (%)",
  "#F59E0B"
);

function updateDateTime() {
  const now = new Date();
  currentDateTime.textContent = now.toLocaleString();
}

setInterval(updateDateTime, 1000);
updateDateTime();

function formatNumber(value, suffix, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return `${value.toFixed(digits)}${suffix}`;
}

function updateGauge(percent) {
  const value = Number.isFinite(percent) ? percent : 0;
  gaugeValue.textContent = `${value.toFixed(1)}%`;
  const angle = Math.max(0, Math.min(100, value)) * 3.6;
  levelGauge.style.background = `conic-gradient(var(--primary) ${angle}deg, rgba(148, 163, 184, 0.2) 0deg)`;
  bottleProgress.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function renderAlertList(alerts) {
  if (!alerts.length) {
    alertList.textContent = "No active alerts";
    return;
  }
  alertList.innerHTML = "";
  alerts.forEach((alert) => {
    const item = document.createElement("div");
    item.className = "alert-item";
    item.innerHTML = `<span class="alert-badge"></span><span>${alert}</span>`;
    alertList.appendChild(item);
  });
}

function updateChartsForBed(bedId) {
  if (!historyByBed[bedId]) return;
  const series = historyByBed[bedId];
  weightChart.data.labels = series.labels;
  weightChart.data.datasets[0].data = series.weight;
  flowChart.data.labels = series.labels;
  flowChart.data.datasets[0].data = series.flow;
  remainingChart.data.labels = series.labels;
  remainingChart.data.datasets[0].data = series.remaining;
  weightChart.update("none");
  flowChart.update("none");
  remainingChart.update("none");
}

function pushHistory(bedId, label, data) {
  if (!historyByBed[bedId]) {
    historyByBed[bedId] = { labels: [], weight: [], flow: [], remaining: [] };
  }
  const series = historyByBed[bedId];
  series.labels.push(label);
  series.weight.push(data.weight);
  series.flow.push(data.flow_rate ?? 0);
  series.remaining.push(data.final_percentage ?? 0);
  if (series.labels.length > 120) {
    series.labels.shift();
    series.weight.shift();
    series.flow.shift();
    series.remaining.shift();
  }
}

function renderPatientCard(bedId, data) {
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS["Unknown"];
  const card = document.createElement("div");
  card.className = "patient-card";
  card.innerHTML = `
    <div class="d-flex justify-content-between align-items-center">
      <div>
        <div class="patient-title">${bedId.toUpperCase()} - ${data.patient_id || ""}</div>
        <div class="patient-meta">
          Drip Mode:
          <select class="form-select form-select-sm drip-select" data-bed="${bedId}">
            <option value="Slow">Slow</option>
            <option value="Normal">Normal</option>
            <option value="Fast">Fast</option>
          </select>
        </div>
      </div>
      <div class="patient-status" style="background:${statusColor}20;color:${statusColor}">${data.status}</div>
    </div>
    <div class="patient-meta">Final Remaining: ${formatNumber(data.final_percentage, "%")}</div>
    <div class="patient-meta">Load Cell: ${formatNumber(data.load_cell_percentage, "%")}</div>
    <div class="patient-meta">Camera: ${formatNumber(data.camera_percentage, "%")}</div>
    <div class="patient-meta">Flow: ${formatNumber(data.flow_rate, " g/min")}</div>
    <div class="patient-meta">Blockage: ${data.blockage_detected ? "Detected" : "None"}</div>
    <div class="patient-meta">Sensor Mismatch: ${data.sensor_mismatch ? "Detected" : "None"}</div>
  `;
  const select = card.querySelector(".drip-select");
  if (select) {
    select.value = data.drip_mode || "Normal";
    select.addEventListener("change", (event) => {
      socket.emit("set_drip_mode", { bed_id: bedId, drip_mode: event.target.value });
    });
  }
  return card;
}

socket.on("patients_update", (payload) => {
  const patients = payload.patients || {};
  const alerts = payload.alerts || [];

  renderAlertList(alerts);

  if (payload.telegram_configured) {
    telegramStatus.textContent = "Telegram: Bot Connected";
    telegramStatusPanel.textContent = "Telegram Status: Bot Connected";
  } else {
    telegramStatus.textContent = "Telegram: Not configured";
    telegramStatusPanel.textContent = "Telegram Status: Not configured";
  }

  if (Number.isFinite(payload.full_bottle_weight)) {
    if (!document.activeElement || document.activeElement !== fullWeightInput) {
      fullWeightInput.value = payload.full_bottle_weight;
    }
    fullWeightHint.textContent = `Default full weight: ${payload.full_bottle_weight} g`;
  }
  if (Number.isFinite(payload.low_percent_threshold)) {
    if (!document.activeElement || document.activeElement !== lowPercentInput) {
      lowPercentInput.value = payload.low_percent_threshold;
    }
    lowPercentHint.textContent = `Current low threshold: ${payload.low_percent_threshold}%`;
  }

  const bedIds = Object.keys(patients).sort();
  currentBedIds = bedIds;
  if (bedIds.length && (!selectedBed || !bedIds.includes(selectedBed))) {
    selectedBed = bedIds[0];
  }

  chartBedSelect.innerHTML = "";
  bedIds.forEach((bedId) => {
    const option = document.createElement("option");
    option.value = bedId;
    option.textContent = bedId.toUpperCase();
    if (bedId === selectedBed) {
      option.selected = true;
    }
    chartBedSelect.appendChild(option);
  });

  patientGrid.innerHTML = "";
  bedIds.forEach((bedId) => {
    const data = patients[bedId];
    if (!data) return;
    patientGrid.appendChild(renderPatientCard(bedId, data));

    if (Number.isFinite(data.weight)) {
      const label = (data.timestamp || "").split(" ")[1] || "";
      pushHistory(bedId, label, data);
    }

    if (cameraPercentText && Number.isFinite(data.camera_percentage)) {
      cameraPercentText.textContent = `Camera Remaining: ${data.camera_percentage.toFixed(1)}%`;
    }
  });

  if (selectedBed && patients[selectedBed]) {
    const current = patients[selectedBed];
    metricWeight.textContent = formatNumber(current.weight, " g");
    metricRemaining.textContent = formatNumber(current.final_percentage, " %");
    metricFlow.textContent = formatNumber(current.flow_rate, " g/min");
    metricTime.textContent = Number.isFinite(current.time_remaining)
      ? `${Math.round(current.time_remaining)} min`
      : "--";
    metricDrip.textContent = current.drip_mode || "--";
    metricStatus.textContent = current.status || "--";
    updateGauge(current.final_percentage);
    updateChartsForBed(selectedBed);
  }

  systemStatusText.textContent = "System Online";
});

chartBedSelect.addEventListener("change", (event) => {
  selectedBed = event.target.value;
  updateChartsForBed(selectedBed);
});

fullWeightButton.addEventListener("click", () => {
  const value = Number.parseFloat(fullWeightInput.value);
  if (!Number.isFinite(value) || value <= 0) {
    fullWeightHint.textContent = "Enter a valid positive number.";
    return;
  }
  socket.emit("set_full_weight", { full_bottle_weight: value });
});

lowPercentButton.addEventListener("click", () => {
  const value = Number.parseFloat(lowPercentInput.value);
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    lowPercentHint.textContent = "Enter a valid percent between 1 and 100.";
    return;
  }
  socket.emit("set_low_percent_threshold", { low_percent_threshold: value });
});

telegramTestButton.addEventListener("click", () => {
  socket.emit("send_test_mobile_alert");
});

let roiStart = null;
let roiActive = false;

function setRoiBox(rect) {
  if (!roiBox) return;
  roiBox.classList.remove("hidden");
  roiBox.style.left = `${rect.x}px`;
  roiBox.style.top = `${rect.y}px`;
  roiBox.style.width = `${rect.w}px`;
  roiBox.style.height = `${rect.h}px`;
}

function clearRoiBox() {
  if (!roiBox) return;
  roiBox.classList.add("hidden");
}

if (cameraFeed) {
  cameraFeed.addEventListener("mousedown", (event) => {
    const rect = cameraFeed.getBoundingClientRect();
    roiStart = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    roiActive = true;
  });

  cameraFeed.addEventListener("mousemove", (event) => {
    if (!roiActive || !roiStart) return;
    const rect = cameraFeed.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const rx = Math.min(roiStart.x, x);
    const ry = Math.min(roiStart.y, y);
    const rw = Math.abs(x - roiStart.x);
    const rh = Math.abs(y - roiStart.y);
    setRoiBox({ x: rx, y: ry, w: rw, h: rh });
  });

  cameraFeed.addEventListener("mouseup", (event) => {
    if (!roiActive || !roiStart) return;
    const rect = cameraFeed.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const rx = Math.min(roiStart.x, x);
    const ry = Math.min(roiStart.y, y);
    const rw = Math.abs(x - roiStart.x);
    const rh = Math.abs(y - roiStart.y);
    roiActive = false;
    if (rw < 10 || rh < 10) {
      clearRoiBox();
      return;
    }
    setRoiBox({ x: rx, y: ry, w: rw, h: rh });
    socket.emit("set_camera_roi", {
      x: rx / rect.width,
      y: ry / rect.height,
      w: rw / rect.width,
      h: rh / rect.height,
    });
  });
}

if (clearRoiButton) {
  clearRoiButton.addEventListener("click", () => {
    clearRoiBox();
    socket.emit("clear_camera_roi");
  });
}

if (themeToggle) {
  const storedTheme = localStorage.getItem("theme") || "light";
  document.body.classList.toggle("theme-dark", storedTheme === "dark");
  themeToggle.checked = storedTheme === "dark";

  themeToggle.addEventListener("change", () => {
    const isDark = themeToggle.checked;
    document.body.classList.toggle("theme-dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

if (window.bootstrap) {
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll("[data-bs-toggle=\"tooltip\"]")
  );
  tooltipTriggerList.map((tooltipTriggerEl) => new window.bootstrap.Tooltip(tooltipTriggerEl));
}
