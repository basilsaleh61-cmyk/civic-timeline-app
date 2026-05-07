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

export default function OutcomeCard({ goal, carriedOver, resolved, onResolve }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Today's Outcome</span>
        {carriedOver && <span style={styles.pill}>Carried Over</span>}
      </div>

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
    </div>
  );
}
