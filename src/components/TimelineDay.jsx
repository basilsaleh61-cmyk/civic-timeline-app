import { useRef, useState, useEffect, useMemo } from "react";
import { useTimeline, formatHour, isPast } from "../hooks/useTimeline.js";
import TimelineRow, { TimelineEventOverlay, ROW_HEIGHT } from "./TimelineRow.jsx";
import { blockColors, nightColors, urgencyColors } from "../theme.js";

// ── Row definitions ──────────────────────────────────────────────────────────

const bc = blockColors;

const ROW_CONFIGS = [
  { id: "wake",       hour: 6,    label: "6 AM",   protoKey: "wake",       bgColor: bc.sleep.bg,      titleColor: bc.sleep.text,      metaColor: bc.sleep.meta,      title: "Wake",        meta: "morning start" },
  { id: "movement",   hour: 7,    label: "7 AM",   protoKey: "movement",   bgColor: bc.movement.bg,   titleColor: bc.movement.text,   metaColor: bc.movement.meta,   title: "Movement",    meta: "workout window" },
  { id: "meal1",      hour: 8,    label: "8 AM",   protoKey: "meal1",      bgColor: bc.processing.bg, titleColor: bc.processing.text, metaColor: bc.processing.meta, title: "Meal",        meta: "breakfast" },
  { id: "deep1",      hour: 9,    label: "9 AM",   protoKey: "deep1",      bgColor: bc.deep.bg,       titleColor: bc.deep.text,       metaColor: bc.deep.meta,       title: "Deep Work",   meta: "2h focus block" },
  { id: "task",       hour: 11,   label: "11 AM",  protoKey: "task",       bgColor: bc.task.bg,       titleColor: bc.task.text,       metaColor: bc.task.meta,       title: "Task Block",  meta: "admin & tasks" },
  { id: "meal2",      hour: 13,   label: "1 PM",   protoKey: "meal2",      bgColor: bc.processing.bg, titleColor: bc.processing.text, metaColor: bc.processing.meta, title: "Meal",        meta: "lunch" },
  { id: "outreach",   hour: 14,   label: "2 PM",   protoKey: "outreach",   bgColor: bc.outreach.bg,   titleColor: bc.outreach.text,   metaColor: bc.outreach.meta,   title: "Outreach",    meta: "comms & follow-ups" },
  { id: "processing", hour: 15,   label: "3 PM",   protoKey: "processing", bgColor: bc.processing.bg, titleColor: bc.processing.text, metaColor: bc.processing.meta, title: "Processing",  meta: "review & clear" },
  { id: "deep2",      hour: 17,   label: "5 PM",   protoKey: "deep2",      bgColor: bc.deep.bg,       titleColor: bc.deep.text,       metaColor: bc.deep.meta,       title: "Deep Work",   meta: "creative block" },
  { id: "meal3",      hour: 19,   label: "7 PM",   protoKey: "meal3",      bgColor: bc.processing.bg, titleColor: bc.processing.text, metaColor: bc.processing.meta, title: "Meal",        meta: "dinner" },
  { id: "tomorrow",   hour: 20,   label: "8 PM",   protoKey: null,         bgColor: nightColors.night1, titleColor: "#5a4f40",         metaColor: "#9a8870",          title: "Tomorrow",    meta: "set your goal for tomorrow" },
  { id: "winddown",   hour: 21,   label: "9 PM",   protoKey: "winddown",   bgColor: nightColors.night2, titleColor: "#5a4f40",         metaColor: "#9a8870",          title: "Wind Down",   meta: "unplug & decompress" },
  { id: "sleep",      hour: 22.5, label: "10:30",  protoKey: "sleep",      bgColor: nightColors.night5, titleColor: "#3a302a",         metaColor: "#7a6850",          title: "Sleep",       meta: "lights out" },
];

const NIGHT_ROW_IDS = new Set(["winddown", "sleep"]);
const SUNSET_AFTER  = "meal3";

// ── Protocol resolution (mirrors useProtocols.getActiveRowIds) ───────────────

function computeActiveRowIds(protocols) {
  const today    = new Date();
  const dayIndex = (today.getDay() + 6) % 7;
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

// ── Derived data helpers ─────────────────────────────────────────────────────

function topTask(tasks) {
  for (const cat of ["urgent", "work", "admin", "shopping"]) {
    const t = tasks.find(t => !t.done && t.category === cat);
    if (t) return t;
  }
  return null;
}

function topContact(outreach) {
  return (
    outreach.find(c => !c.done && c.status === "today") ||
    outreach.find(c => !c.done && c.status === "active") ||
    null
  );
}

// ── Sunset divider ───────────────────────────────────────────────────────────

function SunsetDivider() {
  return (
    <div style={{
      height: 28,
      background: `linear-gradient(to bottom, ${nightColors.sunset}, ${nightColors.night1})`,
      display: "flex",
      alignItems: "center",
      paddingLeft: 54,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: "10px", fontWeight: 600, color: "#9a8060", letterSpacing: "0.07em", textTransform: "uppercase" }}>
        Evening
      </span>
    </div>
  );
}

// ── Tomorrow goal cell ───────────────────────────────────────────────────────

function TomorrowGoalCell({ goalText, setGoalText, goalSubmitted, onSubmit }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "6px 0" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a8870" }}>
        Tomorrow's Goal
      </div>
      {goalSubmitted ? (
        <div style={{ fontSize: "13px", color: "#5a4f40", fontStyle: "italic" }}>{goalText}</div>
      ) : (
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={goalText}
            onChange={e => setGoalText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSubmit(); }}
            placeholder="What's the one thing tomorrow needs?"
            style={{
              flex: 1,
              fontSize: "12px",
              padding: "5px 8px",
              border: "1px solid #c8b89a",
              borderRadius: "4px",
              backgroundColor: "rgba(255,255,255,0.6)",
              outline: "none",
            }}
          />
          <button
            onClick={onSubmit}
            disabled={!goalText.trim()}
            style={{
              fontSize: "11px",
              padding: "5px 10px",
              backgroundColor: goalText.trim() ? "#8a7255" : "#d4c4aa",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: goalText.trim() ? "pointer" : "default",
            }}
          >
            Set ↵
          </button>
        </div>
      )}
    </div>
  );
}

// ── Now-line ─────────────────────────────────────────────────────────────────

function NowLine({ simHour }) {
  return (
    <div style={{
      position: "absolute",
      top: "33%",
      left: 0,
      right: 0,
      zIndex: 20,
      pointerEvents: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{
          width: 48,
          flexShrink: 0,
          display: "flex",
          justifyContent: "flex-end",
          paddingRight: 6,
        }}>
          <span style={{
            fontSize: "10px",
            fontWeight: 700,
            color: urgencyColors.nowLine,
            backgroundColor: "#fff",
            padding: "1px 3px",
            borderRadius: "3px",
          }}>
            {formatHour(simHour)}
          </span>
        </div>
        <div style={{
          flex: 1,
          height: 2,
          backgroundColor: urgencyColors.nowLine,
          borderRadius: 1,
          opacity: 0.85,
        }} />
        <div style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: urgencyColors.nowLine,
          marginLeft: -3,
          flexShrink: 0,
        }} />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TimelineDay({
  protocols,
  tasks,
  outreach,
  events,
  outcome,
  simHour: simHourProp,
  onSimHourChange,
}) {
  const viewportRef = useRef(null);
  const innerRef    = useRef(null);

  const { simHour: hookSimHour, setSimHour, focalOffset } = useTimeline(innerRef, viewportRef);

  const [goalText,      setGoalText]      = useState("");
  const [goalSubmitted, setGoalSubmitted] = useState(false);

  // Sync external simHour prop into hook
  useEffect(() => {
    if (simHourProp != null) setSimHour(simHourProp);
  }, [simHourProp, setSimHour]);

  const currentHour  = simHourProp ?? hookSimHour;
  const activeRowIds = useMemo(() => computeActiveRowIds(protocols), [protocols]);

  const bestTask    = useMemo(() => topTask(tasks),       [tasks]);
  const bestContact = useMemo(() => topContact(outreach), [outreach]);

  const todayEventsByRow = useMemo(() => {
    const map = {};
    for (const evt of events.filter(e => e.section === "today" && e.tlRowId)) {
      if (!map[evt.tlRowId]) map[evt.tlRowId] = [];
      map[evt.tlRowId].push(evt);
    }
    return map;
  }, [events]);

  function resolveRowTitle(row) {
    if (row.id === "task" && bestTask) return bestTask.name;
    if (row.id === "outreach" && bestContact)
      return `${bestContact.person} — ${bestContact.nextAction}`;
    if ((row.id === "deep1" || row.id === "deep2") && outcome?.text && !outcome?.resolved)
      return outcome.text;
    return row.title;
  }

  function isRowVisible(row) {
    if (row.protoKey === null) return true;
    return activeRowIds.has(row.protoKey);
  }

  function handleGoalSubmit() {
    if (!goalText.trim()) return;
    setGoalSubmitted(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
      {/* Scrollable timeline */}
      <div
        ref={viewportRef}
        style={{ position: "relative", flex: 1, overflow: "hidden" }}
      >
        <NowLine simHour={currentHour} />

        <div
          ref={innerRef}
          style={{
            transform: `translateY(${focalOffset}px)`,
            transition: "transform 0.4s ease",
            paddingBottom: 40,
          }}
        >
          {ROW_CONFIGS.map(row => {
            const isNightRow   = NIGHT_ROW_IDS.has(row.id);
            const rowPast      = row.id !== "tomorrow" && isPast(row.hour, currentHour);
            const rowVisible   = isRowVisible(row);
            const rowEvents    = todayEventsByRow[row.id] ?? [];
            const winddownLocked = isNightRow && !goalSubmitted;

            const sunsetBefore = row.id === "tomorrow";

            return (
              <div key={row.id} style={winddownLocked ? { opacity: 0.35, pointerEvents: "none" } : {}}>
                {sunsetBefore && <SunsetDivider />}

                {row.id === "tomorrow" ? (
                  <TimelineRow
                    hour={row.hour}
                    label={row.label}
                    bgColor={row.bgColor}
                    bgOpacity={1}
                    title=""
                    meta=""
                    titleColor={row.titleColor}
                    metaColor={row.metaColor}
                    isPast={false}
                    isVisible={true}
                  >
                    <TomorrowGoalCell
                      goalText={goalText}
                      setGoalText={setGoalText}
                      goalSubmitted={goalSubmitted}
                      onSubmit={handleGoalSubmit}
                    />
                  </TimelineRow>
                ) : (
                  <TimelineRow
                    hour={row.hour}
                    label={row.label}
                    bgColor={row.bgColor}
                    bgOpacity={isNightRow ? 1 : 0.18}
                    title={resolveRowTitle(row)}
                    meta={row.meta}
                    titleColor={row.titleColor}
                    metaColor={row.metaColor}
                    isPast={rowPast}
                    isVisible={rowVisible}
                  >
                    {rowEvents.map(evt => (
                      <TimelineEventOverlay
                        key={evt.id}
                        name={evt.name}
                        category={evt.category}
                        time={evt.time}
                        duration={evt.duration}
                      />
                    ))}
                  </TimelineRow>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Demo time slider */}
      <div style={{
        borderTop: "1px solid #eee",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        backgroundColor: "#fafafa",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#888", whiteSpace: "nowrap" }}>
          Demo Time
        </span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.083}
          value={currentHour}
          onChange={e => {
            const h = Number(e.target.value);
            setSimHour(h);
            onSimHourChange?.(h);
          }}
          style={{ flex: 1, accentColor: urgencyColors.nowLine }}
        />
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#444", whiteSpace: "nowrap", minWidth: 60 }}>
          {formatHour(currentHour)}
        </span>
      </div>
    </div>
  );
}
