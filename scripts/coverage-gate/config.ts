import { z } from "zod";

const Excluded = z.object({ path: z.string(), reason: z.string().min(20) });
const Pending = z.object({
  path: z.string(),
  owner: z.string().min(1),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(20),
});
const Config = z.object({
  thresholds: z.object({ rule: z.string(), totalLines: z.number(), newLines: z.number() }),
  include: z.array(z.string()).min(1),
  exclude: z.array(Excluded),
  pending: z.array(Pending),
});

export type CoverageConfig = z.infer<typeof Config>;
export type PendingEntry = z.infer<typeof Pending>;

/** Reads and validates coverage.config.json: every exclusion and pending entry needs a reason. */
export async function readCoverageConfig(): Promise<CoverageConfig> {
  return Config.parse(await Bun.file("coverage.config.json").json());
}
