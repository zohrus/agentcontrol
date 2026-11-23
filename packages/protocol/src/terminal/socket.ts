import { z } from "zod";
import { TerminalSize } from "./methods.ts";

const size = { cols: TerminalSize, rows: TerminalSize };

/** What the browser sends over the terminal WebSocket (JSON text frames). */
export const TerminalClientMessage = z.discriminatedUnion("type", [
  /** Must come first: starts the shell at this size. */
  z.object({ type: z.literal("open"), ...size }),
  z.object({ type: z.literal("input"), data: z.string() }),
  z.object({ type: z.literal("resize"), ...size }),
]);

/** What the app sends over the terminal WebSocket (JSON text frames). */
export const TerminalServerMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("data"), data: z.string() }),
  z.object({ type: z.literal("exit"), exitCode: z.number().int().nullable() }),
  /** The terminal could not be started or was lost; the socket closes after this. */
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);

/** The WebSocket subprotocol the app selects. */
export const TERMINAL_PROTOCOL = "agentcontrol.terminal.v1";
/**
 * Prefix of the second subprotocol the client offers, which carries the app's secret (a base64url
 * token is a valid subprotocol name). The app never selects it, so it is never echoed back.
 */
export const TOKEN_PROTOCOL_PREFIX = "agentcontrol.token.";

export type TerminalClientMessage = z.infer<typeof TerminalClientMessage>;
export type TerminalServerMessage = z.infer<typeof TerminalServerMessage>;
