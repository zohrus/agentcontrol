import { JsonRpcMessage } from "./envelope.ts";

/** The outcome of parsing one line: a message, or a reason it was rejected. */
export type ParsedLine =
  | { ok: true; message: JsonRpcMessage }
  | { ok: false; reason: "invalid-json" | "invalid-message"; detail: string };

function parseJson(line: string): { value: unknown } | { detail: string } {
  try {
    return { value: JSON.parse(line) };
  } catch (error) {
    return { detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Parses one newline-delimited line into a validated JSON-RPC message, never throwing. */
export function parseMessageLine(line: string): ParsedLine {
  const json = parseJson(line);
  if ("detail" in json) return { ok: false, reason: "invalid-json", detail: json.detail };
  const checked = JsonRpcMessage.safeParse(json.value);
  if (!checked.success) {
    return { ok: false, reason: "invalid-message", detail: checked.error.message };
  }
  return { ok: true, message: checked.data };
}
