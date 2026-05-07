import { useState } from "react";
import { PROTOCOLS } from "../models.js";
import { protocolPriority } from "../theme.js";

function parseExceptionRange(dateRange) {
  if (!dateRange) return null;
  // Expects format like "May 30 – Jun 27" (current year assumed)
  const [startStr, endStr] = dateRange.split(/\s*[–-]\s*/);
  const year = new Date().getFullYear();
  const start = new Date(`${startStr.trim()} ${year}`);
  const end = new Date(`${endStr.trim()} ${year}`);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function todayDayIndex() {
  // Convert JS Sunday=0 to Mon=0 index
  return (new Date().getDay() + 6) % 7;
}

function generateId() {
  return `proto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useProtocols() {
  const [protocols, setProtocols] = useState(PROTOCOLS);

  function toggleProtocol(id) {
    setProtocols(prev =>
      prev.map(p => (p.id === id ? { ...p, active: !p.active } : p))
    );
  }

  function updateProtocol(id, changes) {
    setProtocols(prev =>
      prev.map(p => (p.id === id ? { ...p, ...changes } : p))
    );
  }

  function deleteProtocol(id) {
    setProtocols(prev => prev.filter(p => p.id !== id));
  }

  function addProtocol(protocol) {
    setProtocols(prev => [...prev, { id: generateId(), ...protocol }]);
  }

  function getActiveRowIds() {
    const today = new Date();
    const dayIndex = todayDayIndex();
    const claimed = new Set();

    for (const tier of protocolPriority) {
      const tieredProtocols = protocols.filter(
        p => p.active && p.category === tier
      );

      for (const p of tieredProtocols) {
        if (tier === "exception") {
          const range = parseExceptionRange(p.dateRange);
          if (!range || today < range.start || today > range.end) continue;
        } else {
          if (!p.days.includes(dayIndex)) continue;
        }

        for (const key of p.protoKeys) {
          if (tier === "base" || !claimed.has(key)) {
            claimed.add(key);
          }
        }

        // In replace mode at exception/daySpecific tier, keys not listed are
        // suppressed — handled by consumers checking claimed membership.
      }
    }

    return claimed;
  }

  return {
    protocols,
    toggleProtocol,
    updateProtocol,
    deleteProtocol,
    addProtocol,
    getActiveRowIds,
  };
}
