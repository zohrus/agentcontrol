import { stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { UiHandler } from "./types.ts";

async function isFile(path: string): Promise<boolean> {
  return stat(path).then(
    (info) => info.isFile(),
    () => false,
  );
}

/** The file a URL path names inside `root`, or the page itself for app routes; never outside `root`. */
async function fileFor(root: string, pathname: string): Promise<string | undefined> {
  const target = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (target.startsWith(root + sep) && (await isFile(target))) return target;
  const looksLikeFile = /\.[a-z0-9]+$/i.test(pathname);
  return looksLikeFile ? undefined : join(root, "index.html");
}

/** Serves a built UI folder; any path that is not a file gets index.html so the UI can route. */
export function serveBuiltUi(directory: string): UiHandler {
  const root = resolve(directory);
  return {
    fetch: async (request) => {
      const path = await fileFor(root, new URL(request.url).pathname);
      const found = path !== undefined && (await isFile(path));
      return found ? new Response(Bun.file(path)) : new Response("Not found", { status: 404 });
    },
    close: () => Promise.resolve(),
  };
}
