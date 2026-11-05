import { HTML_ENTITIES } from "@/lib/php-html-entities";

/**
 * A rich editor document (Tiptap JSON) as the HTML the Laravel app stored: a port of
 * ueberdosis/tiptap-php's DOMSerializer with the extensions Filament's RichEditor
 * configures (RichContentRenderer::getTipTapPhpExtensions()). Marks stay open across
 * neighbouring text that shares them, and an overlapping one is closed and reopened, as
 * there; attribute values go through PHP's htmlentities(), text through htmlspecialchars().
 */
export type TiptapNode = { type?: string; attrs?: Record<string, unknown>; content?: TiptapNode[]; marks?: TiptapMark[]; text?: string };
export type TiptapMark = { type?: string; attrs?: Record<string, unknown> };

type Attributes = Record<string, unknown>;
/** tiptap-php's renderHTML() result: ['p', attrs, 0], ['pre', attrs, ['code', attrs, 0]], ['br', attrs] \u2026 */
type Spec = (string | Attributes | Spec | 0)[];
type Extension = {
  /** each attribute's renderHTML, in Schema::getAttributeConfigurations() order (global ones first) */
  attributes?: [string, ((attrs: Attributes) => Attributes | null) | null][];
  render: (item: TiptapNode | TiptapMark, attributes: Attributes) => Spec;
};

const isStringable = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/** htmlspecialchars($text, ENT_QUOTES) */
export function phpHtmlSpecialChars(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

/** htmlentities($text): ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML401, PHP 8.1's default */
export function phpHtmlEntities(text: string): string {
  let out = "";

  for (const character of text) {
    out += HTML_ENTITIES[character] ?? character;
  }

  return out;
}

/** json_encode() with its default flags: slashes and every non-ASCII character escaped. */
export function phpJsonEncode(value: unknown): string {
  // the editor's state reaches PHP as associative arrays, so an empty object is an empty array
  const json = JSON.stringify(value, (_key, item: unknown) => (item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0 ? [] : item));

  return (json ?? "null").replace(/\//g, "\\/").replace(/[\u007f-\uFFFF]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/** HTML::mergeAttributes(): later values win, classes and inline styles are joined. */
function mergeAttributes(...sets: (Attributes | null | undefined)[]): Attributes {
  const merged: Attributes = {};

  for (const set of sets) {
    if (!set || typeof set !== "object") {
      continue;
    }

    for (const [key, value] of Object.entries(set)) {
      if (key === "class") {
        if (isStringable(value)) merged.class = `${String(merged.class ?? "")} ${String(value)}`.trim();
        continue;
      }

      if (key === "style") {
        if (isStringable(value)) {
          const style = `${String(merged.style ?? "").replace(/[; ]+$/, "")}; ${String(value).replace(/;+$/, "")}; `;

          merged.style = style.trim().replace(/^[; ]+/, "");
        }
        continue;
      }

      merged[key] = value;
    }
  }

  return merged;
}

/** HTML::renderAttributes() */
function renderAttributes(attributes: Attributes): string {
  let html = "";

  for (const [name, raw] of Object.entries(attributes)) {
    if (!isStringable(raw)) {
      continue;
    }

    const value = typeof raw === "boolean" ? (raw ? "true" : "false") : String(raw);

    if (value !== "") {
      html += ` ${name}="${phpHtmlEntities(value)}"`;
    }
  }

  return html;
}

const isValidStyle = (value: unknown): value is string => typeof value === "string" && value.trim() !== "" && !/[;{}]/.test(value);

const textAlign: [string, (attrs: Attributes) => Attributes | null] = [
  "textAlign",
  (attrs) => (!isValidStyle(attrs.textAlign) || attrs.textAlign === "start" ? null : { style: `text-align: ${attrs.textAlign}` }),
];

/** ImageExtension::sanitizeStyleLength() */
function styleLength(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || (typeof value !== "string" && typeof value !== "number")) {
    return null;
  }

  const text = String(value).trim();

  return /^\d+(?:\.\d+)?(?:%|px|em|rem|vw|vh|vmin|vmax|pt|pc|cm|mm|in|ch|ex)?$/i.test(text) ? text : null;
}

const px = (value: string) => (/^\d+(?:\.\d+)?$/.test(value) ? `${value}px` : value);

const LINK_PROTOCOLS = ["http", "https", "ftp", "ftps", "mailto", "tel", "callto", "sms", "cid", "xmpp"];

/** Link::isAllowedUri() */
function allowedUri(uri: unknown): boolean {
  if (uri === null || uri === undefined || uri === "") {
    return true;
  }

  if (typeof uri !== "string") {
    return false;
  }

  const sanitised = uri.replace(/[\u0000- \u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/gu, "");

  return new RegExp(`^(?:(?:${LINK_PROTOCOLS.join("|")}):|[^a-z]|[a-z0-9+.\\-]+(?:[^a-z+.\\-:]|$))`, "i").test(sanitised);
}

const plain = (tag: string): Extension => ({ render: (_item, attributes) => [tag, attributes, 0] });

const NODES: Record<string, Extension> = {
  blockquote: plain("blockquote"),
  bulletList: plain("ul"),
  codeBlock: {
    // `language` is `'rendered' => false`: only the inner <code> shows it
    render: (node, attributes) => ["pre", attributes, ["code", { class: node.attrs?.language ? `language-${String(node.attrs.language)}` : null }, 0]],
  },
  customBlock: {
    attributes: [
      ["config", (attrs) => ({ "data-config": phpJsonEncode(attrs.config ?? null) })],
      ["id", (attrs) => ({ "data-id": attrs.id ?? null })],
    ],
    render: (_node, attributes) => ["div", mergeAttributes({ "data-type": "customBlock" }, attributes)],
  },
  hardBreak: { render: (_node, attributes) => ["br", attributes] },
  heading: {
    attributes: [textAlign],
    render: (node, attributes) => {
      const level = [1, 2, 3, 4, 5, 6].includes(Number(node.attrs?.level)) && Number.isInteger(node.attrs?.level) ? Number(node.attrs!.level) : 1;

      return [`h${level}`, attributes, 0];
    },
  },
  horizontalRule: { render: (_node, attributes) => ["hr", attributes] },
  image: {
    attributes: [
      ["src", null],
      ["alt", null],
      ["title", null],
      [
        "width",
        (attrs) => {
          const width = styleLength(attrs.width);

          return { width, style: width ? `width: ${px(width)}` : null };
        },
      ],
      [
        "height",
        (attrs) => {
          const height = styleLength(attrs.height);

          return { height, style: height ? `height: ${px(height)}` : null };
        },
      ],
      ["id", (attrs) => ({ "data-id": attrs.id ?? null })],
      ["loading", null],
    ],
    render: (_node, attributes) => ["img", attributes, 0],
  },
  listItem: plain("li"),
  orderedList: {
    attributes: [["start", (attrs) => (attrs.start ? { start: attrs.start } : null)]],
    render: (_node, attributes) => ["ol", attributes, 0],
  },
  paragraph: { attributes: [textAlign], render: (_node, attributes) => ["p", attributes, 0] },
  table: { render: (_node, attributes) => ["table", attributes, ["tbody", 0]] },
  tableRow: plain("tr"),
  tableCell: {
    attributes: [
      ["rowspan", null],
      ["colspan", null],
      ["colwidth", (attrs) => (Array.isArray(attrs.colwidth) ? { "data-colwidth": attrs.colwidth.join(",") } : null)],
    ],
    render: (_node, attributes) => ["td", attributes, 0],
  },
  tableHeader: {
    attributes: [
      ["rowspan", null],
      ["colspan", null],
      ["colwidth", (attrs) => (Array.isArray(attrs.colwidth) ? { "data-colwidth": attrs.colwidth.join(",") } : null)],
    ],
    render: (_node, attributes) => ["th", attributes, 0],
  },
};

const MARKS: Record<string, Extension> = {
  bold: plain("strong"),
  code: plain("code"),
  highlight: plain("mark"),
  italic: plain("em"),
  link: {
    attributes: [
      ["href", null],
      ["target", null],
      ["rel", null],
      ["class", null],
    ],
    render: (mark, attributes) => {
      const next = { ...attributes };

      if (!allowedUri(next.href ?? "")) {
        next.href = "";
      }

      for (const [key, value] of Object.entries(mark.attrs ?? {})) {
        if (value === null) delete next[key];
      }

      return ["a", next, 0];
    },
  },
  strike: plain("s"),
  subscript: plain("sub"),
  superscript: plain("sup"),
  underline: plain("u"),
};

/** The Schema's attributes for a node or mark, then its renderHTML(). */
function spec(extension: Extension, item: TiptapNode | TiptapMark): Spec {
  let attributes: Attributes = {};

  for (const [name, renderHTML] of extension.attributes ?? []) {
    const value = renderHTML ? renderHTML(item.attrs ?? {}) : { [name]: item.attrs?.[name] ?? null };

    if (value !== null) {
      attributes = mergeAttributes(attributes, value);
    }
  }

  attributes = Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined));

  return extension.render(item, attributes);
}

const isAttributeSet = (value: unknown): value is Attributes => typeof value === "object" && value !== null && !Array.isArray(value);
const holdsZero = (value: unknown) => Array.isArray(value) && value.includes(0);

/** DOMSerializer::renderOpeningTag() for the shapes the extensions above return. */
function openingTag(instructions: Spec): string {
  let html = "";

  instructions.forEach((instruction, index) => {
    if (typeof instruction === "string") {
      const next = instructions[index + 1];

      html += next !== undefined && isAttributeSet(next) ? `<${instruction}${renderAttributes(next)}>` : `<${instruction}>`;
    } else if (Array.isArray(instruction) && holdsZero(instruction)) {
      html += openingTag(instruction);
    }
  });

  return html;
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** DOMSerializer::renderClosingTag(): nothing at all for a void element. */
function closingTag(instructions: Spec): string {
  let html = "";

  for (const instruction of [...instructions].reverse()) {
    if (typeof instruction === "string") {
      if (VOID.has(instruction)) {
        return "";
      }

      html += `</${instruction}>`;
    } else if (Array.isArray(instruction) && holdsZero(instruction)) {
      html += closingTag(instruction);
    }
  }

  return html;
}

/** PHP's `==` between two decoded JSON values (stdClass compares property by property, in any order). */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null) || a === "" || b === "" || a === false || b === false || a === 0 || b === 0;
  }

  if (typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    return keysA.length === keysB.length && keysA.every((key) => key in (b as object) && looseEqual((a as Attributes)[key], (b as Attributes)[key]));
  }

  if (typeof a === "object" || typeof b === "object") {
    return false;
  }

  // PHP 8: a number and a numeric string compare as numbers, otherwise as strings
  const numeric = (value: unknown) => typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));

  if ((typeof a === "number" || typeof b === "number") && numeric(a) && numeric(b)) {
    return Number(a) === Number(b);
  }

  if (typeof a === "boolean" || typeof b === "boolean") {
    return Boolean(a) === Boolean(b);
  }

  return String(a) === String(b);
}

/** True when `other` lacks the mark: nodeHasMark() (the name reads the other way round in tiptap-php). */
function lacksMark(other: TiptapNode | undefined, mark: TiptapMark): boolean {
  if (!other || !("marks" in other) || !Array.isArray(other.marks)) {
    return true;
  }

  return !other.marks.some((candidate) => looseEqual(mark, candidate));
}

type Open = [Extension, TiptapMark];

function renderNode(node: TiptapNode, previous: TiptapNode | undefined, next: TiptapNode | undefined, markStack: Open[]): string {
  const html: string[] = [];
  const marks = Array.isArray(node.marks) ? node.marks : null;

  for (const mark of marks ?? []) {
    const extension = mark.type ? MARKS[mark.type] : undefined;

    if (extension && lacksMark(previous, mark)) {
      html.push(openingTag(spec(extension, mark)));
      markStack.push([extension, mark]);
    }
  }

  const extension = node.type ? NODES[node.type] : undefined;
  const nodeSpec = extension ? spec(extension, node) : null;

  if (nodeSpec) {
    html.push(openingTag(nodeSpec));
  }

  if (Array.isArray(node.content)) {
    const nested: Open[] = [];

    node.content.forEach((child, index) => html.push(renderNode(child, node.content![index - 1], node.content![index + 1], nested)));
  } else if (typeof node.text === "string") {
    html.push(phpHtmlSpecialChars(node.text));
  }

  if (nodeSpec) {
    html.push(closingTag(nodeSpec));
  }

  if (marks) {
    const toClose: Open[] = [];

    for (const mark of [...marks].reverse()) {
      const markExtension = mark.type ? MARKS[mark.type] : undefined;

      if (markExtension && lacksMark(next, mark)) {
        toClose.push([markExtension, mark]);
      }
    }

    // closeAndReopenTags(): pop the stack down to each mark that ends here, reopening any closed on the way
    const reopen: Open[] = [];

    while (toClose.length) {
      const top = markStack.pop();

      if (!top) {
        break;
      }

      html.push(closingTag(spec(top[0], top[1])));

      const found = toClose.findIndex(([candidate, mark]) => candidate === top[0] && looseEqual(mark, top[1]));

      if (found === -1) {
        reopen.push(top);
      } else {
        toClose.splice(found, 1);
      }
    }

    for (const open of reopen.reverse()) {
      html.push(openingTag(spec(open[0], open[1])));
      markStack.push(open);
    }
  }

  return html.join("");
}

/** Editor::getHtml() for a document. */
export function tiptapHtml(document: TiptapNode): string {
  const content = Array.isArray(document.content) ? document.content : [];
  const markStack: Open[] = [];

  return content.map((node, index) => renderNode(node, content[index - 1], content[index + 1], markStack)).join("");
}
