import { SessionId } from "@agentcontrol/protocol";
import { useMemo, useSyncExternalStore } from "react";
import { LOCAL_WORKSPACE, sameSession, type SessionRef } from "../data/index.ts";

const PREFIX = "#/sessions/";

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
  };
}

const currentHash = (): string => window.location.hash;

/** A mistyped address must not break the page: undecodable text means "no session". */
function decodeOrNothing(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return "";
  }
}

/** The workspace and id of `#/sessions/<workspace>/<id>`; the older `<id>` alone is this Mac's. */
function partsOf(hash: string): { workspaceId: string; id: string } | undefined {
  if (!hash.startsWith(PREFIX)) return undefined;
  const parts = hash.slice(PREFIX.length).split("/").map(decodeOrNothing);
  const workspaceId = parts.length === 1 ? LOCAL_WORKSPACE : parts.slice(0, -1).join("");
  return parts.length > 2 ? undefined : { workspaceId, id: parts.slice(-1).join("") };
}

function refFromHash(hash: string): SessionRef | undefined {
  const parts = partsOf(hash);
  const parsed = SessionId.safeParse(parts?.id);
  return parts?.workspaceId && parsed.success
    ? { workspaceId: parts.workspaceId, id: parsed.data }
    : undefined;
}

function select(ref: SessionRef): void {
  const workspace = encodeURIComponent(ref.workspaceId);
  window.location.hash = `${PREFIX}${workspace}/${encodeURIComponent(ref.id)}`;
}

/** Opens no session if this one is the open one: used when it could not be created. */
export function clearSelectionIf(ref: SessionRef): void {
  if (sameSession(refFromHash(window.location.hash), ref)) window.location.hash = "";
}

/** The session the URL points at (`#/sessions/<workspace>/<id>`), and a function that opens another one. */
export function useSelectedSession(): [SessionRef | undefined, (ref: SessionRef) => void] {
  const hash = useSyncExternalStore(subscribe, currentHash);
  return [useMemo(() => refFromHash(hash), [hash]), select];
}
