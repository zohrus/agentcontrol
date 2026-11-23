import { useModify } from "../data/index.ts";
import { ModifyDialog } from "./modify-panel.tsx";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

/** The Modify panel wired to the app: live state, the Modify agent's chat and the version history. */
export function ConnectedModifyDialog({ open, onOpenChange }: Props) {
  const { state, versions, events, actions } = useModify();
  return (
    <ModifyDialog
      open={open}
      onOpenChange={onOpenChange}
      events={events}
      change={state}
      versions={versions}
      update={state.update}
      onSendPrompt={(text) => void actions.request(text)}
      onKeep={() => void actions.keep()}
      onUndo={() => void actions.undo()}
      onDiscard={() => void actions.discard()}
      onRestore={(commit) => void actions.restore(commit)}
      onUpdate={() => void actions.applyUpdate()}
    />
  );
}
