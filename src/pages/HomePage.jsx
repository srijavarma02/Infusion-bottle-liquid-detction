import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HomeNavbar from "../components/home/HomeNavbar";
import {
  DashboardSection,
  FeaturesSection,
  HeroSection,
  HomeFooter,
  InfoSection,
  TechnologySection,
} from "../components/home/HomeSections";
import useTheme from "../hooks/useTheme";
import "../styles/home.css";

function HomePage() {
  const [isNavigating, setIsNavigating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isDark, theme, toggleTheme } = useTheme();

  useEffect(() => {
    document.title = "Smart Saline Monitoring System";
  }, []);

  const scrollToSection = (selector) => {
    const target = document.querySelector(selector);
    if (target) {
      target.classList.remove("section-spotlight");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        target.classList.add("section-spotlight");
        window.setTimeout(() => {
          target.classList.remove("section-spotlight");
        }, 1400);
      }, 250);
      setMenuOpen(false);
    }
  };

  const goToLogin = () => {
    setIsNavigating(true);
    window.setTimeout(() => {
      navigate("/login");
    }, 180);
  };

  return (
    <div className={`home-page theme-${theme}`}>
      <HomeNavbar
        isDark={isDark}
        isNavigating={isNavigating}
        menuOpen={menuOpen}
        onGetStarted={goToLogin}
        onNavigateSection={scrollToSection}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onToggleTheme={toggleTheme}
      />
      <main>
        <HeroSection
          isNavigating={isNavigating}
          onStartMonitoring={goToLogin}
          onWatchDemo={() => scrollToSection("#dashboard")}
        />
        <FeaturesSection />
        <DashboardSection />
        <TechnologySection onViewSpecs={() => scrollToSection("#technology")} />
        <InfoSection />
      </main>
      <HomeFooter onNavigateSection={scrollToSection} />
    </div>
  );
}

export default HomePage;
