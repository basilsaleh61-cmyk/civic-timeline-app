import { eventColors } from "../theme.js";

export const ROW_HEIGHT = 80;

// ── TimelineEventOverlay ─────────────────────────────────────────────────────
// Floats above a protocol block to show a scheduled event within the row.
// Parent is responsible for positioning relative to the timeline container.

export function TimelineEventOverlay({ name, category, time, duration = 60 }) {
  const color = eventColors[category]?.dot ?? "#aaa";
  const bg    = eventColors[category]?.card ?? "#f5f5f5";

  // Height proportional to duration (ROW_HEIGHT = 60 min baseline)
  const height = Math.max(28, (duration / 60) * ROW_HEIGHT);

  return (
    <div style={{
      position: "absolute",
      right: 6,
      top: "50%",
      transform: "translateY(-50%)",
      height,
      width: "44%",
      backgroundColor: bg,
      border: `1.5px solid ${color}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "5px",
      padding: "4px 8px",
      zIndex: 8,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: "2px",
      overflow: "hidden",
      pointerEvents: "none",
    }}>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name}
      </div>
      {time && (
        <div style={{ fontSize: "10px", color: "#888" }}>{time}</div>
      )}
    </div>
  );
}

// ── TimelineRow ──────────────────────────────────────────────────────────────

export default function TimelineRow({
  hour,
  label,
  bgColor,
  bgOpacity = 0.18,
  title,
  meta,
  titleColor = "#1a1a1a",
  metaColor  = "#888",
  isEvent    = false,
  eventBg,
  eventBorder,
  isPast     = false,
  isVisible  = true,
  children,
}) {
  return (
    <div style={{
      display: "flex",
      height: ROW_HEIGHT,
      maxHeight: isVisible ? `${ROW_HEIGHT}px` : "0px",
      opacity: isVisible ? 1 : 0,
      overflow: "hidden",
      transition: "max-height 0.35s ease, opacity 0.35s ease",
    }}>
      {/* Time label column */}
      <div style={{
        width: 48,
        flexShrink: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        paddingTop: 10,
        paddingRight: 10,
      }}>
        <span style={{
          fontSize: "11px",
          fontWeight: 500,
          color: isPast ? "#bbb" : "#888",
          whiteSpace: "nowrap",
          transition: "color 0.3s",
        }}>
          {label}
        </span>
      </div>

      {/* Content cell */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Layer 1 — bg color wash */}
        {bgColor && (
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundColor: bgColor,
            opacity: bgOpacity,
            pointerEvents: "none",
            zIndex: 0,
          }} />
        )}

        {/* Layer 2 — fg block card */}
        <div style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          margin: "4px 6px",
          padding: "8px 10px",
          borderRadius: "6px",
          backgroundColor: isEvent ? (eventBg ?? "transparent") : "transparent",
          border: isEvent && eventBorder ? `1px solid ${eventBorder}` : "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "2px",
        }}>
          {title && (
            <div style={{
              fontSize: "13px",
              fontWeight: 600,
              color: isPast ? "#aaa" : titleColor,
              transition: "color 0.3s",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {title}
            </div>
          )}
          {meta && (
            <div style={{
              fontSize: "11px",
              color: isPast ? "#bbb" : metaColor,
              transition: "color 0.3s",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {meta}
            </div>
          )}

          {/* Slot for injected content (e.g. event overlays, now-line) */}
          {children}
        </div>

        {/* Layer 3 — past-tint overlay */}
        {isPast && (
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(20,18,15,0.45)",
            zIndex: 9,
            pointerEvents: "none",
            transition: "opacity 0.3s",
          }} />
        )}
      </div>
    </div>
  );
}
