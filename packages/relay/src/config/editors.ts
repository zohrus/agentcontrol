import { jsonEditor } from "./json-editor.ts";
import { fileEditor, markdownEditor } from "./markdown-editor.ts";
import { tomlEditor } from "./toml-editor.ts";
import type { Editor, Format } from "./types.ts";

export const editors: Record<Format, Editor> = {
  json: jsonEditor,
  toml: tomlEditor,
  md: markdownEditor,
  file: fileEditor,
};
