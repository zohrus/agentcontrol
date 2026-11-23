import { useId } from "react";
import { cn, inputClass } from "../components/index.ts";
import { type Preset, PRESETS } from "./date-range.ts";

export type Option = { value: string; label: string };

function Select(props: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-[11px] text-muted">
      {props.label}
      <select
        id={id}
        className={cn(inputClass, "w-auto max-w-48 py-1 text-xs text-fg")}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      >
        <option value="">All</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type Props = {
  preset: Preset;
  onPreset: (preset: Preset) => void;
  workspace: { value: string; options: Option[]; onChange: (value: string) => void };
  agent: { value: string; options: Option[]; onChange: (value: string) => void };
  repo: { value: string; options: Option[]; onChange: (value: string) => void };
};

/** Date range presets and the workspace, agent and repository filters, in one row. */
export function FilterBar({ preset, onPreset, workspace, agent, repo }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="radiogroup" aria-label="Date range" className="flex gap-1">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={item.id === preset}
            onClick={() => {
              onPreset(item.id);
            }}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              item.id === preset
                ? "border-accent bg-accent-soft text-fg"
                : "border-line text-muted hover:bg-code",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Select label="Workspace" {...workspace} />
      <Select label="Agent" {...agent} />
      <Select label="Repository" {...repo} />
    </div>
  );
}
