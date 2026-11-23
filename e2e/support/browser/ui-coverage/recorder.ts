// Records which lines of the UI sources a page runs, through Chrome's own coverage (V8 precise
// coverage over the DevTools protocol) and the source maps Vite serves with every module.
//
// V8 hands its counters over once and starts counting from zero, so the page is stopped just
// before it unloads (a reload throws its scripts away) and each handover is added to the total.
import type { CDPSession } from "playwright";
import { type LineHits, lineHitsOf } from "./script-lines.ts";

/** The UI package as the repository sees it; Vite serves its `src/` at the site root. */
const UI_PACKAGE = "packages/ui-template";
const SOURCE_FILE = /^\/src\/.+\.tsx?$/;

/** The repository path of the UI source a script URL names, or undefined for anything else. */
function sourceFileOf(url: string): string | undefined {
  const { pathname } = new URL(url, "http://localhost");
  return SOURCE_FILE.test(pathname) ? `${UI_PACKAGE}${pathname}` : undefined;
}

export type FileHits = Map<string, LineHits>;

function addHits(into: FileHits, file: string, hits: LineHits): void {
  const lines = into.get(file) ?? new Map<number, number>();
  hits.forEach((count, line) => lines.set(line, (lines.get(line) ?? 0) + count));
  into.set(file, lines);
}

/** What Chrome reports for a script, without its text. */
type Reported = Parameters<typeof lineHitsOf>[0] extends infer S
  ? Omit<S & { scriptId: string }, "source">
  : never;

/** The text of a script, read once while the script is alive; undefined when it is gone. */
async function sourceOfScript(
  session: CDPSession,
  known: Map<string, string>,
  scriptId: string,
): Promise<string | undefined> {
  const cached = known.get(scriptId);
  if (cached !== undefined) return cached;
  const fetched = await session
    .send("Debugger.getScriptSource", { scriptId })
    .catch(() => undefined);
  if (fetched !== undefined) known.set(scriptId, fetched.scriptSource);
  return fetched?.scriptSource;
}

async function takeInto(session: CDPSession, total: FileHits, known: Map<string, string>) {
  const { result } = await session.send("Profiler.takePreciseCoverage");
  for (const script of result as Reported[]) {
    const file = sourceFileOf(script.url);
    const source =
      file === undefined ? undefined : await sourceOfScript(session, known, script.scriptId);
    if (file !== undefined && source !== undefined) {
      addHits(total, file, lineHitsOf({ ...script, source }));
    }
  }
}

/** Everything the page ran so far, as lines per UI source. Resolves when the last handover is in. */
export interface Recording {
  finish: () => Promise<FileHits>;
}

/** Starts recording on a page's DevTools session; call it before the page loads the app. */
export async function startRecording(session: CDPSession): Promise<Recording> {
  const total: FileHits = new Map();
  const known = new Map<string, string>();
  let busy: Promise<unknown> = Promise.resolve();
  const take = (): Promise<unknown> => {
    busy = busy.then(() => takeInto(session, total, known)).catch(() => undefined);
    return busy;
  };
  await session.send("Profiler.enable");
  await session.send("Debugger.enable");
  await session.send("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  const resume = (): Promise<unknown> => session.send("Debugger.resume").catch(() => undefined);
  session.on("Debugger.paused", () => {
    void take().then(resume);
  });
  await session.send("DOMDebugger.setEventListenerBreakpoint", { eventName: "beforeunload" });
  return {
    finish: async () => {
      await take();
      return total;
    },
  };
}
