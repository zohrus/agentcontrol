import type { Breakdown, TokenCounts } from "@agentcontrol/sdk";
import { formatTokens } from "../../status/index.ts";
import { ChartCard, type LegendEntry } from "./chart-card.tsx";
import { niceMax, shortDay, ticksOf } from "./scale.ts";

const WIDTH = 640;
const HEIGHT = 220;
const LEFT = 44;
const TOP = 8;
const BOTTOM = 26;
const PLOT_W = WIDTH - LEFT - 8;
const PLOT_H = HEIGHT - TOP - BOTTOM;

/** Token kinds from the bottom of a bar to the top, with the colour of each. */
const KINDS: { key: keyof Omit<TokenCounts, "total">; name: string; colour: string }[] = [
  { key: "input", name: "Input", colour: "var(--chart-1)" },
  { key: "output", name: "Output", colour: "var(--chart-2)" },
  { key: "cacheRead", name: "Cache read", colour: "var(--chart-3)" },
  { key: "cacheWrite", name: "Cache write", colour: "var(--chart-4)" },
];

const LEGEND: LegendEntry[] = KINDS.map(({ name, colour }) => ({ name, colour }));

type Scale = { max: number; slot: number; barWidth: number };

const yOf = (value: number, scale: Scale): number => TOP + PLOT_H - (value / scale.max) * PLOT_H;

function Bar(props: { day: Breakdown; index: number; scale: Scale }) {
  const { day, index, scale } = props;
  const x = LEFT + index * scale.slot + (scale.slot - scale.barWidth) / 2;
  let below = 0;
  return (
    <g>
      {KINDS.map((kind) => {
        const value = day.tokens[kind.key];
        const top = yOf(below + value, scale);
        const height = yOf(below, scale) - top;
        below += value;
        return (
          <rect
            key={kind.key}
            x={x}
            y={top}
            width={scale.barWidth}
            height={height}
            fill={kind.colour}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            <title>{`${shortDay(day.key)}, ${kind.name.toLowerCase()}: ${value.toLocaleString("en-US")} tokens`}</title>
          </rect>
        );
      })}
    </g>
  );
}

function ValueAxis({ scale }: { scale: Scale }) {
  return (
    <>
      {ticksOf(scale.max, 4).map((tick) => (
        <g key={tick}>
          <line
            x1={LEFT}
            x2={WIDTH - 8}
            y1={yOf(tick, scale)}
            y2={yOf(tick, scale)}
            stroke="var(--line)"
          />
          <text x={LEFT - 6} y={yOf(tick, scale) + 3} textAnchor="end">
            {formatTokens(tick)}
          </text>
        </g>
      ))}
    </>
  );
}

function DayLabels({ scale, days }: { scale: Scale; days: Breakdown[] }) {
  const every = Math.ceil(days.length / 8);
  const shown = days.filter((_, index) => index % every === 0);
  return (
    <>
      {shown.map((day) => (
        <text
          key={day.key}
          x={LEFT + (days.indexOf(day) + 0.5) * scale.slot}
          y={HEIGHT - 8}
          textAnchor="middle"
        >
          {shortDay(day.key)}
        </text>
      ))}
    </>
  );
}

function Axes({ scale, days }: { scale: Scale; days: Breakdown[] }) {
  return (
    <g fontSize={10} fill="var(--muted)">
      <ValueAxis scale={scale} />
      <DayLabels scale={scale} days={days} />
    </g>
  );
}

const tableOf = (days: Breakdown[]) => ({
  head: ["Day", "Input", "Output", "Cache read", "Cache write"],
  rows: days.map((day) => [
    day.key,
    ...KINDS.map((kind) => day.tokens[kind.key].toLocaleString("en-US")),
  ]),
});

/** Tokens per day, each bar stacked by token kind. */
export function DayChart({ days }: { days: Breakdown[] }) {
  const max = niceMax(Math.max(...days.map((day) => day.tokens.total), 0));
  const slot = PLOT_W / Math.max(days.length, 1);
  const scale: Scale = { max, slot, barWidth: Math.min(48, slot * 0.7) };
  return (
    <ChartCard title="Tokens per day" legend={LEGEND} table={tableOf(days)}>
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={`Tokens per day over ${String(days.length)} days, stacked by input, output, cache read and cache write. Use Show as table for the numbers.`}
        className="block h-auto w-full"
      >
        <Axes scale={scale} days={days} />
        {days.map((day, index) => (
          <Bar key={day.key} day={day} index={index} scale={scale} />
        ))}
      </svg>
    </ChartCard>
  );
}
