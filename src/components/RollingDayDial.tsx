// ─────────────────────────────────────────────────────────────
// RollingDayDial — fixed-perspective day view
//
// The visible window is anchored to NOW and scaled to fill
// the available vertical space. No scrolling — the window
// choice determines how much runway is shown.
//
// Positioning is 100%-based against the visible window so no
// pixel measurements are needed for layout. Drag conversion
// captures the track's pixel height at mousedown.
// ─────────────────────────────────────────────────────────────

import { useRef, useMemo, useState } from 'react';
import type { TimeBlock } from '../types';

const MIN_DURATION = 15 * 60_000;
const QUARTER      = 15 * 60_000;
const HOUR_MS      = 3_600_000;

// Fixed mock daylight times (MVP — replace with location/date calc later)
const SUNRISE_H = 6,  SUNRISE_M = 15;
const SUNSET_H  = 19, SUNSET_M  = 55;

// ── Helpers ────────────────────────────────────────────────

function snapMs(ms: number): number {
  return Math.round(ms / QUARTER) * QUARTER;
}

export function floorToHour(d: Date): Date {
  const r = new Date(d);
  r.setMinutes(0, 0, 0);
  return r;
}

export function ceilToHour(d: Date): Date {
  const r = new Date(d);
  if (r.getMinutes() === 0 && r.getSeconds() === 0 && r.getMilliseconds() === 0) return r;
  r.setHours(r.getHours() + 1, 0, 0, 0);
  return r;
}

export function roundToNearest15(d: Date): Date {
  return new Date(Math.round(d.getTime() / QUARTER) * QUARTER);
}

function fmtTime(d: Date): string {
  const h   = d.getHours();
  const m   = d.getMinutes();
  const suf = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')}${suf}`;
}

function fmtHourLabel(d: Date): string {
  const h   = d.getHours();
  const suf = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12} ${suf}`;
}

// Strip render-only fields; preserve protocol provenance
function asTimeBlock(b: TimeBlock): TimeBlock {
  return {
    id:            b.id,
    title:         b.title,
    start:         b.start,
    end:           b.end,
    type:          b.type,
    isEvent:       b.isEvent,
    protocolId:    b.protocolId,
    protocolLabel: b.protocolLabel,
    protocolColor: b.protocolColor,
  };
}

// ── Drag ───────────────────────────────────────────────────

type DragKind = 'move' | 'resize-top' | 'resize-bottom';

interface DragMeta {
  kind:        DragKind;
  origStart:   Date;
  origEnd:     Date;
  startY:      number;
  trackHeight: number; // captured at mousedown — used for Δy → Δms conversion
  totalHours:  number; // window size at mousedown
}

function applyDrag(meta: DragMeta, currentY: number): { start: Date; end: Date } {
  const deltaMs = snapMs(
    ((currentY - meta.startY) / meta.trackHeight) * meta.totalHours * HOUR_MS
  );

  if (meta.kind === 'move') {
    return {
      start: new Date(meta.origStart.getTime() + deltaMs),
      end:   new Date(meta.origEnd.getTime()   + deltaMs),
    };
  }
  if (meta.kind === 'resize-top') {
    return {
      start: new Date(Math.min(
        meta.origStart.getTime() + deltaMs,
        meta.origEnd.getTime() - MIN_DURATION
      )),
      end: meta.origEnd,
    };
  }
  // resize-bottom
  return {
    start: meta.origStart,
    end:   new Date(Math.max(
      meta.origEnd.getTime() + deltaMs,
      meta.origStart.getTime() + MIN_DURATION
    )),
  };
}

// ── Day/night bands ─────────────────────────────────────────

interface DayBand {
  topPct:    number;
  heightPct: number;
  kind:      'night' | 'sunset';
}

function computeDayBands(windowStart: Date, totalHours: number): DayBand[] {
  const windowMs  = totalHours * HOUR_MS;
  const windowEnd = new Date(windowStart.getTime() + windowMs);
  const bands: DayBand[] = [];

  function toPct(ms: number) {
    return ((ms - windowStart.getTime()) / windowMs) * 100;
  }

  const cursor = new Date(windowStart);
  cursor.setHours(0, 0, 0, 0); // start at midnight of window's first day

  while (cursor.getTime() < windowEnd.getTime()) {
    const sunrise = new Date(cursor); sunrise.setHours(SUNRISE_H, SUNRISE_M, 0, 0);
    const sunset  = new Date(cursor); sunset.setHours(SUNSET_H,   SUNSET_M,  0, 0);
    const nextDay = new Date(cursor); nextDay.setDate(nextDay.getDate() + 1);

    // Night before sunrise
    const n1s = Math.max(cursor.getTime(), windowStart.getTime());
    const n1e = Math.min(sunrise.getTime(), windowEnd.getTime());
    if (n1e > n1s) {
      const topPct = Math.max(toPct(n1s), 0);
      bands.push({ topPct, heightPct: toPct(n1e) - topPct, kind: 'night' });
    }

    // Night after sunset
    const n2s = Math.max(sunset.getTime(),   windowStart.getTime());
    const n2e = Math.min(nextDay.getTime(),  windowEnd.getTime());
    if (n2e > n2s) {
      bands.push({ topPct: toPct(n2s), heightPct: toPct(n2e) - toPct(n2s), kind: 'night' });
    }

    // Sunset warm line
    const sunMs = sunset.getTime();
    if (sunMs > windowStart.getTime() && sunMs < windowEnd.getTime()) {
      bands.push({ topPct: toPct(sunMs), heightPct: 0, kind: 'sunset' });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return bands;
}

// ── Processed block (render-only, never persisted) ──────────

interface ProcessedBlock extends TimeBlock {
  topPct:     number; // % from top of visible window
  heightPct:  number; // % of visible window height
  isConflict: boolean;
}

// ── Tick marker ──────────────────────────────────────────────

type TickKind = 'hour' | 'half' | 'quarter';

interface TickMark {
  topPct: number;
  time:   Date;
  kind:   TickKind;
}

// ── Props ───────────────────────────────────────────────────

interface Props {
  blocks:   TimeBlock[];
  onUpdate: (block: TimeBlock) => void;
}

// ── Component ───────────────────────────────────────────────

export function RollingDayDial({ blocks, onUpdate }: Props) {
  // Frozen at mount — the window is anchored to session start
  const now = useRef(new Date()).current;

  // Track container ref — used to read pixel height at drag start and Y→time conversion
  const trackRef = useRef<HTMLDivElement>(null);

  // ── Window parameters ───────────────────────────────────
  const offsetBefore = 2;
  const totalHours   = 18;
  const labelEvery   = 1;

  const windowStart = useMemo(
    () => new Date(now.getTime() - offsetBefore * HOUR_MS),
    [now, offsetBefore]
  );
  const windowEnd = useMemo(
    () => new Date(windowStart.getTime() + totalHours * HOUR_MS),
    [windowStart, totalHours]
  );

  // % from top of visible window for any date
  function toTrackPct(d: Date): number {
    return ((d.getTime() - windowStart.getTime()) / (totalHours * HOUR_MS)) * 100;
  }

  // Convert a clientY pixel position to a Date within the window
  function yToTime(clientY: number): Date {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return new Date(windowStart);
    const pct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return new Date(windowStart.getTime() + pct * totalHours * HOUR_MS);
  }

  const nowPct = (offsetBefore / totalHours) * 100;

  // Keep totalHours stable in drag closures
  const totalHoursRef = useRef(totalHours);
  totalHoursRef.current = totalHours;

  // ── Drag state ──────────────────────────────────────────
  const dragMetaRef  = useRef<DragMeta | null>(null);
  const liveBlockRef = useRef<TimeBlock | null>(null);
  const [liveBlock, setLiveBlock] = useState<TimeBlock | null>(null);
  const [activeId,  setActiveId ] = useState<string | null>(null);

  // ── Hover state ─────────────────────────────────────────
  const [hoveredTime, setHoveredTime] = useState<Date | null>(null);

  function startDrag(kind: DragKind, raw: TimeBlock, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setHoveredTime(null);

    const block       = asTimeBlock(raw);
    const trackHeight = trackRef.current?.getBoundingClientRect().height ?? 500;

    dragMetaRef.current  = {
      kind,
      origStart:   block.start,
      origEnd:     block.end,
      startY:      e.clientY,
      trackHeight,
      totalHours:  totalHoursRef.current,
    };
    liveBlockRef.current = block;
    setLiveBlock(block);
    setActiveId(block.id);
    document.body.classList.add('is-dragging');

    function onMove(ev: MouseEvent) {
      const meta = dragMetaRef.current;
      if (!meta) return;
      const { start, end } = applyDrag(meta, ev.clientY);
      const updated = { ...block, start, end };
      liveBlockRef.current = updated;
      setLiveBlock(updated);
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.body.classList.remove('is-dragging');
      if (liveBlockRef.current) onUpdate(liveBlockRef.current);
      dragMetaRef.current  = null;
      liveBlockRef.current = null;
      setLiveBlock(null);
      setActiveId(null);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  // ── Track interaction ────────────────────────────────────

  function handleTrackMouseMove(e: React.MouseEvent) {
    if (dragMetaRef.current) return;
    setHoveredTime(roundToNearest15(yToTime(e.clientY)));
  }

  function handleTrackMouseLeave() {
    setHoveredTime(null);
  }

  // ── Merge live dragging block ────────────────────────────
  const displayBlocks = useMemo(() => {
    if (!liveBlock) return blocks;
    return blocks.map(b => b.id === liveBlock.id ? liveBlock : b);
  }, [blocks, liveBlock]);

  // ── Tick markers — snapped to clean clock boundaries ─────
  // Generate from floorToHour(windowStart) in 15-min steps so labels
  // always land on whole/half hours, never on fractional minutes.
  const tickMarkers = useMemo((): TickMark[] => {
    const ticks: TickMark[] = [];
    const cursor = floorToHour(windowStart);

    while (cursor.getTime() <= windowEnd.getTime() + QUARTER) {
      const topPct = ((cursor.getTime() - windowStart.getTime()) / (totalHours * HOUR_MS)) * 100;
      if (topPct > -0.5 && topPct <= 100.5) {
        const mins = cursor.getMinutes();
        const kind: TickKind = mins === 0 ? 'hour' : mins === 30 ? 'half' : 'quarter';
        ticks.push({ topPct, time: new Date(cursor), kind });
      }
      cursor.setTime(cursor.getTime() + QUARTER);
    }

    return ticks;
  }, [windowStart, windowEnd, totalHours]);

  // ── Day-boundary crossings ─────────────────────────────
  const midnights = useMemo(() => {
    const result: { topPct: number; date: Date }[] = [];
    const cursor = new Date(windowStart);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1);
    while (cursor.getTime() <= windowEnd.getTime()) {
      result.push({ topPct: toTrackPct(cursor), date: new Date(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [windowStart, windowEnd, totalHours]);

  // ── Day/night shading bands ──────────────────────────────
  const dayBands = useMemo(
    () => computeDayBands(windowStart, totalHours),
    [windowStart, totalHours]
  );

  // ── Conflict detection + geometry ────────────────────────
  const protectedBlocks = useMemo(
    () => displayBlocks.filter(b => b.type === 'sleep' || b.type === 'recovery'),
    [displayBlocks]
  );

  const processed = useMemo<ProcessedBlock[]>(
    () => displayBlocks.map(block => ({
      ...block,
      topPct:    toTrackPct(block.start),
      heightPct: ((block.end.getTime() - block.start.getTime()) / (totalHours * HOUR_MS)) * 100,
      isConflict:
        block.type !== 'sleep' &&
        block.type !== 'recovery' &&
        protectedBlocks.some(
          pb =>
            block.start.getTime() < pb.end.getTime() &&
            block.end.getTime()   > pb.start.getTime()
        ),
    })),
    [displayBlocks, windowStart, totalHours, protectedBlocks]
  );

  const hoveredPct = hoveredTime !== null ? toTrackPct(hoveredTime) : null;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="dial-wrapper">

      {/* Fixed-perspective track — no scrolling */}
      <div className="dial-scroll">
        <div
          className="dial-track"
          ref={trackRef}
          onMouseMove={handleTrackMouseMove}
          onMouseLeave={handleTrackMouseLeave}
        >

          {/* Day/night shading (rendered first = behind everything) */}
          {dayBands.map((band, i) =>
            band.kind === 'sunset' ? (
              <div
                key={`sun-${i}`}
                className="sunset-line"
                style={{ top: `${band.topPct}%` }}
              />
            ) : (
              <div
                key={`night-${i}`}
                className="night-band"
                style={{ top: `${band.topPct}%`, height: `${band.heightPct}%` }}
              />
            )
          )}

          {/* Tick grid — hour / half / quarter marks snapped to clean clock times */}
          {tickMarkers.map(({ topPct, time, kind }, i) => (
            <div
              key={i}
              className={`hour-row hour-tick--${kind}`}
              style={{ top: `${topPct}%` }}
            >
              <span className="hour-label">
                {kind === 'hour' && time.getHours() % labelEvery === 0
                  ? fmtHourLabel(time)
                  : null
                }
              </span>
              <div className="hour-line" />
            </div>
          ))}

          {/* Day boundaries */}
          {midnights.map(({ topPct, date }) => (
            <div key={topPct} className="midnight-row" style={{ top: `${topPct}%` }}>
              <span className="midnight-label">
                {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
              <div className="midnight-line" />
            </div>
          ))}

          {/* NOW playhead */}
          <div className="now-row" style={{ top: `${nowPct}%` }}>
            <span className="now-label">NOW</span>
            <div className="now-dot" />
            <div className="now-line" />
          </div>

          {/* Hover time indicator */}
          {hoveredTime && hoveredPct !== null && !liveBlock && (
            <div className="dial-hover-row" style={{ top: `${hoveredPct}%` }}>
              <span className="dial-hover-tooltip">{fmtTime(hoveredTime)}</span>
            </div>
          )}

          {/* Protocol time blocks (behind ticks) */}
          {processed.filter(b => !b.isEvent).map(block => (
            <div
              key={block.id}
              className={[
                'tblock',
                `tblock--${block.type}`,
                block.isConflict      ? 'tblock--conflict' : '',
                block.id === activeId ? 'tblock--active'   : '',
              ].filter(Boolean).join(' ')}
              style={{
                top:       `${block.topPct}%`,
                height:    `${block.heightPct}%`,
                minHeight: 28,
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Resize — top */}
              <div
                className="tblock-handle tblock-handle--top"
                onMouseDown={e => startDrag('resize-top', block, e)}
              />

              {/* Middle: accent | body | conflict badge */}
              <div className="tblock-middle">
                <div className="tblock-accent" />
                <div
                  className="tblock-body"
                  onMouseDown={e => startDrag('move', block, e)}
                >
                  <span className="tblock-title">{block.title}</span>
                  <span className="tblock-time">
                    {fmtTime(block.start)} – {fmtTime(block.end)}
                  </span>
                  {block.protocolId && block.protocolLabel && (
                    <span
                      className="tblock-proto-badge"
                      style={{
                        color:       block.protocolColor,
                        borderColor: block.protocolColor + '50',
                      }}
                    >
                      {block.protocolLabel}
                    </span>
                  )}
                </div>
                {block.isConflict && (
                  <span className="tblock-conflict-badge">conflict</span>
                )}
              </div>

              {/* Resize — bottom */}
              <div
                className="tblock-handle tblock-handle--bottom"
                onMouseDown={e => startDrag('resize-bottom', block, e)}
              />
            </div>
          ))}

          {/* Event overlays — above tblocks and ticks, bordered */}
          {processed.filter(b => b.isEvent).map(block => (
            <div
              key={block.id}
              className="event-overlay"
              style={{
                top:             `${block.topPct}%`,
                height:          `${block.heightPct}%`,
                minHeight:       20,
                borderLeftColor: block.protocolColor ?? '#7F77DD',
                background:      (block.protocolColor ?? '#7F77DD') + '28',
              }}
            >
              <span className="event-overlay-title">{block.title}</span>
              <span className="event-overlay-time">
                {fmtTime(block.start)} – {fmtTime(block.end)}
              </span>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
