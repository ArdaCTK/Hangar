import React, { useState } from "react";
import { useStore } from "../../store/useStore";
import { scanPorts } from "../../lib/tauri";

const PortScanner: React.FC = () => {
  const { portData, setPortData, portsLoading, setPortsLoading } = useStore();
  const [scanned, setScanned] = useState(false);

  const handleScan = async () => {
    setPortsLoading(true);
    try {
      const data = await scanPorts();
      setPortData(data);
      setScanned(true);
    } catch (e) {
      console.error(e);
    } finally {
      setPortsLoading(false);
    }
  };

  const open = portData.filter((p) => p.open);

  return (
    <div style={{ padding: "0 28px 16px" }}>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text3)" }}>
            Port Scanner
            {scanned && open.length > 0 && (
              <span style={{ marginLeft: 8, color: "var(--green)", fontSize: 10 }}>
                {open.length} active
              </span>
            )}
          </div>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11 }}
            onClick={handleScan}
            disabled={portsLoading}
          >
            {portsLoading ? "Scanning…" : scanned ? "↺ Rescan" : "🔌 Scan Ports"}
          </button>
        </div>

        {!scanned && !portsLoading && (
          <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", padding: "12px 0" }}>
            Scan to see which dev servers are running on localhost
          </div>
        )}

        {portsLoading && (
          <div className="loading-state" style={{ height: 60 }}>
            <div className="spinner" /><span>Probing ports…</span>
          </div>
        )}

        {scanned && !portsLoading && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {portData.filter((p) => p.open).map((p) => (
              <div key={p.port} style={{
                display: "flex", flexDirection: "column", gap: 2,
                padding: "8px 12px", borderRadius: "var(--radius)",
                background: "rgba(92,186,125,0.08)", border: "1px solid rgba(92,186,125,0.2)",
              }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "pulse 2s infinite" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
                    :{p.port}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>{p.service_hint}</span>
              </div>
            ))}
            {open.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text3)" }}>No dev servers detected</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PortScanner;
