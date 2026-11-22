import type { UiVersion } from "./types.ts";

/**
 * Every commit message is the user's text, then a blank line and two trailers:
 *   AgentControl-Kind: template | change | update | undo
 *   AgentControl-Template-Version: 1.2     (template and update commits only)
 */
const KIND = /^AgentControl-Kind: (template|change|update|undo)$/m;
const TEMPLATE_VERSION = /^AgentControl-Template-Version: (.+)$/m;
const TRAILERS = /\n\nAgentControl-Kind: [^]*$/;

export function formatMessage(options: {
  kind: UiVersion["kind"];
  message: string;
  templateVersion?: string;
}): string {
  const { kind, message, templateVersion } = options;
  const version = templateVersion ? `\nAgentControl-Template-Version: ${templateVersion}` : "";
  return `${message}\n\nAgentControl-Kind: ${kind}${version}\n`;
}

export function parseMessage(raw: string): Omit<UiVersion, "commit" | "createdAt"> {
  const kind = (KIND.exec(raw)?.[1] ?? "change") as UiVersion["kind"];
  const templateVersion = TEMPLATE_VERSION.exec(raw)?.[1];
  const message = raw.replace(TRAILERS, "").trimEnd();
  return templateVersion === undefined ? { kind, message } : { kind, message, templateVersion };
}
