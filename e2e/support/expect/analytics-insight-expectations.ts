import type { AnalyticsFilter } from "@agentcontrol/sdk";
import type { AppAccess } from "../setup/app.ts";

function fail(expectation: string, saw: unknown): never {
  throw new Error(`${expectation}, but it is ${JSON.stringify(saw)}`);
}

const sameTitles = (a: string[], b: string[]): boolean =>
  JSON.stringify(a.toSorted()) === JSON.stringify(b.toSorted());

/** The titles of the sessions an insight points at; an id with no row in the table stays an id. */
async function titlesBehind(app: AppAccess, sessionIds: string[]): Promise<string[]> {
  const rows = await app.sdk.analytics.sessions({});
  return sessionIds.map((id) => rows.find((row) => row.sessionId === id)?.title ?? id);
}

/** The insights include this rule, and the sessions behind it are exactly these (by title). */
export async function expectInsightAbout(
  app: AppAccess,
  call: { rule: string; titles: string[] },
): Promise<void> {
  const insights = await app.sdk.analytics.insights({});
  const found = insights.find((insight) => insight.rule === call.rule);
  const titles = await titlesBehind(app, found?.sessionIds ?? []);
  // An insight with no sessions would not match a non-empty expectation.
  if (sameTitles(titles, call.titles)) return;
  const saw = { rules: insights.map((i) => i.rule), sessions: titles };
  fail(`expected an insight "${call.rule}" about ${JSON.stringify(call.titles)}`, saw);
}

/** The insights are empty: nothing stands out. */
export async function expectNoInsights(app: AppAccess): Promise<void> {
  const insights = await app.sdk.analytics.insights({});
  if (insights.length > 0) {
    fail(
      "expected no insights",
      insights.map((insight) => insight.text),
    );
  }
}

/** The session table lists exactly these titles, whatever their order. */
export async function expectSessionTable(
  app: AppAccess,
  call: { filter?: AnalyticsFilter; titles: string[] },
): Promise<void> {
  const rows = await app.sdk.analytics.sessions(call.filter ?? {});
  const titles = rows.map((row) => row.title);
  if (!sameTitles(titles, call.titles)) {
    fail(`expected the session table to list ${JSON.stringify(call.titles)}`, titles);
  }
}

/** The insight's link to the session says which workspace the session is in, and its title. */
export async function expectInsightToLinkTo(
  app: AppAccess,
  call: { rule: string; workspaceId: string; title: string },
): Promise<void> {
  const insights = await app.sdk.analytics.insights({});
  const links = insights.find((insight) => insight.rule === call.rule)?.sessions ?? [];
  const found = links.some((l) => l.workspaceId === call.workspaceId && l.title === call.title);
  if (!found)
    fail(`expected "${call.rule}" to link to "${call.title}" in ${call.workspaceId}`, links);
}
