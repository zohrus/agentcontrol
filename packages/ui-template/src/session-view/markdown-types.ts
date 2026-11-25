/** The few kinds of block the agents' replies use. Anything else is a paragraph. */
export type Shape =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "paragraph"; text: string };

/** A block and where its first line starts in the text: that offset names it for as long as it lives. */
export type Block = Shape & { offset: number };

/** Reads the block that starts at line `at`, if one does, and says where the next one starts. */
export type Read = (lines: string[], at: number) => { block: Shape; next: number } | undefined;
