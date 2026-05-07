import { useState, useEffect, useCallback } from "react";

const HOUR_HEIGHT_PX = 80;
const DAY_START_HOUR = 6;
const FOCAL_RATIO = 0.33;

export function formatHour(h) {
  const totalMinutes = Math.round(h * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours < 12 ? "AM" : "PM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function isPast(rowHour, simHour) {
  return rowHour + 1 < simHour;
}

function timeToFloat(date) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function calcFocalOffset(simHour, viewportEl) {
  if (!viewportEl) return 0;
  const nowY = (simHour - DAY_START_HOUR) * HOUR_HEIGHT_PX;
  const viewportHeight = viewportEl.clientHeight;
  return viewportHeight * FOCAL_RATIO - nowY;
}

export function useTimeline(innerRef, viewportRef) {
  const [simHour, setSimHour] = useState(() => timeToFloat(new Date()));
  const [focalOffset, setFocalOffset] = useState(0);

  const recalc = useCallback(() => {
    setFocalOffset(calcFocalOffset(simHour, viewportRef?.current));
  }, [simHour, viewportRef]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  return { simHour, setSimHour, focalOffset };
}
