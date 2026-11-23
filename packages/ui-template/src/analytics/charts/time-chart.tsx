import { formatElapsed } from "../../status/index.ts";
import { ChartCard } from "./chart-card.tsx";

const WIDTH = 640;
const HEIGHT = 34;

type Props = { workingMs: number; waitingMs: number };

const percentOf = (part: number, whole: number): string =>
  `${String(whole === 0 ? 0 : Math.round((part / whole) * 100))}%`;

function viewOf(call: { workingMs: number; waitingMs: number; total: number }) {
  const { workingMs, waitingMs, total } = call;
  const working = `${formatElapsed(workingMs)} (${percentOf(workingMs, total)})`;
  const waiting = `${formatElapsed(waitingMs)} (${percentOf(waitingMs, total)})`;
  return {
    legend: [
      { name: `Working ${working}`, colour: "var(--chart-1)" },
      { name: `Waiting for you ${waiting}`, colour: "var(--chart-2)" },
    ],
    table: {
      head: ["Time", "Duration", "Share"],
      rows: [
        ["Working", formatElapsed(workingMs), percentOf(workingMs, total)],
        ["Waiting for you", formatElapsed(waitingMs), percentOf(waitingMs, total)],
      ],
    },
  };
}

function Segment(props: { x: number; width: number; colour: string; label: string }) {
  return (
    <rect
      x={props.x}
      y={4}
      width={props.width}
      height={26}
      fill={props.colour}
      stroke="var(--surface)"
      strokeWidth={2}
    >
      <title>{props.label}</title>
    </rect>
  );
}

/** One bar split into the time the agents worked and the time they waited for the user. */
export function TimeChart({ workingMs, waitingMs }: Props) {
  const total = workingMs + waitingMs;
  const workWidth = total === 0 ? 0 : (WIDTH * workingMs) / total;
  const { legend, table } = viewOf({ workingMs, waitingMs, total });
  return (
    <ChartCard title="Working and waiting" legend={legend} table={table}>
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={`Agents worked ${formatElapsed(workingMs)} and waited ${formatElapsed(waitingMs)} for you. Use Show as table for the numbers.`}
        className="mb-2 block h-auto w-full"
      >
        <rect x={0} y={4} width={WIDTH} height={26} rx={4} fill="var(--code)" />
        <Segment
          x={0}
          width={workWidth}
          colour="var(--chart-1)"
          label={`Working: ${formatElapsed(workingMs)}`}
        />
        <Segment
          x={workWidth}
          width={total === 0 ? 0 : WIDTH - workWidth}
          colour="var(--chart-2)"
          label={`Waiting for you: ${formatElapsed(waitingMs)}`}
        />
      </svg>
    </ChartCard>
  );
}
