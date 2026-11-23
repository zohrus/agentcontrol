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

/** True when any of the script's code ran since the last handover. */
const ranAny = (script: Reported): boolean =>
  script.functions.some((fn) => fn.ranges.some((range) => range.count > 0));

/** Adds what a UI source ran to the total; other scripts (libraries, the page itself) are skipped. */
async function takeScript(
  session: CDPSession,
  call: { script: Reported; total: FileHits; known: Map<string, string> },
) {
  const { script, total, known } = call;
  const file = sourceFileOf(script.url);
  if (file === undefined) return;
  const source = await sourceOfScript(session, known, script.scriptId);
  if (source === undefined && ranAny(script)) {
    throw new Error(`The text of ${file} was gone before its coverage was taken.`);
  }
  if (source !== undefined) addHits(total, file, lineHitsOf({ ...script, source }));
}

async function takeInto(session: CDPSession, total: FileHits, known: Map<string, string>) {
  const { result } = await session.send("Profiler.takePreciseCoverage");
  for (const script of result as Reported[]) await takeScript(session, { script, total, known });
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
  let failure: Error | undefined;
  const take = (): Promise<unknown> => {
    busy = busy
      .then(() => takeInto(session, total, known))
      .catch((error: unknown) => {
        failure ??= error instanceof Error ? error : new Error(String(error));
      });
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
      // A handover that failed means lines are missing: say so instead of reporting less coverage.
      if (failure !== undefined) throw failure;
      return total;
    },
  };
}
