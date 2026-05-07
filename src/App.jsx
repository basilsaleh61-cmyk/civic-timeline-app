import { useState, useRef } from "react";
import {
  PROTOCOLS,
  TASKS,
  OUTREACH,
  EVENTS,
  TODAY_OUTCOME,
} from "./models.js";
import { useProtocols } from "./hooks/useProtocols.js";
import Sidebar     from "./components/Sidebar.jsx";
import TimelineDay from "./components/TimelineDay.jsx";

function genId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [tasks,   setTasks]   = useState(TASKS);
  const [outreach, setOutreach] = useState(OUTREACH);
  const [events,  setEvents]  = useState(EVENTS);
  const [outcome, setOutcome] = useState(TODAY_OUTCOME);
  const [simHour, setSimHour] = useState(null); // null = use real time in TimelineDay

  const {
    protocols,
    toggleProtocol,
    updateProtocol,
    deleteProtocol,
    addProtocol,
  } = useProtocols();

  // Refs forwarded to TimelineDay so it can read live top-task / top-contact
  const tlTopTaskRef = useRef(null);
  const tlTopOutRef  = useRef(null);

  // ── Task handlers ──────────────────────────────────────────────────────────
  function handleCompleteTask(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: true } : t));
  }

  function handleAddTask({ name, deadline, category }) {
    setTasks(prev => [...prev, {
      id:        genId("task"),
      name,
      deadline:  deadline ?? null,
      category:  category ?? "work",
      done:      false,
      createdAt: new Date().toISOString(),
    }]);
  }

  // ── Outreach handlers ──────────────────────────────────────────────────────
  function handleCompleteOutreach(id) {
    setOutreach(prev => prev.map(c => c.id === id ? { ...c, done: true } : c));
  }

  function handleAddOutreach({ person, context, status, nextAction, resurface }) {
    setOutreach(prev => [...prev, {
      id:         genId("out"),
      person,
      context:    context ?? "",
      lastTouch:  new Date().toISOString().slice(0, 10),
      nextAction: nextAction ?? "",
      resurface:  resurface ?? null,
      status:     status ?? "active",
      done:       false,
    }]);
  }

  function handleMoveOutreach(id, newStatus) {
    setOutreach(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  }

  function handleUpdateOutreach(id, changes) {
    setOutreach(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
  }

  // ── Event handlers ─────────────────────────────────────────────────────────
  function handleAddEvent({ name, time, date, category, section, duration, tlRowId }) {
    setEvents(prev => [...prev, {
      id:       genId("evt"),
      name,
      time:     time ?? "",
      duration: duration ?? 60,
      date:     date ?? new Date().toISOString().slice(0, 10),
      category: category ?? "work",
      section:  section ?? "today",
      tlRowId:  tlRowId ?? null,
    }]);
  }

  function handleRemoveEvent(id) {
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  function handleUpdateEvent(id, changes) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e));
  }

  // ── Outcome handler ────────────────────────────────────────────────────────
  function handleResolveOutcome() {
    setOutcome(prev => ({ ...prev, resolved: !prev.resolved }));
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display:  "grid",
      gridTemplateColumns: "220px 1fr",
      height:   "100vh",
      overflow: "hidden",
      backgroundColor: "#f5f3ef",
    }}>
      {/* Sidebar */}
      <div style={{ height: "100vh", overflow: "hidden", borderRight: "1px solid #e8e4dd" }}>
        <Sidebar
          outcome={outcome}
          onResolve={handleResolveOutcome}

          tasks={tasks}
          onCompleteTask={handleCompleteTask}
          onAddTask={handleAddTask}
          tlTopTaskRef={tlTopTaskRef}

          outreach={outreach}
          onCompleteOutreach={handleCompleteOutreach}
          onAddOutreach={handleAddOutreach}
          onMoveOutreach={handleMoveOutreach}
          onUpdateOutreach={handleUpdateOutreach}
          tlTopOutRef={tlTopOutRef}

          events={events}
          onAddEvent={handleAddEvent}
          onRemoveEvent={handleRemoveEvent}
          onUpdateEvent={handleUpdateEvent}

          protocols={protocols}
          onToggleProtocol={toggleProtocol}
          onUpdateProtocol={updateProtocol}
          onDeleteProtocol={deleteProtocol}
          onAddProtocol={addProtocol}
        />
      </div>

      {/* Timeline */}
      <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <TimelineDay
          protocols={protocols}
          tasks={tasks}
          outreach={outreach}
          events={events}
          outcome={outcome}
          simHour={simHour}
          onSimHourChange={setSimHour}
        />
      </div>
    </div>
  );
}
