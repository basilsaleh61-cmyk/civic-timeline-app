export const blockColors = {
  deep:       { bg: "#7F77DD", text: "#3C3489", meta: "#534AB7" },
  task:       { bg: "#378ADD", text: "#042C53", meta: "#185FA5" },
  outreach:   { bg: "#D85A30", text: "#4A1B0C", meta: "#712B13" },
  processing: { bg: "#639922", text: "#27500A", meta: "#3B6D11" },
  movement:   { bg: "#1D9E75", text: "#085041", meta: "#0F6E56" },
  protocol:   { bg: "#888780", text: "#444441", meta: "#5F5E5A" },
  sleep:      { bg: "#444441", text: "#2C2C2A", meta: "#5F5E5A" },
};

export const eventColors = {
  work:       { dot: "#7F77DD", card: "#EEEDFE" },
  collab:     { dot: "#D4537E", card: "#FBEAF0" },
  networking: { dot: "#BA7517", card: "#FAEEDA" },
  music:      { dot: "#639922", card: "#EAF3DE" },
  social:     { dot: "#D85A30", card: "#FAECE7" },
};

export const urgencyColors = {
  urgent:  "#E24B4A",
  warn:    "#BA7517",
  nowLine: "#E24B4A",
};

export const nightColors = {
  night1: "#ede8de",
  night2: "#e8e2d6",
  night3: "#e2dccf",
  night4: "#dcd5c5",
  night5: "#d4ccba",
  sunset: "#e6e0d4",
};

export const protocolMeta = {
  base: {
    label:  "Base Protocol",
    byline: "Your default daily rhythm — active every day unless overridden by a higher-priority protocol.",
  },
  daySpecific: {
    label:  "Day-Specific Protocols",
    byline: "Applies on selected days only. Overrides base blocks it defines, or replaces the whole day. Higher priority than base.",
  },
  exception: {
    label:  "Exception Protocols",
    byline: "Overrides everything for a date range. Highest priority — no need to deactivate other protocols.",
  },
};

export const protocolPriority = ["exception", "daySpecific", "base"];
