import React, { useEffect, useState } from "react";
import Sidebar from "./components/Layout/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import ProjectPage from "./pages/ProjectPage";
import { useStore } from "./store/useStore";
import { loadSettings, saveSettings, scanProjects, selectFolder } from "./lib/tauri";
import type { Settings } from "./types";

const App: React.FC = () => {
  const {
    settings,
    setSettings,
    selectedProject,
    setProjects,
    isScanning,
    setIsScanning,
    setScanError,
  } = useStore();

  const [showSettings, setShowSettings] = useState(false);
  const [draftSettings, setDraftSettings] = useState<Settings>({
    projects_path: "",
    github_token: null,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings()
      .then((s) => {
        setSettings(s);
        if (s.projects_path) scan(s.projects_path);
        else setShowSettings(true);
      })
      .catch(() => setShowSettings(true));
  }, []);

  const scan = async (path: string) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const projects = await scanProjects(path);
      setProjects(projects);
    } catch (e) {
      setScanError(String(e));
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenSettings = () => {
    setDraftSettings({
      projects_path: settings?.projects_path ?? "",
      github_token: settings?.github_token ?? null,
    });
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    await saveSettings(draftSettings);
    setSettings(draftSettings);
    setShowSettings(false);
    if (draftSettings.projects_path) {
      scan(draftSettings.projects_path);
    }
  };

  const handleSelectFolder = async () => {
    const path = await selectFolder();
    if (path) setDraftSettings((d) => ({ ...d, projects_path: path }));
  };

  return (
    <div className="layout">
      <Sidebar
        onSettingsClick={handleOpenSettings}
        onDashboardClick={() => {}}
      />

      <div className="main-content">
        {/* Scan status bar */}
        <div className="scan-bar">
          {isScanning ? (
            <>
              <div className="spinner" />
              <span>Scanning {settings?.projects_path ?? "projects folder"}…</span>
            </>
          ) : (
            <>
              <span>
                📁 {settings?.projects_path ?? "No folder configured"}
              </span>
              <button
                className="rescan-btn"
                onClick={() => settings?.projects_path && scan(settings.projects_path)}
                disabled={!settings?.projects_path || isScanning}
              >
                ↺ Rescan
              </button>
            </>
          )}
        </div>

        {selectedProject ? <ProjectPage /> : <DashboardPage />}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => settings?.projects_path && setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">⚙️ Settings</div>

            <div className="form-group">
              <label className="form-label">Projects Folder</label>
              <div className="form-input-row">
                <input
                  className="form-input"
                  placeholder="C:\Users\You\Desktop\Projects"
                  value={draftSettings.projects_path}
                  onChange={(e) =>
                    setDraftSettings((d) => ({ ...d, projects_path: e.target.value }))
                  }
                />
                <button className="btn btn-ghost" onClick={handleSelectFolder}>
                  Browse
                </button>
              </div>
              <div className="form-hint">
                The root folder containing all your projects.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">GitHub Personal Access Token</label>
              <input
                className="form-input"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={draftSettings.github_token ?? ""}
                onChange={(e) =>
                  setDraftSettings((d) => ({
                    ...d,
                    github_token: e.target.value || null,
                  }))
                }
              />
              <div className="form-hint">
                Optional. Required for private repos and higher rate limits.
                Scope: repo, read:user
              </div>
            </div>

            <div className="modal-actions">
              {settings?.projects_path && (
                <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>
                  Cancel
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={handleSaveSettings}
                disabled={!draftSettings.projects_path}
              >
                Save & Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
