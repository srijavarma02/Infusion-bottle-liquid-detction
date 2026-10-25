import { Link } from "react-router-dom";

function Brand() {
  return (
    <Link to="/" className="brand">
      <div className="brand-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3C8.4 6.4 6 9.1 6 12.2C6 16 8.9 19 12.5 19C16.1 19 19 16.1 19 12.5C19 9.3 16.4 6.5 12 3Z" fill="white" />
        </svg>
      </div>
      <div>
        SmartSaline
        <small>FLUID MONITORING</small>
      </div>
    </Link>
  );
}

function HomeNavbar({
  isDark,
  isNavigating,
  menuOpen,
  onGetStarted,
  onNavigateSection,
  onToggleMenu,
  onToggleTheme,
}) {
  const handleSectionClick = (event, sectionId) => {
    event.preventDefault();
    onNavigateSection(sectionId);
  };

  return (
    <header>
      <div className="container nav">
        <Brand />
        <nav className={`nav-links${menuOpen ? " open" : ""}`}>
          <a href="#features" onClick={(event) => handleSectionClick(event, "#features")}>
            Features
          </a>
          <a href="#technology" onClick={(event) => handleSectionClick(event, "#technology")}>
            Technology
          </a>
          <a href="#dashboard" onClick={(event) => handleSectionClick(event, "#dashboard")}>
            Dashboard
          </a>
          <a href="#about" onClick={(event) => handleSectionClick(event, "#about")}>
            About
          </a>
        </nav>
        <div className="nav-actions">
          <button type="button" className="icon-button" aria-label="Toggle theme" onClick={onToggleTheme}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {isDark ? (
                <path
                  d="M12 18.5A6.5 6.5 0 1 0 12 5.5a6.5 6.5 0 0 0 0 13ZM12 2v2.2M12 19.8V22M4.22 4.22l1.56 1.56M18.22 18.22l1.56 1.56M2 12h2.2M19.8 12H22M4.22 19.78l1.56-1.56M18.22 5.78l1.56-1.56"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path d="M21 14.5C19.9 15.2 18.6 15.6 17.2 15.6C13.3 15.6 10.2 12.5 10.2 8.6C10.2 7.2 10.6 5.9 11.3 4.8C7.3 5.8 4.4 9.4 4.4 13.6C4.4 18.6 8.4 22.6 13.4 22.6C17.6 22.6 21.2 19.6 22.2 15.7C21.8 15.6 21.4 15.1 21 14.5Z" fill="currentColor" />
              )}
            </svg>
          </button>
          <button type="button" className="primary-btn" onClick={onGetStarted} disabled={isNavigating}>
            {isNavigating ? "Opening logs..." : "Get Started"}
          </button>
          <button type="button" className="menu-toggle" aria-label="Open menu" onClick={onToggleMenu}>
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}

export { Brand };
export default HomeNavbar;
