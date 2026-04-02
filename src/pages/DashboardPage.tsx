import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import StatsGrid from "../components/Dashboard/StatsGrid";
import LangChart from "../components/Dashboard/LangChart";
import ProjectCard from "../components/ProjectCard";
import GitHubOnlyRepos from "../components/Dashboard/GitHubOnlyRepos";
import ContributionsGraph from "../components/Dashboard/ContributionsGraph";
import PortScanner from "../components/Dashboard/PortScanner";
import { getDashboardStats } from "../lib/tauri";

const DashboardPage: React.FC = () => {
  const { projects, isScanning, setSelectedProject, setActivePage, detailsCache } = useStore();

  const totalDeps = useMemo(
    () => Object.values(detailsCache).reduce((acc, d) => acc + d.dependencies.length, 0),
    [detailsCache]
  );
  const stats = useMemo(() => getDashboardStats(projects, totalDeps), [projects, totalDeps]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">
          {isScanning ? "Scanning projects…" : `${projects.length} projects found`}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <StatsGrid stats={stats} />

        {!isScanning && projects.length > 0 && (
          <>
            <LangChart languages={stats.language_distribution} frameworks={stats.framework_distribution} />
            <ContributionsGraph />
            <PortScanner />
          </>
        )}

        <div className="projects-section">
          <div className="section-title">
            All Local Projects
            <span className="section-count">{projects.length}</span>
          </div>

          {isScanning && (
            <div className="loading-state"><div className="spinner" /><span>Scanning projects folder…</span></div>
          )}

          {!isScanning && projects.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <div className="empty-state-title">No projects found</div>
              <div className="empty-state-desc">Configure your Projects folder path in Settings.</div>
            </div>
          )}

          {!isScanning && projects.length > 0 && (
            <div className="project-cards-grid">
              {projects.map((p) => (
                <ProjectCard key={p.path} project={p} onClick={() => {
                  setSelectedProject(p.path);
                  setActivePage("dashboard");
                }} />
              ))}
            </div>
          )}
        </div>

        {!isScanning && <GitHubOnlyRepos />}
      </div>
    </div>
  );
};

export default DashboardPage;
