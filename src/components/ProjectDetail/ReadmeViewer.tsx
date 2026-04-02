import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { ProjectDocs } from "../../types";
import { getFileTree, readProjectFile } from "../../lib/tauri";

interface Props { docs: ProjectDocs; projectPath: string; }

type DocKey = "readme" | "license" | "contributing" | "code_of_conduct";

const DOC_LABELS: Record<DocKey, string> = {
  readme: "README", license: "LICENSE",
  contributing: "CONTRIBUTING", code_of_conduct: "CODE OF CONDUCT",
};

interface DocFile { label: string; content: string; }

const ReadmeViewer: React.FC<Props> = ({ docs, projectPath }) => {
  const [extraDocs, setExtraDocs]   = useState<DocFile[]>([]);
  const [activeTab, setActiveTab]   = useState<string | null>(null);
  const [tabContent, setTabContent] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  const builtinTabs = (Object.keys(DOC_LABELS) as DocKey[]).filter((k) => docs[k] !== null);

  // Scan docs/ folder
  useEffect(() => {
    const docsPath = projectPath + (projectPath.includes("/") ? "/" : "\\") + "docs";
    getFileTree(docsPath)
      .then((nodes) => {
        const mdFiles = nodes
          .filter((n) => !n.is_dir && (n.extension === "md" || n.extension === "mdx" || n.extension === "txt"))
          .slice(0, 12);
        setExtraDocs(mdFiles.map((n) => ({ label: n.name, content: "" })));
      })
      .catch(() => {}); // docs/ folder may not exist
  }, [projectPath]);

  // Set initial active tab
  useEffect(() => {
    if (!activeTab) {
      if (builtinTabs.length > 0) setActiveTab(builtinTabs[0]);
      else if (extraDocs.length > 0) setActiveTab(`extra:${extraDocs[0].label}`);
    }
  }, [builtinTabs.length, extraDocs.length]);

  // Load extra doc content when selected
  useEffect(() => {
    if (!activeTab?.startsWith("extra:")) return;
    const fileName = activeTab.slice(6);
    const sep = projectPath.includes("/") ? "/" : "\\";
    const filePath = `${projectPath}${sep}docs${sep}${fileName}`;
    setLoading(true);
    readProjectFile(filePath)
      .then(setTabContent)
      .catch(() => setTabContent("Could not read file."))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const allTabs = builtinTabs.length === 0 && extraDocs.length === 0;
  if (allTabs) {
    return (
      <div className="docs-empty">
        <div className="empty-state-icon">📄</div>
        <div className="empty-state-title">No documentation files found</div>
        <div className="empty-state-desc">README.md, LICENSE, CONTRIBUTING.md, or a docs/ folder were not found.</div>
      </div>
    );
  }

  const getContent = (): string | null => {
    if (!activeTab) return null;
    if (activeTab.startsWith("extra:")) return tabContent;
    return docs[activeTab as DocKey] ?? null;
  };

  const content = getContent();

  return (
    <div>
      <div className="docs-tabs" style={{ flexWrap: "wrap" }}>
        {builtinTabs.map((k) => (
          <button key={k} className={`docs-tab-btn ${activeTab === k ? "active" : ""}`}
            onClick={() => setActiveTab(k)}>
            {DOC_LABELS[k]}
          </button>
        ))}
        {extraDocs.length > 0 && (
          <>
            {builtinTabs.length > 0 && (
              <span style={{ alignSelf: "center", fontSize: 10, color: "var(--text3)", margin: "0 4px" }}>docs/</span>
            )}
            {extraDocs.map((d) => (
              <button key={`extra:${d.label}`}
                className={`docs-tab-btn ${activeTab === `extra:${d.label}` ? "active" : ""}`}
                onClick={() => setActiveTab(`extra:${d.label}`)}>
                {d.label}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="docs-content">
        {loading
          ? <div className="loading-state" style={{ height: 80 }}><div className="spinner" /></div>
          : content
            ? <ReactMarkdown>{content}</ReactMarkdown>
            : <div style={{ color: "var(--text3)", fontSize: 12 }}>No content available.</div>}
      </div>
    </div>
  );
};

export default ReadmeViewer;
