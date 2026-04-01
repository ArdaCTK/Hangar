import React, { useEffect, useState } from "react";
import { fetchGitHubUserRepos, type GithubRepoSummary } from "../../lib/tauri";
import { useStore } from "../../store/useStore";

const GitHubOnlyRepos: React.FC = () => {
  const { settings, projects } = useStore();
  const [repos, setRepos] = useState<GithubRepoSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Build a set of remote URLs and repo names from local projects
  const localRepoNames = new Set(
    projects
      .filter((p) => p.github_repo)
      .map((p) => `${p.github_owner}/${p.github_repo}`.toLowerCase())
  );

  const localProjectNames = new Set(projects.map((p) => p.name.toLowerCase()));

  useEffect(() => {
    if (!settings?.github_token || fetched) return;
    setLoading(true);
    setFetched(true);
    fetchGitHubUserRepos(settings.github_token)
      .then((r) => setRepos(r))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [settings?.github_token]);

  // Filter to repos not cloned locally
  const githubOnly = repos.filter((r) => {
    const key = r.full_name.toLowerCase();
    const nameMatch = localProjectNames.has(r.name.toLowerCase());
    const remoteMatch = localRepoNames.has(key);
    return !nameMatch && !remoteMatch;
  });

  if (!settings?.github_token) {
    return (
      <div className="section-block" style={{ padding: "0 28px 20px" }}>
        <div className="section-title">
          GitHub-Only Repos
          <span className="section-count">?</span>
        </div>
        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          fontSize: "12px",
          color: "var(--text3)",
        }}>
          Add a GitHub token in Settings to see repos that exist on GitHub but aren't cloned locally.
        </div>
      </div>
    );
  }

  return (
    <div className="section-block" style={{ padding: "0 28px 20px" }}>
      <div className="section-title">
        GitHub-Only Repos
        <span className="section-count">{loading ? "…" : githubOnly.length}</span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="loading-state" style={{ height: 80 }}>
          <div className="spinner" />
          <span>Fetching your GitHub repos…</span>
        </div>
      )}

      {!loading && githubOnly.length === 0 && !error && (
        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          fontSize: "12px",
          color: "var(--text3)",
        }}>
          ✓ All your GitHub repos are cloned locally.
        </div>
      )}

      {!loading && githubOnly.length > 0 && (
        <div className="project-cards-grid">
          {githubOnly.map((r) => (
            <div
              key={r.full_name}
              className="project-card"
              onClick={() => window.open(r.html_url, "_blank")}
              title="Open on GitHub"
            >
              <div className="project-card-header">
                <div className="project-card-name">{r.name}</div>
                <span className="project-card-type" style={{ color: r.private ? "var(--yellow)" : "var(--green)" }}>
                  {r.private ? "private" : "public"}
                </span>
              </div>

              {r.description && (
                <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.description}
                </div>
              )}

              <div className="project-card-langs">
                {r.language && <span className="lang-tag">{r.language}</span>}
                <span className="lang-tag" style={{ color: "var(--yellow)" }}>
                  ★ {r.stars}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <span className="git-badge no-git" style={{ background: "rgba(232,184,75,0.08)", color: "var(--yellow)", borderColor: "rgba(232,184,75,0.2)" }}>
                  ☁ GitHub only
                </span>
                <span style={{ fontSize: "11px", color: "var(--text3)" }}>
                  {r.updated_at.slice(0, 10)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GitHubOnlyRepos;
