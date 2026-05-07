import { useState } from "react";
import { blockColors, eventColors } from "../theme.js";
import OutcomeCard from "./OutcomeCard.jsx";
import TaskPanel from "./TaskPanel.jsx";
import OutreachPanel from "./OutreachPanel.jsx";
import EventPanel from "./EventPanel.jsx";
import ProtocolEditor from "./ProtocolEditor.jsx";

// ── Legend metadata ──────────────────────────────────────────────────────────

const BLOCK_LEGEND = [
  { key: "deep",       label: "Deep Work" },
  { key: "task",       label: "Task" },
  { key: "outreach",   label: "Outreach" },
  { key: "processing", label: "Processing" },
  { key: "movement",   label: "Movement" },
  { key: "protocol",   label: "Protocol" },
  { key: "sleep",      label: "Sleep / Rest" },
];

const EVENT_LEGEND = [
  { key: "work",       label: "Work" },
  { key: "collab",     label: "Collab" },
  { key: "networking", label: "Networking" },
  { key: "music",      label: "Music" },
  { key: "social",     label: "Social" },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, backgroundColor: "#e8e4dd", flexShrink: 0 }} />;
}

function DateHeader() {
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const date    = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return (
    <div style={{
      padding: "16px 16px 12px",
      borderBottom: "1px solid #e8e4dd",
      flexShrink: 0,
      backgroundColor: "#faf9f7",
    }}>
      <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b0a898" }}>
        {dayName}
      </div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a", marginTop: "1px" }}>
        {date}
      </div>
    </div>
  );
}

function BlockLegend() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#b0a898", marginBottom: "2px" }}>
        Block Types
      </div>
      {BLOCK_LEGEND.map(({ key, label }) => {
        const c = blockColors[key];
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: 18,
              height: 12,
              borderRadius: "3px",
              backgroundColor: c.bg,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "12px", color: "#555" }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function EventLegend() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#b0a898", marginBottom: "2px" }}>
        Event Categories
      </div>
      {EVENT_LEGEND.map(({ key, label }) => {
        const c = eventColors[key];
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: c.dot,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: "12px", color: "#555" }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Sidebar({
  outcome,
  onResolve,
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

  return (
    <>
      {/* Scrollbar style — scoped by class */}
      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #d0cdc5; border-radius: 99px; }
        .sidebar-scroll { scrollbar-width: thin; scrollbar-color: #d0cdc5 transparent; }
      `}</style>

      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#faf9f7",
        overflow: "hidden",
      }}>
        {/* Fixed top: date header */}
        <DateHeader />

        {/* Scrollable content */}
        <div
          className="sidebar-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 14px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <OutcomeCard
            goal={outcome.text || "No outcome set for today."}
            carriedOver={outcome.carriedOver}
            resolved={outcome.resolved}
            onResolve={onResolve}
          />

          <Divider />

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

          <Divider />

          <BlockLegend />

          <button
            onClick={() => setProtoOpen(true)}
            style={{
              alignSelf: "flex-start",
              fontSize: "12px",
              fontWeight: 600,
              padding: "6px 14px",
              backgroundColor: "#f0ede8",
              color: "#5f5e5a",
              border: "1px solid #d8d4cc",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Edit protocols ↗
          </button>

          <Divider />

          <EventLegend />
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
