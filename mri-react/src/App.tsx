import React, { useCallback, useEffect, useState } from "react";
import History from "./components/History";
import jsPDF from "jspdf";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
type PredictionResponse = {
  prediction: string;
  confidence: number;
  heatmap?: string;
  imageUrl?: string;
};

const App: React.FC = () => {
  const { token, logout, user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [showHistory, setShowHistory] = useState(
    window.location.pathname === "/history",
  );
  const [showDashboard, setShowDashboard] = useState(
    window.location.pathname === "/dashboard",
  );
  const [showProfile, setShowProfile] = useState(
    window.location.pathname === "/profile",
  );
  const [authView, setAuthView] = useState<"login" | "register">("login");

  useEffect(() => {
    const onPopState = () => {
      setShowDashboard(window.location.pathname === "/dashboard");
      setShowHistory(window.location.pathname === "/history");
      setShowProfile(window.location.pathname === "/profile");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleFileSelect = useCallback(
    (file: File | null) => {
      setSelectedFile(file);
      setResult(null);
      setError(null);

      // Clean up previous preview URL to prevent memory leaks
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      if (file) {
        setFileName(`Selected: ${file.name}`);
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setFileName("");
        setPreviewUrl(null);
      }
    },
    [previewUrl],
  );

  const handlePatientNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPatientName(event.target.value);
      setError(null);
    },
    [],
  );

  const onFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!patientName.trim()) {
        setError("Please enter a patient name");
        return;
      }

      if (!selectedFile) {
        setError("Please select an image file");
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("patientName", patientName.trim());

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = await fetch("http://localhost:3000/api/predict", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || "Failed to get prediction from server",
          );
        }

        const data: PredictionResponse = await response.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        setLoading(false);
      }
    },
    [selectedFile, patientName, token],
  );

  const confidencePercent =
    result && typeof result.confidence === "number"
      ? Math.max(0, Math.min(100, result.confidence * 100))
      : 0;

  const getTumorDescription = (prediction: string) => {
    const lowerPrediction = prediction.toLowerCase();
    if (lowerPrediction.includes("glioma")) {
      return "Gliomas originate from glial cells in the brain and may affect brain function depending on their size and location.";
    } else if (lowerPrediction.includes("meningioma")) {
      return "Meningiomas develop in the meninges surrounding the brain and are typically slow growing but may require monitoring.";
    } else if (lowerPrediction.includes("pituitary")) {
      return "Pituitary tumors occur in the pituitary gland and may affect hormone production.";
    } else if (
      lowerPrediction.includes("notumor") ||
      lowerPrediction.includes("no tumor") ||
      lowerPrediction.includes("normal")
    ) {
      return "No tumor detected. The MRI scan appears normal.";
    }
    return "";
  };

  const handleDownloadReport = useCallback(() => {
    const generatePdfReport = async () => {
      if (!result || !patientName) return;

      console.log("Selected File:", selectedFile);

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      const reportDate = new Date();
      const dateString = reportDate.toLocaleDateString();
      const reportId = `MRI-${new Date().getTime()}`;
      const isNoTumor =
        result.prediction.toLowerCase().includes("notumor") ||
        result.prediction.toLowerCase().includes("no tumor") ||
        result.prediction.toLowerCase().includes("normal");

      const fileToBase64 = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () =>
            reject(new Error("Failed to read MRI image file"));
          reader.readAsDataURL(file);
        });
      const toDataUrlFromImageUrl = async (url: string): Promise<string> => {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) {
          throw new Error(`Failed to fetch image (${response.status})`);
        }
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      let y = 18;
      const ensureSpace = (heightNeeded: number) => {
        if (y + heightNeeded > pageHeight - 28) {
          doc.addPage();
          y = 18;
        }
      };

      // Header section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(33, 37, 41);
      doc.text("Zenith — Enhancing Brain Tumor Detection with AI", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(`Report ID: ${reportId}`, margin, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 90);
      doc.text("MRI Analysis Report", margin, y);
      y += 5;
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Patient information section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      doc.text("Patient Information", margin, y);
      y += 4;

      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, y, contentWidth, 32, 1.5, 1.5, "FD");

      const labelX = margin + 5;
      const valueX = margin + 50;
      let infoY = y + 8;
      const infoRows: Array<[string, string]> = [
        ["Patient Name", patientName],
        ["Tumor Type (Diagnosis)", result.prediction],
        ["Confidence", `${confidencePercent.toFixed(1)}%`],
        ["Date of Analysis", dateString],
      ];

      doc.setFontSize(10.5);
      infoRows.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(70, 70, 70);
        doc.text(label, labelX, infoY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(25, 25, 25);
        doc.text(value, valueX, infoY);
        infoY += 7;
      });
      y += 40;

      // MRI section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      doc.text("MRI Scan", margin, y);
      y += 4;

      const imageSectionY = y;
      const imageBoxHeight = 100;
      doc.setDrawColor(225, 225, 225);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(
        margin,
        imageSectionY,
        contentWidth,
        imageBoxHeight,
        2,
        2,
        "FD",
      );

      if (selectedFile) {
        try {
          const imageData = await fileToBase64(selectedFile);
          const imageInfo = doc.getImageProperties(imageData);
          const maxImageWidth = contentWidth - 12;
          const maxImageHeight = imageBoxHeight - 12;
          const ratio = Math.min(
            maxImageWidth / imageInfo.width,
            maxImageHeight / imageInfo.height,
          );

          const renderWidth = imageInfo.width * ratio;
          const renderHeight = imageInfo.height * ratio;
          const imageX = margin + (contentWidth - renderWidth) / 2;
          const imageY = imageSectionY + (imageBoxHeight - renderHeight) / 2;
          const imageFormat =
            selectedFile.type === "image/png" ? "PNG" : "JPEG";

          doc.addImage(
            imageData,
            imageFormat,
            imageX,
            imageY,
            renderWidth,
            renderHeight,
          );
        } catch (error) {
          console.error("Failed to embed MRI image in PDF", error);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          doc.setTextColor(120, 120, 120);
          doc.text("MRI image unavailable", pageWidth / 2, imageSectionY + 46, {
            align: "center",
          });
        }
      }
      y += imageBoxHeight + 10;

      // Heatmap section (skip if missing)
      if (result.heatmap) {
        ensureSpace(112);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(33, 37, 41);
        doc.text("Tumor Highlight Heatmap", margin, y);
        y += 4;

        const heatmapSectionY = y;
        const heatmapBoxHeight = 95;
        doc.setDrawColor(225, 225, 225);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(
          margin,
          heatmapSectionY,
          contentWidth,
          heatmapBoxHeight,
          2,
          2,
          "FD",
        );

        try {
          const heatmapUrl = `http://localhost:3000${result.heatmap}`;
          console.log("Heatmap URL:", heatmapUrl);
          const heatmapData = await toDataUrlFromImageUrl(heatmapUrl);
          const heatmapInfo = doc.getImageProperties(heatmapData);
          const maxHeatmapWidth = contentWidth - 12;
          const maxHeatmapHeight = heatmapBoxHeight - 12;
          const ratio = Math.min(
            maxHeatmapWidth / heatmapInfo.width,
            maxHeatmapHeight / heatmapInfo.height,
          );
          const renderWidth = heatmapInfo.width * ratio;
          const renderHeight = heatmapInfo.height * ratio;
          const imageX = margin + (contentWidth - renderWidth) / 2;
          const imageY =
            heatmapSectionY + (heatmapBoxHeight - renderHeight) / 2;
          const imageFormat = heatmapData.startsWith("data:image/png")
            ? "PNG"
            : "JPEG";
          doc.addImage(
            heatmapData,
            imageFormat,
            imageX,
            imageY,
            renderWidth,
            renderHeight,
          );
        } catch (error) {
          console.error("Heatmap load failed:", error);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          doc.setTextColor(120, 120, 120);
          doc.text("Heatmap unavailable", margin + 5, heatmapSectionY + 12);
        }

        y += heatmapBoxHeight + 10;
      }

      // Tumor description section
      const tumorDescription = getTumorDescription(result.prediction);
      if (tumorDescription) {
        ensureSpace(42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(33, 37, 41);
        doc.text("Tumor Description", margin, y);
        y += 4;

        const descriptionLines = doc.splitTextToSize(
          tumorDescription,
          contentWidth - 10,
        );
        const descriptionHeight = Math.max(
          22,
          descriptionLines.length * 5 + 10,
        );
        doc.setDrawColor(232, 232, 232);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(
          margin,
          y,
          contentWidth,
          descriptionHeight,
          1.5,
          1.5,
          "FD",
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(55, 55, 55);
        doc.text(descriptionLines, margin + 5, y + 7);
        y += descriptionHeight + 10;
      }

      // Result highlight section
      ensureSpace(34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(33, 37, 41);
      doc.text("Result Summary", margin, y);
      y += 4;

      const resultColor: [number, number, number] = isNoTumor
        ? [34, 139, 34]
        : [198, 40, 40];
      doc.setDrawColor(232, 232, 232);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(resultColor[0], resultColor[1], resultColor[2]);
      doc.text(`Diagnosis: ${result.prediction}`, margin + 5, y + 9);
      doc.setTextColor(25, 25, 25);
      doc.text(
        `Confidence: ${confidencePercent.toFixed(1)}%`,
        margin + 5,
        y + 18,
      );

      // Footer section
      const footerY = pageHeight - 18;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.4);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(125, 125, 125);
      doc.text("Generated by Zenith AI System", margin, footerY);
      doc.text(
        `Timestamp: ${reportDate.toLocaleString()}`,
        pageWidth - margin,
        footerY,
        {
          align: "right",
        },
      );

      doc.save(`${patientName.replace(/\s+/g, "_")}_MRI_Report.pdf`);
    };

    void generatePdfReport();
  }, [result, patientName, confidencePercent, selectedFile]);

  if (!token) {
    return authView === "login" ? (
      <Login onSwitchToRegister={() => setAuthView("register")} />
    ) : (
      <Register onSwitchToLogin={() => setAuthView("login")} />
    );
  }

  return (
    <>
      <div className="navbar">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "1.4em", fontWeight: "bold", color: "#111827", whiteSpace: "nowrap" }}>🧠 Zenith MRI</span>
          {user && (
            <span style={{ color: "#6b7280", fontWeight: 500, paddingLeft: "16px", borderLeft: "2px solid #e5e7eb", whiteSpace: "nowrap" }}>
              {user.name}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "nowrap" }}>
        <button
          className="secondary-btn"
          onClick={() => {
            const next = !showDashboard;
            setShowDashboard(next);
            setShowHistory(false);
            setShowProfile(false);
            window.history.pushState({}, "", next ? "/dashboard" : "/");
          }}
        >
          {showDashboard ? "Back to Analysis" : "Dashboard"}
        </button>
        <button
          className="secondary-btn"
          onClick={() => {
            const next = !showHistory;
            setShowHistory(next);
            setShowDashboard(false);
            setShowProfile(false);
            window.history.pushState({}, "", next ? "/history" : "/");
          }}
        >
          {showHistory ? "Back to Analysis" : "View History"}
        </button>
        <button
          className="secondary-btn"
          onClick={() => {
            const next = !showProfile;
            setShowProfile(next);
            setShowDashboard(false);
            setShowHistory(false);
            window.history.pushState({}, "", next ? "/profile" : "/");
          }}
        >
          {showProfile ? "Back to Analysis" : "Profile"}
        </button>
        <button
          className="secondary-btn"
          onClick={() => {
            logout();
            setShowHistory(false);
            setShowDashboard(false);
            setShowProfile(false);
            window.history.pushState({}, "", "/");
          }}
          style={{
            borderColor: "#fecaca",
            color: "#ef4444",
            background: "#fef2f2",
            fontWeight: "bold"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#fee2e2";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#fef2f2";
          }}
        >
          Logout
        </button>
        </div>
      </div>

      {showProfile ? (
        <Profile />
      ) : showDashboard ? (
        <Dashboard />
      ) : showHistory ? (
        <History />
      ) : (
        <div className="page-root">
          <div className="container">
            <h1>🧠 Brain Tumor MRI Classifier</h1>
            <p className="subtitle">
              Upload an MRI scan for AI-powered analysis
            </p>

            <form onSubmit={onSubmit}>
              <div className="patient-name-container">
                <label htmlFor="patient-name" className="patient-name-label">
                  Patient Name
                </label>
                <input
                  id="patient-name"
                  type="text"
                  className="patient-name-input"
                  placeholder="Enter patient name"
                  value={patientName}
                  onChange={handlePatientNameChange}
                  required
                  disabled={loading}
                />
              </div>

              <div
                className={`upload-area ${isDragging ? "dragover" : ""} ${previewUrl ? "has-preview" : ""}`}
                style={{
                  position: "relative",
                  padding: previewUrl ? "20px" : "40px",
                }}
                onDragEnter={previewUrl ? undefined : onDragOver}
                onDragOver={previewUrl ? undefined : onDragOver}
                onDragLeave={previewUrl ? undefined : onDragLeave}
                onDrop={previewUrl ? undefined : onDrop}
                onClick={() => {
                  if (!previewUrl) {
                    const input = document.getElementById(
                      "file-input",
                    ) as HTMLInputElement | null;
                    input?.click();
                  }
                }}
              >
                {!previewUrl ? (
                  <>
                    <div className="upload-icon">📤</div>
                    <div className="upload-text">
                      Click to upload or drag and drop
                    </div>
                    <div
                      className="upload-text"
                      style={{ fontSize: "0.85em", color: "#999" }}
                    >
                      Supported: JPG, PNG, JPEG
                    </div>
                    <input
                      id="file-input"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={onFileInputChange}
                    />
                    <div className="file-name">{fileName}</div>
                  </>
                ) : (
                  <div
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: "100%",
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Clear the selected file
                        handleFileSelect(null);

                        // Also clear the file input value so selecting the same file again triggers onChange
                        const input = document.getElementById(
                          "file-input",
                        ) as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      style={{
                        position: "absolute",
                        top: "-10px",
                        right: "-10px",
                        background: "#ff4444",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "30px",
                        height: "30px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                        zIndex: 2,
                      }}
                      title="Remove image"
                    >
                      ✕
                    </button>
                    <img
                      src={previewUrl}
                      alt="MRI Preview"
                      style={{
                        width: "100%",
                        maxHeight: "280px",
                        borderRadius: "10px",
                        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                    <div className="file-name" style={{ marginTop: "10px" }}>
                      {fileName}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn-predict"
                disabled={loading || !selectedFile || !patientName.trim()}
                style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}
              >
                {loading && <span className="btn-spinner"></span>}
                {loading ? "Analyzing..." : "Analyze MRI Scan"}
              </button>
            </form>

            {loading && <div className="loader show" />}

            {error && <div className="error show">{`⚠️ Error: ${error}`}</div>}

            {result && (
              <>
                <div className="result-container card show">
                  <div className="result-title">📊 Analysis Results</div>
                  <div className="result-item">
                    <span className="result-label">Diagnosis:</span>
                    <span className="result-value">{result.prediction}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Confidence:</span>
                    <span className="result-value">
                      {confidencePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                </div>

                {getTumorDescription(result.prediction) && (
                  <div
                    className="result-container card show"
                    style={{ marginTop: "24px" }}
                  >
                    <div className="result-title">ℹ️ Tumor Information</div>
                    <p
                      style={{
                        color: "#555",
                        lineHeight: "1.5",
                        fontSize: "0.95em",
                      }}
                    >
                      {getTumorDescription(result.prediction)}
                    </p>
                  </div>
                )}

                {result.heatmap && (
                  <div
                    className="result-container card show"
                    style={{ marginTop: "24px", textAlign: "center" }}
                  >
                    <div className="result-title">
                      🔍 Tumor Highlight Heatmap
                    </div>
                    <img
                      src={`http://localhost:3000${result.heatmap}`}
                      alt="Grad-CAM Heatmap Overlay"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        borderRadius: "10px",
                        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                        objectFit: "contain",
                        marginTop: "10px",
                      }}
                    />
                  </div>
                )}

                <div style={{ textAlign: "center", marginTop: "30px" }}>
                  <button
                    onClick={handleDownloadReport}
                    className="primary-btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    📄 Download Medical Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default App;
