import React, { useEffect, useState } from "react";
import type { GithubRepoSummary, GitHubData } from "../../types";
import { fetchGitHub } from "../../lib/tauri";
import { useStore } from "../../store/useStore";
import ReactMarkdown from "react-markdown";

interface Props {
  repo: GithubRepoSummary;
  onClose: () => void;
}

type Tab = "overview" | "commits" | "readme";

const GitHubRepoModal: React.FC<Props> = ({ repo, onClose }) => {
  const { settings, githubCache, setGitHub } = useStore();
  const ghKey = repo.full_name;
  const cached: GitHubData | null = githubCache[ghKey] ?? null;
  const [data, setData]     = useState<GitHubData | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError]   = useState<string | null>(null);
  const [tab, setTab]       = useState<Tab>("overview");

  useEffect(() => {
    if (cached) { setData(cached); setLoading(false); return; }
    setLoading(true);
    fetchGitHub(repo.owner, repo.name, settings?.github_token ?? null)
      .then((d) => { setData(d); setGitHub(ghKey, d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 700, maxWidth: "94vw", maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "18px 24px 0", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{repo.name}</span>
                <span className="project-card-type" style={{ color: repo.private ? "var(--yellow)" : "var(--green)" }}>
                  {repo.private ? "private" : "public"}
                </span>
                <a href={repo.html_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "var(--blue)", textDecoration: "none" }}>
                  ↗ GitHub
                </a>
              </div>
              {repo.description && (
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{repo.description}</div>
              )}
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={onClose}>✕</button>
          </div>

          {data && (
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>
              <span>★ {data.stars.toLocaleString()}</span>
              <span>⑂ {data.forks.toLocaleString()}</span>
              <span>⊙ {data.open_issues} issues</span>
              <span>⌥ {data.open_prs} PRs</span>
              {data.license_name && <span>⚖ {data.license_name}</span>}
              {data.size_kb > 0 && <span>📦 {data.size_kb >= 1024 ? `${(data.size_kb/1024).toFixed(1)} MB` : `${data.size_kb} KB`}</span>}
            </div>
          )}

          <div className="tabs">
            {(["overview","commits","readme"] as Tab[]).map((t) => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loading && <div className="loading-state"><div className="spinner" /><span>Fetching from GitHub…</span></div>}
          {error && <div className="error-banner">{error}</div>}

          {data && tab === "overview" && (
            <div>
              {data.topics.length > 0 && (
                <div className="section-block">
                  <div className="section-block-title">Topics</div>
                  <div className="branch-list">
                    {data.topics.map((t) => <span key={t} className="branch-tag">{t}</span>)}
                  </div>
                </div>
              )}
              <div className="section-block">
                <div className="section-block-title">Branches ({data.branches.length})</div>
                <div className="branch-list">
                  {data.branches.map((b) => (
                    <span key={b} className={`branch-tag ${b === data.default_branch ? "current" : ""}`}>
                      {b === data.default_branch && "● "}{b}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                {[
                  ["Created",  data.created_at.slice(0,10)],
                  ["Updated",  data.updated_at.slice(0,10)],
                  ["Default Branch", data.default_branch],
                  ["Language", repo.language ?? "—"],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data && tab === "commits" && (
            <div>
              <div className="section-block-title" style={{ marginBottom: 10 }}>Recent Commits</div>
              {data.commits.length === 0
                ? <div style={{ color: "var(--text3)", fontSize: 12 }}>No commits fetched</div>
                : (
                  <div className="commit-list">
                    {data.commits.map((c) => (
                      <div className="commit-item" key={c.hash}>
                        <span className="commit-hash">{c.short_hash}</span>
                        <span className="commit-message">{c.message}</span>
                        <span className="commit-author">{c.author}</span>
                        <span className="commit-date">{c.date.slice(0,10)}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {data && tab === "readme" && (
            data.readme
              ? <div className="docs-content"><ReactMarkdown>{data.readme}</ReactMarkdown></div>
              : <div className="docs-empty"><div style={{ fontSize: 24 }}>📄</div><div style={{ color: "var(--text3)", fontSize: 12 }}>No README found</div></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitHubRepoModal;
