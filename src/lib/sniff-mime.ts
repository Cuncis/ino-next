/**
 * The type a file really is, from its first bytes, for the upload types the admin accepts
 * (images and PDF). Laravel checks uploads with finfo (the `mimetypes` rule, and
 * guessExtension() for the stored name), not with the type the browser declared, so a
 * text file renamed to .png is refused there too. Anything else is
 * "application/octet-stream".
 */
const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

export function sniffMime(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  if (startsWith(bytes, ascii("ftypavif"), 4) || startsWith(bytes, ascii("ftypavis"), 4)) return "image/avif";
  if (startsWith(bytes, ascii("%PDF-"))) return "application/pdf";

  // an SVG is XML text whose root element is <svg>
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 4096)).replace(/^﻿/, "");
  const root = head.replace(/^\s*(<\?xml[^>]*\?>\s*)?((<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)\s*)*/i, "");

  if (/^<svg[\s>]/i.test(root)) return "image/svg+xml";

  return "application/octet-stream";
}

/** The files with their sniffed type in place of the browser's. */
export async function withSniffedTypes(files: Record<string, File[]>): Promise<Record<string, File[]>> {
  const entries = await Promise.all(
    Object.entries(files).map(async ([name, list]) => [
      name,
      await Promise.all(list.map(async (file) => new File([await file.arrayBuffer()], file.name, { type: sniffMime(new Uint8Array(await file.slice(0, 4096).arrayBuffer())), lastModified: file.lastModified }))),
    ]),
  );

  return Object.fromEntries(entries);
}
