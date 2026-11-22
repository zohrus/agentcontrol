import { Dialog, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/index.ts";
import { ModifyChat } from "./modify-chat.tsx";
import { ReviewBar } from "./review-bar.tsx";
import type { ModifyPanelProps } from "./types.ts";
import { UpdateBanner } from "./update-banner.tsx";
import { VersionHistory } from "./version-history.tsx";

/** Chat with the Modify agent, Keep / Undo for its change, update banner and version history. */
export function ModifyPanel(props: ModifyPanelProps) {
  const { update, onUpdate, onKeep, onUndo } = props;
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {update && (
        <UpdateBanner update={update} onUpdate={onUpdate} onKeep={onKeep} onUndo={onUndo} />
      )}
      <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="border-b border-line px-3">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="history">History ({props.versions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="chat">
          <ModifyChat events={props.events} onSendPrompt={props.onSendPrompt} />
          <ReviewBar gate={props.gate} onKeep={onKeep} onUndo={onUndo} />
        </TabsContent>
        <TabsContent value="history">
          <VersionHistory versions={props.versions} onRestore={props.onRestore} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type DialogProps = ModifyPanelProps & { open: boolean; onOpenChange: (open: boolean) => void };

/** The Modify panel as a side sheet, opened by "Modify this UI". */
export function ModifyDialog({ open, onOpenChange, ...panel }: DialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      placement="right"
      title="Modify this UI"
      description="Describe a change. Nothing is kept until you press Keep."
    >
      <ModifyPanel {...panel} />
    </Dialog>
  );
}
