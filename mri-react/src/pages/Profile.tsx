import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

type Prediction = {
  createdAt: string;
};

type HistoryResponse = {
  count: number;
  predictions: Prediction[];
};

const Profile: React.FC = () => {
  const { user, token } = useAuth();
  const [totalScans, setTotalScans] = useState<number>(0);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/history", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error("Failed to fetch history");
        }
        const result: HistoryResponse = await response.json();
        setTotalScans(result.count);
        
        if (result.predictions && result.predictions.length > 0) {
          // Find the most recent date
          const dates = result.predictions.map(p => new Date(p.createdAt).getTime());
          const maxDate = new Date(Math.max(...dates));
          setLastActivity(maxDate.toLocaleString());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchHistory();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  if (!user) {
    return null;
  }

  // Use type assertion to access optional fields that might be returned from backend
  const userInfo: any = user;

  return (
    <div className="page-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: '600px', width: '100%' }}>
        <h1 style={{ textAlign: "center", marginBottom: "30px" }}>User Profile</h1>
        
        <div className="card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ color: '#6b7280', margin: '0 0 5px 0', fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: '24px' }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Name:</span>
              <span style={{ color: '#111827' }}>{user.name}</span>
              
              <span style={{ fontWeight: 600, color: '#374151' }}>Email:</span>
              <span style={{ color: '#111827' }}>{user.email}</span>
              
              {userInfo.createdAt && (
                <>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Account Created:</span>
                  <span style={{ color: '#6b7280' }}>
                    {new Date(userInfo.createdAt).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>
          
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />
          
          <div>
            <h3 style={{ color: '#6b7280', margin: '0 0 5px 0', fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity Statistics</h3>
            
            {isLoading ? (
              <div style={{ color: "#666", padding: "10px 0" }}>Loading statistics...</div>
            ) : error ? (
              <div className="error show" style={{ marginTop: '10px' }}>⚠️ Error: {error}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: '24px' }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>Total Scans:</span>
                <span style={{ color: '#764ba2', fontWeight: 'bold', fontSize: '1.2em' }}>{totalScans}</span>
                
                <span style={{ fontWeight: 600, color: '#374151' }}>Last Activity:</span>
                <span style={{ color: '#6b7280' }}>{lastActivity || "No activity yet"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
