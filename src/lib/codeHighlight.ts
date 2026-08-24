import hljs from "highlight.js";

/**
 * Highlights a code block with the specified language.
 * Falls back to auto-detection if language is not supported.
 */
export function highlightCode(code: string, language?: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      const result = hljs.highlight(code, { language, ignoreIllegals: true });
      return result.value;
    }
    const result = hljs.highlightAuto(code);
    return result.value;
  } catch {
    // If highlighting fails, return escaped HTML
    return escapeHtml(code);
  }
}

/**
 * Escapes HTML special characters for safe output.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generates a language badge for the code block.
 */
export function getLanguageBadge(language?: string): string {
  if (!language) return "";
  return `<span class="code-language-badge">${language}</span>`;
}

/**
 * Checks if a language is supported by highlight.js.
 */
export function isLanguageSupported(language: string): boolean {
  return hljs.getLanguage(language) !== undefined;
}

/**
 * Gets list of all supported languages.
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(hljs.listLanguages());
}