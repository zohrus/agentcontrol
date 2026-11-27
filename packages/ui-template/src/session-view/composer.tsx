import { type KeyboardEvent, useEffect, useState } from "react";
import { Button } from "../components/index.ts";

export type ComposerProps = {
  running: boolean;
  /** Cancel was pressed and the app has not answered yet. */
  cancelling?: boolean;
  placeholder: string;
  onSendPrompt: (text: string) => void;
  /** The session is still being set up: a message is held, not sent, until it is ready. */
  starting?: boolean;
  /** The session did not become ready: a held message is given back, not sent. */
  notReady?: boolean;
  onCancel: () => void;
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
function useHeldMessage(call: { starting: boolean; notReady: boolean; deliver: () => void }): Held {
  const { starting, notReady, deliver } = call;
  const [queued, setQueued] = useState(false);
  const [notSent, setNotSent] = useState(false);
  useEffect(() => {
    if (!queued || starting) return;
    setQueued(false);
    if (notReady) setNotSent(true);
    else deliver();
  }, [queued, starting, notReady, deliver]);
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
      Not sent: the session did not become ready. Your message is still here.
    </p>
  );
}

type ButtonsProps = {
  held: Held;
  canSend: boolean;
  running: boolean;
  cancelling: boolean;
  onSend: () => void;
  onCancel: () => void;
};

function SendButton({ held, canSend, onSend }: Pick<ButtonsProps, "held" | "canSend" | "onSend">) {
  if (held.queued) return <Button onClick={held.release}>Take back</Button>;
  return (
    <Button variant="primary" onClick={onSend} disabled={!canSend}>
      Send
    </Button>
  );
}

/** Cancel while a turn runs; once pressed it says it is cancelling until the app has answered. */
function CancelButton(props: Pick<ButtonsProps, "running" | "cancelling" | "onCancel">) {
  if (!props.running) return null;
  return (
    <Button onClick={props.onCancel} disabled={props.cancelling}>
      {props.cancelling ? "Cancelling…" : "Cancel"}
    </Button>
  );
}

function Buttons(props: ButtonsProps) {
  return (
    <div className="flex gap-2">
      <SendButton {...props} />
      <CancelButton {...props} />
    </div>
  );
}

/** The text being written, and what Send does with it: send now, or hold it while the session starts. */
function useMessage(props: ComposerProps) {
  const { starting = false, notReady = false, onSendPrompt } = props;
  const [text, setText] = useState("");
  const deliver = () => {
    onSendPrompt(text.trim());
    setText("");
  };
  const held = useHeldMessage({ starting, notReady, deliver });
  const send = () => {
    if (text.trim() === "" || held.queued) return;
    if (starting) held.hold();
    else deliver();
  };
  return { text, setText, held, send };
}

/** Prompt box with Send and Cancel (while a turn runs). */
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
      <Buttons
        {...props}
        cancelling={props.cancelling === true}
        held={held}
        canSend={text.trim() !== ""}
        onSend={send}
      />
    </div>
  );
}
