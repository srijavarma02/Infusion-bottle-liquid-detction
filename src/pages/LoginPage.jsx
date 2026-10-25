import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isAuthLoading, role } = useAuth();
  const [email, setEmail] = useState("nurse@test.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthLoading && isAuthenticated) {
    return <Navigate to={role === "patient" ? "/patient" : "/logs"} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const signedInUser = await login(email, password);
      const nextPath =
        location.state?.from?.pathname ||
        (signedInUser.role === "patient" ? "/patient" : "/logs");
      navigate(nextPath, { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__ambient login-page__ambient--blue" />
      <div className="login-page__ambient login-page__ambient--red" />

      <div className="login-card">
        <div className="login-card__eyebrow">Hospital Access Portal</div>
        <h1>Secure Saline Monitoring Login</h1>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@hospital.test"
              autoComplete="username"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="login-error">{error}</div> : null}

          <button type="submit" className="login-button" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
