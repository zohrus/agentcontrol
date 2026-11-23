// Collects the UI code a browser test ran and writes it as an lcov part next to the ones
// `bun test --coverage` writes, so scripts/coverage.ts merges the UI with the server code.
import { mkdir } from "node:fs/promises";
import { onTestEnd } from "../../setup/cleanup.ts";
import type { Page } from "../playwright.ts";
import { type FileHits, startRecording } from "./recorder.ts";

/** Set by scripts/run-e2e.ts --coverage to the start of the folders this test file's parts go to. */
const PARTS_DIR_VARIABLE = "AGENTCONTROL_BROWSER_COVERAGE_PARTS";

let partNumber = 0;

function lcovOf(files: FileHits): string {
  const sorted = [...files].sort(([a], [b]) => a.localeCompare(b));
  const records = sorted.map(([file, lines]) => {
    const rows = [...lines]
      .sort(([a], [b]) => a - b)
      .map(([line, hits]) => `DA:${String(line)},${String(hits)}`);
    return [`SF:${file}`, ...rows, "end_of_record"].join("\n");
  });
  return `${records.join("\n")}\n`;
}

/**
 * Starts recording what the page runs; the report is written when the test ends. Does nothing
 * unless the suite runs with coverage. Call it before the page loads the app.
 */
export async function recordBrowserCoverage(page: Page): Promise<void> {
  const partsDir = process.env[PARTS_DIR_VARIABLE];
  if (partsDir === undefined) return;
  // A listener makes Chrome's "pause before the page unloads" apply to this page.
  await page.addInitScript("window.addEventListener('beforeunload', () => undefined);");
  const recording = await startRecording(await page.context().newCDPSession(page));
  onTestEnd(async () => {
    const files = await recording.finish();
    partNumber += 1;
    const dir = `${partsDir}-${String(partNumber)}`;
    await mkdir(dir, { recursive: true });
    await Bun.write(`${dir}/lcov.info`, lcovOf(files));
  });
}
