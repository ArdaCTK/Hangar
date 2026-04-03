import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { timeGetWeeklyReport, timeGetMonthlyReport, timeExportCsv } from "../lib/tauri";
import type { WeeklyReport, MonthlyReport } from "../types";

type ViewMode = "weekly" | "monthly";

const COLORS = [
  "#5b9cf6", "#a78bfa", "#5cba7d", "#e8b84b", "#f59e4b",
  "#e05c5c", "#4bcbf5", "#d946ef", "#6ee7b7", "#fb923c",
];

const MeridianPage: React.FC = () => {
  const { projects, meridianLoading, setMeridianLoading } = useStore();

  const [view, setView] = useState<ViewMode>("weekly");
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [monthly, setMonthly] = useState<MonthlyReport | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [exportHourlyRate, setExportHourlyRate] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const projectPaths = useMemo(() => projects.map(p => p.path), [projects]);

  useEffect(() => {
    if (projectPaths.length === 0) return;
    if (view === "weekly") loadWeekly();
    else loadMonthly();
  }, [view, projectPaths.length, selectedMonth.year, selectedMonth.month]);

  const loadWeekly = async () => {
    setMeridianLoading(true);
    try {
      const r = await timeGetWeeklyReport(projectPaths);
      setWeekly(r);
    } catch { }
    setMeridianLoading(false);
  };

  const loadMonthly = async () => {
    setMeridianLoading(true);
    try {
      const r = await timeGetMonthlyReport(projectPaths, selectedMonth.year, selectedMonth.month);
      setMonthly(r);
    } catch { }
    setMeridianLoading(false);
  };

  const handleExport = async () => {
    setExporting(true);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];
    try {
      const csv = await timeExportCsv(projectPaths, startDate, endDate, exportHourlyRate);
      setExportResult(csv);
    } catch { }
    setExporting(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const report = view === "weekly" ? weekly : monthly;
  const maxDaily = weekly?.daily ? Math.max(...weekly.daily.map(d => d.hours), 1) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <div className="page-title">🕰️ Meridian</div>
        <div className="page-subtitle">Developer time tracking from git commits</div>
      </div>

      <div className="meridian-toolbar">
        <div className="ghub-tabs">
          <button className={`ghub-tab ${view === "weekly" ? "active" : ""}`}
            onClick={() => setView("weekly")}>Weekly</button>
          <button className={`ghub-tab ${view === "monthly" ? "active" : ""}`}
            onClick={() => setView("monthly")}>Monthly</button>
        </div>

        {view === "monthly" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-ghost" style={{ padding: "3px 8px" }}
              onClick={() => setSelectedMonth(prev => {
                const d = new Date(prev.year, prev.month - 2, 1);
                return { year: d.getFullYear(), month: d.getMonth() + 1 };
              })}>←</button>
            <span style={{ fontSize: 12, minWidth: 90, textAlign: "center" }}>
              {selectedMonth.year}-{String(selectedMonth.month).padStart(2, "0")}
            </span>
            <button className="btn btn-ghost" style={{ padding: "3px 8px" }}
              onClick={() => setSelectedMonth(prev => {
                const d = new Date(prev.year, prev.month, 1);
                return { year: d.getFullYear(), month: d.getMonth() + 1 };
              })}>→</button>
          </div>
        )}

        <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 11 }}
          onClick={() => view === "weekly" ? loadWeekly() : loadMonthly()}>
          ↺ Refresh
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px" }}>
        {meridianLoading && <div className="loading-state"><div className="spinner" /><span>Analyzing commits…</span></div>}

        {!meridianLoading && projectPaths.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🕰️</div>
            <div className="empty-state-title">No projects found</div>
            <div className="empty-state-desc">Meridian analyzes git commits from your projects to track time.</div>
          </div>
        )}

        {!meridianLoading && report && (
          <>
            {/* Total Hours Card */}
            <div className="meridian-hero">
              <div className="meridian-hero-value">
                {report.total_hours.toFixed(1)}
                <span className="meridian-hero-unit">hours</span>
              </div>
              <div className="meridian-hero-label">
                {view === "weekly" ? "This Week" : `${(monthly as MonthlyReport)?.month ?? ""}`}
              </div>
            </div>

            {/* Project Breakdown */}
            <div className="meridian-section">
              <div className="section-block-title">Project Breakdown</div>
              <div className="meridian-breakdown">
                {report.projects.map((p, i) => (
                  <div key={p.name} className="meridian-project-row">
                    <div className="meridian-project-color" style={{ background: COLORS[i % COLORS.length] }} />
                    <div className="meridian-project-name">{p.name}</div>
                    <div className="meridian-project-bar-container">
                      <div className="meridian-project-bar"
                        style={{
                          width: `${p.percentage}%`,
                          background: COLORS[i % COLORS.length],
                        }} />
                    </div>
                    <div className="meridian-project-hours">{p.hours.toFixed(1)}h</div>
                    <div className="meridian-project-pct">{p.percentage}%</div>
                  </div>
                ))}

                {report.projects.length === 0 && (
                  <div style={{ color: "var(--text3)", fontSize: 12, padding: 12 }}>
                    No commit activity found in this period.
                  </div>
                )}
              </div>
            </div>

            {/* Daily Chart (Weekly view only) */}
            {view === "weekly" && weekly?.daily && weekly.daily.length > 0 && (
              <div className="meridian-section">
                <div className="section-block-title">Daily Activity</div>
                <div className="meridian-daily-chart">
                  {weekly.daily.map(d => (
                    <div key={d.date} className="meridian-daily-bar-wrapper">
                      <div className="meridian-daily-bar"
                        style={{ height: `${(d.hours / maxDaily) * 100}%` }}
                        title={`${d.date}: ${d.hours.toFixed(1)}h`} />
                      <div className="meridian-daily-label">{d.date.slice(8)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly chart (Monthly view) */}
            {view === "monthly" && monthly?.weekly && monthly.weekly.length > 0 && (
              <div className="meridian-section">
                <div className="section-block-title">Weekly Summary</div>
                <div className="meridian-weekly-grid">
                  {monthly.weekly.map(w => (
                    <div key={w.week} className="meridian-week-card">
                      <div className="meridian-week-label">{w.week}</div>
                      <div className="meridian-week-value">{w.hours.toFixed(1)}h</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export */}
            <div className="meridian-section">
              <div className="section-block-title">Invoice Export</div>
              <div className="meridian-export">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 11, color: "var(--text3)" }}>Hourly Rate:</label>
                  <input className="form-input" type="number" value={exportHourlyRate}
                    onChange={e => setExportHourlyRate(Number(e.target.value))}
                    style={{ width: 80 }} />
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>$/hr</span>
                  <button className="btn btn-primary" onClick={handleExport}
                    disabled={exporting} style={{ marginLeft: 8 }}>
                    {exporting ? "Generating…" : "Generate CSV"}
                  </button>
                </div>

                {exportResult && (
                  <div className="meridian-export-result">
                    <pre className="meridian-csv-preview">{exportResult}</pre>
                    <button className="btn btn-ghost" style={{ marginTop: 8 }}
                      onClick={() => copyToClipboard(exportResult)}>
                      📋 Copy to Clipboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MeridianPage;
