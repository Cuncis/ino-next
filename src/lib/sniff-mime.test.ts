import { describe, expect, it } from "vitest";
import { sniffMime, withSniffedTypes } from "./sniff-mime";

const bytes = (...parts: (string | number[])[]) => new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...new TextEncoder().encode(part)] : part)));

describe("sniffMime", () => {
  it("knows the accepted upload types by their first bytes", () => {
    expect(sniffMime(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMime(bytes("GIF89a"))).toBe("image/gif");
    expect(sniffMime(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
    expect(sniffMime(bytes([0, 0, 0, 0x1c], "ftypavif"))).toBe("image/avif");
    expect(sniffMime(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMime(bytes('﻿<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg>\n<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("image/svg+xml");
  });

  it("refuses anything else, whatever its name says", () => {
    expect(sniffMime(bytes("halo"))).toBe("application/octet-stream");
    expect(sniffMime(bytes("<html><svg></svg></html>"))).toBe("application/octet-stream");
    expect(sniffMime(bytes(""))).toBe("application/octet-stream");
  });

  it("re-types files and keeps their name and contents", async () => {
    const { files } = await withSniffedTypes({ files: [new File(["halo"], "foto.png", { type: "image/png" })] });

    expect(files[0].type).toBe("application/octet-stream");
    expect(files[0].name).toBe("foto.png");
    expect(await files[0].text()).toBe("halo");
  });
});
