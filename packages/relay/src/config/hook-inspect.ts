import type { ConfigAgent, HookItem } from "@agentcontrol/protocol";
import { sha256 } from "./fs.ts";
import { asRecord, asText, type Obj } from "./inspect-shared.ts";
import { HOOK_MARK } from "./json-editor.ts";

/** Claude Code and Codex hook files share one shape, and the same four event names. */
const EVENTS: Record<string, HookItem["event"]> = {
  PreToolUse: "before-tool",
  PostToolUse: "after-edit",
  SessionStart: "session-start",
  Stop: "session-stop",
};

function commandsOf(group: unknown): { command: string; id: string | undefined }[] {
  const raw = asRecord(group).hooks;
  return (Array.isArray(raw) ? raw : []).map((entry) => {
    const [command = "", id] = (asText(asRecord(entry).command) ?? "").split(HOOK_MARK);
    return { command, id };
  });
}

function hooksOfGroup(input: {
  agent: ConfigAgent;
  event: string;
  kind: HookItem["event"];
  group: unknown;
}): HookItem[] {
  const { agent, event, kind, group } = input;
  return commandsOf(group).map(({ command, id }) => {
    const hookId = id ?? `${agent}:hook:${event}:${sha256(command).slice(0, 8)}`;
    const matcher = asText(asRecord(group).matcher);
    return { id: hookId, kind: "hook", name: hookId, event: kind, matcher, command };
  });
}

/** Hook items found under the "hooks" key of a settings.json or hooks.json object. */
export function hookItems(agent: ConfigAgent, file: Obj): HookItem[] {
  return Object.entries(asRecord(file.hooks)).flatMap(([event, groups]) => {
    const kind = EVENTS[event];
    const list: unknown[] = Array.isArray(groups) ? groups : [];
    return kind ? list.flatMap((group) => hooksOfGroup({ agent, event, kind, group })) : [];
  });
}
