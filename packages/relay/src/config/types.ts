import type { ConfigAgent, ScopedItem, UnsupportedItem } from "@agentcontrol/protocol";

export type Format = "json" | "toml" | "md" | "file";

/** One managed piece of a native file: a JSON path, a TOML table or key, a Markdown block or a whole file. */
export interface Entry {
  file: string;
  format: Format;
  key: string;
  itemId: string;
  value: string;
}

export interface ManagedRef {
  key: string;
  itemId: string;
  hash: string;
}

export interface ManifestFile {
  agent: ConfigAgent;
  format: Format;
  entries: ManagedRef[];
}

export interface Manifest {
  version: 1;
  files: Record<string, ManifestFile>;
}

export interface ConfigCtx {
  homeDir: string;
  repoPath?: string | undefined;
  readFile(path: string): Promise<string | undefined>;
  /** Relative paths of every file below dir, recursively; empty when dir does not exist. */
  listFiles(dir: string): Promise<string[]>;
}

export interface RenderCtx extends ConfigCtx {
  manifest: Manifest;
}

export interface RenderResult {
  /** Full desired content of every native file that changes. */
  files: Map<string, string>;
  deleted: string[];
  /** Managed entries per file after this render, for the manifest. */
  managed: Record<string, ManifestFile>;
  unsupported: UnsupportedItem[];
}

export interface HarnessAdapter {
  agent: ConfigAgent;
  inspect(ctx: ConfigCtx): Promise<ScopedItem[]>;
  render(items: ScopedItem[], ctx: RenderCtx): Promise<RenderResult>;
}

/** Where an item lands: the home folder for global scope, the repo otherwise. */
export interface Place {
  global: boolean;
  base: string;
}

export interface Mapped {
  entries: Entry[];
  unsupported: string[];
}

export interface Editor {
  get(content: string, key: string): string | undefined;
  set(content: string, key: string, value: string): string;
  remove(content: string, key: string): string;
}
