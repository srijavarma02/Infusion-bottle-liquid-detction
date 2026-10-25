import { Link } from "react-router-dom";
import {
  featureCards,
  footerColumns,
  heroCards,
  infoCards,
  techCards,
  techHighlights,
} from "./data";
import { Brand } from "./HomeNavbar";

const demoActivities = [
  {
    ward: "Ward 204A",
    patient: "Patient #1847",
    badge: "Low Level",
    badgeClass: "status-low",
    icon: "!",
    iconStyle: { background: "#fff3e5", color: "#e8590c" },
    time: "2 min ago",
  },
  {
    ward: "ICU-5B",
    patient: "Patient #2103",
    badge: "Replaced",
    badgeClass: "status-ok",
    icon: "+",
    iconStyle: { background: "#eafbf1", color: "#15803d" },
    time: "18 min ago",
  },
  {
    ward: "Ward 308C",
    patient: "Patient #1956",
    badge: "Monitoring",
    badgeClass: "status-mon",
    icon: "~",
    iconStyle: { background: "#edf4ff", color: "#1e63ff" },
    time: "35 min ago",
  },
  {
    ward: "ICU-2A",
    patient: "Patient #2087",
    badge: "Critical Alert",
    badgeClass: "status-crit",
    icon: "!",
    iconStyle: { background: "#ffe9ec", color: "#e11d48" },
    time: "1 hr ago",
  },
];

const demoDistribution = [
  { label: "75-100% (Optimal)", summary: "142 bottles (57%)", width: "57%", background: "#22c55e" },
  { label: "50-75% (Good)", summary: "68 bottles (28%)", width: "28%", background: "#2b6bff" },
  { label: "25-50% (Low)", summary: "31 bottles (13%)", width: "13%", background: "#ff7a2f" },
  { label: "0-25% (Critical)", summary: "6 bottles (2%)", width: "2%", background: "#ef4444" },
];

const demoPatients = [
  { bedId: "BED1", status: "Full", percent: "92.0%", weight: "496.4 g", flow: "18.4 g/min", timeLeft: "88 min" },
  { bedId: "BED2", status: "Half", percent: "58.3%", weight: "314.2 g", flow: "14.1 g/min", timeLeft: "41 min" },
  { bedId: "BED3", status: "Low Saline", percent: "14.8%", weight: "79.7 g", flow: "12.6 g/min", timeLeft: "9 min" },
];

function getStatusClass(status) {
  if (status === "Low Saline") return "status-low";
  if (status === "Full") return "status-ok";
  if (status === "Half") return "status-mon";
  return "status-crit";
}

export function HeroSection({ isNavigating, onStartMonitoring, onWatchDemo }) {
  return (
    <section className="hero">
      <div className="container">
        <span className="pill">Live Dashboard</span>
        <h1>
          Smart Saline Bottle <span>Fluid Monitoring System</span>
        </h1>
        <p>
          Real-time monitoring with intelligent alerts for intravenous fluid
          administration. Enhance patient safety and reduce nursing workload with
          precision IoT technology.
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="primary-btn"
            onClick={onStartMonitoring}
            disabled={isNavigating}
          >
            {isNavigating ? "Opening logs..." : "Start Monitoring"}
          </button>
          <button type="button" className="ghost-btn" onClick={onWatchDemo}>
            Watch Demo
          </button>
        </div>
        <div className="hero-cards">
          {heroCards.map((card) => (
            <div key={card.title} className="mini-card">
              <div className="mini-icon" style={{ background: card.background }}>
                {card.icon}
              </div>
              <div>
                <h4>{card.title}</h4>
                <p>{card.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturesSection() {
  return (
    <section className="core-features" id="features">
      <div className="container">
        <span className="pill">Core Features</span>
        <h2 className="section-title">
          Everything you need for <span>intelligent fluid monitoring</span>
        </h2>
        <p className="section-subtitle">
          Clinical-grade technology engineered to improve patient outcomes, reduce
          nursing burden, and optimize hospital operations.
        </p>
        <div className="feature-grid">
          {featureCards.map((card) => (
            <article key={card.title} className="feature-card">
              <div className="feature-icon" style={{ background: card.background }}>
                {card.icon}
              </div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DashboardSection() {
  return (
    <section className="dashboard" id="dashboard">
      <div className="container">
        <span className="pill">Live Dashboard</span>
        <h2 className="section-title">
          Monitor everything <span>at a glance</span>
        </h2>
        <p className="section-subtitle">
          Intuitive, real-time interface purpose-built for healthcare professionals.
          Actionable insights that drive better patient outcomes.
        </p>

        <div className="stats-row">
          <div className="stat-card stat-blue">
            <h4>Active Monitors</h4>
            <strong>247</strong>
            <span>+12.5% vs last week</span>
          </div>
          <div className="stat-card stat-orange">
            <h4>Critical Alerts</h4>
            <strong>3</strong>
            <span>2 resolved | avg 8 min</span>
          </div>
          <div className="stat-card stat-green">
            <h4>System Uptime</h4>
            <strong>99.99%</strong>
            <span>Operational | 30 days</span>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="panel">
            <div className="panel-header">
              <h4>Recent Activity</h4>
              <Link
                to="/logs"
                className="pill"
                style={{ background: "#f3f4f6", color: "#6b7280", borderColor: "#e5e7eb" }}
              >
                View All
              </Link>
            </div>
            {demoActivities.map((activity, index) => (
              <div
                key={`${activity.ward}-${activity.time}`}
                className="activity-item"
                style={index === demoActivities.length - 1 ? { marginBottom: 0 } : undefined}
              >
                <div className="mini-icon" style={activity.iconStyle}>
                  {activity.icon}
                </div>
                <div>
                  <strong>{activity.ward}</strong>
                  <div className="muted-inline">{activity.patient}</div>
                </div>
                <span className={`status-pill ${activity.badgeClass}`}>{activity.badge}</span>
                <span className="time-inline">{activity.time}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h4>Fluid Level Distribution</h4>
              <a
                href="/logs/download"
                className="pill"
                style={{ background: "#f3f4f6", color: "#6b7280", borderColor: "#e5e7eb" }}
              >
                Export
              </a>
            </div>
            {demoDistribution.map((level) => (
              <div key={level.label} className="bar-row">
                <div className="bar-label">
                  <strong>{level.label}</strong>
                  <span>{level.summary}</span>
                </div>
                <div className="bar">
                  <span style={{ width: level.width, background: level.background }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="live-patient-grid">
          {demoPatients.map((patient) => (
            <article key={patient.bedId} className="live-patient-card">
              <div className="live-patient-header">
                <h4>{patient.bedId}</h4>
                <span className={`status-pill ${getStatusClass(patient.status)}`}>
                  {patient.status}
                </span>
              </div>
              <p>Remaining: {patient.percent}</p>
              <p>Weight: {patient.weight}</p>
              <p>Flow: {patient.flow}</p>
              <p>Time Left: {patient.timeLeft}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TechnologySection({ onViewSpecs }) {
  return (
    <section className="technology" id="technology">
      <div className="container technology-container">
        <div>
          <span
            className="pill"
            style={{ background: "#eafbf1", color: "#16a34a", borderColor: "#c7f0d4" }}
          >
            Technology Stack
          </span>
          <h2 className="section-title">
            Built on <span>cutting-edge technology</span>
          </h2>
          <p className="section-subtitle">
            Our system leverages enterprise-grade IoT infrastructure, real-time
            data processing, and machine learning algorithms to deliver medical-grade
            accuracy and reliability.
          </p>
          <ul className="tech-list">
            {techHighlights.map(([title, text]) => (
              <li key={title}>
                <div className="check">+</div>
                {title} <span>{text}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="primary-btn" onClick={onViewSpecs}>
            View Technical Specs
          </button>
        </div>
        <div className="tech-grid">
          {techCards.map((card) => (
            <div key={card.title} className="tech-card">
              <div className="feature-icon" style={{ background: card.background }}>
                {card.icon}
              </div>
              <h4>{card.title}</h4>
              <ul>
                {card.items.map((item) => (
                  <li key={item}>
                    <span className="dot" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function InfoSection() {
  return (
    <section className="info-cards" id="about">
      <div className="container">
        <div className="info-grid">
          {infoCards.map((card) => (
            <article key={card.title} className="info-card">
              <div className="feature-icon" style={{ background: card.background }}>
                {card.icon}
              </div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeFooter({ onNavigateSection }) {
  const footerLinkMap = {
    Features: { type: "section", value: "#features" },
    Dashboard: { type: "section", value: "#dashboard" },
    Technology: { type: "section", value: "#technology" },
    Documentation: { type: "route", value: "/logs" },
    "API Reference": { type: "route", value: "/logs" },
    "Support Center": { type: "route", value: "/logs" },
    "About Us": { type: "section", value: "#about" },
    "Contact Us": { type: "section", value: "#about" },
  };

  const renderFooterLink = (link, columnTitle) => {
    const target = footerLinkMap[link];
    const linkContent = (
      <>
        {link}
        {columnTitle === "Company" && link === "Careers" ? (
          <span className="hiring-badge">Hiring</span>
        ) : null}
      </>
    );

    if (!target) return <a href="#about">{linkContent}</a>;
    if (target.type === "route") return <a href={target.value}>{linkContent}</a>;

    return (
      <a
        href={target.value}
        onClick={(event) => {
          event.preventDefault();
          onNavigateSection(target.value);
        }}
      >
        {linkContent}
      </a>
    );
  };

  const handleAboutClick = (event) => {
    event.preventDefault();
    onNavigateSection("#about");
  };

  return (
    <footer>
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>
            Advancing patient safety through intelligent IoT monitoring. Trusted by
            healthcare facilities worldwide.
          </p>
          <div className="socials">
            <a href="#about" aria-label="Twitter" onClick={handleAboutClick}>
              X
            </a>
            <a href="#about" aria-label="LinkedIn" onClick={handleAboutClick}>
              in
            </a>
            <a href="/logs" aria-label="Logs">
              []
            </a>
            <a href="mailto:support@smartsaline.local" aria-label="Email">
              @
            </a>
          </div>
        </div>
        {footerColumns.map((column) => (
          <div key={column.title} className="footer-links">
            <h4>{column.title}</h4>
            <ul>
              {column.links.map((link) => (
                <li key={link}>{renderFooterLink(link, column.title)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>© 2026 SmartSaline Inc. All rights reserved. FDA Class II Medical Device.</span>
        <nav>
          <a href="#about" onClick={handleAboutClick}>Privacy Policy</a>
          <a href="#about" onClick={handleAboutClick}>Terms of Service</a>
          <a href="#about" onClick={handleAboutClick}>HIPAA Compliance</a>
        </nav>
      </div>
    </footer>
  );
}
