import { stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { UiHandler } from "./types.ts";

async function isFile(path: string): Promise<boolean> {
  return stat(path).then(
    (info) => info.isFile(),
    () => false,
  );
}

/** A path that names a build asset: a missing one is a 404, while `/repo/v1.0` is an app route. */
const ASSET = /\.(?:m?js|css|map|json|html|txt|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|wasm)$/i;

function decodePath(pathname: string): string | undefined {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
}

/** The file a URL path names inside `root`, or the page itself for app routes; never outside `root`. */
async function fileFor(root: string, pathname: string): Promise<string | undefined> {
  const decoded = decodePath(pathname);
  if (decoded === undefined) return undefined;
  const target = resolve(root, `.${decoded}`);
  if (target.startsWith(root + sep) && (await isFile(target))) return target;
  return ASSET.test(pathname) ? undefined : join(root, "index.html");
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
