import React, { useEffect, useMemo, useRef } from "react";
import { useStore } from "../../store/useStore";
import { getActivityData } from "../../lib/tauri";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getColor(count: number): string {
  if (count === 0) return "var(--bg3)";
  if (count <= 2)  return "#1a3a2a";
  if (count <= 5)  return "#1e5c3a";
  if (count <= 10) return "#29894f";
  if (count <= 20) return "#3bba6e";
  return "#5cba7d";
}

function buildGrid(data: { date: string; count: number; projects: string[] }[]) {
  const dateMap = new Map(data.map((d) => [d.date, d]));
  const today   = new Date();
  const grid: { date: string; count: number; projects: string[]; dayOfWeek: number }[][] = [];

  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay());

  let cursorTs = start.getTime();
  const todayTs = today.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  while (cursorTs <= todayTs) {
    const week: typeof grid[0] = [];
    for (let d = 0; d < 7; d++) {
      const cursor = new Date(cursorTs);
      const iso = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
      const entry = dateMap.get(iso);
      week.push({ date: iso, count: entry?.count ?? 0, projects: entry?.projects ?? [], dayOfWeek: d });
      cursorTs += dayMs;
    }
    grid.push(week);
  }
  return { grid, start };
}

const ContributionsGraph: React.FC = () => {
  const { projects, activityData, setActivityData, activityLoading, setActivityLoading } = useStore();

  const lastFetchKeyRef = useRef<string>("");
  const gitPaths = useMemo(
    () => projects.filter((p) => p.has_git).map((p) => p.path).sort(),
    [projects],
  );
  const fetchKey = gitPaths.join("|");

  useEffect(() => {
    if (!fetchKey) {
      setActivityData([]);
      lastFetchKeyRef.current = "";
      return;
    }
    if (lastFetchKeyRef.current === fetchKey) return;

    lastFetchKeyRef.current = fetchKey;
    setActivityLoading(true);
    getActivityData(gitPaths)
      .then(setActivityData)
      .catch(console.error)
      .finally(() => setActivityLoading(false));
  }, [fetchKey, gitPaths, setActivityData, setActivityLoading]);

  const { grid } = useMemo(() => buildGrid(activityData), [activityData]);

  const totalCommits = useMemo(() => activityData.reduce((s, d) => s + d.count, 0), [activityData]);
  const activeDays   = useMemo(() => activityData.filter((d) => d.count > 0).length, [activityData]);

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((week, col) => {
      const firstDay = week[0];
      if (!firstDay) return;
      const m = new Date(firstDay.date).getMonth();
      if (m !== lastMonth) { labels.push({ label: MONTHS[m], col }); lastMonth = m; }
    });
    return labels;
  }, [grid]);

  if (activityLoading) {
    return (
      <div style={{ padding: "0 28px 16px" }}>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 12 }}>
            Commit Activity
          </div>
          <div className="loading-state" style={{ height: 80 }}>
            <div className="spinner" />
            <span>Loading commit history…</span>
          </div>
        </div>
      </div>
    );
  }

  const CELL = 11;
  const GAP  = 2;

  return (
    <div style={{ padding: "0 28px 16px" }}>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text3)" }}>
            Commit Activity — Last 52 Weeks
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: "11px", color: "var(--text3)" }}>
            <span><span style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{totalCommits.toLocaleString()}</span> commits</span>
            <span><span style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}>{activeDays}</span> active days</span>
          </div>
        </div>

        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "flex", marginLeft: 24, marginBottom: 4, position: "relative", height: 14 }}>
            {monthLabels.map(({ label, col }) => (
              <span key={label + col} style={{
                position: "absolute", left: col * (CELL + GAP),
                fontSize: 10, color: "var(--text3)", whiteSpace: "nowrap",
              }}>{label}</span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: GAP, marginRight: 4, marginTop: 1 }}>
              {[0,1,2,3,4,5,6].map((d) => (
                <div key={d} style={{ height: CELL, fontSize: 9, color: "var(--text3)", lineHeight: `${CELL}px`, whiteSpace: "nowrap", width: 18 }}>
                  {d % 2 === 1 ? DAYS[d].slice(0, 3) : ""}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: GAP }}>
              {grid.map((week, wi) => (
                <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                  {week.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.count} commit${day.count !== 1 ? "s" : ""}${day.projects.length ? ` (${day.projects.slice(0,3).join(", ")})` : ""}`}
                      style={{
                        width: CELL, height: CELL,
                        background: getColor(day.count),
                        borderRadius: 2,
                        cursor: day.count > 0 ? "pointer" : "default",
                        transition: "opacity 0.1s",
                        opacity: day.date > new Date().toISOString().slice(0, 10) ? 0.2 : 1,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 8, fontSize: 10, color: "var(--text3)" }}>
          <span>Less</span>
          {[0, 2, 5, 10, 20, 30].map((v) => (
            <div key={v} style={{ width: CELL, height: CELL, background: getColor(v), borderRadius: 2 }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

export default ContributionsGraph;
