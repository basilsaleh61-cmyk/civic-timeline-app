import { useState } from "react";
import OutcomeCard from "./OutcomeCard.jsx";
import TaskPanel from "./TaskPanel.jsx";
import OutreachPanel from "./OutreachPanel.jsx";
import EventPanel from "./EventPanel.jsx";
import ProtocolEditor from "./ProtocolEditor.jsx";
import { skyColorAt } from "./RollingDayDial";

// ── Time-of-day theming ────────────────────────────────────

function getSkyMode() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if      (h >= 7  && h < 17) return "day";
  else if (h >= 17 && h < 20) return "dusk";
  else                         return "night";
}

const SKY_THEMES = {
  day: {
    sidebar:     "#faf9f7",
    header:      "#faf9f7",
    headerBorder:"#e8e4dd",
    dayLabel:    "#b0a898",
    dateText:    "#1a1a1a",
    divider:     "#e8e4dd",
    scrollThumb: "#d0cdc5",
  },
  dusk: {
    sidebar:     "#f5e8d0",
    header:      "#eddbb0",
    headerBorder:"#e0c880",
    dayLabel:    "#8a6a10",
    dateText:    "#3a2800",
    divider:     "#e0c880",
    scrollThumb: "#c8a850",
  },
  night: {
    sidebar:     "#110e28",
    header:      "#0d0b22",
    headerBorder:"#2a2448",
    dayLabel:    "#8878b0",
    dateText:    "#e0d8f8",
    divider:     "#2a2448",
    scrollThumb: "#4a4070",
  },
};

// ── Tomorrow outcome card ─────────────────────────────────

function TomorrowCard({ tomorrowOutcome, onSetTomorrowText, onResolveTomorrow, theme }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft  ] = useState("");

  function handleSet() {
    if (draft.trim()) {
      onSetTomorrowText(draft.trim());
      setEditing(false);
      setDraft("");
    }
  }

  const accentColor = "#7c6cc0";
  const isEmpty = !tomorrowOutcome.text;

  return (
    <div style={{
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: "8px",
      background: "rgba(124,108,192,0.08)",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: "7px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: accentColor, flex: 1,
        }}>
          Tomorrow's Outcome
        </span>
        {!isEmpty && !editing && (
          <button
            onClick={() => { setDraft(tomorrowOutcome.text); setEditing(true); }}
            style={{ background: "none", border: "none", color: accentColor, fontSize: "10px", fontWeight: 600, cursor: "pointer", padding: "0 2px" }}
          >
            edit
          </button>
        )}
      </div>

      {isEmpty || editing ? (
        <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter")  handleSet();
              if (e.key === "Escape") { setEditing(false); setDraft(""); }
            }}
            placeholder="Set tomorrow's outcome…"
            style={{
              flex: 1, background: "rgba(255,255,255,0.6)", border: `1px solid ${accentColor}55`,
              borderRadius: "5px", padding: "5px 9px", fontSize: "12px",
              fontFamily: "inherit", color: "#1a1a1a", outline: "none",
            }}
          />
          <button
            onClick={handleSet}
            style={{
              flexShrink: 0, background: accentColor, color: "#fff", border: "none",
              borderRadius: "5px", padding: "5px 12px", fontSize: "11px",
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Set
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
          <input
            type="checkbox"
            checked={tomorrowOutcome.resolved}
            onChange={onResolveTomorrow}
            style={{ marginTop: "3px", accentColor, cursor: "pointer", flexShrink: 0 }}
          />
          <span style={{
            fontSize: "13px", lineHeight: "1.5",
            color: tomorrowOutcome.resolved ? "#aaa" : accentColor,
            textDecoration: tomorrowOutcome.resolved ? "line-through" : "none",
          }}>
            {tomorrowOutcome.text}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Date header ────────────────────────────────────────────

function DateHeader({ theme }) {
  const now     = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const date    = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return (
    <div style={{
      padding: "16px 16px 12px",
      borderBottom: `1px solid ${theme.headerBorder}`,
      flexShrink: 0,
      backgroundColor: theme.header,
    }}>
      <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.dayLabel }}>
        {dayName}
      </div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: theme.dateText, marginTop: "1px" }}>
        {date}
      </div>
    </div>
  );
}

function Divider({ color }) {
  return <div style={{ height: 1, backgroundColor: color, flexShrink: 0 }} />;
}

// ── Main sidebar ───────────────────────────────────────────

export default function Sidebar({
  outcome,
  onResolve,
  onSetText,
  tomorrowOutcome,
  onSetTomorrowText,
  onResolveTomorrow,
  tasks,
  onCompleteTask,
  onAddTask,
  outreach,
  onCompleteOutreach,
  onAddOutreach,
  onMoveOutreach,
  onUpdateOutreach,
  events,
  onAddEvent,
  onRemoveEvent,
  onUpdateEvent,
  protocols,
  onToggleProtocol,
  onUpdateProtocol,
  onDeleteProtocol,
  onAddProtocol,
  tlTopTaskRef,
  tlTopOutRef,
}) {
  const [protoOpen, setProtoOpen] = useState(false);
  const mode  = getSkyMode();
  const theme = SKY_THEMES[mode];

  return (
    <>
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: ${theme.scrollThumb}; border-radius: 99px; }
        .sidebar-scroll { scrollbar-width: thin; scrollbar-color: ${theme.scrollThumb} transparent; }
      `}</style>

      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.sidebar,
        overflow: "hidden",
        transition: "background-color 0.6s ease",
      }}>
        <DateHeader theme={theme} />

        <div
          className="sidebar-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "14px 14px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <OutcomeCard
            goal={outcome.text}
            carriedOver={outcome.carriedOver}
            resolved={outcome.resolved}
            onResolve={onResolve}
            onSetText={onSetText}
          />

          <TomorrowCard
            tomorrowOutcome={tomorrowOutcome}
            onSetTomorrowText={onSetTomorrowText}
            onResolveTomorrow={onResolveTomorrow}
            theme={theme}
          />

          <Divider color={theme.divider} />

          <TaskPanel
            tasks={tasks}
            onComplete={onCompleteTask}
            onAdd={onAddTask}
            tlTopTaskRef={tlTopTaskRef}
          />

          <OutreachPanel
            contacts={outreach}
            onComplete={onCompleteOutreach}
            onAdd={onAddOutreach}
            onMove={onMoveOutreach}
            onUpdate={onUpdateOutreach}
            tlTopOutRef={tlTopOutRef}
          />

          <EventPanel
            events={events}
            onAdd={onAddEvent}
            onRemove={onRemoveEvent}
            onUpdate={onUpdateEvent}
          />

          <Divider color={theme.divider} />

          <button
            onClick={() => setProtoOpen(true)}
            style={{
              alignSelf: "flex-start",
              fontSize: "12px",
              fontWeight: 600,
              padding: "6px 14px",
              backgroundColor: mode === "night" ? "#2a2448" : "#f0ede8",
              color: mode === "night" ? "#b0a0d8" : "#5f5e5a",
              border: `1px solid ${theme.divider}`,
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Edit protocols ↗
          </button>
        </div>
      </div>

      <ProtocolEditor
        open={protoOpen}
        onClose={() => setProtoOpen(false)}
        protocols={protocols}
        onToggle={onToggleProtocol}
        onUpdate={onUpdateProtocol}
        onDelete={onDeleteProtocol}
        onAdd={onAddProtocol}
      />
    </>
  );
}
