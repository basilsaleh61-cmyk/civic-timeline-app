import { useState, useEffect } from "react";
import { blockColors, protocolMeta } from "../theme.js";

const proto = blockColors.protocol;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const SECTION_ORDER = ["base", "daySpecific", "exception"];
const CATEGORY_PILLS = [
  { key: "base",        label: "Base" },
  { key: "daySpecific", label: "Day-Specific" },
  { key: "exception",   label: "Exception" },
];

function genId() {
  return `proto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ToggleSwitch({ on, onToggle }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onToggle(); }}
      role="switch"
      aria-checked={on}
      style={{
        width: 36, height: 20, borderRadius: 10,
        backgroundColor: on ? "#22c55e" : "#d1d5db",
        position: "relative", cursor: "pointer", flexShrink: 0,
        transition: "background-color 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        backgroundColor: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </div>
  );
}

function DayTagRow({ days, onChange }) {
  function toggleDay(idx) {
    onChange(
      days.includes(idx)
        ? days.filter(d => d !== idx)
        : [...days, idx].sort((a, b) => a - b)
    );
  }
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {DAY_LABELS.map((label, idx) => {
        const active = days.includes(idx);
        return (
          <button
            key={idx}
            onClick={() => toggleDay(idx)}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "none",
              backgroundColor: active ? proto.bg : "#e5e7eb",
              color: active ? "#fff" : "#6b7280",
              fontWeight: 700, fontSize: "12px", cursor: "pointer",
              transition: "background-color 0.15s",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ReplaceMergeToggle({ mode, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", gap: "0", borderRadius: "6px", overflow: "hidden", border: "1px solid #ddd", width: "fit-content" }}>
        {["replace", "merge"].map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: "6px 16px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 600,
              backgroundColor: mode === opt ? proto.bg : "#f3f4f6",
              color: mode === opt ? "#fff" : "#555",
              textTransform: "capitalize",
              transition: "background-color 0.15s",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: "11px", color: "#888", lineHeight: 1.5 }}>
        {mode === "replace"
          ? "Replace: this protocol defines the whole day."
          : "Merge: only overrides the blocks it defines, base fills the rest."}
      </p>
    </div>
  );
}

function ProtocolCard({ protocol, expanded, onToggleExpand, onToggle, onUpdate, onDelete }) {
  const [edit, setEdit] = useState({
    name:      protocol.name,
    days:      [...protocol.days],
    dateRange: protocol.dateRange ?? "",
    blocks:    protocol.blocks ?? "",
    mode:      protocol.mode,
  });

  useEffect(() => {
    setEdit({
      name:      protocol.name,
      days:      [...protocol.days],
      dateRange: protocol.dateRange ?? "",
      blocks:    protocol.blocks ?? "",
      mode:      protocol.mode,
    });
  }, [protocol]);

  function handleSave() {
    onUpdate(protocol.id, {
      name:      edit.name,
      days:      edit.days,
      dateRange: protocol.category === "exception" ? edit.dateRange : null,
      blocks:    edit.blocks,
      mode:      edit.mode,
    });
    onToggleExpand(null);
  }

  return (
    <div style={{
      borderRadius: "8px",
      border: "1px solid #e5e7eb",
      overflow: "hidden",
      opacity: protocol.active ? 1 : 0.5,
      transition: "opacity 0.2s",
    }}>
      {/* Card header */}
      <div
        onClick={() => onToggleExpand(expanded ? null : protocol.id)}
        style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 14px", cursor: "pointer",
          backgroundColor: "#f9fafb", userSelect: "none",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a1a" }}>{protocol.name}</div>
          {protocol.description && (
            <div style={{ fontSize: "12px", color: "#888", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {protocol.description}
            </div>
          )}
        </div>
        <ToggleSwitch on={protocol.active} onToggle={() => onToggle(protocol.id)} />
        <span style={{ fontSize: "12px", color: "#aaa" }}>{expanded ? "▾" : "▸"}</span>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div style={{ padding: "16px 14px", backgroundColor: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Name */}
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: proto.meta }}>Name</span>
            <input
              value={edit.name}
              onChange={e => setEdit(p => ({ ...p, name: e.target.value }))}
              style={{ fontSize: "14px", padding: "6px 10px", border: "1px solid #ddd", borderRadius: "5px", outline: "none" }}
            />
          </label>

          {/* Days or date range */}
          {protocol.category !== "exception" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: proto.meta }}>Active Days</span>
              <DayTagRow days={edit.days} onChange={days => setEdit(p => ({ ...p, days }))} />
            </label>
          ) : (
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: proto.meta }}>Date Range</span>
              <input
                value={edit.dateRange}
                onChange={e => setEdit(p => ({ ...p, dateRange: e.target.value }))}
                placeholder="e.g. May 30 – Jun 27"
                style={{ fontSize: "13px", padding: "6px 10px", border: "1px solid #ddd", borderRadius: "5px", outline: "none" }}
              />
            </label>
          )}

          {/* Blocks textarea */}
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: proto.meta }}>Blocks</span>
            <textarea
              value={edit.blocks}
              onChange={e => setEdit(p => ({ ...p, blocks: e.target.value }))}
              rows={4}
              style={{ fontSize: "13px", padding: "8px 10px", border: "1px solid #ddd", borderRadius: "5px", outline: "none", resize: "vertical", lineHeight: 1.5 }}
            />
          </label>

          {/* Replace / Merge */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: proto.meta }}>Mode</span>
            <ReplaceMergeToggle mode={edit.mode} onChange={mode => setEdit(p => ({ ...p, mode }))} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "space-between", marginTop: "4px" }}>
            <button
              onClick={() => onDelete(protocol.id)}
              style={{ fontSize: "12px", padding: "6px 14px", backgroundColor: "#fff", color: "#dc2626", border: "1px solid #dc2626", borderRadius: "5px", cursor: "pointer" }}
            >
              Delete
            </button>
            <button
              onClick={handleSave}
              style={{ fontSize: "12px", padding: "6px 18px", backgroundColor: proto.bg, color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer" }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionGroup({ category, protocols, expandedId, onToggleExpand, onToggle, onUpdate, onDelete }) {
  const meta = protocolMeta[category];
  const sectionProtos = protocols.filter(p => p.category === category);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{meta.label}</div>
        <div style={{ fontSize: "11px", color: "#888", marginTop: "2px", lineHeight: 1.5 }}>{meta.byline}</div>
      </div>
      {sectionProtos.length === 0 && (
        <div style={{ fontSize: "12px", color: "#bbb", fontStyle: "italic", paddingLeft: "4px" }}>No protocols yet.</div>
      )}
      {sectionProtos.map(p => (
        <ProtocolCard
          key={p.id}
          protocol={p}
          expanded={expandedId === p.id}
          onToggleExpand={onToggleExpand}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function AddViaChat({ onGenerate }) {
  const [text,     setText]     = useState("");
  const [category, setCategory] = useState("base");

  function handleGenerate() {
    if (!text.trim()) return;
    onGenerate(text.trim(), category);
    setText("");
  }

  return (
    <div style={{
      borderTop: "2px solid #f0f0f0",
      paddingTop: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>Add new protocol via chat</div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe the protocol you want to create…"
        rows={3}
        style={{ fontSize: "13px", padding: "10px", border: "1px solid #ddd", borderRadius: "6px", outline: "none", resize: "vertical", lineHeight: 1.5 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {/* Category pills */}
        <div style={{ display: "flex", gap: "6px" }}>
          {CATEGORY_PILLS.map(pill => (
            <button
              key={pill.key}
              onClick={() => setCategory(pill.key)}
              style={{
                fontSize: "11px", fontWeight: 600,
                padding: "4px 12px", borderRadius: "999px",
                border: `1px solid ${category === pill.key ? proto.bg : "#ddd"}`,
                backgroundColor: category === pill.key ? proto.bg : "#fff",
                color: category === pill.key ? "#fff" : "#555",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleGenerate}
          style={{
            marginLeft: "auto",
            fontSize: "13px", fontWeight: 600,
            padding: "7px 18px",
            backgroundColor: "#1a1a1a", color: "#fff",
            border: "none", borderRadius: "6px", cursor: "pointer",
          }}
        >
          Generate protocol ↗
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ProtocolEditor({ protocols, onToggle, onUpdate, onDelete, onAdd, open, onClose }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!open) return null;

  function handleGenerate(text, category) {
    const newId = genId();
    onAdd({
      id:          newId,
      name:        text.split("\n")[0].slice(0, 50),
      description: text,
      category,
      active:      true,
      days:        category !== "exception" ? [0, 1, 2, 3, 4] : [],
      mode:        "replace",
      blocks:      text,
      dateRange:   category === "exception" ? "" : null,
      protoKeys:   [],
    });
    setExpandedId(newId);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "580px",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "18px 20px 14px",
          borderBottom: "1px solid #f0f0f0",
          position: "sticky", top: 0,
          backgroundColor: "#fff",
          zIndex: 1,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: proto.meta }}>
              Schedule
            </div>
            <div style={{ fontSize: "17px", fontWeight: 700, color: "#1a1a1a", marginTop: "1px" }}>
              Protocol Editor
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#aaa", lineHeight: 1, padding: "0 4px" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "28px" }}>
          {SECTION_ORDER.map(category => (
            <SectionGroup
              key={category}
              category={category}
              protocols={protocols}
              expandedId={expandedId}
              onToggleExpand={id => setExpandedId(id)}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}

          <AddViaChat onGenerate={handleGenerate} />
        </div>
      </div>
    </div>
  );
}
