// `bun test` only discovers *.test.ts / *.spec.ts, so *.e2e.ts files are passed explicitly.
const files = [...new Bun.Glob("e2e/**/*.e2e.ts").scanSync({ cwd: process.cwd() })].map(
  (file) => `./${file}`,
);

if (files.length === 0) {
  console.log("no *.e2e.ts files yet");
} else {
  const run = Bun.spawnSync(["bun", "test", ...files], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  process.exit(run.exitCode);
}
