import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AppAccess, Session } from "./app.ts";
import { onTestEnd } from "./cleanup.ts";
import { attemptApi } from "./app-attempt.ts";
import { worktreeOf } from "./app-more-user.ts";
import { sandboxedPageUserOf } from "./preview-sandbox-user.ts";

/** What the app answered when a preview address was loaded, the way a browser would see it. */
export interface LoadedPreview {
  readonly address: string;
  readonly status: number;
  readonly headers: Headers;
  readonly bytes: Uint8Array;
  readonly text: string;
}

/** Files to put into a worktree: text or raw bytes, by path. */
export type WorktreeFiles = Readonly<Record<string, string | Uint8Array>>;

/** Writes the files below `folder`, creating the folders they need. */
async function writeFilesBelow(folder: string, files: WorktreeFiles): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(folder, path)), { recursive: true });
    await Bun.write(join(folder, path), content);
  }
}

/** Loads an address with no credentials at all, like an iframe that cannot send the bearer header. */
async function loadPreviewAddress(address: string): Promise<LoadedPreview> {
  const response = await fetch(address);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  return { address, status: response.status, headers: response.headers, bytes, text };
}

/** The address of `relativePath` as the page at `address` would resolve it (`%2F` stays as it is). */
const addressNextTo = (address: string, relativePath: string): string =>
  new URL(relativePath, address).href;

/** The same address with another ticket in it. */
export function addressWithTicket(address: string, ticket: string): string {
  const url = new URL(address);
  const [, preview, , ...rest] = url.pathname.split("/");
  url.pathname = ["", preview, ticket, ...rest].join("/");
  return url.href;
}

/** Files in and around a session's worktree, put there from outside the app, as an editor would. */
function worktreeFilesUserOf(app: AppAccess) {
  return {
    writesFilesInTheWorktree: async (session: Session, files: WorktreeFiles): Promise<void> => {
      await writeFilesBelow(await worktreeOf(app, session), files);
    },
    /** A folder somewhere else on the machine, with files the session must never show. */
    hasAFolderOutsideTheWorktreeHolding: async (files: WorktreeFiles): Promise<string> => {
      const folder = await mkdtemp(join(tmpdir(), "agentcontrol-outside-"));
      onTestEnd(() => rm(folder, { recursive: true, force: true }));
      await writeFilesBelow(folder, files);
      return folder;
    },
    /** Adds a link inside the worktree that leads to a folder outside it. */
    linksTheWorktreeToAFolderOutsideIt: async (session: Session, link: string, target: string) => {
      await symlink(target, join(await worktreeOf(app, session), link));
    },
  };
}

/** What a person (or an editor, or the agent) does to see a worktree file as a web page. */
export function appPreviewUserOf(app: AppAccess) {
  return {
    ...worktreeFilesUserOf(app),
    ...sandboxedPageUserOf(app),
    asksForPreviewAddressOf: (session: Session, path: string) =>
      app.sdk.files.previewUrl(session.id, path),
    triesToAskForPreviewAddressOf: (session: Session, path: string) =>
      attemptApi(app.sdk.files.previewUrl(session.id, path)),
    loadsPreview: loadPreviewAddress,
    /** Loads a file the way a page next to `address` would ask for it. */
    loadsPreviewNextTo: (address: string, relativePath: string) =>
      loadPreviewAddress(addressNextTo(address, relativePath)),
    /** Loads the ticket's top folder with no slash after the ticket, as a mistyped address would. */
    loadsPreviewTopFolderWithoutSlash: (address: string) => {
      const url = new URL(address);
      url.pathname = url.pathname.split("/").slice(0, 3).join("/");
      url.search = "";
      return loadPreviewAddress(url.href);
    },
  };
}
