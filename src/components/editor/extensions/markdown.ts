import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";

export function markdownExtension() {
  return markdown({
    codeLanguages: languages,
  });
}
