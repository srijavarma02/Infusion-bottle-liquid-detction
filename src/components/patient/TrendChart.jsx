import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

function TrendChart({ rows, loading }) {
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

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
            borderColor: "#3f9ff8",
            backgroundColor: "rgba(63, 159, 248, 0.18)",
            fill: true,
            tension: 0.42,
            pointRadius: 0,
            borderWidth: 2.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            displayColors: false,
          },
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 8, color: "#6f8ea8" },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#6f8ea8" },
            grid: { color: "rgba(109, 143, 170, 0.16)" },
          },
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

    const series = [...rows].reverse().slice(-36);
    chart.data.labels = series.map((row) => (row.timestamp || "").split(" ")[1] || row.timestamp || "");
    chart.data.datasets[0].data = series.map((row) => Number(row.weight) || 0);
    chart.update("none");
  }, [rows]);

  return (
    <section className="patient-panel patient-chart-panel">
      <div className="patient-panel__head">
        <h2>Weight Trend</h2>
        <p>Recent saline bottle weight history.</p>
      </div>
      <div className="patient-chart-wrap">
        {loading && (
          <div className="patient-chart-loading">
            <span>Loading trend...</span>
          </div>
        )}
        <canvas ref={chartCanvasRef} />
      </div>
    </section>
  );
}

export default TrendChart;
