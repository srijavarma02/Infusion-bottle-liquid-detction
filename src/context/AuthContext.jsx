import { createContext, useContext, useEffect, useMemo, useState } from "react";

const TOKEN_KEY = "saline-auth-token";

const AuthContext = createContext(null);

async function parseJsonSafely(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const clearAuth = () => {
    setToken("");
    setUser(null);
    window.localStorage.removeItem(TOKEN_KEY);
  };

  const authFetch = async (input, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
      clearAuth();
    }
    return response;
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!token) {
        if (active) {
          setIsAuthLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const payload = await response.json();
        if (active) {
          setUser(payload.user || null);
        }
      } catch {
        if (active) {
          clearAuth();
        }
      } finally {
        if (active) {
          setIsAuthLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, [token]);

  const login = async (email, password) => {
    let response;
    try {
      response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error("Backend is not reachable. Start server on http://127.0.0.1:5000.");
    }

    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(payload?.error || "Unable to login");
    }
    if (!payload?.token || !payload?.user) {
      throw new Error("Invalid server response from login endpoint.");
    }

    setToken(payload.token);
    setUser(payload.user);
    window.localStorage.setItem(TOKEN_KEY, payload.token);
    return payload.user;
  };

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.role || "",
      patientId: user?.patient_id ?? null,
      isAuthenticated: Boolean(token && user),
      isAuthLoading,
      login,
      logout: clearAuth,
      authFetch,
    }),
    [token, user, isAuthLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthProvider, useAuth };
