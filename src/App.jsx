import { Navigate, Route, Routes } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import LogsPage from "./pages/LogsPage";
import PatientDashboard from "./pages/PatientDashboard";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomePage />} />
      <Route
        path="/logs"
        element={
          <PrivateRoute>
            <LogsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/patient"
        element={
          <PrivateRoute>
            <PatientDashboard />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
