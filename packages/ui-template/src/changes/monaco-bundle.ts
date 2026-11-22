import * as monaco from "monaco-editor";
import CssWorker from "monaco-editor/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";

const workers: Record<string, new () => Worker> = {
  json: JsonWorker,
  css: CssWorker,
  scss: CssWorker,
  less: CssWorker,
  html: HtmlWorker,
  typescript: TsWorker,
  javascript: TsWorker,
};

/** Monaco and its workers, bundled by Vite so nothing loads from a CDN. */
self.MonacoEnvironment = {
  getWorker: (_workerId, label) => new (workers[label] ?? EditorWorker)(),
};

const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = () => {
  monaco.editor.setTheme(darkScheme.matches ? "vs-dark" : "vs");
};
applyTheme();
darkScheme.addEventListener("change", applyTheme);

export { monaco };
