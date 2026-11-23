import { ConfigScreen } from "../config/index.ts";
import { LOCAL_WORKSPACE, useChoices, useConfigState, useController } from "../data/index.ts";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

/** The Config screen wired to the app: the stored items, reviews, applies, undo, import and drift. */
export function ConfigDialog(props: Props) {
  const { config } = useController();
  const state = useConfigState();
  const { repos } = useChoices(LOCAL_WORKSPACE);
  return <ConfigScreen {...props} state={state} repos={repos} actions={config} />;
}
