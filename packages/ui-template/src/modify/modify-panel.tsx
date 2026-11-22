import { Dialog, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/index.ts";
import { ChangeDetails } from "./change-details.tsx";
import { ModifyChat } from "./modify-chat.tsx";
import { ReviewBar } from "./review-bar.tsx";
import type { ModifyPanelProps } from "./types.ts";
import { UpdateBanner } from "./update-banner.tsx";
import { VersionHistory } from "./version-history.tsx";

function RecoveryLink() {
  return (
    <a
      href="/_safe"
      className="border-t border-line px-4 py-2 text-xs text-muted underline hover:text-fg"
    >
      If the UI breaks, open the recovery page
    </a>
  );
}

function ChatTab(props: ModifyPanelProps) {
  const { change, update, versions } = props;
  const { status } = change;
  return (
    <>
      <ModifyChat
        events={props.events}
        canSend={status === "idle" || status === "failed"}
        onSendPrompt={props.onSendPrompt}
      />
      <ChangeDetails change={change} />
      <ReviewBar
        status={status}
        canGoBack={versions.length > 1}
        hideKeepUndo={update?.phase === "merged"}
        onKeep={props.onKeep}
        onUndo={props.onUndo}
        onDiscard={props.onDiscard}
      />
    </>
  );
}

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
          <ChatTab {...props} />
        </TabsContent>
        <TabsContent value="history">
          <VersionHistory versions={props.versions} onRestore={props.onRestore} />
        </TabsContent>
      </Tabs>
      <RecoveryLink />
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
