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

// ── Sky colour palette ──────────────────────────────────────
// [hour (0–24), hex].  Values between stops are linearly
// interpolated so the gradient blends smoothly.

export const SKY_STOPS: [number, string][] = [
  [0,    '#0c1033'],  // midnight deep navy
  [2,    '#090c22'],  // deepest night
  [4,    '#0e1538'],  // pre-dawn dark indigo
  [5,    '#1e2460'],  // indigo
  [5.5,  '#3d3578'],  // blue-indigo horizon
  [6,    '#6a5070'],  // dawn rose-purple
  [6.5,  '#c07050'],  // golden dawn
  [7,    '#e8b870'],  // warm morning amber
  [8,    '#f0d8a5'],  // morning parchment
  [10,   '#f0e0b5'],  // warm daytime
  [12,   '#eedebb'],  // noon parchment
  [15,   '#eeddbb'],  // afternoon
  [17,   '#e8cc75'],  // late-afternoon golden
  [18,   '#e8a050'],  // pre-sunset golden
  [18.5, '#d47040'],  // golden-hour peak
  [19,   '#c04028'],  // sunset orange-red
  [19.5, '#8a2850'],  // dusk magenta
  [20,   '#3a1858'],  // dusk purple
  [21,   '#1c1040'],  // twilight
  [22,   '#120c30'],  // early night
  [23,   '#0d0c2a'],  // night
  [24,   '#0c1033'],  // back to midnight
];

function parseHex6(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerpColor(c0: string, c1: string, t: number): string {
  const [r0, g0, b0] = parseHex6(c0);
  const [r1, g1, b1] = parseHex6(c1);
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function skyColorAt(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < SKY_STOPS.length; i++) {
    if (SKY_STOPS[i][0] > h) {
      const [t0, c0] = SKY_STOPS[i - 1];
      const [t1, c1] = SKY_STOPS[i];
      return lerpColor(c0, c1, (h - t0) / (t1 - t0));
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

function computeDialSkyGradient(windowStart: Date, totalHours: number): string {
  const stops: string[] = [];
  const step = 0.5; // sample every 30 min for smooth blending
  for (let h = 0; h <= totalHours; h += step) {
    const t    = new Date(windowStart.getTime() + h * HOUR_MS);
    const hour = t.getHours() + t.getMinutes() / 60;
    const pct  = (h / totalHours) * 100;
    stops.push(`${skyColorAt(hour)} ${pct.toFixed(1)}%`);
  }
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
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

  // NOW is centred: equal runway above and below.
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
                top:             `${block.topPct}%`,
                height:          `${block.heightPct}%`,
                minHeight:       28,
                transform:       block.id === activeId ? 'scaleY(1)' : `scaleY(${block.cScale})`,
                transformOrigin: 'center center',
                opacity:         block.id === activeId ? 1 : block.cOpacity,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="tblock-handle tblock-handle--top" onMouseDown={e => startDrag('resize-top', block, e)} />
              <div className="tblock-middle">
                <div className="tblock-accent" />
                <div className="tblock-body" onMouseDown={e => startDrag('move', block, e)}>
                  <span className="tblock-title">{block.title}</span>
                  <span className="tblock-time">{fmtTime(block.start)} – {fmtTime(block.end)}</span>
                </div>
                {block.isConflict && <span className="tblock-conflict-badge">conflict</span>}
              </div>
              <div className="tblock-handle tblock-handle--bottom" onMouseDown={e => startDrag('resize-bottom', block, e)} />
            </div>
          ))}

          {/* Layer 2: tick grid — fully visible ±7 h from NOW, fades in outer 2 h only */}
          {tickMarkers.map(({ topPct, time, kind }, i) => {
            const dh = Math.abs(topPct - nowPct) / 100 * totalHours;
            const op = dh <= 7 ? 1 : Math.max(0, 1 - (dh - 7) / 2);
            return (
              <div key={i} className={`hour-row hour-tick--${kind}`} style={{ top: `${topPct}%`, opacity: op }}>
                <span className="hour-label">
                  {kind === 'hour' && time.getHours() % labelEvery === 0 ? fmtHourLabel(time) : null}
                </span>
                <div className="hour-line" />
              </div>
            );
          })}

          {/* Layer 2: day boundaries */}
          {midnights.map(({ topPct, date }) => {
            const dh = Math.abs(topPct - nowPct) / 100 * totalHours;
            const op = dh <= 7 ? 1 : Math.max(0, 1 - (dh - 7) / 2);
            return (
              <div key={topPct} className="midnight-row" style={{ top: `${topPct}%`, opacity: op }}>
                <span className="midnight-label">
                  {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
                <div className="midnight-line" />
              </div>
            );
          })}

          {/* Layer 3: event overlays — bordered, above tblocks, cylinder-compressed */}
          {processed.filter(b => b.isEvent).map(block => (
            <div
              key={block.id}
              className="event-overlay"
              style={{
                top:             `${block.topPct}%`,
                height:          `${block.heightPct}%`,
                minHeight:       20,
                borderLeftColor: block.protocolColor ?? '#7F77DD',
                background:      'rgba(255,255,255,0.92)',
                transform:       `scaleY(${block.cScale})`,
                transformOrigin: 'center center',
                opacity:         block.cOpacity,
              }}
            >
              <span className="event-overlay-title">{block.title}</span>
              <span className="event-overlay-time">{fmtTime(block.start)} – {fmtTime(block.end)}</span>
            </div>
          ))}

          {/* Layer 4: NOW playhead — focal plane, above vignette */}
          <div className="now-row" style={{ top: `${nowPct}%` }}>
            <span className="now-label">NOW</span>
            <div className="now-dot" />
            <div className="now-line" />
          </div>

          {/* Layer 4: hover indicator */}
          {hoveredTime && hoveredPct !== null && !liveBlock && (
            <div className="dial-hover-row" style={{ top: `${hoveredPct}%` }}>
              <span className="dial-hover-tooltip">{fmtTime(hoveredTime)}</span>
            </div>
          )}

          {/* Layer 5: cylinder vignette — dark overlay at top/bottom edges */}
          <div className="dial-vignette" />

        </div>
      </div>
    </div>
  );
}
