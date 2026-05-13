import { useState } from "react";
import OutcomeCard from "./OutcomeCard.jsx";
import TaskPanel from "./TaskPanel.jsx";
import OutreachPanel from "./OutreachPanel.jsx";
import EventPanel from "./EventPanel.jsx";
import ProtocolEditor from "./ProtocolEditor.jsx";
import { blockColors, urgencyColors } from "../theme.js";

// ── Time-of-day theming ────────────────────────────────────

function getSkyMode() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return (h >= 6 && h < 18) ? "day" : "night";
}

const SKY_THEMES = {
  day: {
    sidebar:      "#F4EBD8",
    header:       "#EDE4D0",
    headerBorder: "#D8CEBC",
    dayLabel:     "#8a7a62",
    dateText:     "#1a1a1a",
    divider:      "#D8CEBC",
    scrollThumb:  "#c0b8a8",
    bar:          "#E8DEC8",
  },
  night: {
    sidebar:      "#DDD1BC",
    header:       "#CEC4AE",
    headerBorder: "#C4BAA4",
    dayLabel:     "#7a6e5a",
    dateText:     "#1a1a1a",
    divider:      "#C4BAA4",
    scrollThumb:  "#b8b0a0",
    bar:          "#C8BEA8",
  },
};

// ── Collapsed bar badge ────────────────────────────────────

function CollapsedBadge({ count, color, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
      <div style={{
        width: 30, height: 30,
        borderRadius: "50%",
        backgroundColor: count > 0 ? color : "rgba(0,0,0,0.10)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "12px", fontWeight: 700,
        color: count > 0 ? "#fff" : "rgba(0,0,0,0.30)",
        transition: "background-color 0.2s",
      }}>
        {count}
      </div>
      <div style={{
        fontSize: "7px", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: count > 0 ? color : "rgba(0,0,0,0.25)",
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Tomorrow outcome card ─────────────────────────────────

function TomorrowCard({ tomorrowOutcome, onSetTomorrowText, onResolveTomorrow }) {
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
      display: "flex", flexDirection: "column", gap: "7px",
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

function Divider({ color }) {
  return <div style={{ height: 1, backgroundColor: color, flexShrink: 0 }} />;
}

// ── Main sidebar ───────────────────────────────────────────

export default function Sidebar({
  editOpen,
  onOpenEdit,
  onCloseEdit,
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

  // Counts for collapsed bar — today's bucket only
  const pendingTasks   = tasks.filter(t => !t.done && t.category === "urgent").length;
  const activeOutreach = outreach.filter(c => !c.done && c.status === "today").length;
  const todayEvents    = events.filter(e => e.section === "today").length;

  const now       = new Date();
  const dayAbbr   = now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dateNum   = now.getDate();
  const monthAbbr = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const dayName   = now.toLocaleDateString("en-US", { weekday: "long" });
  const dateFull  = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // ── Collapsed bar ──────────────────────────────────────
  if (!editOpen) {
    return (
      <div
        onClick={onOpenEdit}
        style={{
          width: "52px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 0 20px",
          gap: "0",
          backgroundColor: theme.bar,
          cursor: "pointer",
          userSelect: "none",
          transition: "background-color 0.6s ease",
          overflow: "hidden",
        }}
      >
        {/* Date pill */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.12em", color: theme.dayLabel }}>
            {dayAbbr}
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: theme.dateText, lineHeight: 1.1 }}>
            {dateNum}
          </div>
          <div style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "0.10em", color: theme.dayLabel }}>
            {monthAbbr}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", alignItems: "center" }}>
          <CollapsedBadge count={pendingTasks}   color={blockColors.task.meta}    label="tasks" />
          <CollapsedBadge count={activeOutreach}  color={blockColors.outreach.meta} label="reach" />
          <CollapsedBadge count={todayEvents}     color={urgencyColors.warn}        label="events" />
        </div>

        {/* Expand hint */}
        <div style={{
          marginTop: "auto",
          fontSize: "18px",
          color: theme.dayLabel,
          opacity: 0.5,
          lineHeight: 1,
        }}>
          ›
        </div>
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────
  return (
    <>
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 6px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.06); border-radius: 99px; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: ${theme.scrollThumb}; border-radius: 99px; }
        .sidebar-scroll { scrollbar-width: thin; scrollbar-color: ${theme.scrollThumb} rgba(0,0,0,0.06); }

        .panel-scroll::-webkit-scrollbar { width: 5px; }
        .panel-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 99px; }
        .panel-scroll::-webkit-scrollbar-thumb { background: ${theme.scrollThumb}; border-radius: 99px; }
        .panel-scroll { scrollbar-width: thin; scrollbar-color: ${theme.scrollThumb} rgba(0,0,0,0.05); }
      `}</style>

      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.sidebar,
        overflow: "hidden",
        transition: "background-color 0.6s ease",
      }}>
        {/* Header with back button */}
        <div style={{
          padding: "12px 14px 10px",
          borderBottom: `1px solid ${theme.headerBorder}`,
          flexShrink: 0,
          backgroundColor: theme.header,
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <button
            onClick={onCloseEdit}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "20px", lineHeight: 1, color: theme.dayLabel,
              padding: "0 4px 0 0", flexShrink: 0,
              fontFamily: "inherit",
            }}
            aria-label="Collapse panel"
          >
            ‹
          </button>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.dayLabel }}>
              {dayName}
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: theme.dateText, marginTop: "1px" }}>
              {dateFull}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          className="sidebar-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
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
              backgroundColor: theme.headerBorder,
              color: theme.dayLabel,
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
