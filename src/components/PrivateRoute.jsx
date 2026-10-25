import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

function PrivateRoute({ children }) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <div className="auth-boot-screen">Checking secure session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default PrivateRoute;
