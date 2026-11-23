import { z } from "zod";

const instant = z
  .string()
  .refine((text) => !Number.isNaN(Date.parse(text)), "a date or a date and time");

/** The query every analytics route takes. */
export const FilterQuery = z.object({
  /** Count only what happened at or after this time. */
  from: instant.optional(),
  /** Count only what happened before this time. */
  to: instant.optional(),
  workspace: z.string().min(1).optional(),
  agent: z.string().min(1).optional(),
  /** The repository's path. */
  repo: z.string().min(1).optional(),
  /** Minutes east of UTC of the viewer, so days start at their midnight; 0 (UTC) by default. */
  tzOffset: z
    .string()
    .regex(/^-?\d{1,3}$/)
    .optional(),
});

/** What to count: a time range and which workspace, agent and repository. */
export type Filters = {
  fromMs?: number;
  toMs?: number;
  workspaceId?: string;
  agent?: string;
  repoPath?: string;
  tzOffsetMinutes: number;
};

const ms = (text: string | undefined): number | undefined =>
  text === undefined ? undefined : Date.parse(text);

/** Reads the validated query into filters, dates as milliseconds. */
export function filtersOf(query: z.infer<typeof FilterQuery>): Filters {
  const picked = {
    fromMs: ms(query.from),
    toMs: ms(query.to),
    workspaceId: query.workspace,
    agent: query.agent,
    repoPath: query.repo,
  };
  const known = Object.entries(picked).filter(([, value]) => value !== undefined);
  return { tzOffsetMinutes: Number(query.tzOffset ?? 0), ...Object.fromEntries(known) };
}

/** Whether a timestamp is inside the range: from is included, to is not. */
export function inRange(ts: string, filters: Filters): boolean {
  const at = Date.parse(ts);
  return at >= (filters.fromMs ?? -Infinity) && at < (filters.toMs ?? Infinity);
}

/** Whether a range was asked for at all. */
export const hasRange = (filters: Filters): boolean =>
  filters.fromMs !== undefined || filters.toMs !== undefined;

/** The calendar day of a timestamp for a viewer `tzOffsetMinutes` east of UTC, as "2026-11-23". */
export function dayOf(call: { ts: string; tzOffsetMinutes: number }): string {
  return new Date(Date.parse(call.ts) + call.tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}
