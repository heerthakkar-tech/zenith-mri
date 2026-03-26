import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAuth } from "../context/AuthContext";

type DashboardStats = {
  total: number;
  glioma: number;
  pituitary: number;
  notumor: number;
};

type Prediction = {
  patientName: string;
  tumorType: string;
  createdAt: string;
};

type HistoryResponse = {
  predictions: Prediction[];
};

const COLORS = ["#ff6b6b", "#f59f00", "#51cf66"];



const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const headers: HeadersInit | undefined = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;
        const [statsRes, historyRes] = await Promise.all([
          fetch("http://localhost:3000/api/dashboard/stats", { headers }),
          fetch("http://localhost:3000/api/history", { headers }),
        ]);

        if (!statsRes.ok) {
          throw new Error("Failed to fetch dashboard stats");
        }
        if (!historyRes.ok) {
          throw new Error("Failed to fetch recent activity");
        }

        const statsData: DashboardStats = await statsRes.json();
        const historyData: HistoryResponse = await historyRes.json();

        setStats(statsData);
        setRecent((historyData.predictions || []).slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [token]);

  const pieData = useMemo(
    () => [
      { name: "Glioma", value: stats?.glioma ?? 0 },
      { name: "Pituitary", value: stats?.pituitary ?? 0 },
      { name: "No Tumor", value: stats?.notumor ?? 0 },
    ],
    [stats],
  );

  if (isLoading) {
    return (
      <div className="page-root">
        <div
          className="container"
          style={{ textAlign: "center", color: "#666" }}
        >
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-root">
        <div className="container">
          <div className="error show">{`⚠️ Error: ${error}`}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root">
      <div
        className="container"
      >
        <h1 style={{ marginBottom: "20px" }}>Dashboard</h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
            marginBottom: "30px",
          }}
        >
          <div className="card card-total" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "2em", lineHeight: 1 }}>📊</div>
            <div style={{ marginTop: "auto" }}>
              <div style={{ color: "#6b7280", fontSize: "0.95em", fontWeight: 600 }}>Total Scans</div>
              <div style={{ fontSize: "2.4em", fontWeight: "bold", color: "#111827", lineHeight: 1, marginTop: "8px" }}>
                {stats?.total ?? 0}
              </div>
            </div>
          </div>
          <div className="card card-glioma" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "2em", lineHeight: 1 }}>🔴</div>
            <div style={{ marginTop: "auto" }}>
              <div style={{ color: "#6b7280", fontSize: "0.95em", fontWeight: 600 }}>Glioma</div>
              <div style={{ fontSize: "2.4em", fontWeight: "bold", color: "#111827", lineHeight: 1, marginTop: "8px" }}>
                {stats?.glioma ?? 0}
              </div>
            </div>
          </div>
          <div className="card card-pituitary" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "2em", lineHeight: 1 }}>🟠</div>
            <div style={{ marginTop: "auto" }}>
              <div style={{ color: "#6b7280", fontSize: "0.95em", fontWeight: 600 }}>Pituitary</div>
              <div style={{ fontSize: "2.4em", fontWeight: "bold", color: "#111827", lineHeight: 1, marginTop: "8px" }}>
                {stats?.pituitary ?? 0}
              </div>
            </div>
          </div>
          <div className="card card-notumor" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "2em", lineHeight: 1 }}>🟢</div>
            <div style={{ marginTop: "auto" }}>
              <div style={{ color: "#6b7280", fontSize: "0.95em", fontWeight: 600 }}>No Tumor</div>
              <div style={{ fontSize: "2.4em", fontWeight: "bold", color: "#111827", lineHeight: 1, marginTop: "8px" }}>
                {stats?.notumor ?? 0}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: "30px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "24px", color: "#111827", fontSize: "1.5em", fontWeight: "bold" }}>
            Tumor Distribution
          </h3>
          <div style={{ width: "100%", height: "300px" }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: "24px", color: "#111827", fontSize: "1.5em", fontWeight: "bold" }}>
            Recent Activity
          </h3>
          {recent.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No recent activity.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recent.map((item, idx) => (
                <div
                  key={`${item.patientName}-${item.createdAt}-${idx}`}
                  style={{
                    padding: "16px 0",
                    borderBottom:
                      idx !== recent.length - 1 ? "1px solid #f3f4f6" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: "bold", color: "#111827" }}>
                    {item.patientName}
                  </span>
                  <span style={{ color: "#764ba2", fontWeight: "bold" }}>
                    {item.tumorType}
                  </span>
                  <span style={{ color: "#6b7280", fontSize: "0.9em" }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
