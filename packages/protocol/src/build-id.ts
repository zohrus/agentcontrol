import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Set by `bun build --compile --define` (scripts/build.ts); absent when the code runs from source. */
declare const AGENTCONTROL_BUILD_ID: string | undefined;

const ID_LENGTH = 12;
const root = join(import.meta.dir, "../../..");
/** What the relay runs on: its own and the protocol's sources, and the pins of their dependencies. */
const FOLDERS = ["packages/protocol/src", "packages/relay/src"];
const FILES = ["packages/protocol/package.json", "packages/relay/package.json"];

/** Every file the relay's code is made of, as paths relative to the checkout, in a fixed order. */
function relayFiles(): string[] {
  const inFolders = FOLDERS.flatMap((folder) =>
    readdirSync(join(root, folder), { recursive: true, encoding: "utf8" })
      .map((name) => join(folder, name))
      .filter((path) => statSync(join(root, path)).isFile()),
  );
  return [...inFolders, ...FILES].sort();
}

/** A short hash of the relay's source: it changes whenever any file of it does, saved or not. */
function hashOfSource(): string {
  const hash = createHash("sha256");
  for (const path of relayFiles()) hash.update(`${path}\0`).update(readFileSync(join(root, path)));
  return hash.digest("hex").slice(0, ID_LENGTH);
}

let known: string | undefined;

/**
 * Identifies the code the relay runs, which a version number cannot: the same version covers every
 * commit until the next release. A compiled binary carries the hash of the source it was built from;
 * running from source, it is hashed at start, once. The app and its relay are the same build when the
 * two are equal. `unknown` when neither is possible, which equals itself and so never forces a
 * replacement.
 */
export function buildIdentity(): string {
  if (known !== undefined) return known;
  try {
    known = typeof AGENTCONTROL_BUILD_ID === "string" ? AGENTCONTROL_BUILD_ID : hashOfSource();
  } catch {
    known = "unknown";
  }
  return known;
}
