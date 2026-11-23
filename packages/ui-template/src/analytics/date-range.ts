/** The date ranges the filter bar offers. */
export type Preset = "today" | "7d" | "30d" | "all";

export const PRESETS: readonly { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

const DAYS: Record<Preset, number> = { today: 1, "7d": 7, "30d": 30, all: 0 };

/** The start of the day `days - 1` days before today, in the viewer's own time zone. */
function startOfDay(now: Date, daysBack: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);
}

/**
 * The range a preset means, ending now: "today" starts at this morning's midnight, "7 days" at
 * midnight six days ago (so today counts as one of the seven), and "all time" has no limit.
 */
export function rangeOf(preset: Preset, now: Date): { from?: string } {
  const days = DAYS[preset];
  return days === 0 ? {} : { from: startOfDay(now, days - 1).toISOString() };
}

/** Minutes the viewer's clock is ahead of UTC (60 for UTC+1), for the day breakdown. */
export const tzOffsetOf = (now: Date): number => -now.getTimezoneOffset();
