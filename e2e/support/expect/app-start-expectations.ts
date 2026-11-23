import type { AppAccess } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

type Readable = Pick<AppAccess, "sdk" | "baseUrl" | "token">;

async function health(app: Readable): Promise<string> {
  const response = await fetch(`${app.baseUrl}/api/health`, {
    headers: { authorization: `Bearer ${app.token}` },
  });
  const body = (await response.json()) as { ok: boolean; relay: string };
  return `${body.ok ? "ok" : "not ok"}, relay ${body.relay}`;
}

/** The app serves requests and says, in its workspace and its health check, the relay is not there. */
export async function expectAppToServeAndReportTheRelayDisconnected(app: Readable): Promise<void> {
  const workspace = await app.sdk.workspace.get();
  if (workspace.connection !== "disconnected") {
    throw new Error(`expected the workspace to be disconnected, but it is ${workspace.connection}`);
  }
  const seen = await health(app);
  if (seen !== "ok, relay disconnected") {
    throw new Error(
      `expected the health check to say "ok, relay disconnected", but it says ${seen}`,
    );
  }
}

/** The workspace and the health check both say connected, once the app has found the relay. */
export async function expectAppToFindTheRelay(app: Readable): Promise<void> {
  await eventually("expected the app to find the relay", async () => {
    const workspace = await app.sdk.workspace.get();
    return workspace.connection === "connected" ? undefined : "it is still disconnected";
  });
  const seen = await health(app);
  if (seen !== "ok, relay connected") {
    throw new Error(`expected the health check to say "ok, relay connected", but it says ${seen}`);
  }
}

/** The live stream told the UI that the relay connected. */
export async function expectLiveStreamToReportTheRelayConnected(app: AppAccess): Promise<void> {
  await app.workspaceConnections.waitFor(
    (state) => state === "connected",
    "expected the live stream to report the relay as connected",
  );
}
