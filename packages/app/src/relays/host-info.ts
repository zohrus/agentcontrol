import type { HostInfo } from "./target.ts";

/** Prints `name=value` lines that `parseHostInfo` reads. */
export const INSPECT_SCRIPT = [
  `echo "os=$(uname -s)"`,
  `echo "machine=$(uname -m)"`,
  `echo "free_kb=$(df -Pk "$HOME" 2>/dev/null | awk 'NR==2{print $4}')"`,
  `echo "git=$(git --version 2>/dev/null)"`,
].join("; ");

const ARCHITECTURES: Record<string, string> = {
  x86_64: "x64",
  amd64: "x64",
  aarch64: "arm64",
  arm64: "arm64",
};

const KB_PER_GB = 1024 * 1024;

type Fields = Record<string, string | undefined>;

function fieldsOf(output: string): Fields {
  const pairs = output.split("\n").map((line) => {
    const at = line.indexOf("=");
    return [line.slice(0, at), line.slice(at + 1).trim()] as const;
  });
  return Object.fromEntries(pairs);
}

const field = (fields: Fields, name: string): string => fields[name] ?? "";

function gigabytes(freeKb: string): number | undefined {
  const free = Number.parseFloat(freeKb);
  return Number.isNaN(free) ? undefined : free / KB_PER_GB;
}

/** Reads the output of `INSPECT_SCRIPT`. */
export function parseHostInfo(output: string): HostInfo {
  const fields = fieldsOf(output);
  const machine = field(fields, "machine");
  return {
    os: field(fields, "os").toLowerCase(),
    arch: ARCHITECTURES[machine] ?? machine,
    freeDiskGb: gigabytes(field(fields, "free_kb")),
    git: field(fields, "git") || undefined,
  };
}
