import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { LanguageStat } from "../../types";

const COLORS = [
  "#5b9cf6", "#a78bfa", "#5cba7d", "#e8b84b", "#e05c5c",
  "#f59e4b", "#4dd0e1", "#f48fb1", "#aed581", "#ff8a65",
];

interface Props {
  languages: LanguageStat[];
  frameworks: LanguageStat[];
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "4px",
          padding: "6px 10px",
          fontSize: "11px",
          color: "var(--text)",
        }}
      >
        <div style={{ fontWeight: 600 }}>{payload[0]?.name}</div>
        <div style={{ color: "var(--text2)" }}>{payload[0]?.value} projects</div>
      </div>
    );
  }
  return null;
};

const LangChart: React.FC<Props> = ({ languages, frameworks }) => {
  const topLangs = languages.slice(0, 8);
  const topFws = frameworks.slice(0, 8);

  return (
    <div className="charts-row">
      {/* Language Pie */}
      <div className="chart-card">
        <div className="chart-title">Language Distribution</div>
        {topLangs.length === 0 ? (
          <div style={{ color: "var(--text3)", fontSize: "12px", textAlign: "center", padding: "40px 0" }}>
            No data yet
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={topLangs}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={72}
                  dataKey="count"
                  nameKey="name"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {topLangs.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {topLangs.map((l, i) => (
                <div className="legend-item" key={l.name}>
                  <span
                    className="legend-dot"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {l.name}
                  <span style={{ color: "var(--text3)", marginLeft: 2 }}>
                    {l.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Framework Bar */}
      <div className="chart-card">
        <div className="chart-title">Framework & Ecosystem</div>
        {topFws.length === 0 ? (
          <div style={{ color: "var(--text3)", fontSize: "12px", textAlign: "center", padding: "40px 0" }}>
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={topFws.length * 26 + 20}>
            <BarChart
              data={topFws}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "var(--text3)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                tick={{ fontSize: 11, fill: "var(--text2)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {topFws.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default LangChart;
