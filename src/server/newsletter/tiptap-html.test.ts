import { describe, expect, it } from "vitest";
import cases from "./tiptap-html.fixtures.json";
import { phpJsonEncode, tiptapHtml, type TiptapNode } from "./tiptap-html";

/**
 * Each document's HTML as the Laravel app's tiptap-php (with Filament's extensions)
 * wrote it, captured from that app: marks kept open and reopened, htmlentities() on
 * attributes, json_encode() in a custom block's config, void elements without a close.
 */
describe("tiptapHtml", () => {
  it.each(cases.map((item, index) => [index, item] as const))("renders document %i as tiptap-php did", (_, item) => {
    expect(tiptapHtml(item.doc as TiptapNode)).toBe(item.html);
  });

  it("encodes JSON as PHP's json_encode() does", () => {
    expect(phpJsonEncode({ label: "Ünï 😀", url: "https://x.com/a" })).toBe('{"label":"\\u00dcn\\u00ef \\ud83d\\ude00","url":"https:\\/\\/x.com\\/a"}');
    expect(phpJsonEncode({})).toBe("[]");
  });
});
