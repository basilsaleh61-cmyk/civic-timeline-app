// ─────────────────────────────────────────────────────────────
// HorizonTimeline — RUNWAY model
//
// Today is always the far-left origin. The view shows only
// forward time (runway remaining). All positioning is
// percentage-based so the ruler always fills the container
// width with no horizontal scrolling.
//
// Interaction:
//   hover  → snaps to nearest day, highlights band + tooltip
//   drag   → selects date range, opens add-span form on release
// ─────────────────────────────────────────────────────────────

import { useState, useMemo, useRef, useEffect } from 'react';
import type { HorizonSpan, TimeBlock } from '../types';
import { skyColorAt } from './RollingDayDial';

type HorizonView = 'week' | 'month' | 'season' | 'year';
type NotchLevel  = 'hairline' | 'minor' | 'medium' | 'major';

const SPAN_H  = 20;
const SPAN_GAP =  4;
const EVT_H   = 18;  // event bar height in the fixed band
const PROTO_H  =  8;  // protocol strip height (below events)
const BAND_H   = EVT_H + PROTO_H; // total fixed band below ticks

const BLOCK_COLORS: Record<string, string> = {
  routine:  '#1d9e75',
  task:     '#377ADD',
  prep:     '#D85A30',
  recovery: '#639922',
  sleep:    '#444441',
};
const AXIS_TOP = 26;   // px above spans reserved for notch labels
const DAY_MS   = 86_400_000;
const HOUR_MS  =  3_600_000;
const VIEWS: HorizonView[] = ['week', 'month', 'season', 'year'];

// Fixed mock daylight times (MVP — replace with location/date calc later)
const SUNRISE_H = 6,  SUNRISE_M = 15;
const SUNSET_H  = 19, SUNSET_M  = 55;

const SPAN_COLORS = ['#0d9488', '#7c3aed', '#dc2626', '#d97706', '#2563eb', '#16a34a'];

// ── Range (always starts today) ────────────────────────────

interface Range { start: Date; end: Date; }

// Day bands: daytime (sunrise→sunset) highlighted on dark background (week view only)
interface HorizonDayBand { left: number; width: number; color: string; }

function computeHorizonDayBands(view: HorizonView, range: Range): HorizonDayBand[] {
  if (view !== 'week') return [];
  const NIGHT    = '#DDD1BC';
  const STEP_MS  = 15 * 60_000;
  const totalMs  = range.end.getTime() - range.start.getTime();
  const snapBase = Math.floor(range.start.getTime() / STEP_MS) * STEP_MS;

  interface RawBand { color: string; start: number; end: number; }
  const raw: RawBand[] = [];
  let prevColor = '';

  for (let t = snapBase; t < range.end.getTime(); t += STEP_MS) {
    const d     = new Date(t);
    const color = skyColorAt(d.getHours() + d.getMinutes() / 60);
    if (color === '#DDD1BC') { prevColor = ''; continue; }
    const startPct = Math.max(0,   (t           - range.start.getTime()) / totalMs * 100);
    const endPct   = Math.min(100, (t + STEP_MS - range.start.getTime()) / totalMs * 100);
    if (color !== prevColor) {
      raw.push({ color, start: startPct, end: endPct });
    } else if (raw.length > 0) {
      raw[raw.length - 1].end = endPct;
    }
    prevColor = color;
  }
  return raw.map(b => ({ left: b.start, width: b.end - b.start, color: b.color }));
}

function computeRange(view: HorizonView, today: Date, now: Date = today): Range {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (view) {
    case 'week': {
      // Start from the actual current moment so LEFT EDGE = NOW
      const end = new Date(now); end.setDate(end.getDate() + 7);
      return { start: now, end };
    }
    case 'month': {
      const end = new Date(today); end.setMonth(end.getMonth() + 1);
      return { start: today, end };
    }
    case 'season': {
      if (m >= 2 && m <= 7)                          // SS — runway to Sep 1
        return { start: today, end: new Date(y, 8, 1) };
      const yr = m >= 8 ? y : y - 1;                 // FW — runway to Mar 1
      return { start: today, end: new Date(yr + 1, 2, 1) };
    }
    case 'year':
      return { start: today, end: new Date(y + 1, 0, 1) };
  }
}

// ── Percentage helpers ─────────────────────────────────────

function toPct(d: Date, range: Range): number {
  const span = range.end.getTime() - range.start.getTime();
  return ((d.getTime() - range.start.getTime()) / span) * 100;
}

function pctToMs(pct: number, range: Range): number {
  return range.start.getTime() + (pct / 100) * (range.end.getTime() - range.start.getTime());
}

function snapToDay(ms: number): Date {
  const d = new Date(ms); d.setHours(0, 0, 0, 0); return d;
}

function snapToHour(ms: number): Date {
  return new Date(Math.round(ms / HOUR_MS) * HOUR_MS);
}

// YYYY-MM-DD  (for date inputs in month/season/year views)
function dateToInput(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// YYYY-MM-DDTHH:MM  (for datetime-local inputs in week view)
function dateToInputDT(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dateToInput(d)}T${hh}:${mm}`;
}

// Handles both YYYY-MM-DD and YYYY-MM-DDTHH:MM
function inputToDateAny(s: string): Date {
  if (s.includes('T')) {
    const [datePart, timePart] = s.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm]  = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ── Notches ────────────────────────────────────────────────
//
// Four-level ruler system:
//   hairline — year view daily texture tick (very faint, very short)
//   minor    — daily in week/month/season; weekly in year
//   medium   — weekly in month/season
//   major    — weekly in month (labeled); monthly in season/year (labeled)

const LEVEL_RANK: Record<NotchLevel, number> = { hairline: 0, minor: 1, medium: 2, major: 3 };
interface Notch { pct: number; label?: string; level: NotchLevel; }

function computeNotches(view: HorizonView, range: Range): Notch[] {
  const { start, end } = range;
  const map = new Map<number, Notch>();

  function add(d: Date, level: NotchLevel, label?: string) {
    const ts  = d.getTime();
    const pct = toPct(d, range);
    if (pct < -0.01 || pct > 100.01) return;
    const existing = map.get(ts);
    if (!existing || LEVEL_RANK[level] > LEVEL_RANK[existing.level])
      map.set(ts, { pct, level, label });
  }

  const eachHour = (fn: (d: Date) => void) => {
    // Snap to the next full hour so ticks are always on the hour,
    // even when the range starts mid-hour (week view starting at NOW).
    const d = new Date(start); d.setMinutes(0, 0, 0);
    if (d < start) d.setHours(d.getHours() + 1);
    while (d < end) { fn(new Date(d)); d.setHours(d.getHours() + 1); }
  };

  const eachDay = (fn: (d: Date) => void) => {
    const d = new Date(start);
    while (d < end) { fn(new Date(d)); d.setDate(d.getDate() + 1); }
  };

  // Calendar Mondays — always advance at least 1 day so we never
  // place a tick at the origin (it already has the TODAY marker).
  const eachMonday = (fn: (d: Date) => void) => {
    const d = new Date(start);
    const offset = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + offset);
    while (d < end) { fn(new Date(d)); d.setDate(d.getDate() + 7); }
  };

  // Month starts after the current month (avoid label collision with TODAY).
  const eachNextMonth = (fn: (d: Date) => void) => {
    const mc = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    while (mc < end) { fn(new Date(mc)); mc.setMonth(mc.getMonth() + 1); }
  };

  if (view === 'week') {
    // Layer 1: every hour → minor (hourly texture)
    eachHour(d => add(d, 'minor'));
    // Layer 2: 6am / noon / 6pm → medium quarter-day anchors (upgrades minor)
    eachHour(d => {
      const h = d.getHours();
      if (h === 6 || h === 12 || h === 18) add(d, 'medium');
    });
    // Layer 3: midnight (day start) → major + date label (upgrades medium/minor)
    eachDay(d => add(d, 'major',
      d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    ));
  } else if (view === 'month') {
    eachDay(d => add(d, 'minor'));
    eachMonday(d => add(d, 'major',
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ));
  } else if (view === 'season') {
    eachDay(d => add(d, 'minor'));
    eachMonday(d => add(d, 'medium'));
    eachNextMonth(d => add(d, 'major', d.toLocaleDateString('en-US', { month: 'short' })));
  } else { // year
    eachDay(d => add(d, 'hairline'));
    eachMonday(d => add(d, 'minor'));
    eachNextMonth(d => add(d, 'major', d.toLocaleDateString('en-US', { month: 'short' })));
  }

  return Array.from(map.values()).sort((a, b) => a.pct - b.pct);
}

// ── Span placement ─────────────────────────────────────────

interface PlacedSpan extends HorizonSpan {
  leftPct:  number;
  widthPct: number;
  row:      number;
}


function placeSpans(spans: HorizonSpan[], range: Range): PlacedSpan[] {
  const today    = range.start;
  const rangeEnd = range.end;
  const visible = spans
    .filter(s => s.end > today && s.start < rangeEnd)
    .map(s => ({
      ...s,
      start: s.start < today    ? today    : s.start,
      end:   s.end   > rangeEnd ? rangeEnd : s.end,
    }));
  const sorted  = [...visible].sort((a, b) => a.start.getTime() - b.start.getTime());
  const rowEnds: number[] = [];
  return sorted.map(span => {
    let row = rowEnds.findIndex(e => e <= span.start.getTime());
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = span.end.getTime();
    const leftPct  = toPct(span.start, range);
    const rightPct = toPct(span.end,   range);
    return { ...span, leftPct, widthPct: Math.max(rightPct - leftPct, 0.5), row };
  });
}

// ── Horizon night bands (week view only) ───────────────────

interface HorizonNightBand { left: number; width: number; }

function computeHorizonNightBands(view: HorizonView, range: Range): HorizonNightBand[] {
  if (view !== 'week') return [];

  const bands: HorizonNightBand[] = [];
  const cursor = new Date(range.start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < range.end) {
    const sunrise = new Date(cursor); sunrise.setHours(SUNRISE_H, SUNRISE_M, 0, 0);
    const sunset  = new Date(cursor); sunset.setHours(SUNSET_H,   SUNSET_M,  0, 0);
    const nextDay = new Date(cursor); nextDay.setDate(nextDay.getDate() + 1);

    // Night before sunrise
    const n1s = new Date(Math.max(cursor.getTime(),   range.start.getTime()));
    const n1e = new Date(Math.min(sunrise.getTime(),  range.end.getTime()));
    if (n1e > n1s)
      bands.push({ left: toPct(n1s, range), width: toPct(n1e, range) - toPct(n1s, range) });

    // Night after sunset
    const n2s = new Date(Math.max(sunset.getTime(),   range.start.getTime()));
    const n2e = new Date(Math.min(nextDay.getTime(),  range.end.getTime()));
    if (n2e > n2s)
      bands.push({ left: toPct(n2s, range), width: toPct(n2e, range) - toPct(n2s, range) });

    cursor.setDate(cursor.getDate() + 1);
  }

  return bands;
}

// ── Component ──────────────────────────────────────────────

interface Props {
  spans:               HorizonSpan[];
  onAddSpan:           (span: HorizonSpan) => void;
  blocks?:             TimeBlock[];
  onUpdateEventTime?:  (id: string, start: Date, end: Date) => void;
}

export function HorizonTimeline({ blocks = [], onUpdateEventTime }: Props) {
  const [view, setView] = useState<HorizonView>('month');
  const [now,  setNow ] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const range    = useMemo(() => computeRange(view, today, now), [view, today, now]);
  const notches  = useMemo(() => computeNotches(view, range), [view, range]);
  const dayBands = useMemo(() => computeHorizonDayBands(view, range), [view, range]);

  // Fixed height — no vertical expansion
  const totalHeight = AXIS_TOP + BAND_H;

  // ── Refs ────────────────────────────────────────────────
  const rulerRef   = useRef<HTMLDivElement>(null);
  const rangeRef   = useRef(range);
  rangeRef.current = range;

  // Protocol strips — week view only
  const protoStrips = useMemo(() => {
    if (view !== 'week') return [];
    const result: Array<{ id: string; color: string; leftPct: number; widthPct: number }> = [];
    const cursor = new Date(range.start); cursor.setHours(0, 0, 0, 0);
    while (cursor < range.end) {
      for (const b of blocks.filter(b => !b.isEvent)) {
        const durMs = b.end.getTime() - b.start.getTime();
        const s = new Date(cursor);
        s.setHours(b.start.getHours(), b.start.getMinutes(), 0, 0);
        const e = new Date(s.getTime() + durMs);
        if (e > range.start && s < range.end) {
          const leftPct  = Math.max(0,   toPct(s, range));
          const rightPct = Math.min(100, toPct(e, range));
          result.push({
            id:       `${b.id}-${cursor.getDate()}`,
            color:    BLOCK_COLORS[b.type] ?? '#888',
            leftPct,
            widthPct: Math.max(rightPct - leftPct, 0.1),
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [blocks, range, view]);

  // Event bars — week view only, with live-drag override
  const placedEventBars = useMemo(() => {
    return blocks
      .filter(b => b.isEvent && b.end > range.start && b.start < range.end)
      .map(b => {
        const leftPct  = Math.max(0,   toPct(b.start, range));
        const rightPct = Math.min(100, toPct(b.end,   range));
        return { ...b, color: b.protocolColor ?? '#7F77DD', leftPct, widthPct: Math.max(rightPct - leftPct, 0.3) };
      });
  }, [blocks, range]);

  // ── Event bar drag ──────────────────────────────────────
  const [activeEvtId, setActiveEvtId] = useState<string | null>(null);
  const [liveEvt,     setLiveEvt    ] = useState<{ id: string; start: Date; end: Date } | null>(null);
  const liveEvtRef = useRef<typeof liveEvt>(null);

  const displayEventBars = useMemo(() => placedEventBars.map(b => {
    if (!liveEvt || b.id !== liveEvt.id) return b;
    const leftPct  = Math.max(0,   toPct(liveEvt.start, range));
    const rightPct = Math.min(100, toPct(liveEvt.end,   range));
    return { ...b, start: liveEvt.start, end: liveEvt.end, leftPct, widthPct: Math.max(rightPct - leftPct, 0.3) };
  }), [placedEventBars, liveEvt, range]);

  function startEventDrag(kind: 'move' | 'resize-left' | 'resize-right', bar: typeof placedEventBars[0], e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rangeMs   = range.end.getTime() - range.start.getTime();
    const origStart = bar.start, origEnd = bar.end;
    const startX    = e.clientX;
    const SNAP      = 15 * 60_000;
    setActiveEvtId(bar.id);
    document.body.classList.add('is-dragging');
    function onMove(ev: MouseEvent) {
      const deltaPct = (ev.clientX - startX) / rect.width * 100;
      const deltaMs  = Math.round(deltaPct / 100 * rangeMs / SNAP) * SNAP;
      let ns = origStart, ne = origEnd;
      if (kind === 'move') { ns = new Date(origStart.getTime() + deltaMs); ne = new Date(origEnd.getTime() + deltaMs); }
      else if (kind === 'resize-left')  ns = new Date(Math.min(origStart.getTime() + deltaMs, origEnd.getTime() - SNAP));
      else                              ne = new Date(Math.max(origEnd.getTime() + deltaMs, origStart.getTime() + SNAP));
      const live = { id: bar.id, start: ns, end: ne };
      liveEvtRef.current = live; setLiveEvt(live);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-dragging');
      setActiveEvtId(null);
      if (liveEvtRef.current) onUpdateEventTime?.(bar.id, liveEvtRef.current.start, liveEvtRef.current.end);
      liveEvtRef.current = null; setLiveEvt(null);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="ht-outer">

      {/* Header: title + view toggle */}
      <div className="ht-header">
        <span className="ht-header-title">Runway</span>
        <div className="ht-view-toggle">
          {VIEWS.map(v => (
            <button
              key={v}
              type="button"
              className={`ht-view-btn${view === v ? ' ht-view-btn--active' : ''}`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Full-width ruler — fixed height */}
      <div
        ref={rulerRef}
        className="ht-ruler"
        style={{ height: totalHeight }}
      >

        {/* Day bands (week view) */}
        {dayBands.map((band, i) => (
          <div
            key={`db-${i}`}
            className="ht-day-band"
            style={{ left: `${band.left}%`, width: `${band.width}%`, background: band.color }}
          />
        ))}

        {/* Protocol strips — week view only, translucent, pinned to base */}
        {protoStrips.map(s => (
          <div
            key={s.id}
            className="ht-proto-strip"
            style={{
              left:       `${s.leftPct}%`,
              width:      `${s.widthPct}%`,
              bottom:     0,
              height:     PROTO_H,
              background: s.color + '55',
            }}
          />
        ))}

        {/* Event bars — week view only, opaque, draggable */}
        {view === 'week' && displayEventBars.map(bar => (
          <div
            key={bar.id}
            className={`ht-event-bar${bar.id === activeEvtId ? ' ht-event-bar--active' : ''}`}
            style={{
              left:       `${bar.leftPct}%`,
              width:      `${bar.widthPct}%`,
              bottom:     PROTO_H,
              height:     EVT_H,
              background: bar.color,
            }}
            title={bar.title}
            onMouseDown={ev => startEventDrag('move', bar, ev)}
          >
            <div className="ht-evtbar-handle ht-evtbar-handle--l" onMouseDown={ev => startEventDrag('resize-left',  bar, ev)} />
            <span className="ht-evtbar-label">{bar.title}</span>
            <div className="ht-evtbar-handle ht-evtbar-handle--r" onMouseDown={ev => startEventDrag('resize-right', bar, ev)} />
          </div>
        ))}

        {/* Notch ticks + labels */}
        {notches.map((n, i) => (
          <div
            key={i}
            className={`ht-notch ht-notch--${n.level}`}
            style={{ left: `${n.pct}%` }}
          >
            {n.label && <span className="ht-notch-label">{n.label}</span>}
          </div>
        ))}

        {/* Left-edge origin marker */}
        <div className="ht-today-marker" />

        {/* NOW marker — floats in m/s/y views */}
        {view !== 'week' && (
          <div
            className="ht-now-marker"
            style={{ left: `${toPct(now, range)}%` }}
          >
            <span className="ht-now-label">NOW</span>
          </div>
        )}

      </div>

    </div>
  );
}
