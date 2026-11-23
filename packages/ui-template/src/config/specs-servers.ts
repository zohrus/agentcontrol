import { linesOf, pairsText, parsePairs } from "./form-text.ts";
import { type Built, idOf, kindSpec, needsName, str, valueOf } from "./kind-spec.ts";

const trimmed = (form: Record<string, string>, key: string): string => valueOf(form, key).trim();

type Problems = {
  command: string;
  url: string;
  env: string | undefined;
  headers: string | undefined;
};

function problemWith(call: Problems): string | undefined {
  if (call.command === "" && call.url === "") return "Enter a command to run, or a URL.";
  if (call.env) return `"${call.env}" is not NAME=value.`;
  return call.headers ? `"${call.headers}" is not Name: value.` : undefined;
}

/** How the server is reached: by command (with arguments and environment) or by URL (with headers). */
function reach(form: Record<string, string>) {
  const env = parsePairs(valueOf(form, "env"), "=");
  const headers = parsePairs(valueOf(form, "headers"), ":");
  const command = trimmed(form, "command");
  const url = trimmed(form, "url");
  const byCommand =
    command === "" ? {} : { command, args: linesOf(valueOf(form, "args")), env: env.pairs };
  const byUrl = url === "" ? {} : { url, headers: headers.pairs };
  const error = problemWith({ command, url, env: env.bad, headers: headers.bad });
  return { error, found: { ...byCommand, ...byUrl } };
}

function buildServer(form: Record<string, string>, base: { id: string } | undefined): Built {
  const { error, found } = reach(form);
  const problem = needsName(form) ?? error;
  if (problem) return { error: problem };
  return { item: { id: idOf(base), kind: "mcp", name: trimmed(form, "name"), ...found } };
}

/** What goes in an MCP server: how to start it (a command) or where it is (a URL). */
export const mcpSpec = kindSpec(
  "mcp",
  {
    label: "MCP servers",
    noun: "MCP server",
    fields: [
      {
        key: "name",
        label: "Name",
        control: "text",
        hint: "Letters, digits, dashes, underscores.",
      },
      {
        key: "command",
        label: "Command",
        control: "text",
        hint: "For a server that runs here, for example npx.",
      },
      { key: "args", label: "Arguments", control: "area", hint: "One per line." },
      { key: "env", label: "Environment", control: "area", hint: "NAME=value, one per line." },
      { key: "url", label: "URL", control: "text", hint: "For a server that runs elsewhere." },
      { key: "headers", label: "Headers", control: "area", hint: "Name: value, one per line." },
    ],
  },
  {
    empty: { id: "", kind: "mcp", name: "" },
    toForm: (item) => ({
      name: item.name,
      command: str(item.command),
      args: (item.args ?? []).join("\n"),
      env: pairsText(item.env, "="),
      url: str(item.url),
      headers: pairsText(item.headers, ": "),
    }),
    build: buildServer,
    summary: (item) => str(item.command ?? item.url),
  },
);
