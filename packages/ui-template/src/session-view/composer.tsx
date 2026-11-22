import { type KeyboardEvent, useState } from "react";
import { Button } from "../components/index.ts";

export type ComposerProps = {
  running: boolean;
  placeholder: string;
  onSendPrompt: (text: string) => void;
  onCancel: () => void;
  onArchive: () => void;
};

type PromptProps = {
  text: string;
  placeholder: string;
  onChange: (text: string) => void;
  onSend: () => void;
};

function isSendShortcut(event: KeyboardEvent): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

function Prompt({ text, placeholder, onChange, onSend }: PromptProps) {
  return (
    <textarea
      value={text}
      rows={2}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (isSendShortcut(e)) onSend();
      }}
      className="resize-none rounded-lg border border-line bg-surface px-3 py-2 text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
    />
  );
}

/** Prompt box with Send, Cancel (while a turn runs) and Archive. */
export function Composer({
  running,
  placeholder,
  onSendPrompt,
  onCancel,
  onArchive,
}: ComposerProps) {
  const [text, setText] = useState("");
  const send = () => {
    if (text.trim() === "") return;
    onSendPrompt(text.trim());
    setText("");
  };
  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-2.5">
      <Prompt text={text} placeholder={placeholder} onChange={setText} onSend={send} />
      <div className="flex gap-2">
        <Button variant="primary" onClick={send} disabled={text.trim() === ""}>
          Send
        </Button>
        {running && <Button onClick={onCancel}>Cancel</Button>}
        <Button className="ml-auto" variant="ghost" onClick={onArchive}>
          Archive
        </Button>
      </div>
    </div>
  );
}
