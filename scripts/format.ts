// `bun run format <paths...>`: formats only the given paths. It refuses to run with none, so an
// agent can never reformat files it does not own. (The orchestrator can run biome directly.)
const paths = process.argv.slice(2);

if (paths.length === 0) {
  console.error("bun run format needs the paths to format, for example: bun run format scripts/");
  process.exit(1);
}

const run = Bun.spawnSync(
  ["bunx", "biome", "format", "--write", "--no-errors-on-unmatched", ...paths],
  { stdout: "inherit", stderr: "inherit" },
);
process.exit(run.exitCode);
