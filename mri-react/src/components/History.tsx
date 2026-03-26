import React, { useState, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import { useAuth } from "../context/AuthContext";

type Prediction = {
  _id: string;
  patientName: string;
  tumorType: string;
  confidence: number;
  createdAt: string;
  imageUrl?: string;
  heatmap?: string;
};

type HistoryResponse = {
  count: number;
  predictions: Prediction[];
};

const History: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("All");

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
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [token]);

  const generatePdfBlob = useCallback(async (pred: Prediction) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    const createdAt = new Date(pred.createdAt);
    const dateString = createdAt.toLocaleDateString();
    const timestamp = new Date().toLocaleString();
    const reportId = `MRI-${new Date().getTime()}`;
    const confidencePercent = Math.max(
      0,
      Math.min(100, (pred.confidence ?? 0) * 100),
    );

    const tumorTypeLower = String(pred.tumorType ?? "").toLowerCase();
    const isNoTumor =
      tumorTypeLower.includes("notumor") ||
      tumorTypeLower.includes("no tumor") ||
      tumorTypeLower.includes("normal");
    const isRedTumor =
      tumorTypeLower.includes("glioma") || tumorTypeLower.includes("pituitary");
    const diagnosisColor: [number, number, number] = isNoTumor
      ? [34, 139, 34]
      : isRedTumor
        ? [198, 40, 40]
        : [33, 37, 41];

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
      if (y + heightNeeded > pageHeight - 25) {
        doc.addPage();
        y = 18;
      }
    };
    const getTumorDescription = (tumorType: string) => {
      const lower = tumorType.toLowerCase();
      if (lower.includes("glioma")) {
        return "Glioma tumors originate in the brain or spinal cord and can affect brain function depending on their size and location.";
      }
      if (lower.includes("pituitary")) {
        return "Pituitary tumors occur in the pituitary gland and may affect hormone levels and body functions.";
      }
      if (
        lower.includes("notumor") ||
        lower.includes("no tumor") ||
        lower.includes("normal")
      ) {
        return "No tumor detected. The MRI scan appears normal with no abnormal growth.";
      }
      return "";
    };

    // HEADER SECTION
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(33, 37, 41);
    doc.text("Brain Tumor MRI Analysis Report", pageWidth / 2, y, {
      align: "center",
    });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Report ID: ${reportId}`, margin, y);
    y += 4;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // PATIENT INFO CARD STYLE
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, contentWidth, 36, 2, 2, "FD");

    const labelX = margin + 6;
    const valueX = margin + 45;
    let rowY = y + 10;

    doc.setFontSize(10.5);
    const rows: Array<[string, string]> = [
      ["Patient Name", pred.patientName],
      ["Date", dateString],
      ["Diagnosis", pred.tumorType],
      ["Confidence", `${confidencePercent.toFixed(1)}%`],
    ];

    rows.forEach(([label, value], idx) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(90, 90, 90);
      doc.text(label, labelX, rowY);

      const isDiagnosisRow = idx === 2;
      doc.setFont("helvetica", "normal");
      if (isDiagnosisRow) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(
          diagnosisColor[0],
          diagnosisColor[1],
          diagnosisColor[2],
        );
      } else {
        doc.setTextColor(33, 37, 41);
      }
      doc.text(String(value ?? ""), valueX, rowY);
      rowY += 8;
    });

    y += 46;

    // CONFIDENCE BAR
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(33, 37, 41);
    doc.text("Confidence Level", margin, y);
    y += 6;

    const barX = margin;
    const barY = y;
    const barWidth = contentWidth;
    const barHeight = 6.5;
    const fillWidth = (barWidth * confidencePercent) / 100;

    // background
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(barX, barY, barWidth, barHeight, 2, 2, "FD");

    // fill
    doc.setDrawColor(102, 126, 234);
    doc.setFillColor(102, 126, 234);
    doc.roundedRect(barX, barY, Math.max(0, fillWidth), barHeight, 2, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(
      `${confidencePercent.toFixed(1)}%`,
      pageWidth - margin,
      barY + 11,
      {
        align: "right",
      },
    );

    y += 22;

    // MRI IMAGE SECTION (skip gracefully if missing)
    if (pred.imageUrl) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(33, 37, 41);
      doc.text("MRI Scan", margin, y);
      y += 5;

      const imageBoxY = y;
      const imageBoxHeight = 95;
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(
        margin,
        imageBoxY,
        contentWidth,
        imageBoxHeight,
        2.5,
        2.5,
        "FD",
      );

      try {
        const absoluteUrl = `http://localhost:3000${pred.imageUrl}`;
        console.log("Image URL:", absoluteUrl);
        const imageData = await toDataUrlFromImageUrl(absoluteUrl);

        // doc.addImage(imageUrl, ...) - jsPDF needs a data URL, so we fetch+convert first
        const imageInfo = doc.getImageProperties(imageData);
        const maxImageWidth = contentWidth - 12;
        const maxImageHeight = imageBoxHeight - 12;
        const ratio = Math.min(
          maxImageWidth / imageInfo.width,
          maxImageHeight / imageInfo.height,
        );

        const renderWidth = imageInfo.width * ratio;
        const renderHeight = imageInfo.height * ratio;
        const x = margin + (contentWidth - renderWidth) / 2;
        const imgY = imageBoxY + (imageBoxHeight - renderHeight) / 2;
        const imageFormat = imageData.startsWith("data:image/png")
          ? "PNG"
          : "JPEG";
        doc.addImage(
          imageData,
          imageFormat,
          x,
          imgY,
          renderWidth,
          renderHeight,
        );
      } catch (error) {
        console.error("Image load failed:", error);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text("MRI image unavailable", margin + 5, imageBoxY + 12);
      }

      y += imageBoxHeight + 12;
    }

    // HEATMAP SECTION (skip gracefully if missing)
    const heatmapPath = pred.heatmap;
    if (heatmapPath) {
      ensureSpace(112);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(33, 37, 41);
      doc.text("Tumor Highlight Heatmap", margin, y);
      y += 5;

      const heatmapBoxY = y;
      const heatmapBoxHeight = 95;
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(
        margin,
        heatmapBoxY,
        contentWidth,
        heatmapBoxHeight,
        2.5,
        2.5,
        "FD",
      );

      try {
        const heatmapUrl = `http://localhost:3000${heatmapPath}`;
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
        const x = margin + (contentWidth - renderWidth) / 2;
        const imgY = heatmapBoxY + (heatmapBoxHeight - renderHeight) / 2;
        const imageFormat = heatmapData.startsWith("data:image/png")
          ? "PNG"
          : "JPEG";
        doc.addImage(
          heatmapData,
          imageFormat,
          x,
          imgY,
          renderWidth,
          renderHeight,
        );
      } catch (error) {
        console.error("Heatmap load failed:", error);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text("Heatmap unavailable", margin + 5, heatmapBoxY + 12);
      }

      y += heatmapBoxHeight + 12;
    }

    // TUMOR DESCRIPTION SECTION
    const description = getTumorDescription(pred.tumorType);
    if (description) {
      ensureSpace(42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(33, 37, 41);
      doc.text("Tumor Description", margin, y);
      y += 5;

      const descriptionLines = doc.splitTextToSize(
        description,
        contentWidth - 10,
      );
      const descriptionHeight = Math.max(22, descriptionLines.length * 5 + 10);
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, y, contentWidth, descriptionHeight, 2, 2, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(55, 55, 55);
      doc.text(descriptionLines, margin + 5, y + 7);
      y += descriptionHeight + 10;
    }

    // FOOTER
    const footerY = pageHeight - 15;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.4);
    doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Generated by Zenith AI System", margin, footerY);
    doc.text(timestamp, pageWidth - margin, footerY, { align: "right" });

    return doc.output("blob");
  }, []);

  const handleViewReport = useCallback(
    async (pred: Prediction) => {
      try {
        const blob = await generatePdfBlob(pred);
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        console.error("Failed to view report:", error);
      }
    },
    [generatePdfBlob],
  );

  const handleDownloadReport = useCallback(
    async (pred: Prediction) => {
      try {
        const blob = await generatePdfBlob(pred);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${pred.patientName.replace(/\s+/g, "_")}_MRI_Report.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Failed to download report:", error);
      }
    },
    [generatePdfBlob],
  );

  if (isLoading) {
    return (
      <div className="page-root">
        <div
          className="container"
          style={{ textAlign: "center", color: "#666" }}
        >
          Loading prediction history...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-root">
        <div className="container">
          <div className="error show">⚠️ Error: {error}</div>
        </div>
      </div>
    );
  }

  const hasNoHistory =
    !data || !data.predictions || data.predictions.length === 0;
  const filteredPredictions = (data?.predictions ?? []).filter((pred) => {
    const matchesSearch = pred.patientName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const normalizedType = pred.tumorType.toLowerCase().replace(/\s+/g, "");
    const matchesFilter =
      filterType === "All" || normalizedType === filterType.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the record for ${name}?`)) return;

    try {
      const response = await fetch(`http://localhost:3000/api/history/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error("Failed to delete record");
      }

      if (data) {
        setData({
          ...data,
          predictions: data.predictions.filter((p) => p._id !== id),
          count: data.count - 1,
        });
      }
    } catch (err) {
      console.error("Error deleting record:", err);
      alert("Failed to delete record. Please try again.");
    }
  };

  return (
    <div className="page-root">
      <div className="container">
        <h1 style={{ marginBottom: "30px" }}>Prediction History</h1>

        {hasNoHistory ? (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              color: "#6b7280",
              fontSize: "1.1em",
            }}
          >
            No prediction history available.
          </div>
        ) : (
          <>
            <div className="filter-container">
              <input
                type="text"
                placeholder="Search patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="All">All</option>
                <option value="glioma">glioma</option>
                <option value="pituitary">pituitary</option>
                <option value="notumor">notumor</option>
              </select>
            </div>
            <div style={{ overflowX: "auto", paddingBottom: "10px" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "800px",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid #e5e7eb",
                    color: "#374151",
                    fontSize: "1.1em",
                    fontWeight: "bold",
                  }}
                >
                  <th style={{ padding: "12px" }}>Patient Name</th>
                  <th style={{ padding: "12px" }}>Tumor Type</th>
                  <th style={{ padding: "12px" }}>Confidence</th>
                  <th style={{ padding: "12px" }}>Date</th>
                  <th style={{ padding: "12px", textAlign: "center" }}>
                    Report
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPredictions.map((pred, index) => (
                  <tr
                    key={index}
                    className="history-row"
                    style={{
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px",
                        color: "#111827",
                        fontWeight: "500",
                      }}
                    >
                      {pred.patientName}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        color: "#764ba2",
                        fontWeight: "bold",
                      }}
                    >
                      {pred.tumorType}
                    </td>
                    <td style={{ padding: "12px", color: "#6b7280" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {(pred.confidence * 100).toFixed(1)}%
                        <div
                          className="confidence-bar"
                          style={{ width: "60px", margin: 0, height: "6px" }}
                        >
                          <div
                            className="confidence-fill"
                            style={{
                              width: `${Math.max(0, Math.min(100, pred.confidence * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        color: "#6b7280",
                        fontSize: "0.9em",
                      }}
                    >
                      {new Date(pred.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "nowrap" }}>
                        <button
                          onClick={() => handleViewReport(pred)}
                          className="secondary-btn"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDownloadReport(pred)}
                          className="primary-btn"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(pred._id, pred.patientName)}
                          className="delete-btn"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default History;
