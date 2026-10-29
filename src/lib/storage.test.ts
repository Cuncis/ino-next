import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Never write into public/storage: it links to the real uploads folder
let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "inofarma-uploads-"));
  vi.stubEnv("UPLOADS_DISK", "public");
  vi.stubEnv("UPLOADS_PUBLIC_ROOT", root);
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("UPLOADS_LEGACY_URLS", "http://localhost:8000/storage");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("public uploads disk", () => {
  it("stores, links and deletes files, and refuses paths outside the disk", async () => {
    const { uploadsDisk } = await import("./storage");
    const disk = uploadsDisk();

    await disk.put("products/7/foto.jpg", Buffer.from("jpeg"), "image/jpeg");

    expect(readFileSync(path.join(root, "products/7/foto.jpg"), "utf8")).toBe("jpeg");
    expect(disk.url("products/7/foto.jpg")).toBe("http://localhost:3000/storage/products/7/foto.jpg");

    await disk.delete(["products/7/foto.jpg", "products/7/foto-thumb.jpg"]);

    expect(existsSync(path.join(root, "products/7/foto.jpg"))).toBe(false);
    await expect(disk.put("../keluar.txt", Buffer.from("x"), "text/plain")).rejects.toThrow("Path di luar disk");
  });

  it("recognises URLs Laravel saved under its own server", async () => {
    const { displayUrl, pathFromUrl } = await import("./storage");

    expect(pathFromUrl("http://localhost:8000/storage/products/937/a.jpg")).toBe("products/937/a.jpg");
    expect(pathFromUrl("http://localhost:3000/storage/products/1/b.jpg")).toBe("products/1/b.jpg");
    expect(displayUrl("http://localhost:8000/storage/products/937/a.jpg")).toBe("/storage/products/937/a.jpg");
    expect(displayUrl("/media/images/apotek/jengki.png")).toBe("/media/images/apotek/jengki.png");
    expect(displayUrl("https://cdn.example.com/x.jpg")).toBe("https://cdn.example.com/x.jpg");
  });
});
