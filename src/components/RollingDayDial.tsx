// ─────────────────────────────────────────────────────────────
// RollingDayDial — cylindrical time drum
//
// The visible window is centred on NOW (9 h before, 9 h after).
// Blocks near NOW render at full fidelity; blocks further away
// compress and fade, implying the surface curves away from the
// viewer. The background is a live sky-colour gradient that maps
// time-of-day to actual sky hues — deep navy at night, warm
// parchment through the day, golden at dusk.
// ─────────────────────────────────────────────────────────────

import { useRef, useMemo, useState } from 'react';
import type { TimeBlock } from '../types';

const MIN_DURATION = 15 * 60_000;
const QUARTER      = 15 * 60_000;
const HOUR_MS      = 3_600_000;

// ── Two-tone sky palette ─────────────────────────────────────
// Day (6:00–18:00): warm parchment. Night (18:00–6:00): muted parchment.

const SUNRISE_H = 6;
const SUNSET_H  = 18;

export const DAY_COLOR   = '#F4EBD8';
export const NIGHT_COLOR = '#DDD1BC';

export function skyColorAt(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return (h >= SUNRISE_H && h < SUNSET_H) ? DAY_COLOR : NIGHT_COLOR;
}

// ── Stepped dial gradient ─────────────────────────────────
// Hard-edged color bands aligned to 15-min tick marks.

function computeDialSkyGradient(windowStart: Date, totalHours: number): string {
  const STEP_MS = 15 * 60_000;
  const totalMs = totalHours * HOUR_MS;
  const snapMs  = Math.floor(windowStart.getTime() / STEP_MS) * STEP_MS;

  interface Band { color: string; start: number; end: number; }
  const bands: Band[] = [];
  let prevColor = '';

  for (let t = snapMs; t < windowStart.getTime() + totalMs; t += STEP_MS) {
    const d     = new Date(t);
    const color = skyColorAt(d.getHours() + d.getMinutes() / 60);
    const startPct = Math.max(0, (t - windowStart.getTime()) / totalMs * 100);
    const endPct   = Math.min(100, (t + STEP_MS - windowStart.getTime()) / totalMs * 100);
    if (color !== prevColor) {
      bands.push({ color, start: startPct, end: endPct });
      prevColor = color;
    } else if (bands.length > 0) {
      bands[bands.length - 1].end = endPct;
    }
  }
  if (bands.length > 0) bands[bands.length - 1].end = 100;

  const stops = bands.flatMap(({ color, start, end }) => [
    `${color} ${start.toFixed(2)}%`,
    `${color} ${end.toFixed(2)}%`,
  ]);
  return stops.length > 0
    ? `linear-gradient(to bottom, ${stops.join(', ')})`
    : DAY_COLOR;
}

// ── Helpers ────────────────────────────────────────────────

function snapMs(ms: number): number {
  return Math.round(ms / QUARTER) * QUARTER;
}

export function floorToHour(d: Date): Date {
  const r = new Date(d); r.setMinutes(0, 0, 0); return r;
}

export function roundToNearest15(d: Date): Date {
  return new Date(Math.round(d.getTime() / QUARTER) * QUARTER);
}

function fmtTime(d: Date): string {
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
}

function fmtHourLabel(d: Date): string {
  const h = d.getHours();
  return `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
}

function asTimeBlock(b: TimeBlock): TimeBlock {
  return {
    id: b.id, title: b.title, start: b.start, end: b.end, type: b.type,
    isEvent: b.isEvent, protocolColor: b.protocolColor,
  };
}

// ── Tick contrast helper ──────────────────────────────────
// Returns true when the given hex colour is perceptually dark,
// so callers can choose white vs black ink accordingly.
function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

// ── Cylinder projection ────────────────────────────────────
// Maps distance-from-NOW (hours) to visual scale and opacity.
// Items at NOW = full size / full opacity; further = compressed + faded.

function cylScale(distHours: number): number {
  return Math.max(0.25, 1 - Math.min(distHours, 7) / 7 * 0.75);
}

function cylOpacity(distHours: number): number {
  return Math.max(0.04, 1 - Math.min(distHours, 4.5) / 4.5 * 0.96);
}

// ── Drag ───────────────────────────────────────────────────

type DragKind = 'move' | 'resize-top' | 'resize-bottom';

interface DragMeta {
  kind:        DragKind;
  origStart:   Date;
  origEnd:     Date;
  startY:      number;
  trackHeight: number;
  totalHours:  number;
}

function applyDrag(meta: DragMeta, currentY: number): { start: Date; end: Date } {
  const deltaMs = snapMs(
    ((currentY - meta.startY) / meta.trackHeight) * meta.totalHours * HOUR_MS
  );
  if (meta.kind === 'move') return {
    start: new Date(meta.origStart.getTime() + deltaMs),
    end:   new Date(meta.origEnd.getTime()   + deltaMs),
  };
  if (meta.kind === 'resize-top') return {
    start: new Date(Math.min(meta.origStart.getTime() + deltaMs, meta.origEnd.getTime() - MIN_DURATION)),
    end: meta.origEnd,
  };
  return {
    start: meta.origStart,
    end:   new Date(Math.max(meta.origEnd.getTime() + deltaMs, meta.origStart.getTime() + MIN_DURATION)),
  };
}

// ── Types ───────────────────────────────────────────────────

interface ProcessedBlock extends TimeBlock {
  topPct:     number;
  heightPct:  number;
  isConflict: boolean;
  cScale:     number;
  cOpacity:   number;
}

type TickKind = 'hour' | 'half' | 'quarter';
interface TickMark { topPct: number; time: Date; kind: TickKind; }

interface Props {
  blocks:   TimeBlock[];
  onUpdate: (block: TimeBlock) => void;
}

// ── Component ───────────────────────────────────────────────

export function RollingDayDial({ blocks, onUpdate }: Props) {
  const now      = useRef(new Date()).current;
  const trackRef = useRef<HTMLDivElement>(null);

  // NOW centred: 9 h before, 9 h after.
  const offsetBefore = 9;
  const totalHours   = 18;
  const labelEvery   = 1;

  const windowStart = useMemo(() => new Date(now.getTime() - offsetBefore * HOUR_MS), [now, offsetBefore]);
  const windowEnd   = useMemo(() => new Date(windowStart.getTime() + totalHours * HOUR_MS), [windowStart, totalHours]);

  function toTrackPct(d: Date): number {
    return ((d.getTime() - windowStart.getTime()) / (totalHours * HOUR_MS)) * 100;
  }
  function yToTime(clientY: number): Date {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return new Date(windowStart);
    return new Date(windowStart.getTime() + Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) * totalHours * HOUR_MS);
  }

  // Focal plane — NOW is at the vertical centre of the track.
  const nowPct = (offsetBefore / totalHours) * 100; // = 50 %

  const totalHoursRef = useRef(totalHours);
  totalHoursRef.current = totalHours;

  // ── Sky gradient background ──────────────────────────────
  const skyGradient = useMemo(
    () => computeDialSkyGradient(windowStart, totalHours),
    [windowStart, totalHours]
  );

  // ── Drag state ──────────────────────────────────────────
  const dragMetaRef  = useRef<DragMeta | null>(null);
  const liveBlockRef = useRef<TimeBlock | null>(null);
  const [liveBlock,   setLiveBlock  ] = useState<TimeBlock | null>(null);
  const [activeId,    setActiveId   ] = useState<string | null>(null);
  const [hoveredTime, setHoveredTime] = useState<Date | null>(null);

  function startDrag(kind: DragKind, raw: TimeBlock, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setHoveredTime(null);
    const block       = asTimeBlock(raw);
    const trackHeight = trackRef.current?.getBoundingClientRect().height ?? 500;
    dragMetaRef.current  = { kind, origStart: block.start, origEnd: block.end, startY: e.clientY, trackHeight, totalHours: totalHoursRef.current };
    liveBlockRef.current = block;
    setLiveBlock(block); setActiveId(block.id);
    document.body.classList.add('is-dragging');
    function onMove(ev: MouseEvent) {
      const meta = dragMetaRef.current; if (!meta) return;
      const { start, end } = applyDrag(meta, ev.clientY);
      const updated = { ...block, start, end };
      liveBlockRef.current = updated; setLiveBlock(updated);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-dragging');
      if (liveBlockRef.current) onUpdate(liveBlockRef.current);
      dragMetaRef.current = null; liveBlockRef.current = null;
      setLiveBlock(null); setActiveId(null);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleTrackMouseMove(e: React.MouseEvent) {
    if (dragMetaRef.current) return;
    setHoveredTime(roundToNearest15(yToTime(e.clientY)));
  }
  function handleTrackMouseLeave() { setHoveredTime(null); }

  const displayBlocks = useMemo(() => {
    if (!liveBlock) return blocks;
    return blocks.map(b => b.id === liveBlock.id ? liveBlock : b);
  }, [blocks, liveBlock]);

  // ── Tick markers ─────────────────────────────────────────
  const tickMarkers = useMemo((): TickMark[] => {
    const ticks: TickMark[] = [];
    const cursor = floorToHour(windowStart);
    while (cursor.getTime() <= windowEnd.getTime() + QUARTER) {
      const topPct = ((cursor.getTime() - windowStart.getTime()) / (totalHours * HOUR_MS)) * 100;
      if (topPct > -0.5 && topPct <= 100.5) {
        const mins = cursor.getMinutes();
        ticks.push({ topPct, time: new Date(cursor), kind: mins === 0 ? 'hour' : mins === 30 ? 'half' : 'quarter' });
      }
      cursor.setTime(cursor.getTime() + QUARTER);
    }
    return ticks;
  }, [windowStart, windowEnd, totalHours]);

  const midnights = useMemo(() => {
    const result: { topPct: number; date: Date }[] = [];
    const cursor = new Date(windowStart); cursor.setHours(0, 0, 0, 0); cursor.setDate(cursor.getDate() + 1);
    while (cursor.getTime() <= windowEnd.getTime()) {
      result.push({ topPct: toTrackPct(cursor), date: new Date(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [windowStart, windowEnd, totalHours]);

  const protectedBlocks = useMemo(
    () => displayBlocks.filter(b => b.type === 'sleep' || b.type === 'recovery'),
    [displayBlocks]
  );

  const processed = useMemo<ProcessedBlock[]>(
    () => displayBlocks.map(block => {
      const topPct    = toTrackPct(block.start);
      const heightPct = ((block.end.getTime() - block.start.getTime()) / (totalHours * HOUR_MS)) * 100;
      const distHours = Math.abs((topPct + heightPct / 2) - nowPct) / 100 * totalHours;
      const isConflict =
        block.type !== 'sleep' && block.type !== 'recovery' &&
        protectedBlocks.some(pb => block.start.getTime() < pb.end.getTime() && block.end.getTime() > pb.start.getTime());
      return { ...block, topPct, heightPct, isConflict, cScale: cylScale(distHours), cOpacity: cylOpacity(distHours) };
    }),
    [displayBlocks, windowStart, totalHours, protectedBlocks, nowPct]
  );

  const hoveredPct = hoveredTime !== null ? toTrackPct(hoveredTime) : null;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="dial-wrapper">
      <div className="dial-scroll">
        <div
          className="dial-track"
          ref={trackRef}
          style={{ background: skyGradient }}
          onMouseMove={handleTrackMouseMove}
          onMouseLeave={handleTrackMouseLeave}
        >

          {/* Layer 0: construction paper grain overlay */}
          <div className="dial-grain" />

          {/* Layer 1: protocol time blocks — full-width, behind ticks */}
          {processed.filter(b => !b.isEvent).map(block => (
            <div
              key={block.id}
              className={[
                'tblock', `tblock--${block.type}`,
                block.isConflict      ? 'tblock--conflict' : '',
                block.id === activeId ? 'tblock--active'   : '',
              ].filter(Boolean).join(' ')}
              style={{
                top:       `${block.topPct}%`,
                height:    `${block.heightPct}%`,
                minHeight: 28,
              }}
            >
              <div className="tblock-middle">
                <div className="tblock-body">
                  <span className="tblock-title">{block.title}</span>
                  <span className="tblock-time">{fmtTime(block.start)} – {fmtTime(block.end)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Layer 2: event cards — opaque, behind ticks, not interactive */}
          {processed.filter(b => b.isEvent).map(block => (
            <div
              key={block.id}
              className="event-overlay"
              style={{
                top:             `${block.topPct}%`,
                height:          `${block.heightPct}%`,
                minHeight:       20,
                borderLeftColor: block.protocolColor ?? '#7F77DD',
              }}
            >
              <span className="event-overlay-title">{block.title}</span>
              <span className="event-overlay-time">{fmtTime(block.start)} – {fmtTime(block.end)}</span>
            </div>
          ))}

          {/* Layer 3: tick grid — ink adapts to sky background */}
          {tickMarkers.map(({ topPct, time, kind }, i) => {
            const bg   = skyColorAt(time.getHours() + time.getMinutes() / 60);
            const dark = isColorDark(bg);
            const lc   = dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.55)';
            const la   = kind === 'hour' ? 0.28 : kind === 'half' ? 0.14 : 0.07;
            const lnC  = dark ? `rgba(255,255,255,${la * 1.15})` : `rgba(0,0,0,${la})`;
            return (
              <div key={i} className={`hour-row hour-tick--${kind}`} style={{ top: `${topPct}%` }}>
                <span className="hour-label" style={{ color: lc }}>
                  {kind === 'hour' && time.getHours() !== 0 && time.getHours() % labelEvery === 0 ? fmtHourLabel(time) : null}
                </span>
                <div className="hour-line" style={{ background: lnC }} />
              </div>
            );
          })}

          {/* Layer 3: day boundaries */}
          {midnights.map(({ topPct, date }) => {
            const bg   = skyColorAt(0); // midnight is always night
            const dark = isColorDark(bg);
            const lc   = dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.65)';
            const lnC  = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
            return (
              <div key={topPct} className="midnight-row" style={{ top: `${topPct}%` }}>
                <span className="midnight-label" style={{ color: lc }}>
                  {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
                <div className="midnight-line" style={{ background: lnC }} />
              </div>
            );
          })}

          {/* Layer 4: NOW playhead — focal plane, always on top */}
          <div className="now-row" style={{ top: `${nowPct}%` }}>
            <div className="now-line" />
            <div className="now-tab">NOW</div>
          </div>

          {/* Layer 4: hover indicator */}
          {hoveredTime && hoveredPct !== null && (
            <div className="dial-hover-row" style={{ top: `${hoveredPct}%` }}>
              <span className="dial-hover-tooltip">{fmtTime(hoveredTime)}</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
