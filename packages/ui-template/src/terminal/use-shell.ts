import type { OpenTerminal, SessionId, Terminal as Shell } from "@agentcontrol/sdk";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { type RefObject, useEffect } from "react";
import { type Controller, useController } from "../data/index.ts";
import { onThemeChange, terminalTheme } from "./theme.ts";

/** How a shell ended, for the bar under the terminal. */
export type ShellEnd = { exitCode: number | null } | { problem: string };

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** Keeps the xterm view as big as its box; the view tells the shell when its size changes. */
function followSize(options: { box: HTMLElement; fit: FitAddon }): () => void {
  const observer = new ResizeObserver(() => {
    // Fitting inside the observer would resize it again in the same frame: wait for the next.
    // A hidden tab has no size: wait until it is shown again.
    requestAnimationFrame(() => {
      if (options.box.clientWidth > 0 && options.box.clientHeight > 0) options.fit.fit();
    });
  });
  observer.observe(options.box);
  return () => {
    observer.disconnect();
  };
}

function newView(box: HTMLElement): { view: Terminal; fit: FitAddon } {
  const view = new Terminal({
    cursorBlink: true,
    fontFamily: FONT,
    fontSize: 12,
    theme: terminalTheme(),
  });
  const fit = new FitAddon();
  view.loadAddon(fit);
  view.open(box);
  fit.fit();
  return { view, fit };
}

/** Passes what the user types and the view's size to the shell; returns how to stop. */
function sendTo(shell: Shell, view: Terminal): () => void {
  const listeners = [
    view.onData((data) => {
      shell.write(data);
    }),
    view.onResize((size) => {
      shell.resize(size);
    }),
  ];
  return () => {
    listeners.forEach((listener) => {
      listener.dispose();
    });
  };
}

function callbacks(view: Terminal, onEnd: (end: ShellEnd) => void): OpenTerminal {
  return {
    cols: view.cols,
    rows: view.rows,
    onData: (text) => {
      view.write(text);
    },
    onExit: (exitCode) => {
      onEnd({ exitCode });
    },
    onError: (problem) => {
      onEnd({ problem });
    },
  };
}

/** Starts the session's shell in the box; returns how to end it and remove the view. */
function showShell(call: {
  controller: Controller;
  id: SessionId;
  box: HTMLElement;
  onEnd: (end: ShellEnd) => void;
}): () => void {
  const { view, fit } = newView(call.box);
  const shell = call.controller.openTerminal(call.id, callbacks(view, call.onEnd));
  const stops = [
    sendTo(shell, view),
    followSize({ box: call.box, fit }),
    onThemeChange(() => {
      view.options.theme = terminalTheme();
    }),
  ];
  return () => {
    stops.forEach((stop) => {
      stop();
    });
    shell.close();
    view.dispose();
  };
}

/**
 * Shows the session's shell in `box`: the shell starts when this runs and ends when it is cleaned
 * up (the tab is closed or the session changes). `onEnd` is called if the shell ends first.
 */
export function useShell(options: {
  id: SessionId;
  box: RefObject<HTMLDivElement | null>;
  onEnd: (end: ShellEnd) => void;
}): void {
  const controller = useController();
  const { id, box, onEnd } = options;
  useEffect(() => {
    const element = box.current;
    return element ? showShell({ controller, id, box: element, onEnd }) : undefined;
  }, [controller, id, box, onEnd]);
}
