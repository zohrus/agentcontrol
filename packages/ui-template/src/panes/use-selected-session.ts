import { SessionId } from "@agentcontrol/protocol";
import { useSyncExternalStore } from "react";

const PREFIX = "#/sessions/";

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("hashchange", listener);
  };
}

const currentHash = (): string => window.location.hash;

function idFromHash(hash: string): SessionId | undefined {
  if (!hash.startsWith(PREFIX)) return undefined;
  const parsed = SessionId.safeParse(decodeURIComponent(hash.slice(PREFIX.length)));
  return parsed.success ? parsed.data : undefined;
}

function select(id: SessionId): void {
  window.location.hash = `${PREFIX}${encodeURIComponent(id)}`;
}

/** The session the URL points at (`#/sessions/<id>`), and a function that opens another one. */
export function useSelectedSession(): [SessionId | undefined, (id: SessionId) => void] {
  const hash = useSyncExternalStore(subscribe, currentHash);
  return [idFromHash(hash), select];
}
