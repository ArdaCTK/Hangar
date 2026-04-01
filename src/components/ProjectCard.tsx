import React from "react";
import type { ProjectInfo } from "../types";

interface Props {
  project: ProjectInfo;
  onClick: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

const ProjectCard: React.FC<Props> = ({ project: p, onClick }) => {
  return (
    <div className="project-card" onClick={onClick}>
      <div className="project-card-header">
        <div className="project-card-name" title={p.name}>{p.name}</div>
        <span className="project-card-type">{p.project_type}</span>
      </div>

      <div className="project-card-langs">
        {p.languages.slice(0, 4).map((l) => (
          <span className="lang-tag" key={l}>{l}</span>
        ))}
        {p.frameworks.slice(0, 3).map((f) => (
          <span className="lang-tag" key={f} style={{ color: "var(--blue)", borderColor: "rgba(91,156,246,0.2)" }}>
            {f}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span className={`git-badge ${p.has_git ? "" : "no-git"}`}>
          {p.has_git ? (
            <>
              <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">
                <path d="M15.698 7.287 8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.55 1.56l1.773 1.774a1.224 1.224 0 0 1 1.267 2.025 1.226 1.226 0 0 1-2.002-1.334L8.58 5.963v4.353a1.226 1.226 0 1 1-1.008-.036V5.887a1.226 1.226 0 0 1-.666-1.608L5.093 2.466 .302 7.258a1.03 1.03 0 0 0 0 1.457l6.986 6.985a1.03 1.03 0 0 0 1.456 0l6.953-6.956a1.029 1.029 0 0 0 0-1.457" />
              </svg>
              Git
            </>
          ) : (
            <>✕ No Git</>
          )}
        </span>

        <div className="project-card-meta">
          <span className="project-card-meta-item">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M14 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" stroke="currentColor" strokeWidth="1.3" />
              <path d="M4 6h8M4 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            {p.file_count.toLocaleString()}
          </span>
          <span className="project-card-meta-item">
            {formatSize(p.total_size)}
          </span>
          <span className="project-card-meta-item">
            {timeAgo(p.last_modified)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
