import { useState, useRef, useEffect } from "react";
import { eventColors, urgencyColors } from "../theme.js";

const amber = urgencyColors.warn;
const CATEGORIES = Object.keys(eventColors);

const SECTIONS = [
  { key: "today",    label: "Today" },
  { key: "week",     label: "This Week" },
  { key: "upcoming", label: "Upcoming" },
];

function isPastToday(event) {
  if (event.section !== "today" || !event.time) return false;
  const [h, m] = event.time.split(":").map(Number);
  const now = new Date();
  return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
}

function formatMeta(event) {
  if (!event.time) return event.category;
  const [h, m] = event.time.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  const time = `${display}:${String(m).padStart(2, "0")} ${period}`;
  return `${time} · ${event.category}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CategoryDotPicker({ selected, onSelect }) {
  return (
    <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
      {CATEGORIES.map(cat => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          title={cat}
          style={{
            width: selected === cat ? 16 : 12,
            height: selected === cat ? 16 : 12,
            borderRadius: "50%",
            backgroundColor: eventColors[cat].dot,
            border: selected === cat ? `2px solid #333` : "2px solid transparent",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          aria-label={`Category: ${cat}`}
        />
      ))}
    </div>
  );
}

function InlineAddRow({ sectionKey, onAdd, onCancel }) {
  const [name,     setName]     = useState("");
  const [time,     setTime]     = useState("");
  const [date,     setDate]     = useState(sectionKey === "today" ? todayISO() : "");
  const [category, setCategory] = useState("work");
  const rowRef = useRef(null);

  useEffect(() => {
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), time, date: date || todayISO(), category, section: sectionKey });
    setName(""); setTime(""); setDate(sectionKey === "today" ? todayISO() : "");
  }

  return (
    <div ref={rowRef} style={{ padding: "8px 4px", display: "flex", flexDirection: "column", gap: "6px" }}>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
        placeholder="Event name…"
        style={{ fontSize: "13px", padding: "5px 8px", border: `1px solid ${amber}`, borderRadius: "4px", outline: "none" }}
      />
      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          style={{ fontSize: "12px", padding: "4px 6px", border: "1px solid #ccc", borderRadius: "4px", outline: "none" }}
        />
        {sectionKey !== "today" && (
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ fontSize: "12px", padding: "4px 6px", border: "1px solid #ccc", borderRadius: "4px", outline: "none" }}
          />
        )}
        <CategoryDotPicker selected={category} onSelect={setCategory} />
        <button
          onClick={submit}
          style={{ fontSize: "12px", padding: "4px 12px", backgroundColor: amber, color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", marginLeft: "auto" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function DetailCard({ event, onSave, onRemove }) {
  const [edit, setEdit] = useState({
    name:     event.name,
    time:     event.time ?? "",
    duration: event.duration ?? "",
    category: event.category,
  });

  function field(label, key, type = "text") {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: amber }}>
          {label}
        </span>
        <input
          type={type}
          value={edit[key]}
          onChange={e => setEdit(prev => ({ ...prev, [key]: e.target.value }))}
          style={{ fontSize: "13px", padding: "5px 8px", border: "1px solid #ddd", borderRadius: "4px", outline: "none" }}
        />
      </label>
    );
  }

  return (
    <div style={{
      margin: "4px 0 6px 16px",
      padding: "10px 12px",
      backgroundColor: eventColors[edit.category]?.card ?? "#fff",
      borderRadius: "6px",
      border: `1px solid ${eventColors[edit.category]?.dot ?? "#ddd"}33`,
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    }}>
      {field("Title",    "name")}
      {field("Time",     "time",     "time")}
      {field("Duration (min)", "duration", "number")}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: amber }}>
          Category
        </span>
        <CategoryDotPicker selected={edit.category} onSelect={cat => setEdit(prev => ({ ...prev, category: cat }))} />
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "2px" }}>
        <button
          onClick={onRemove}
          style={{ fontSize: "12px", padding: "5px 12px", backgroundColor: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Remove
        </button>
        <button
          onClick={() => onSave(edit)}
          style={{ fontSize: "12px", padding: "5px 14px", backgroundColor: amber, color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function EventItem({ event, animating, expanded, onToggle, onSave, onRemove }) {
  const isAnimating = animating.has(event.id);
  const past = isPastToday(event);
  const dotColor = eventColors[event.category]?.dot ?? "#aaa";
  const isExpanded = expanded === event.id;
  const detailRef = useRef(null);

  useEffect(() => {
    if (isExpanded) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isExpanded]);

  return (
    <div style={{
      maxHeight: isAnimating ? "0px" : "600px",
      opacity: isAnimating ? 0 : past ? 0.35 : 1,
      overflow: "hidden",
      transition: "opacity 300ms ease, max-height 300ms ease",
    }}>
      <div
        onClick={() => onToggle(event.id)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0",
          cursor: "pointer",
          padding: "6px 0",
        }}
      >
        <div style={{ width: 3, alignSelf: "stretch", borderRadius: "2px", backgroundColor: dotColor, marginRight: "10px", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 500, color: "#2a2a2a" }}>{event.name}</div>
          <div style={{ fontSize: "11px", color: "#888", marginTop: "1px" }}>{formatMeta(event)}</div>
        </div>
      </div>

      {isExpanded && (
        <div ref={detailRef}>
          <DetailCard
            event={event}
            onSave={edits => onSave(event.id, edits)}
            onRemove={() => onRemove(event.id)}
          />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ section, count, open, onToggle, onAdd }) {
  const isToday = section.key === "today";
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 12px",
        borderRadius: "5px",
        cursor: "pointer",
        backgroundColor: isToday ? amber : "#fdf5e6",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: "11px", fontWeight: 700, color: isToday ? "#fff" : "#7a5a10", flex: 1 }}>
        {section.label}
      </span>
      <span style={{
        fontSize: "11px", fontWeight: 700,
        backgroundColor: isToday ? "rgba(255,255,255,0.25)" : amber,
        color: "#fff",
        borderRadius: "999px",
        padding: "1px 7px",
        minWidth: "20px",
        textAlign: "center",
      }}>
        {count}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onAdd(); }}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", lineHeight: 1, color: isToday ? "#fff" : amber, padding: "0 2px" }}
        aria-label={`Add event to ${section.label}`}
      >
        +
      </button>
      <span style={{ fontSize: "10px", color: isToday ? "rgba(255,255,255,0.7)" : amber }}>
        {open ? "▾" : "▸"}
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function EventPanel({ events, onAdd, onRemove, onUpdate }) {
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [openSections, setOpenSections] = useState(Object.fromEntries(SECTIONS.map(s => [s.key, false])));
  const [addingIn,     setAddingIn]     = useState(null);
  const [expanded,     setExpanded]     = useState(null);
  const [animating,    setAnimating]    = useState(new Set());

  function handleRemove(id) {
    setAnimating(prev => new Set(prev).add(id));
    setTimeout(() => onRemove(id), 300);
  }

  function handleAdd(eventData) {
    onAdd(eventData);
    setAddingIn(null);
  }

  return (
    <div style={{
      borderLeft: `4px solid ${amber}`,
      borderRadius: "8px",
      backgroundColor: "#fdf8ee",
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div
        onClick={() => setPanelOpen(o => !o)}
        style={{ padding: "12px 14px 10px", cursor: "pointer", backgroundColor: "#f9eec8", userSelect: "none" }}
      >
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: amber }}>
          Events
        </div>
        <div style={{ fontSize: "14px", fontWeight: 500, color: "#5a3d00", marginTop: "2px" }}>
          {events.filter(e => e.section === "today").length} today · {events.filter(e => e.section !== "today").length} upcoming
        </div>
      </div>

      {panelOpen && (
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {SECTIONS.map(section => {
            const sectionEvents = events.filter(e => e.section === section.key);
            const isOpen = openSections[section.key];

            return (
              <div key={section.key}>
                <SectionHeader
                  section={section}
                  count={sectionEvents.length}
                  open={isOpen}
                  onToggle={() => setOpenSections(prev => ({ ...prev, [section.key]: !prev[section.key] }))}
                  onAdd={() => setAddingIn(k => k === section.key ? null : section.key)}
                />
                {isOpen && (
                  <div style={{ paddingLeft: "4px" }}>
                    {sectionEvents.map(event => (
                      <EventItem
                        key={event.id}
                        event={event}
                        animating={animating}
                        expanded={expanded}
                        onToggle={id => setExpanded(prev => prev === id ? null : id)}
                        onSave={(id, edits) => { onUpdate(id, edits); setExpanded(null); }}
                        onRemove={handleRemove}
                      />
                    ))}
                    {addingIn === section.key && (
                      <InlineAddRow
                        sectionKey={section.key}
                        onAdd={handleAdd}
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
