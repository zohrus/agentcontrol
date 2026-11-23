import { AgentKind } from "@agentcontrol/protocol";
import rootPackage from "../../../../package.json";
import { findResources } from "../resources/index.ts";

export interface ModifyConfig {
  agent: AgentKind;
  templateDir: string;
  templateVersion: string;
}

/**
 * Which agent edits the UI, and where this release's default UI is. Defaults: Claude Code, the
 * default UI of the release's resources folder (`packages/ui-template` in a source checkout), and
 * the repo's version. The environment overrides each
 * (AGENTCONTROL_MODIFY_AGENT, _UI_TEMPLATE_DIR, _UI_TEMPLATE_VERSION), which tests use.
 */
export function readModifyConfig(env: Record<string, string | undefined>): ModifyConfig {
  return {
    agent: AgentKind.catch("claude-code").parse(env["AGENTCONTROL_MODIFY_AGENT"]),
    templateDir:
      env["AGENTCONTROL_UI_TEMPLATE_DIR"] ??
      findResources({ env, execPath: process.execPath }).templateDir,
    templateVersion: env["AGENTCONTROL_UI_TEMPLATE_VERSION"] ?? rootPackage.version,
  };
}
