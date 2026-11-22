import { join } from "node:path";
import { AgentKind } from "@agentcontrol/protocol";
import rootPackage from "../../../../package.json";

export interface ModifyConfig {
  agent: AgentKind;
  templateDir: string;
  templateVersion: string;
}

/**
 * Which agent edits the UI, and where this release's default UI is. Defaults: Claude Code, the
 * template package next to this one, and the repo's version. The environment overrides each
 * (AGENTCONTROL_MODIFY_AGENT, _UI_TEMPLATE_DIR, _UI_TEMPLATE_VERSION), which tests use.
 */
export function readModifyConfig(env: Record<string, string | undefined>): ModifyConfig {
  return {
    agent: AgentKind.catch("claude-code").parse(env["AGENTCONTROL_MODIFY_AGENT"]),
    templateDir:
      env["AGENTCONTROL_UI_TEMPLATE_DIR"] ?? join(import.meta.dir, "../../../ui-template"),
    templateVersion: env["AGENTCONTROL_UI_TEMPLATE_VERSION"] ?? rootPackage.version,
  };
}
