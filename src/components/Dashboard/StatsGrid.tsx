import React from "react";
import type { DashboardStats } from "../../types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface Props {
  stats: DashboardStats;
}

const StatsGrid: React.FC<Props> = ({ stats }) => {
  const cards = [
    {
      label: "Total Projects",
      value: stats.total_projects,
      colorClass: "",
      sub: "scanned",
    },
    {
      label: "Git Connected",
      value: stats.git_connected,
      colorClass: "green",
      sub: `${stats.total_projects > 0 ? Math.round((stats.git_connected / stats.total_projects) * 100) : 0}% of total`,
    },
    {
      label: "No Git",
      value: stats.git_unconnected,
      colorClass: stats.git_unconnected > 0 ? "red" : "",
      sub: "local only",
    },
    {
      label: "Total Files",
      value: stats.total_files.toLocaleString(),
      colorClass: "blue",
      sub: "across all projects",
    },
    {
      label: "Dependencies",
      value: stats.total_dependencies.toLocaleString(),
      colorClass: "yellow",
      sub: "npm + cargo + pip",
    },
    {
      label: "Disk Usage",
      value: formatSize(stats.total_size_bytes),
      colorClass: "",
      sub: "total size",
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((c) => (
        <div className="stat-card" key={c.label}>
          <div className="stat-label">{c.label}</div>
          <div className={`stat-value ${c.colorClass}`}>{c.value}</div>
          <div className="stat-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
