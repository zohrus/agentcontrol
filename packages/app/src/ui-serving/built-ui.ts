import { type BuildCache, type BuildResult, isDir } from "./build-cache.ts";
import { placeholderPage, STATUS_PATH, statusAnswer, withBuildNotes } from "./build-notes.ts";
import { serveBuiltUi } from "./static.ts";
import type { UiHandler } from "./types.ts";

/** The UI the release ships already built, and the default UI it was built from. */
interface Prebuilt {
  /** The built files. */
  dir: string;
  /** The default UI's sources, as they are written into the data folder. */
  template: string;
}

export interface BuiltUiOptions {
  cache: BuildCache;
  /** The live UI folder: what the served build has to match. */
  liveDir: string;
  prebuilt?: Prebuilt;
}

/** What the app does about the UI's builds: the checks use `build`, everything else `sync`. */
export interface UiBuilds {
  /** Builds the UI in a folder (the Modify checks' build step); equal content is built once. */
  build(dir: string): Promise<{ ok: boolean; output: string }>;
  /** Makes the served build match the live folder, building when needed. Never throws. */
  sync(): Promise<void>;
  /** The UI as a handler: a build is already being served when this resolves, or the first one is being made. */
  serve(): Promise<UiHandler>;
  /** Ends the builds that are running. */
  stop(): void;
}

/** What a failed build says when Vite printed nothing (it was killed, for example). */
const NO_OUTPUT = "The build ended without saying why.";

interface State {
  /** The key of the build served: the newest one made, until the live content has its own. */
  key: string | undefined;
  /** What the build of the live content printed, when it failed. */
  failure: string | undefined;
}

const isHtml = (response: Response): boolean =>
  (response.headers.get("content-type") ?? "").toLowerCase().startsWith("text/html");

/** The folder of the build that comes with the release, when it is the build of this key. */
async function shippedBuildFor(options: {
  cache: BuildCache;
  prebuilt: Prebuilt | undefined;
  key: string;
}): Promise<string | undefined> {
  const { cache, prebuilt, key } = options;
  if (prebuilt === undefined || (await cache.has(key))) return undefined;
  const fits = (await isDir(prebuilt.dir)) && (await cache.keyOf(prebuilt.template)) === key;
  return fits ? prebuilt.dir : undefined;
}

/** Serves the key if its build exists or comes with the release; false when it has to be built. */
async function switchIfReady(options: BuiltUiOptions & { state: State; key: string }) {
  const { cache, prebuilt, state, key } = options;
  const shipped = await shippedBuildFor({ cache, prebuilt, key });
  if (shipped !== undefined) await cache.adopt({ key, from: shipped });
  if (!(await cache.has(key))) return false;
  // The key is served before old builds are deleted, so a request never meets a deleted build.
  Object.assign(state, { key, failure: undefined });
  // Deleting old builds is housekeeping: failing at it is no reason to report a failed build.
  await cache.used(key).catch(() => undefined);
  return true;
}

async function syncOnce(options: BuiltUiOptions & { state: State }): Promise<void> {
  const { cache, liveDir, state } = options;
  const key = await cache.keyOf(liveDir);
  if (await switchIfReady({ ...options, key })) return;
  const built: BuildResult = await cache.build(liveDir);
  if (!built.ok) {
    state.failure = built.output || NO_OUTPUT;
    return;
  }
  await switchIfReady({ ...options, key: built.key });
}

/** At start: serves the newest build there is, then the build of the live folder if it is ready. */
async function first(options: BuiltUiOptions & { state: State; sync: () => Promise<void> }) {
  const { cache, liveDir, state } = options;
  state.key = await cache.newest();
  const key = await cache.keyOf(liveDir);
  if (!(await switchIfReady({ ...options, key }))) void options.sync();
}

/** Syncs one at a time: a request that comes while one runs waits, then looks at the folder again. */
function inTurn(work: () => Promise<void>): () => Promise<void> {
  let last: Promise<void> = Promise.resolve();
  return () => {
    last = last.then(work);
    return last;
  };
}

function handlerFor(options: { cache: BuildCache; state: State }): UiHandler {
  const { cache, state } = options;
  return {
    fetch: async (request) => {
      const serving = { key: state.key, failed: state.failure !== undefined };
      if (new URL(request.url).pathname === STATUS_PATH) return statusAnswer(serving);
      if (state.key === undefined) return placeholderPage(serving);
      const answer = await serveBuiltUi(cache.dirOf(state.key)).fetch(request);
      return isHtml(answer) ? withBuildNotes({ response: answer, serving }) : answer;
    },
    failure: () => state.failure,
    close: () => Promise.resolve(),
  };
}

/** The production UI: the live folder, built by Vite into the cache and served from there. */
export function createUiBuilds(options: BuiltUiOptions): UiBuilds {
  const { cache } = options;
  const state: State = { key: undefined, failure: undefined };
  let serving = false;
  const sync = inTurn(() =>
    syncOnce({ ...options, state }).catch((error: unknown) => {
      state.failure = String(error);
    }),
  );
  return {
    build: (dir) => cache.build(dir),
    // Serving the dev server or a folder of built files, there is no build to keep up to date.
    sync: () => (serving ? sync() : Promise.resolve()),
    serve: async () => {
      await cache.clean().catch(() => undefined);
      serving = true;
      await first({ ...options, state, sync }).catch((error: unknown) => {
        state.failure = String(error);
      });
      return handlerFor({ cache, state });
    },
    stop: () => {
      cache.stop();
    },
  };
}
