import { useState } from "react";
import { blockColors } from "../theme.js";

const deep = blockColors.deep;

const styles = {
  card: {
    borderLeft: `4px solid ${deep.meta}`,
    borderRadius: "8px",
    backgroundColor: "#f5f4fc",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: deep.meta,
    flex: 1,
  },
  pill: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    backgroundColor: deep.bg,
    color: "#fff",
    borderRadius: "999px",
    padding: "2px 8px",
  },
  goalRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  checkbox: {
    marginTop: "2px",
    width: "16px",
    height: "16px",
    accentColor: deep.meta,
    cursor: "pointer",
    flexShrink: 0,
  },
};

const inputStyle = {
  flex: 1,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${deep.meta}55`,
  borderRadius: "5px",
  padding: "6px 10px",
  fontSize: "13px",
  fontFamily: "inherit",
  color: "#1a1a1a",
  outline: "none",
};

const setBtnStyle = {
  flexShrink: 0,
  background: deep.meta,
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  padding: "6px 14px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const editBtnStyle = {
  background: "none",
  border: "none",
  color: deep.meta,
  fontSize: "10px",
  fontWeight: 600,
  cursor: "pointer",
  padding: "0 2px",
  fontFamily: "inherit",
  letterSpacing: "0.04em",
};

const cancelBtnStyle = {
  background: "none",
  border: "none",
  color: "#aaa",
  fontSize: "14px",
  cursor: "pointer",
  padding: "0 2px",
  fontFamily: "inherit",
  lineHeight: 1,
};

export default function OutcomeCard({ goal, carriedOver, resolved, onResolve, onSetText }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft  ] = useState("");

  const isEmpty = !goal;

  function startEdit() {
    setDraft(goal || "");
    setEditing(true);
  }

  function handleSet() {
    if (draft.trim() && onSetText) {
      onSetText(draft.trim());
      setEditing(false);
      setDraft("");
    }
  }

  function handleCancel() {
    setEditing(false);
    setDraft("");
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Today's Outcome</span>
        {carriedOver && <span style={styles.pill}>Carried Over</span>}
        {!isEmpty && !editing && (
          <button onClick={startEdit} style={editBtnStyle}>edit</button>
        )}
      </div>

      {(isEmpty || editing) ? (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter")  handleSet();
              if (e.key === "Escape") handleCancel();
            }}
            placeholder="Set today's outcome…"
            style={inputStyle}
            autoFocus
          />
          <button onClick={handleSet}    style={setBtnStyle}>Set</button>
          {editing && (
            <button onClick={handleCancel} style={cancelBtnStyle}>✕</button>
          )}
        </div>
      ) : (
        <div style={styles.goalRow}>
          <input
            type="checkbox"
            checked={resolved}
            onChange={onResolve}
            style={styles.checkbox}
            aria-label="Mark outcome complete"
          />
          <span
            style={{
              fontSize: "15px",
              lineHeight: "1.5",
              color: resolved ? "#aaa" : deep.text,
              textDecoration: resolved ? "line-through" : "none",
              transition: "color 0.2s, text-decoration 0.2s",
            }}
          >
            {goal}
          </span>
        </div>
      )}
    </div>
  );
}
