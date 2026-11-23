import { z } from "zod";
import { SessionId } from "../ids/index.ts";

/** Identifies one terminal (a shell) the relay holds open. */
export const TerminalId = z.string().min(1);
export type TerminalId = z.infer<typeof TerminalId>;

/** The most columns or rows a terminal may have; a bigger size is refused as invalid params. */
export const TERMINAL_MAX_SIZE = 1000;
/** A column or row count. */
export const TerminalSize = z.number().int().min(1).max(TERMINAL_MAX_SIZE);

/** Params of relay/terminal.open: start the user's shell in the session's folder. */
export const TerminalOpenParams = z.object({
  sessionId: SessionId,
  cols: TerminalSize,
  rows: TerminalSize,
});
/** Result of relay/terminal.open. Output follows as relay/terminal.data notifications. */
export const TerminalOpenResult = z.object({ terminalId: TerminalId });

/** Params of relay/terminal.write: what the user typed (UTF-8 text). */
export const TerminalWriteParams = z.object({ terminalId: TerminalId, data: z.string() });
/** Params of relay/terminal.resize. */
export const TerminalResizeParams = z.object({
  terminalId: TerminalId,
  cols: TerminalSize,
  rows: TerminalSize,
});
/** Params of relay/terminal.close: ends the shell. */
export const TerminalCloseParams = z.object({ terminalId: TerminalId });

/** Params of the relay/terminal.data notification: shell output as UTF-8 text. */
export const TerminalDataParams = z.object({ terminalId: TerminalId, data: z.string() });
/** Params of the relay/terminal.exit notification; `exitCode` is null when a signal ended it. */
export const TerminalExitParams = z.object({
  terminalId: TerminalId,
  exitCode: z.number().int().nullable(),
});

export type TerminalOpenParams = z.infer<typeof TerminalOpenParams>;
export type TerminalOpenResult = z.infer<typeof TerminalOpenResult>;
export type TerminalWriteParams = z.infer<typeof TerminalWriteParams>;
export type TerminalResizeParams = z.infer<typeof TerminalResizeParams>;
export type TerminalCloseParams = z.infer<typeof TerminalCloseParams>;
export type TerminalDataParams = z.infer<typeof TerminalDataParams>;
export type TerminalExitParams = z.infer<typeof TerminalExitParams>;
