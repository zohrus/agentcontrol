const CHUNK = 64 * 1024;
const HTML = { "content-type": "text/html" };

/** How many bytes of streamed downloads were produced so far, readable at /sent. */
const counters = { sent: 0 };

/** The page a script on the IDE's origin would use to attack the app, and report what it got. */
const ATTACK_PAGE = `<!doctype html><title>attack</title><script>
const app = new URLSearchParams(location.search).get("app");
const result = {};
const tries = {
  api: () => fetch(app + "/api/sessions", { headers: { authorization: "Bearer guess" } }),
  page: () => fetch(app + "/").then((r) => r.text()),
  apiNoHeader: () => fetch(app + "/api/sessions"),
};
Promise.all(Object.entries(tries).map(async ([name, run]) => {
  try { await run(); result[name] = "readable"; } catch (e) { result[name] = "blocked"; }
})).then(() => { window.__result = result; document.title = "done"; });
</script>`;

function streamOf(megabytes: number): ReadableStream {
  let left = megabytes * 1024 * 1024;
  return new ReadableStream({
    pull(controller) {
      if (left <= 0) {
        controller.close();
        return;
      }
      const piece = new Uint8Array(Math.min(CHUNK, left)).fill(97);
      left -= piece.length;
      counters.sent += piece.length;
      controller.enqueue(piece);
    },
  });
}

interface PageCall {
  request: Request;
  url: URL;
  folder: string;
}

/** One answer per path, like the few pages of the real workbench the tests care about. */
const routes: Record<string, (call: PageCall) => Response> = {
  "/": ({ folder }) =>
    new Response(
      `<!doctype html><title>fake code-server</title><p id="folder">${folder}</p><script src="./static/app.js"></script>`,
      { headers: HTML },
    ),
  "/static/app.js": () =>
    new Response("document.title = 'workbench loaded';", {
      headers: { "content-type": "text/javascript" },
    }),
  "/attack": () => new Response(ATTACK_PAGE, { headers: HTML }),
  "/big": ({ url }) => new Response(streamOf(Number(url.searchParams.get("mb") ?? "1"))),
  "/sent": () => new Response(String(counters.sent)),
  "/echo": ({ request }) => new Response(request.body, { status: 201 }),
  "/headers": ({ request }) => Response.json(Object.fromEntries(request.headers)),
  "/cookie": () =>
    new Response("cookie", { headers: { "set-cookie": "fake=1; Path=/", "x-fake": "yes" } }),
};

/** What the fake code-server answers to plain HTTP requests. */
export function servePage(call: PageCall): Response {
  return routes[call.url.pathname]?.(call) ?? new Response("not found", { status: 404 });
}
