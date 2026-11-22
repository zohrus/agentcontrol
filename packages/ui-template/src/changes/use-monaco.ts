import { useEffect, useState } from "react";

export type Monaco = typeof import("./monaco-bundle.ts").monaco;

let loading: Promise<Monaco> | undefined;

function loadMonaco(): Promise<Monaco> {
  loading ??= import("./monaco-bundle.ts").then((bundle) => bundle.monaco);
  return loading;
}

/** Monaco once its chunk has loaded; undefined until then. */
export function useMonaco(): Monaco | undefined {
  const [monaco, setMonaco] = useState<Monaco>();
  useEffect(() => {
    void loadMonaco().then(setMonaco);
  }, []);
  return monaco;
}
