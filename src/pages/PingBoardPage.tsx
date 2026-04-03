import React, { useEffect, useState, useRef } from "react";
import { useStore } from "../store/useStore";
import {
  pingGetAllMonitors, pingAddMonitor, pingRemoveMonitor, pingCheckNow, pingGetHistory,
} from "../lib/tauri";
import type { Monitor, PingRecord } from "../types";

const PingBoardPage: React.FC = () => {
  const { monitors, setMonitors, pingHistory, setPingHistory } = useStore();
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>(null);
  const [checking, setChecking] = useState<Record<string, boolean>>({});

  // Add monitor form
  const [addName, setAddName] = useState("");
  const [addUrl, setAddUrl] = useState("https://");
  const [addInterval, setAddInterval] = useState(60);
  const [addMethod, setAddMethod] = useState("GET");

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadMonitors();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (monitors.length > 0) {
      intervalRef.current = window.setInterval(() => {
        checkAllMonitors();
      }, 30000); // Check every 30s
    }
  }, [monitors.length]);

  const loadMonitors = async () => {
    setLoading(true);
    try {
      let m = await pingGetAllMonitors();
      setMonitors(m);
      // Auto-check all on load
      for (const mon of m) {
        if (mon.is_active) {
          try {
            const updated = await pingCheckNow(mon.id);
            m = m.map(p => p.id === updated.id ? updated : p);
            setMonitors(m);
          } catch { }
        }
      }
    } catch { }
    setLoading(false);
  };

  const checkAllMonitors = async () => {
    const current = useStore.getState().monitors;
    for (const mon of current) {
      if (mon.is_active) {
        try {
          const updated = await pingCheckNow(mon.id);
          const latest = useStore.getState().monitors;
          setMonitors(latest.map(p => p.id === updated.id ? updated : p));
        } catch { }
      }
    }
  };

  const handleAdd = async () => {
    if (!addName || !addUrl) return;
    try {
      const m = await pingAddMonitor(addName, addUrl, addInterval, addMethod);
      const current = useStore.getState().monitors;
      setMonitors([...current, m]);
      setShowAdd(false);
      setAddName(""); setAddUrl("https://"); setAddInterval(60); setAddMethod("GET");
      // Immediately check it
      try {
        const updated = await pingCheckNow(m.id);
        const latest = useStore.getState().monitors;
        setMonitors(latest.map(p => p.id === updated.id ? updated : p));
      } catch { }
    } catch { }
  };

  const handleRemove = async (id: string) => {
    await pingRemoveMonitor(id);
    const current = useStore.getState().monitors;
    setMonitors(current.filter(m => m.id !== id));
    if (selectedMonitor === id) setSelectedMonitor(null);
  };

  const handleCheck = async (id: string) => {
    setChecking(prev => ({ ...prev, [id]: true }));
    try {
      const updated = await pingCheckNow(id);
      const current = useStore.getState().monitors;
      setMonitors(current.map(m => m.id === updated.id ? updated : m));
    } catch { }
    setChecking(prev => ({ ...prev, [id]: false }));
  };

  const handleSelectMonitor = async (id: string) => {
    setSelectedMonitor(id === selectedMonitor ? null : id);
    if (id !== selectedMonitor) {
      try {
        const history = await pingGetHistory(id);
        setPingHistory(id, history);
      } catch { }
    }
  };

  const statusColor = (status: string) => {
    if (status === "up") return "var(--green)";
    if (status === "down") return "var(--red)";
    if (status === "degraded") return "var(--yellow)";
    return "var(--text3)";
  };

  const selectedHistory = selectedMonitor ? (pingHistory[selectedMonitor] ?? []) : [];
  const selectedMon = monitors.find(m => m.id === selectedMonitor);

  const uptimeBarData = (history: PingRecord[]) => {
    const last30 = history.slice(-30);
    return last30.map(r => ({
      status: r.status,
      ms: r.response_ms,
      time: new Date(r.timestamp * 1000).toLocaleTimeString(),
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="page-title" style={{ marginBottom: 0 }}>📡 PingBoard</div>
          <button className="btn btn-ghost"
            onClick={() => setShowAdd(true)}>
            + Add Monitor
          </button>
        </div>
        <div className="page-subtitle">
          {monitors.length} monitors • {monitors.filter(m => m.last_status === "up").length} up • {monitors.filter(m => m.last_status === "down").length} down
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px" }}>
        {loading && <div className="loading-state"><div className="spinner" /><span>Loading monitors…</span></div>}

        {!loading && monitors.length === 0 && !showAdd && (
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">No monitors configured</div>
            <div className="empty-state-desc">Add a monitor to track uptime of your services and APIs.</div>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              + Add First Monitor
            </button>
          </div>
        )}

        {/* Add Modal */}
        {showAdd && (
          <div className="ping-add-card">
            <div className="section-block-title" style={{ marginBottom: 12 }}>Add Monitor</div>
            <div className="ping-add-form">
              <input className="form-input" placeholder="Name (e.g., Production API)"
                value={addName} onChange={e => setAddName(e.target.value)} />
              <input className="form-input" placeholder="URL (e.g., https://api.example.com/health)"
                value={addUrl} onChange={e => setAddUrl(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <select className="form-input" value={addMethod} onChange={e => setAddMethod(e.target.value)}>
                  <option>GET</option><option>HEAD</option><option>POST</option>
                </select>
                <select className="form-input" value={addInterval} onChange={e => setAddInterval(Number(e.target.value))}>
                  <option value={30}>Every 30s</option>
                  <option value={60}>Every 1m</option>
                  <option value={300}>Every 5m</option>
                  <option value={900}>Every 15m</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAdd} disabled={!addName || !addUrl}>Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Monitor Cards */}
        <div className="ping-grid">
          {monitors.map(mon => (
            <div key={mon.id} className={`ping-card ${selectedMonitor === mon.id ? "active" : ""}`}
              onClick={() => handleSelectMonitor(mon.id)}>
              <div className="ping-card-header">
                <div className="ping-status-dot" style={{ background: statusColor(mon.last_status) }} />
                <div className="ping-card-name">{mon.name}</div>
                <div className="ping-card-actions">
                  <button className="btn btn-ghost"
                    onClick={e => { e.stopPropagation(); handleCheck(mon.id); }}
                    disabled={checking[mon.id]}>
                    {checking[mon.id] ? "⟳" : "Check"}
                  </button>
                  <button className="btn btn-ghost" style={{ color: "var(--red)" }}
                    onClick={e => { e.stopPropagation(); handleRemove(mon.id); }}>
                    ✕
                  </button>
                </div>
              </div>
              <div className="ping-card-url">{mon.url}</div>
              <div className="ping-card-stats">
                <div className="ping-stat">
                  <span className="ping-stat-label">Status</span>
                  <span className="ping-stat-value" style={{ color: statusColor(mon.last_status) }}>
                    {mon.last_status.toUpperCase()}
                  </span>
                </div>
                <div className="ping-stat">
                  <span className="ping-stat-label">Response</span>
                  <span className="ping-stat-value">
                    {mon.last_response_ms != null ? `${mon.last_response_ms}ms` : "—"}
                  </span>
                </div>
                <div className="ping-stat">
                  <span className="ping-stat-label">Uptime 24h</span>
                  <span className="ping-stat-value" style={{ color: mon.uptime_24h >= 99 ? "var(--green)" : mon.uptime_24h >= 95 ? "var(--yellow)" : "var(--red)" }}>
                    {mon.uptime_24h}%
                  </span>
                </div>
              </div>

              {/* Mini uptime bar */}
              <div className="ping-uptime-bar">
                {uptimeBarData(pingHistory[mon.id] ?? []).map((d, i) => (
                  <div key={i} className="ping-bar-segment"
                    style={{ background: statusColor(d.status) }}
                    title={`${d.time} - ${d.ms}ms`} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedMon && (
          <div className="ping-detail">
            <div className="section-block-title" style={{ marginBottom: 12 }}>
              Response History — {selectedMon.name}
            </div>

            <div className="ping-history-chart">
              {selectedHistory.slice(-50).map((r, i) => {
                const maxMs = Math.max(...selectedHistory.map(h => h.response_ms), 1);
                const heightPct = Math.min((r.response_ms / maxMs) * 100, 100);
                return (
                  <div key={i} className="ping-history-bar"
                    style={{
                      height: `${Math.max(heightPct, 4)}%`,
                      background: statusColor(r.status),
                    }}
                    title={`${new Date(r.timestamp * 1000).toLocaleString()} — ${r.response_ms}ms ${r.error ?? ""}`}
                  />
                );
              })}
            </div>

            {selectedHistory.length > 0 && (
              <div className="ping-history-stats">
                <div>Avg: {Math.round(selectedHistory.reduce((a, r) => a + r.response_ms, 0) / selectedHistory.length)}ms</div>
                <div>Min: {Math.min(...selectedHistory.map(r => r.response_ms))}ms</div>
                <div>Max: {Math.max(...selectedHistory.map(r => r.response_ms))}ms</div>
                <div>Checks: {selectedHistory.length}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PingBoardPage;
