import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

type LoginProps = {
  onSwitchToRegister: () => void;
};

const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      login(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-root">
      <div className="container" style={{ maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <span style={{ fontSize: "1.8em", fontWeight: "bold", color: "#111827", whiteSpace: "nowrap" }}>🧠 Zenith MRI</span>
        </div>
        <h1 style={{ marginBottom: "12px" }}>Login</h1>
        <p className="subtitle" style={{ marginBottom: "18px" }}>
          Sign in to access Zenith MRI analysis.
        </p>
        <form onSubmit={onSubmit}>
          <div className="patient-name-container">
            <label className="patient-name-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              className="patient-name-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="patient-name-container">
            <label className="patient-name-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="patient-name-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-predict" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Login"}
          </button>
        </form>
        {error && <div className="error show">{`⚠️ Error: ${error}`}</div>}
        <div style={{ marginTop: "14px", textAlign: "center", color: "#666" }}>
          New user?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{
              border: "none",
              background: "transparent",
              color: "#667eea",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
