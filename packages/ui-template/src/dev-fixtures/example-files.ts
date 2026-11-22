import type { DiffResult } from "@agentcontrol/protocol";

/** EXAMPLE DATA for `bun run dev` without a server. Delete this folder when the SDK is wired in. */
export type ExampleFile = { base: string; working: string };

const rateLimit = [
  'import type { Request, Response, NextFunction } from "express";',
  'import { redis } from "../redis";',
  "",
  "const WINDOW_MS = 60_000;",
  "const LIMIT = 100;",
  "",
  "export async function rateLimit(req: Request, res: Response, next: NextFunction) {",
  '  const key = "rl:" + req.header("x-api-key");',
  "  const now = Date.now();",
  "  await redis.zremrangebyscore(key, 0, now - WINDOW_MS);",
  "  if ((await redis.zcard(key)) >= LIMIT) {",
  '    return res.status(429).json({ error: "rate_limited" });',
  "  }",
  "  await redis.zadd(key, now, String(now));",
  "  next();",
  "}",
  "",
];

const serverBase = [
  'import express from "express";',
  'import { router } from "./router";',
  "",
  "const app = express();",
  "app.use(express.json());",
  "app.use(router);",
  "app.listen(3000);",
  "",
];

const serverWorking = [
  'import express from "express";',
  'import { rateLimit } from "./middleware/rateLimit";',
  'import { router } from "./router";',
  "",
  "const app = express();",
  "app.use(express.json());",
  "app.use(rateLimit);",
  "app.use(router);",
  "app.listen(3000);",
  "",
];

const testWorking = [
  'import { expect, test } from "bun:test";',
  'import { rateLimit } from "../src/middleware/rateLimit";',
  "",
  'test("the 101st request in a minute is rejected", async () => {',
  "  expect(typeof rateLimit).toBe('function');",
  "});",
  "",
];

export const exampleFiles: Record<string, ExampleFile> = {
  "src/middleware/rateLimit.ts": { base: "", working: rateLimit.join("\n") },
  "src/server.ts": { base: serverBase.join("\n"), working: serverWorking.join("\n") },
  "test/rateLimit.test.ts": { base: "", working: testWorking.join("\n") },
};

export const exampleDiff: DiffResult = {
  baseCommit: "3f2a9c1",
  patch: "",
  files: [
    { path: "src/middleware/rateLimit.ts", status: "added", additions: 17, deletions: 0 },
    { path: "src/server.ts", status: "modified", additions: 2, deletions: 1 },
    { path: "test/rateLimit.test.ts", status: "added", additions: 7, deletions: 0 },
  ],
};
