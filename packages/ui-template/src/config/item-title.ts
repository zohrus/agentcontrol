import type { ConfigItem } from "@agentcontrol/protocol";

/** What an item is called in a list: its name, or what it is when it has none. */
export function itemTitle(item: ConfigItem): string {
  if ("name" in item) return item.name;
  return item.kind === "permission" ? "Permission rules" : "Environment variables";
}
