/** The smallest "round" number (1, 2, 5 times a power of ten) at or above `value`. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}

/** Evenly spaced axis values from 0 to `max`, `count` steps. */
export function ticksOf(max: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (max * index) / count);
}

/** "2026-01-05" as "Jan 5". */
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${names[Number(month) - 1] ?? ""} ${String(Number(date))}`;
}
