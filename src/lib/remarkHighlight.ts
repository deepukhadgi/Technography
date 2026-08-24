import { visit } from "unist-util-visit";
import type { Root, Element, Text } from "hast";
import { highlightCode } from "./codeHighlight";

/**
 * Remark plugin that adds syntax highlighting to code blocks using highlight.js.
 * This runs during the markdown-to-HTML conversion on the server.
 */
export function remarkHighlight() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index: number | undefined, parent: Element | Root | undefined) => {
      // Target <pre><code> elements
      if (
        node.tagName === "pre" &&
        node.children.length === 1 &&
        node.children[0].type === "element" &&
        node.children[0].tagName === "code"
      ) {
        const codeElement = node.children[0] as Element;
        const language = getLanguageFromClass(codeElement.properties?.className);
        const codeText = getTextContent(codeElement);

        if (codeText) {
          // Highlight the code
          const highlightedCode = highlightCode(codeText, language);

          // Replace the code element's children with the highlighted HTML
          codeElement.children = [
            {
              type: "raw",
              value: highlightedCode,
            },
          ];

          // Add language badge as a data attribute for CSS styling
          if (language) {
            codeElement.properties = codeElement.properties || {};
            codeElement.properties["data-language"] = language;
          }
        }
      }
    });
  };
}

/**
 * Extracts language from className like "language-typescript"
 */
function getLanguageFromClass(className: unknown): string | undefined {
  if (!className) return undefined;
  const classes = Array.isArray(className) ? className : [className];
  for (const cls of classes) {
    if (typeof cls === "string" && cls.startsWith("language-")) {
      return cls.slice("language-".length);
    }
  }
  return undefined;
}

/**
 * Gets text content from a hast element tree
 */
function getTextContent(node: Element): string {
  let result = "";
  for (const child of node.children || []) {
    if (child.type === "text") {
      result += (child as Text).value;
    } else if (child.type === "element") {
      result += getTextContent(child as Element);
    }
  }
  return result;
}