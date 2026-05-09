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
import type { HorizonSpan } from '../types';
import { skyColorAt } from './RollingDayDial';

type HorizonView = 'week' | 'month' | 'season' | 'year';
type NotchLevel  = 'hairline' | 'minor' | 'medium' | 'major';

const SPAN_H   = 20;
const SPAN_GAP = 4;
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
  const NIGHT    = '#342447';
  const STEP_MS  = 15 * 60_000;
  const totalMs  = range.end.getTime() - range.start.getTime();
  const snapBase = Math.floor(range.start.getTime() / STEP_MS) * STEP_MS;

  interface RawBand { color: string; start: number; end: number; }
  const raw: RawBand[] = [];
  let prevColor = '';

  for (let t = snapBase; t < range.end.getTime(); t += STEP_MS) {
    const d     = new Date(t);
    const color = skyColorAt(d.getHours() + d.getMinutes() / 60);
    if (color === NIGHT) { prevColor = ''; continue; }
    const startPct = Math.max(0,   (t            - range.start.getTime()) / totalMs * 100);
    const endPct   = Math.min(100, (t + STEP_MS  - range.start.getTime()) / totalMs * 100);
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

interface FormState {
  title:     string;
  startDate: string; // YYYY-MM-DD
  endDate:   string;
  color:     string;
}

interface EventBar {
  id:    string;
  title: string;
  start: Date;
  end:   Date;
  color: string;
}

interface Props {
  spans:      HorizonSpan[];
  onAddSpan:  (span: HorizonSpan) => void;
  eventBars?: EventBar[];
}

export function HorizonTimeline({ spans, onAddSpan, eventBars = [] }: Props) {
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
  const placed   = useMemo(() => placeSpans(spans, range), [spans, range]);
  const dayBands = useMemo(() => computeHorizonDayBands(view, range), [view, range]);
  const numRows     = placed.length === 0 ? 1 : Math.max(...placed.map(s => s.row)) + 1;
  const totalHeight = AXIS_TOP + numRows * (SPAN_H + SPAN_GAP) + 8;

  // ── Refs ────────────────────────────────────────────────
  const rulerRef     = useRef<HTMLDivElement>(null);
  const rangeRef     = useRef(range);
  const viewRef      = useRef(view);
  const dragStartRef = useRef<Date | null>(null);
  const dragEndRef   = useRef<Date | null>(null);
  rangeRef.current   = range; // always current; used inside effect closures
  viewRef.current    = view;

  // ── Interaction state ───────────────────────────────────
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [isDragging,  setIsDragging ] = useState(false);
  const [selBand,     setSelBand    ] = useState<{ left: number; right: number } | null>(null);
  const [showForm,    setShowForm   ] = useState(false);
  const [form,        setForm       ] = useState<FormState>({
    title: '', startDate: '', endDate: '', color: SPAN_COLORS[0],
  });

  // ── x-position → view-aware snapped time unit ───────────
  // Week view snaps to the nearest hour; all other views snap to
  // the nearest day. Both refs update every render so closures
  // inside effects always read the freshest values.
  function clientXToUnit(clientX: number): Date | null {
    const el = rulerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const ms   = pctToMs(pct, rangeRef.current);
    return viewRef.current === 'week' ? snapToHour(ms) : snapToDay(ms);
  }

  // ── Document-level drag listeners ──────────────────────
  useEffect(() => {
    if (!isDragging) return;

    function onMove(e: MouseEvent) {
      const d = clientXToUnit(e.clientX);
      if (!d || !dragStartRef.current) return;
      dragEndRef.current = d;
      setHoveredDate(d);
      const r      = rangeRef.current;
      const unitMs = viewRef.current === 'week' ? HOUR_MS : DAY_MS;
      const s      = dragStartRef.current <= d ? dragStartRef.current : d;
      const en     = dragStartRef.current <= d ? d : dragStartRef.current;
      setSelBand({ left: toPct(s, r), right: toPct(new Date(en.getTime() + unitMs), r) });
    }

    function onUp() {
      const start  = dragStartRef.current;
      const end    = dragEndRef.current ?? start;
      dragStartRef.current = null;
      dragEndRef.current   = null;
      setIsDragging(false);
      setSelBand(null);
      setHoveredDate(null);

      if (start) {
        const s      = !end || start <= end ? start : end;
        const en     = !end || start <= end ? end ?? start : start;
        const isWeek = viewRef.current === 'week';
        const unitMs = isWeek ? HOUR_MS : DAY_MS;
        setForm({
          title:     '',
          startDate: isWeek ? dateToInputDT(s)                          : dateToInput(s),
          endDate:   isWeek ? dateToInputDT(new Date(en.getTime() + unitMs))
                            : dateToInput(new Date(en.getTime() + DAY_MS)),
          color:     SPAN_COLORS[0],
        });
        setShowForm(true);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [isDragging]);

  // ── React event handlers ────────────────────────────────

  function handleMouseMove(e: React.MouseEvent) {
    if (isDragging) return; // handled by document listener
    setHoveredDate(clientXToUnit(e.clientX));
  }

  function handleMouseLeave() {
    if (!isDragging) setHoveredDate(null);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const d = clientXToUnit(e.clientX);
    if (!d) return;
    e.preventDefault(); // prevent text selection on drag
    dragStartRef.current = d;
    dragEndRef.current   = d;
    setIsDragging(true);
    setHoveredDate(d);
  }

  // ── Form ────────────────────────────────────────────────

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate || !form.endDate) return;
    onAddSpan({
      id:    crypto.randomUUID(),
      title: form.title.trim(),
      start: inputToDateAny(form.startDate),
      end:   inputToDateAny(form.endDate),
      color: form.color,
    });
    setShowForm(false);
    setForm({ title: '', startDate: '', endDate: '', color: SPAN_COLORS[0] });
  }

  // ── Derived hover visuals ───────────────────────────────

  const hoverBand = useMemo(() => {
    if (!hoveredDate || isDragging) return null;
    const unitMs = view === 'week' ? HOUR_MS : DAY_MS;
    const left   = toPct(hoveredDate, range);
    const right  = toPct(new Date(hoveredDate.getTime() + unitMs), range);
    return { left, width: right - left };
  }, [hoveredDate, isDragging, range, view]);

  const hovPct = hoveredDate ? toPct(hoveredDate, range) : 0;

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

      {/* Full-width ruler — no scroll */}
      <div
        ref={rulerRef}
        className={`ht-ruler${isDragging ? ' ht-ruler--dragging' : ''}`}
        style={{ height: totalHeight }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >

        {/* Day bands (week view) — atmospheric color fills for non-night periods */}
        {dayBands.map((band, i) => (
          <div
            key={`db-${i}`}
            className="ht-day-band"
            style={{ left: `${band.left}%`, width: `${band.width}%`, background: band.color }}
          />
        ))}

        {/* Event bars (week view) — full-height bold colored columns */}
        {view === 'week' && eventBars.map(bar => {
          const leftPct  = toPct(bar.start, range);
          const rightPct = toPct(bar.end,   range);
          if (rightPct < 0 || leftPct > 100) return null;
          const clampedLeft  = Math.max(0,   leftPct);
          const clampedRight = Math.min(100, rightPct);
          return (
            <div
              key={bar.id}
              className="ht-event-bar"
              style={{
                left:        `${clampedLeft}%`,
                width:       `${clampedRight - clampedLeft}%`,
                borderColor: bar.color,
                background:  bar.color + '55',
              }}
              title={bar.title}
            />
          );
        })}

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

        {/* NOW marker — floats in m/s/y views; week view starts at NOW so no float needed */}
        {view !== 'week' && (
          <div
            className="ht-now-marker"
            style={{ left: `${toPct(now, range)}%` }}
          >
            <span className="ht-now-label">NOW</span>
          </div>
        )}

        {/* Hover highlight band (single day) */}
        {hoverBand && (
          <div
            className="ht-hover-band"
            style={{ left: `${hoverBand.left}%`, width: `${hoverBand.width}%` }}
          />
        )}

        {/* Hover date tooltip */}
        {hoveredDate && !isDragging && (
          <div
            className="ht-hover-tooltip"
            style={{
              left:      `${hovPct}%`,
              transform: hovPct > 70
                ? 'translateX(calc(-100% - 4px))'
                : 'translateX(4px)',
            }}
          >
            {view === 'week'
              ? hoveredDate.toLocaleString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                  hour: 'numeric', hour12: true,
                })
              : hoveredDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            }
          </div>
        )}

        {/* Drag selection band */}
        {selBand && (
          <div
            className="ht-sel-band"
            style={{
              left:  `${selBand.left}%`,
              width: `${Math.max(selBand.right - selBand.left, 0)}%`,
            }}
          />
        )}

        {/* Horizon spans, clipped to runway */}
        {placed.map(span => (
          <div
            key={span.id}
            className="ht-span"
            style={{
              left:        `${span.leftPct}%`,
              width:       `${span.widthPct}%`,
              top:         AXIS_TOP + span.row * (SPAN_H + SPAN_GAP),
              height:      SPAN_H,
              borderColor: span.color,
              background:  span.color + '18',
            }}
            title={`${span.title}\n${span.start.toLocaleDateString()} – ${span.end.toLocaleDateString()}`}
          >
            <span className="ht-span-label" style={{ color: span.color }}>{span.title}</span>
          </div>
        ))}

      </div>

      {/* Add-span form — rendered below ruler when active */}
      {showForm && (
        <form className="ht-form" onSubmit={submitForm}>

          <div className="ht-form-header">
            <span className="ht-form-title">New span</span>
            <button type="button" className="ht-form-close" onClick={() => setShowForm(false)}>×</button>
          </div>

          <div className="ht-form-row">
            <input
              className="ht-form-input ht-form-input--title"
              placeholder="Title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="ht-form-row">
            <input
              type={view === 'week' ? 'datetime-local' : 'date'}
              className={`ht-form-input ht-form-date${view === 'week' ? ' ht-form-date--dt' : ''}`}
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            />
            <span className="ht-form-sep">→</span>
            <input
              type={view === 'week' ? 'datetime-local' : 'date'}
              className={`ht-form-input ht-form-date${view === 'week' ? ' ht-form-date--dt' : ''}`}
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            />
          </div>

          <div className="ht-form-row">
            {SPAN_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`ht-color-swatch${form.color === c ? ' ht-color-swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => setForm(f => ({ ...f, color: c }))}
              />
            ))}
          </div>

          <div className="ht-form-row ht-form-actions">
            <button
              type="button"
              className="ht-form-btn ht-form-btn--cancel"
              onClick={() => setShowForm(false)}
            >
              cancel
            </button>
            <button type="submit" className="ht-form-btn ht-form-btn--submit">
              add span
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
