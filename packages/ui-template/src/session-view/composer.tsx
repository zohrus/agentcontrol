import { type KeyboardEvent, useEffect, useState } from "react";
import { Button } from "../components/index.ts";

export type ComposerProps = {
  running: boolean;
  placeholder: string;
  onSendPrompt: (text: string) => void;
  /** The session is still being set up: a message is held, not sent, until it is ready. */
  starting?: boolean;
  /** The agent is up and takes its first prompt; a held message is sent when this is true. */
  ready?: boolean;
  onCancel: () => void;
  /** Omit to hide the Archive button (for example in the Modify chat). */
  onArchive?: () => void;
};

type PromptProps = {
  text: string;
  locked: boolean;
  placeholder: string;
  onChange: (text: string) => void;
  onSend: () => void;
};

function isSendShortcut(event: KeyboardEvent): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

function Prompt({ text, locked, placeholder, onChange, onSend }: PromptProps) {
  return (
    <textarea
      value={text}
      readOnly={locked}
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

type Held = {
  /** The message waits for the session to be set up. */
  queued: boolean;
  /** A held message was not sent because the session did not become ready. */
  notSent: boolean;
  hold: () => void;
  release: () => void;
};

/** A message written while the session starts is held, and sent once the agent is ready. */
function useHeldMessage(call: { starting: boolean; ready: boolean; deliver: () => void }): Held {
  const { starting, ready, deliver } = call;
  const [queued, setQueued] = useState(false);
  const [notSent, setNotSent] = useState(false);
  useEffect(() => {
    if (!queued || starting) return;
    setQueued(false);
    if (ready) deliver();
    else setNotSent(true);
  }, [queued, starting, ready, deliver]);
  return {
    queued,
    notSent,
    hold: () => {
      setNotSent(false);
      setQueued(true);
    },
    release: () => {
      setQueued(false);
    },
  };
}

function HeldNote({ held }: { held: Held }) {
  if (held.queued) {
    return (
      <p role="status" className="m-0 text-[11px] text-muted">
        Queued: it is sent as the first message as soon as the session is ready.
      </p>
    );
  }
  if (!held.notSent) return null;
  return (
    <p role="alert" className="m-0 text-[11px] text-fail">
      Not sent: the session could not be set up. Your message is still here.
    </p>
  );
}

type ButtonsProps = {
  held: Held;
  canSend: boolean;
  running: boolean;
  onSend: () => void;
  onCancel: () => void;
  onArchive?: (() => void) | undefined;
};

function Buttons({ held, canSend, running, onSend, onCancel, onArchive }: ButtonsProps) {
  return (
    <div className="flex gap-2">
      {held.queued ? (
        <Button onClick={held.release}>Take back</Button>
      ) : (
        <Button variant="primary" onClick={onSend} disabled={!canSend}>
          Send
        </Button>
      )}
      {running && <Button onClick={onCancel}>Cancel</Button>}
      {onArchive && (
        <Button className="ml-auto" variant="ghost" onClick={onArchive}>
          Archive
        </Button>
      )}
    </div>
  );
}

/** The text being written, and what Send does with it: send now, or hold it while the session starts. */
function useMessage(props: ComposerProps) {
  const { starting = false, ready = false, onSendPrompt } = props;
  const [text, setText] = useState("");
  const deliver = () => {
    onSendPrompt(text.trim());
    setText("");
  };
  const held = useHeldMessage({ starting, ready, deliver });
  const send = () => {
    if (text.trim() === "" || held.queued) return;
    if (starting) held.hold();
    else deliver();
  };
  return { text, setText, held, send };
}

/** Prompt box with Send, Cancel (while a turn runs) and Archive. */
export function Composer(props: ComposerProps) {
  const { text, setText, held, send } = useMessage(props);
  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-2.5">
      <Prompt
        text={text}
        locked={held.queued}
        placeholder={props.placeholder}
        onChange={setText}
        onSend={send}
      />
      <HeldNote held={held} />
      <Buttons {...props} held={held} canSend={text.trim() !== ""} onSend={send} />
    </div>
  );
}
