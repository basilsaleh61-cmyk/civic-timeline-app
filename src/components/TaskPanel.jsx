import { useState, useMemo, useEffect, useRef } from "react";
import { blockColors, urgencyColors } from "../theme.js";

const task = blockColors.task;

const SECTIONS = [
  { key: "urgent",   label: "Today",          categories: ["urgent"] },
  { key: "work",     label: "Work / Project",  categories: ["work"] },
  { key: "admin",    label: "Admin / Errand",  categories: ["admin"] },
  { key: "shopping", label: "Shopping",        categories: ["shopping"] },
];

function getWeekEnd() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // Sun=0
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday);
  end.setHours(23, 59, 59, 999);
  return end;
}

function deadlineUrgency(sectionTasks) {
  const now = new Date();
  const weekEnd = getWeekEnd();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pending = sectionTasks.filter(t => !t.done && t.deadline);

  if (pending.some(t => new Date(t.deadline) <= weekEnd)) return "red";
  if (pending.some(t => new Date(t.deadline) <= sevenDays)) return "amber";
  return "normal";
}

function badgeStyle(urgency) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "20px",
    height: "18px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    padding: "0 6px",
  };
  if (urgency === "red")   return { ...base, backgroundColor: urgencyColors.urgent, color: "#fff" };
  if (urgency === "amber") return { ...base, backgroundColor: urgencyColors.warn, color: "#fff" };
  return { ...base, backgroundColor: "#dde6f5", color: task.text };
}

function SectionHeader({ label, count, urgency, open, onToggle, onAdd }) {
  const isUrgent = label === "Today";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 12px",
        cursor: "pointer",
        backgroundColor: isUrgent ? urgencyColors.urgent : "#eaf1fb",
        borderRadius: "5px",
        userSelect: "none",
      }}
      onClick={onToggle}
    >
      <span style={{ fontSize: "11px", fontWeight: 700, color: isUrgent ? "#fff" : task.text, flex: 1 }}>
        {label}
      </span>
      <span style={badgeStyle(urgency)}>{count}</span>
      <button
        onClick={e => { e.stopPropagation(); onAdd(); }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
          color: isUrgent ? "#fff" : task.meta,
          padding: "0 2px",
        }}
        aria-label={`Add task to ${label}`}
      >
        +
      </button>
      <span style={{ fontSize: "10px", color: isUrgent ? "rgba(255,255,255,0.7)" : task.meta }}>
        {open ? "▾" : "▸"}
      </span>
    </div>
  );
}

function InlineAddRow({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const rowRef = useRef(null);

  useEffect(() => {
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim(), deadline || null);
    setName("");
    setDeadline("");
  }

  return (
    <div ref={rowRef} style={{ display: "flex", gap: "6px", padding: "6px 4px", alignItems: "center" }}>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
        placeholder="Task name…"
        style={{
          flex: 1,
          fontSize: "13px",
          padding: "4px 8px",
          border: `1px solid ${task.meta}`,
          borderRadius: "4px",
          outline: "none",
        }}
      />
      <input
        type="date"
        value={deadline}
        onChange={e => setDeadline(e.target.value)}
        style={{
          fontSize: "12px",
          padding: "4px 6px",
          border: `1px solid #ccc`,
          borderRadius: "4px",
          outline: "none",
        }}
      />
      <button
        onClick={submit}
        style={{
          fontSize: "12px",
          padding: "4px 10px",
          backgroundColor: task.meta,
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Add
      </button>
    </div>
  );
}

function TaskItem({ t, onComplete, animating }) {
  const isAnimating = animating.has(t.id);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "6px 4px",
        overflow: "hidden",
        maxHeight: isAnimating ? "0px" : "80px",
        opacity: isAnimating ? 0 : 1,
        transition: "opacity 300ms ease, max-height 300ms ease",
      }}
    >
      <input
        type="checkbox"
        checked={t.done}
        onChange={() => onComplete(t.id)}
        style={{ marginTop: "3px", accentColor: task.meta, cursor: "pointer", flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <span style={{
          fontSize: "14px",
          color: t.done ? "#aaa" : task.text,
          textDecoration: t.done ? "line-through" : "none",
        }}>
          {t.name}
        </span>
        {t.deadline && (
          <div style={{ fontSize: "11px", color: urgencyColors.warn, marginTop: "1px" }}>
            {new Date(t.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskPanel({ tasks, onComplete, onAdd, tlTopTaskRef }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [openSections, setOpenSections] = useState(
    Object.fromEntries(SECTIONS.map(s => [s.key, false]))
  );
  const [addingIn, setAddingIn] = useState(null);
  const [animating, setAnimating] = useState(new Set());

  const topTask = useMemo(() => {
    for (const sectionKey of ["urgent", "work", "admin", "shopping"]) {
      const section = SECTIONS.find(s => s.key === sectionKey);
      const found = tasks.find(t => !t.done && section.categories.includes(t.category));
      if (found) return found;
    }
    return null;
  }, [tasks]);

  useEffect(() => {
    if (typeof tlTopTaskRef?.current === "function") {
      tlTopTaskRef.current(topTask?.name ?? null);
    }
  }, [topTask, tlTopTaskRef]);

  function handleComplete(id) {
    setAnimating(prev => new Set(prev).add(id));
    setTimeout(() => onComplete(id), 300);
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleAdd(sectionKey, name, deadline) {
    const category = SECTIONS.find(s => s.key === sectionKey).categories[0];
    onAdd({ name, deadline: deadline ? new Date(deadline).toISOString() : null, category });
    setAddingIn(null);
  }

  return (
    <div style={{
      borderLeft: `4px solid ${task.meta}`,
      borderRadius: "8px",
      backgroundColor: "#f0f6ff",
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div
        onClick={() => setPanelOpen(o => !o)}
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "12px 14px 10px",
          cursor: "pointer",
          backgroundColor: "#ddeaf8",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: task.meta }}>
          Task Block
        </span>
        <span style={{ fontSize: "14px", fontWeight: 500, color: task.text, marginTop: "2px" }}>
          {topTask ? topTask.name : "No pending tasks"}
        </span>
      </div>

      {/* Body */}
      {panelOpen && (
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {SECTIONS.map(section => {
            const sectionTasks = tasks.filter(t => section.categories.includes(t.category));
            const pending = sectionTasks.filter(t => !t.done);
            const urgency = deadlineUrgency(sectionTasks);
            const isOpen = openSections[section.key];

            return (
              <div key={section.key}>
                <SectionHeader
                  label={section.label}
                  count={pending.length}
                  urgency={urgency}
                  open={isOpen}
                  onToggle={() => toggleSection(section.key)}
                  onAdd={() => setAddingIn(k => k === section.key ? null : section.key)}
                />
                {isOpen && (
                  <div style={{ paddingLeft: "4px" }}>
                    {sectionTasks.map(t => (
                      <TaskItem key={t.id} t={t} onComplete={handleComplete} animating={animating} />
                    ))}
                    {addingIn === section.key && (
                      <InlineAddRow
                        onAdd={(name, deadline) => handleAdd(section.key, name, deadline)}
                        onCancel={() => setAddingIn(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
