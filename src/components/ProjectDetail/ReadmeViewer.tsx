import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ProjectDocs } from "../../types";

interface Props {
  docs: ProjectDocs;
}

type DocKey = "readme" | "license" | "contributing" | "code_of_conduct";

const DOC_LABELS: Record<DocKey, string> = {
  readme: "README",
  license: "LICENSE",
  contributing: "CONTRIBUTING",
  code_of_conduct: "CODE OF CONDUCT",
};

const ReadmeViewer: React.FC<Props> = ({ docs }) => {
  const available = (Object.keys(DOC_LABELS) as DocKey[]).filter(
    (k) => docs[k] !== null
  );

  const [active, setActive] = useState<DocKey>(available[0] ?? "readme");

  if (available.length === 0) {
    return (
      <div className="docs-empty">
        <div className="empty-state-icon">📄</div>
        <div className="empty-state-title">No documentation files found</div>
        <div className="empty-state-desc">
          README.md, LICENSE, CONTRIBUTING.md, and CODE_OF_CONDUCT.md were not found in this project.
        </div>
      </div>
    );
  }

  const content = docs[active];

  return (
    <div>
      <div className="docs-tabs">
        {available.map((k) => (
          <button
            key={k}
            className={`docs-tab-btn ${active === k ? "active" : ""}`}
            onClick={() => setActive(k)}
          >
            {DOC_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="docs-content">
        {content ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : (
          <div style={{ color: "var(--text3)", fontSize: "12px" }}>
            No content available.
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadmeViewer;
