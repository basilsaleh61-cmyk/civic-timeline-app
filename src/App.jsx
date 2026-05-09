import { useState, useRef, useMemo } from "react";
import { TASKS, OUTREACH, EVENTS, TODAY_OUTCOME } from "./models.js";
import { useProtocols } from "./hooks/useProtocols.js";
import { HorizonTimeline } from "./components/HorizonTimeline";
import { RollingDayDial }  from "./components/RollingDayDial";
import Sidebar from "./components/Sidebar.jsx";
import "./App.css";

// ── Protocol row definitions ──────────────────────────────────
// Each active protoKey becomes a TimeBlock on the day dial.

const ROW_BLOCKS = [
  { id: "wake",       protoKey: "wake",       title: "Wake",       startH: 6,    endH: 7,    type: "routine"  },
  { id: "movement",   protoKey: "movement",   title: "Movement",   startH: 7,    endH: 8,    type: "routine"  },
  { id: "meal1",      protoKey: "meal1",      title: "Meal",       startH: 8,    endH: 9,    type: "routine"  },
  { id: "deep1",      protoKey: "deep1",      title: "Deep Work",  startH: 9,    endH: 11,   type: "task"     },
  { id: "task",       protoKey: "task",       title: "Task Block", startH: 11,   endH: 13,   type: "task"     },
  { id: "meal2",      protoKey: "meal2",      title: "Meal",       startH: 13,   endH: 14,   type: "routine"  },
  { id: "outreach",   protoKey: "outreach",   title: "Outreach",   startH: 14,   endH: 15,   type: "prep"     },
  { id: "processing", protoKey: "processing", title: "Processing", startH: 15,   endH: 17,   type: "recovery" },
  { id: "deep2",      protoKey: "deep2",      title: "Deep Work",  startH: 17,   endH: 19,   type: "task"     },
  { id: "meal3",      protoKey: "meal3",      title: "Meal",       startH: 19,   endH: 21,   type: "routine"  },
  { id: "winddown",   protoKey: "winddown",   title: "Wind Down",  startH: 21,   endH: 22.5, type: "recovery" },
  { id: "sleep",      protoKey: "sleep",      title: "Sleep",      startH: 22.5, endH: 29.5, type: "sleep"    },
];

// Convert decimal hour (≥24 = next day) to a Date
function atH(h) {
  const d = new Date();
  const offset = h >= 24 ? 1 : 0;
  const hh = h >= 24 ? h - 24 : h;
  d.setDate(d.getDate() + offset);
  d.setHours(Math.floor(hh), Math.round((hh % 1) * 60), 0, 0);
  return d;
}

// Mirror of computeActiveRowIds from TimelineDay / useProtocols
function computeActiveProtoKeys(protocols) {
  const today    = new Date();
  const dayIndex = (today.getDay() + 6) % 7; // Mon=0
  const claimed  = new Set();

  for (const tier of ["exception", "daySpecific", "base"]) {
    for (const p of protocols.filter(pr => pr.active && pr.category === tier)) {
      if (tier === "exception") {
        if (!p.dateRange) continue;
        const [s, e] = p.dateRange.split(/\s*[–-]\s*/);
        const yr  = today.getFullYear();
        const end = new Date(`${e.trim()} ${yr}`);
        end.setHours(23, 59, 59, 999);
        if (today < new Date(`${s.trim()} ${yr}`) || today > end) continue;
      } else {
        if (!p.days.includes(dayIndex)) continue;
      }
      for (const key of p.protoKeys) {
        if (tier === "base" || !claimed.has(key)) claimed.add(key);
      }
    }
  }
  return claimed;
}

function genId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const EVT_COLORS = {
  work:       "#7F77DD",
  collab:     "#D4537E",
  networking: "#BA7517",
  music:      "#639922",
  social:     "#D85A30",
};

// ── Legend bar ────────────────────────────────────────────────

const BLOCK_LEGEND = [
  { label: "Routine",  color: "rgba(29,158,117,0.55)" },
  { label: "Task",     color: "rgba(55,138,221,0.55)" },
  { label: "Prep",     color: "rgba(216,90,48,0.55)"  },
  { label: "Recovery", color: "rgba(99,153,34,0.55)"  },
  { label: "Sleep",    color: "rgba(68,68,65,0.55)"   },
];

const EVENT_LEGEND = [
  { label: "Work",       color: EVT_COLORS.work       },
  { label: "Collab",     color: EVT_COLORS.collab     },
  { label: "Networking", color: EVT_COLORS.networking },
  { label: "Music",      color: EVT_COLORS.music      },
  { label: "Social",     color: EVT_COLORS.social     },
];

function LegendBar() {
  return (
    <div className="app-legend">
      <span className="app-legend-heading">Blocks</span>
      {BLOCK_LEGEND.map(({ label, color }) => (
        <span key={label} className="app-legend-item">
          <span className="app-legend-swatch" style={{ background: color }} />
          {label}
        </span>
      ))}
      <span className="app-legend-sep" />
      <span className="app-legend-heading">Events</span>
      {EVENT_LEGEND.map(({ label, color }) => (
        <span key={label} className="app-legend-item">
          <span className="app-legend-dot" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────

export default function App() {
  // ── Horizon state ─────────────────────────────────────────
  const [spans, setSpans] = useState([]);

  // ── Civic state ───────────────────────────────────────────
  const [tasks,           setTasks]          = useState(TASKS);
  const [outreach,        setOutreach]        = useState(OUTREACH);
  const [events,          setEvents]          = useState(EVENTS);
  const [outcome,         setOutcome]         = useState(TODAY_OUTCOME);
  const [tomorrowOutcome, setTomorrowOutcome] = useState({ text: "", resolved: false });

  const { protocols, toggleProtocol, updateProtocol, deleteProtocol, addProtocol } = useProtocols();

  const tlTopTaskRef = useRef(null);
  const tlTopOutRef  = useRef(null);

  // ── Derived dial blocks ────────────────────────────────────
  const derivedBlocks = useMemo(() => {
    const activeKeys = computeActiveProtoKeys(protocols);

    const protoBlocks = ROW_BLOCKS
      .filter(row => activeKeys.has(row.protoKey))
      .map(row => ({
        id:    `proto-${row.id}`,
        title: row.title,
        start: atH(row.startH),
        end:   atH(row.endH),
        type:  row.type,
      }));

    const evtBlocks = events
      .filter(e => e.section === "today" && e.time)
      .map(e => {
        const [hh, mm] = e.time.split(":").map(Number);
        const start = new Date();
        start.setHours(hh, mm, 0, 0);
        const end = new Date(start.getTime() + (e.duration ?? 60) * 60_000);
        return {
          id:            `evt-${e.id}`,
          title:         e.name,
          start,
          end,
          type:          "prep",
          isEvent:       true,
          protocolColor: EVT_COLORS[e.category ?? "work"] ?? "#7F77DD",
        };
      });

    return [...protoBlocks, ...evtBlocks];
  }, [protocols, events]);

  // ── Horizon event bars ─────────────────────────────────────
  const horizonEventBars = useMemo(() => {
    return events
      .filter(e => e.section === "today" && e.time)
      .map(e => {
        const [hh, mm] = e.time.split(":").map(Number);
        const start = new Date();
        start.setHours(hh, mm, 0, 0);
        const end = new Date(start.getTime() + (e.duration ?? 60) * 60_000);
        return {
          id:    `htevt-${e.id}`,
          title: e.name,
          start,
          end,
          color: EVT_COLORS[e.category ?? "work"] ?? "#7F77DD",
        };
      });
  }, [events]);

  // ── Drag overrides (session-scoped block repositioning) ────
  const [blockOverrides, setBlockOverrides] = useState(new Map());

  const blocks = useMemo(
    () => derivedBlocks.map(b => {
      const ov = blockOverrides.get(b.id);
      return ov ? { ...b, ...ov } : b;
    }),
    [derivedBlocks, blockOverrides]
  );

  function updateBlock(updated) {
    setBlockOverrides(prev => {
      const next = new Map(prev);
      next.set(updated.id, { start: updated.start, end: updated.end });
      return next;
    });
  }

  // ── Horizon handler ───────────────────────────────────────
  function addSpan(span) {
    setSpans(prev => [...prev, span]);
  }

  // ── Task handlers ─────────────────────────────────────────
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

  // ── Outreach handlers ─────────────────────────────────────
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

  // ── Event handlers ────────────────────────────────────────
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

  // ── Outcome handlers ──────────────────────────────────────
  function handleResolveOutcome() {
    setOutcome(prev => ({ ...prev, resolved: !prev.resolved }));
  }

  function handleSetOutcomeText(text) {
    setOutcome(prev => ({ ...prev, text, resolved: false }));
  }

  function handleSetTomorrowText(text) {
    setTomorrowOutcome(prev => ({ ...prev, text, resolved: false }));
  }

  function handleResolveTomorrow() {
    setTomorrowOutcome(prev => ({ ...prev, resolved: !prev.resolved }));
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="app">
      <HorizonTimeline spans={spans} onAddSpan={addSpan} eventBars={horizonEventBars} />

      <div className="app-body">
        <div className="app-dial">
          <RollingDayDial blocks={blocks} onUpdate={updateBlock} />
        </div>

        <div className="app-panel">
          <Sidebar
            outcome={outcome}
            onResolve={handleResolveOutcome}
            onSetText={handleSetOutcomeText}
            tomorrowOutcome={tomorrowOutcome}
            onSetTomorrowText={handleSetTomorrowText}
            onResolveTomorrow={handleResolveTomorrow}

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
      </div>

      <LegendBar />
    </div>
  );
}
