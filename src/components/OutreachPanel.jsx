import { useState, useMemo, useEffect, useRef } from "react";
import { blockColors, urgencyColors } from "../theme.js";

const out = blockColors.outreach;
const proto = blockColors.protocol;

const SECTIONS = [
  { key: "today",   label: "Today" },
  { key: "active",  label: "Active" },
  { key: "waiting", label: "Waiting" },
  { key: "dormant", label: "Dormant" },
];

const STATUS_COLORS = {
  today:   urgencyColors.urgent,
  active:  out.bg,
  waiting: urgencyColors.warn,
  dormant: proto.bg,
};

function resurfaceUrgency(resurface) {
  if (!resurface) return "gray";
  if (resurface === "today") return "red";
  const d = new Date(resurface);
  if (isNaN(d)) return "gray";
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (d <= todayEnd) return "red";
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (d <= sevenDays) return "amber";
  return "gray";
}

function formatResurface(resurface) {
  if (!resurface || resurface === "today") return "Today";
  const d = new Date(resurface);
  if (isNaN(d)) return resurface;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ResurfaceBadge({ resurface }) {
  const urgency = resurfaceUrgency(resurface);
  const color = urgency === "red" ? urgencyColors.urgent : urgency === "amber" ? urgencyColors.warn : "#b0aaa0";
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 600,
      color,
      border: `1px solid ${color}`,
      borderRadius: "999px",
      padding: "1px 7px",
      whiteSpace: "nowrap",
      flexShrink: 0,
    }}>
      {formatResurface(resurface)}
    </span>
  );
}

function SectionHeader({ section, count, open, onToggle, onAdd, dragOver }) {
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
        backgroundColor: dragOver ? "#fde4d8" : "#fdf0eb",
        transition: "background-color 0.15s",
        userSelect: "none",
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        backgroundColor: STATUS_COLORS[section.key],
        flexShrink: 0,
      }} />
      <span style={{ fontSize: "11px", fontWeight: 700, color: out.text, flex: 1 }}>
        {section.label}
      </span>
      <span style={{
        fontSize: "11px", fontWeight: 700,
        backgroundColor: STATUS_COLORS[section.key],
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
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: "16px", lineHeight: 1, color: out.meta, padding: "0 2px",
        }}
        aria-label={`Add contact to ${section.label}`}
      >
        +
      </button>
      <span style={{ fontSize: "10px", color: out.meta }}>
        {open ? "▾" : "▸"}
      </span>
    </div>
  );
}

function InlineAddRow({ onAdd, onCancel }) {
  const [person, setPerson] = useState("");
  const [context, setContext] = useState("");
  const rowRef = useRef(null);

  useEffect(() => {
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  function submit() {
    if (!person.trim()) return;
    onAdd(person.trim(), context.trim());
    setPerson(""); setContext("");
  }

  return (
    <div ref={rowRef} style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "6px 4px" }}>
      <input
        autoFocus
        value={person}
        onChange={e => setPerson(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
        placeholder="Person name…"
        style={{ fontSize: "13px", padding: "4px 8px", border: `1px solid ${out.meta}`, borderRadius: "4px", outline: "none" }}
      />
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Context…"
          style={{ flex: 1, fontSize: "12px", padding: "4px 8px", border: "1px solid #ccc", borderRadius: "4px", outline: "none" }}
        />
        <button
          onClick={submit}
          style={{ fontSize: "12px", padding: "4px 10px", backgroundColor: out.meta, color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function DetailCard({ contact, onSave }) {
  const [edit, setEdit] = useState({
    person:     contact.person,
    context:    contact.context,
    lastTouch:  contact.lastTouch ?? "",
    nextAction: contact.nextAction,
    resurface:  contact.resurface === "today" ? "today" : (contact.resurface?.slice(0, 10) ?? ""),
  });

  useEffect(() => {
    setEdit({
      person:     contact.person,
      context:    contact.context,
      lastTouch:  contact.lastTouch ?? "",
      nextAction: contact.nextAction,
      resurface:  contact.resurface === "today" ? "today" : (contact.resurface?.slice(0, 10) ?? ""),
    });
  }, [contact.id]);

  const field = (label, key, type = "text") => (
    <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: out.meta }}>
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

  return (
    <div style={{
      marginLeft: "26px",
      padding: "10px 12px",
      backgroundColor: "#fff7f4",
      borderRadius: "6px",
      border: `1px solid #f0ccc0`,
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    }}>
      {field("Person", "person")}
      {field("Context", "context")}
      {field("Next Action", "nextAction")}
      {field("Last Touch", "lastTouch", "date")}
      <label style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: out.meta }}>
          Resurface
        </span>
        <input
          value={edit.resurface}
          onChange={e => setEdit(prev => ({ ...prev, resurface: e.target.value }))}
          placeholder="today or YYYY-MM-DD"
          style={{ fontSize: "13px", padding: "5px 8px", border: "1px solid #ddd", borderRadius: "4px", outline: "none" }}
        />
      </label>
      <button
        onClick={() => onSave(edit)}
        style={{
          alignSelf: "flex-end",
          fontSize: "12px",
          padding: "5px 14px",
          backgroundColor: out.meta,
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Save
      </button>
    </div>
  );
}

function ContactItem({ contact, onComplete, animating, expanded, onToggleExpand, onSave, onDragStart, onDragEnd }) {
  const isAnimating = animating.has(contact.id);
  const isExpanded = expanded === contact.id;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, contact)}
      onDragEnd={onDragEnd}
      style={{
        maxHeight: isAnimating ? "0px" : "600px",
        opacity: isAnimating ? 0 : 1,
        overflow: "hidden",
        transition: "opacity 300ms ease, max-height 300ms ease",
        cursor: "grab",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "7px 4px" }}>
        <input
          type="checkbox"
          checked={contact.done}
          onChange={() => onComplete(contact.id)}
          style={{ marginTop: "3px", accentColor: out.meta, cursor: "pointer", flexShrink: 0 }}
        />
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          backgroundColor: STATUS_COLORS[contact.status],
          marginTop: 5, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: out.text }}>{contact.person}</div>
          <div style={{ fontSize: "12px", color: out.meta, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {contact.nextAction}
          </div>
        </div>
        <ResurfaceBadge resurface={contact.resurface} />
        <button
          onClick={() => onToggleExpand(contact.id)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "16px", color: out.meta, padding: "0 4px", lineHeight: 1, flexShrink: 0,
          }}
          aria-label="Expand contact detail"
        >
          ···
        </button>
      </div>

      {isExpanded && (
        <DetailCard contact={contact} onSave={edits => onSave(contact.id, edits)} />
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OutreachPanel({ contacts, onComplete, onAdd, onMove, onUpdate, tlTopOutRef }) {
  const [panelOpen,    setPanelOpen]    = useState(true);
  const [openSections, setOpenSections] = useState(Object.fromEntries(SECTIONS.map(s => [s.key, false])));
  const [addingIn,     setAddingIn]     = useState(null);
  const [expanded,     setExpanded]     = useState(null);
  const [animating,    setAnimating]    = useState(new Set());
  const [archived,     setArchived]     = useState([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [dragOver,     setDragOver]     = useState(null);
  const draggingRef = useRef(null);

  const topContact = useMemo(() => (
    contacts.find(c => !c.done && c.status === "today") ||
    contacts.find(c => !c.done && c.status === "active") ||
    null
  ), [contacts]);

  useEffect(() => {
    if (typeof tlTopOutRef?.current === "function") {
      tlTopOutRef.current(topContact ? `${topContact.person} — ${topContact.nextAction}` : null);
    }
  }, [topContact, tlTopOutRef]);

  function handleComplete(id) {
    const contact = contacts.find(c => c.id === id);
    setAnimating(prev => new Set(prev).add(id));
    setTimeout(() => {
      if (contact) setArchived(prev => [...prev, contact]);
      onComplete(id);
    }, 300);
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleAdd(sectionKey, person, context) {
    onAdd({ person, context, status: sectionKey, nextAction: "", resurface: null });
    setAddingIn(null);
  }

  function handleDragStart(e, contact) {
    draggingRef.current = contact;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    draggingRef.current = null;
    setDragOver(null);
  }

  function handleDrop(e, targetStatus) {
    e.preventDefault();
    const contact = draggingRef.current;
    if (!contact || contact.status === targetStatus) return;
    onMove(contact.id, targetStatus);
    setDragOver(null);
    draggingRef.current = null;
  }

  return (
    <div style={{
      borderLeft: `4px solid ${out.meta}`,
      borderRadius: "8px",
      backgroundColor: "#fdf3ef",
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div
        onClick={() => setPanelOpen(o => !o)}
        style={{
          padding: "12px 14px 10px",
          cursor: "pointer",
          backgroundColor: "#f9e4db",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: out.meta }}>
          Outreach Block
        </div>
        <div style={{ fontSize: "14px", fontWeight: 500, color: out.text, marginTop: "2px" }}>
          {topContact ? `${topContact.person} — ${topContact.nextAction}` : "No outreach queued"}
        </div>
      </div>

      {panelOpen && (
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {SECTIONS.map(section => {
            const sectionContacts = contacts.filter(c => c.status === section.key && !c.done);
            const isOpen = openSections[section.key];

            return (
              <div
                key={section.key}
                onDragOver={e => { e.preventDefault(); setDragOver(section.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, section.key)}
              >
                <SectionHeader
                  section={section}
                  count={sectionContacts.length}
                  open={isOpen}
                  onToggle={() => toggleSection(section.key)}
                  onAdd={() => setAddingIn(k => k === section.key ? null : section.key)}
                  dragOver={dragOver === section.key}
                />
                {isOpen && (
                  <div style={{ paddingLeft: "4px" }}>
                    {sectionContacts.map(contact => (
                      <ContactItem
                        key={contact.id}
                        contact={contact}
                        onComplete={handleComplete}
                        animating={animating}
                        expanded={expanded}
                        onToggleExpand={id => setExpanded(prev => prev === id ? null : id)}
                        onSave={(id, edits) => { onUpdate(id, edits); setExpanded(null); }}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                    {addingIn === section.key && (
                      <InlineAddRow
                        onAdd={(person, context) => handleAdd(section.key, person, context)}
                        onCancel={() => setAddingIn(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Archived today */}
          {archived.length > 0 && (
            <div>
              <div
                onClick={() => setArchivedOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "6px 12px", borderRadius: "5px",
                  backgroundColor: "#f0e8e4", cursor: "pointer", userSelect: "none",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: out.meta, flex: 1 }}>
                  Archived Today
                </span>
                <span style={{
                  fontSize: "11px", fontWeight: 700,
                  backgroundColor: out.meta, color: "#fff",
                  borderRadius: "999px", padding: "1px 7px",
                }}>
                  {archived.length}
                </span>
                <span style={{ fontSize: "10px", color: out.meta }}>{archivedOpen ? "▾" : "▸"}</span>
              </div>
              {archivedOpen && (
                <div style={{ paddingLeft: "18px" }}>
                  {archived.map(c => (
                    <div key={c.id} style={{ padding: "5px 4px", fontSize: "13px", color: "#aaa", textDecoration: "line-through" }}>
                      {c.person}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
