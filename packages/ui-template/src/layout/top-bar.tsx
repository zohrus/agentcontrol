import { Button } from "../components/index.ts";
import type { SlotMap } from "./bar-slots.tsx";

export type TopBarActions = {
  onConfig: () => void;
  onAnalytics: () => void;
  onModify: () => void;
  onNewSession: () => void;
};

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-1.5 rounded border border-line px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}

function SearchBox() {
  return (
    <div className="flex max-w-[360px] flex-1 items-center rounded-md border border-line px-2.5 py-1 text-xs text-muted">
      Search sessions, files, prompts
      <span className="ml-auto">
        <Kbd>⌘K</Kbd>
      </span>
    </div>
  );
}

/** Default top bar slots: brand, search placeholder and the four actions. */
export function defaultTopBarSlots(actions: TopBarActions): SlotMap {
  return {
    brand: <span className="text-sm font-semibold">AgentControl</span>,
    search: <SearchBox />,
    config: <Button onClick={actions.onConfig}>Config</Button>,
    analytics: <Button onClick={actions.onAnalytics}>Analytics</Button>,
    modify: (
      <Button variant="modify" onClick={actions.onModify}>
        Modify this UI<Kbd>⌘.</Kbd>
      </Button>
    ),
    "new-session": (
      <Button variant="primary" onClick={actions.onNewSession}>
        New session
      </Button>
    ),
  };
}
