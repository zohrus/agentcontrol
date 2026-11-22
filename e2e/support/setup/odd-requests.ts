import { createClient } from "@agentcontrol/sdk";
import type { AppAccess } from "./app.ts";
import { attemptApi } from "./app-attempt.ts";

/** A client whose requests go out as `send` makes them, to the app as it is now. */
function clientSending(
  app: AppAccess,
  send: (url: string, init?: RequestInit) => Promise<Response>,
) {
  return createClient({ baseUrl: app.baseUrl, fetch: send as typeof fetch });
}

/** Adds a repo with a request body that is not JSON at all, as a broken client would send. */
export function triesToAddARepoWithABodyThatIsNotJson(app: AppAccess) {
  const client = clientSending(app, (url, init) => fetch(url, { ...init, body: "{not json" }));
  return attemptApi(client.repos.add(app.repoPath));
}

/** Lists the agents through something in front of the app that answers with its own error page. */
export function triesToListAgentsThroughAFailingProxy(app: AppAccess) {
  const badGateway = () => Promise.resolve(new Response("Bad Gateway", { status: 502 }));
  return attemptApi(clientSending(app, badGateway).agents.list());
}
