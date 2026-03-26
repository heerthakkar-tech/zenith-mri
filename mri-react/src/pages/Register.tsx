import React, { useState } from "react";

type RegisterProps = {
  onSwitchToLogin: () => void;
};

const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      setSuccess("Registration successful. Please login.");
      setName("");
      setEmail("");
      setPassword("");
      setTimeout(() => onSwitchToLogin(), 700);
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
        <h1 style={{ marginBottom: "12px" }}>Register</h1>
        <p className="subtitle" style={{ marginBottom: "18px" }}>
          Create your Zenith account.
        </p>
        <form onSubmit={onSubmit}>
          <div className="patient-name-container">
            <label className="patient-name-label" htmlFor="register-name">
              Name
            </label>
            <input
              id="register-name"
              type="text"
              className="patient-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="patient-name-container">
            <label className="patient-name-label" htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              className="patient-name-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="patient-name-container">
            <label className="patient-name-label" htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              className="patient-name-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-predict" disabled={isLoading}>
            {isLoading ? "Creating..." : "Register"}
          </button>
        </form>
        {error && <div className="error show">{`⚠️ Error: ${error}`}</div>}
        {success && (
          <div className="result-container show" style={{ marginTop: "12px" }}>
            {success}
          </div>
        )}
        <div style={{ marginTop: "14px", textAlign: "center", color: "#666" }}>
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{
              border: "none",
              background: "transparent",
              color: "#667eea",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
