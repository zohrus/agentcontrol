import type { z } from "zod";

/** Reads a JSONL file and returns the lines that parse and match the schema; others are skipped. */
export async function readJsonl<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.output<T>[]> {
  const text = await Bun.file(path).text();
  return text.split("\n").flatMap((line) => parseLine(line, schema));
}

function parseLine<T extends z.ZodType>(line: string, schema: T): z.output<T>[] {
  try {
    const parsed = schema.safeParse(JSON.parse(line));
    return parsed.success ? [parsed.data] : [];
  } catch {
    return [];
  }
}
