import React, { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
import { saveNote, deleteNote } from "../../lib/tauri";

interface Props { projectPath: string; }

const ALL_TAG_COLORS = ["#5b9cf6","#5cba7d","#e8b84b","#a78bfa","#e05c5c","#f59e4b","#4dd0e1"];

const NotesPanel: React.FC<Props> = ({ projectPath }) => {
  const { notes, setNote } = useStore();
  const existing = notes[projectPath];

  const [noteText, setNoteText] = useState(existing?.note ?? "");
  const [tags,     setTags]     = useState<string[]>(existing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    setNoteText(existing?.note ?? "");
    setTags(existing?.tags ?? []);
  }, [projectPath]);

  const handleSave = async () => {
    setSaving(true);
    await saveNote(projectPath, noteText, tags).catch(() => {});
    setNote(projectPath, { note: noteText, tags, updated_at: Date.now() / 1000 });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async () => {
    await deleteNote(projectPath).catch(() => {});
    setNote(projectPath, { note: "", tags: [], updated_at: 0 });
    setNoteText("");
    setTags([]);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const tagColor = (t: string) => ALL_TAG_COLORS[Math.abs(t.split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % ALL_TAG_COLORS.length];

  return (
    <div>
      <div className="section-block">
        <div className="section-block-title" style={{ marginBottom: 10 }}>Tags</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {tags.map((t) => (
            <span key={t} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 12, fontSize: 11,
              background: `${tagColor(t)}18`, border: `1px solid ${tagColor(t)}40`,
              color: tagColor(t), fontFamily: "var(--font-mono)",
            }}>
              {t}
              <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 11, lineHeight: 1, opacity: 0.7 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            className="form-input"
            placeholder="Add tag…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            style={{ fontSize: 12 }}
          />
          <button className="btn btn-ghost" onClick={addTag} style={{ fontSize: 12, whiteSpace: "nowrap" }}>+ Add</button>
        </div>
      </div>

      <div className="section-block">
        <div className="section-block-title" style={{ marginBottom: 8 }}>Notes</div>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add notes, ideas, TODOs about this project…"
          style={{
            width: "100%", minHeight: 180, resize: "vertical",
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", color: "var(--text)", padding: "10px 12px",
            fontSize: 13, fontFamily: "var(--font)", lineHeight: 1.6,
            outline: "none", transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--border2)")}
          onBlur={(e)  => (e.target.style.borderColor = "var(--border)")}
        />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "var(--text3)" }}>
          {existing?.updated_at ? `Last saved ${new Date(existing.updated_at * 1000).toLocaleString()}` : "Not saved yet"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {existing?.note && (
            <button className="btn btn-ghost" style={{ fontSize: 11, color: "var(--red)" }} onClick={handleDelete}>
              Delete
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ fontSize: 12 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Notes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotesPanel;
