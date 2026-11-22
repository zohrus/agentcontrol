import { Button } from "../components/index.ts";

export type SessionFilter = "inbox" | "all" | "archived";

type Props = {
  filter: SessionFilter;
  waiting: number;
  onChange: (filter: SessionFilter) => void;
};

function FilterButton({
  value,
  label,
  filter,
  onChange,
}: Omit<Props, "waiting"> & { value: SessionFilter; label: string }) {
  return (
    <Button
      variant={filter === value ? "default" : "ghost"}
      aria-pressed={filter === value}
      onClick={() => {
        onChange(value);
      }}
    >
      {label}
    </Button>
  );
}

/** Inbox (sessions waiting on you), All and Archived. */
export function ListFilters({ filter, waiting, onChange }: Props) {
  const common = { filter, onChange };
  return (
    <div role="group" aria-label="Show" className="flex items-center gap-1 px-2 pt-2">
      <FilterButton {...common} value="inbox" label={`Inbox (${String(waiting)})`} />
      <FilterButton {...common} value="all" label="All" />
      <FilterButton {...common} value="archived" label="Archived" />
    </div>
  );
}
