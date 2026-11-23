import type { SessionId } from "@agentcontrol/sdk";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useRef, useState } from "react";
import { Button } from "../components/index.ts";
import { type ShellEnd, useShell } from "./use-shell.ts";

function describe(end: ShellEnd): string {
  if ("problem" in end) return end.problem;
  if (end.exitCode === null) return "The shell was stopped.";
  return `The shell ended with exit code ${String(end.exitCode)}.`;
}

/** One shell: it starts when this mounts and ends when it unmounts. */
function Shell({ id, onEnd }: { id: SessionId; onEnd: (end: ShellEnd) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useShell({ id, box, onEnd });
  return <div ref={box} data-testid="terminal" className="min-h-0 flex-1 overflow-hidden p-2" />;
}

function Ended({ end, onRestart }: { end: ShellEnd; onRestart: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-t border-line px-3 py-2 text-xs text-muted"
    >
      <span>{describe(end)}</span>
      <Button onClick={onRestart}>New terminal</Button>
    </div>
  );
}

/**
 * The Terminal tab: a shell in the session's folder on its workspace. It starts the first time the
 * tab is shown and keeps running while other tabs are shown. When it ends, "New terminal" starts
 * another.
 */
export function TerminalTab({ id, active }: { id: SessionId; active: boolean }) {
  const [opened, setOpened] = useState(active);
  const [generation, setGeneration] = useState(0);
  const [end, setEnd] = useState<ShellEnd>();
  if (active && !opened) setOpened(true);
  const onEnd = useCallback((next: ShellEnd) => {
    setEnd((previous) => previous ?? next);
  }, []);
  const restart = (): void => {
    setEnd(undefined);
    setGeneration((count) => count + 1);
  };
  if (!opened) return null;
  return (
    <>
      <Shell key={generation} id={id} onEnd={onEnd} />
      {end && <Ended end={end} onRestart={restart} />}
    </>
  );
}
