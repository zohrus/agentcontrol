import type { Breakdown } from "@agentcontrol/sdk";
import { formatTokens } from "../../status/index.ts";
import { ChartCard } from "./chart-card.tsx";

const ROW = 26;
const WIDTH = 640;
const LABEL = 190;
const VALUE = 70;

function ModelBar(props: { model: Breakdown; index: number; max: number }) {
  const { model, index, max } = props;
  const y = index * ROW;
  const width = Math.max(2, ((WIDTH - LABEL - VALUE) * model.tokens.total) / max);
  return (
    <g>
      <text x={0} y={y + 16} fontSize={11} fill="var(--fg)">
        {model.label.length > 28 ? `${model.label.slice(0, 27)}…` : model.label}
        <title>{model.label}</title>
      </text>
      <rect x={LABEL} y={y + 5} width={width} height={14} rx={3} fill="var(--chart-1)">
        <title>{`${model.label}: ${model.tokens.total.toLocaleString("en-US")} tokens in ${String(model.turns)} turns`}</title>
      </rect>
      <text x={LABEL + width + 6} y={y + 16} fontSize={11} fill="var(--muted)">
        {formatTokens(model.tokens.total)}
      </text>
    </g>
  );
}

const tableOf = (models: Breakdown[]) => ({
  head: ["Model", "Turns", "Tokens"],
  rows: models.map((model) => [
    model.label,
    String(model.turns),
    model.tokens.total.toLocaleString("en-US"),
  ]),
});

/** Total tokens per model, longest bar first. */
export function ModelChart({ models }: { models: Breakdown[] }) {
  const max = Math.max(...models.map((model) => model.tokens.total), 1);
  return (
    <ChartCard title="Tokens per model" table={tableOf(models)}>
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(Math.max(models.length, 1) * ROW)}`}
        role="img"
        aria-label={`Tokens per model for ${String(models.length)} models. Use Show as table for the numbers.`}
        className="block h-auto w-full"
      >
        {models.map((model, index) => (
          <ModelBar key={model.key} model={model} index={index} max={max} />
        ))}
      </svg>
    </ChartCard>
  );
}
