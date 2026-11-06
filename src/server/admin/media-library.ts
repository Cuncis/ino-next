import path from "node:path";
import { appUrl } from "@/lib/app-url";
import { randomString } from "@/lib/random";
import { slugify } from "@/lib/slug";
import { redis } from "@/lib/redis";
import { filesUnder, uploadsDisk } from "@/lib/storage";

/**
 * Media File (App\Support\MediaLibrary): every image the site can show, in one list:
 * files staff uploaded there, product photos, and the storefront's own artwork under
 * public/media. Only files uploaded through Media File (media/ on the uploads disk) can
 * be deleted here. The scan is cached for a minute (see mediaItems()).
 */
export const SOURCE_UPLOADED = "unggahan";
export const SOURCE_PRODUCT = "produk";
export const SOURCE_SITE = "situs";
export const UPLOAD_DIRECTORY = "media";

/** MediaFiles::VIEWS: display options and files per page. */
export const VIEWS = { daftar: 30, kecil: 48, sedang: 24, besar: 12 } as const;
export const DEFAULT_VIEW = "sedang";
export type ViewMode = keyof typeof VIEWS;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif", "application/pdf"];
export const MAX_SIZE_KB = 8192;

const EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "avif", "pdf"];

export type MediaItem = { source: string; path: string; name: string; folder: string; size: number; modified: number; url: string; isImage: boolean; deletable: boolean };

/**
 * MediaLibrary::items(): Cache::remember('media-library.items.v2', 60) in Laravel's shared
 * cache store, here a Redis key, so an upload on one server clears the list on all of them.
 * A scan already running in this process is reused (kept on globalThis: each Next route
 * bundle has its own copy of this module). Without Redis the files are scanned every time.
 */
const CACHE_KEY = "media-library.items.v2";
const CACHE_SECONDS = 60;
const running = globalThis as typeof globalThis & { __mediaScan?: Promise<MediaItem[]> | null };

export async function forgetMedia(): Promise<void> {
  running.__mediaScan = null;
  await redis.del(CACHE_KEY).catch(() => {});
}

const extension = (file: string) => (file.includes(".") ? file.slice(file.lastIndexOf(".") + 1).toLowerCase() : "");
const wanted = (file: string) => EXTENSIONS.includes(extension(file));
export const isUploadedHere = (filePath: string) => filePath.startsWith(`${UPLOAD_DIRECTORY}/`) && !filePath.includes("..");

function item(source: string, filePath: string, size: number, modified: number, url: string): MediaItem {
  const folder = path.posix.dirname(filePath);

  return {
    source,
    path: filePath,
    name: path.posix.basename(filePath),
    folder: folder === "." ? "" : folder,
    size,
    modified,
    url,
    isImage: extension(filePath) !== "pdf",
    deletable: source === SOURCE_UPLOADED && isUploadedHere(filePath),
  };
}

/** public/media, walked like File::allFiles(). */
async function siteFiles(): Promise<MediaItem[]> {
  const root = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "media");

  return (await filesUnder(root))
    .filter((file) => wanted(file.relative))
    .map((file) => item(SOURCE_SITE, `media/${file.relative}`, file.size, file.modified, appUrl(`/media/${file.relative}`)));
}

/** MediaLibrary::scan(): the uploads disk (product photos apart from the rest, thumbnails left out) and the site's artwork, newest first. */
export async function mediaItems(): Promise<MediaItem[]> {
  const saved = await redis.get(CACHE_KEY).catch(() => null);

  if (saved) {
    try {
      return JSON.parse(saved) as MediaItem[];
    } catch {
      // a broken entry is scanned again, as MediaLibrary::items() does
    }
  }

  const scanning = (running.__mediaScan ??= scan()
    .then(async (items) => {
      await redis.set(CACHE_KEY, JSON.stringify(items), "EX", CACHE_SECONDS).catch(() => {});

      return items;
    })
    .finally(() => {
      if (running.__mediaScan === scanning) running.__mediaScan = null;
    }));

  return scanning;
}

async function scan(): Promise<MediaItem[]> {
  const disk = uploadsDisk();
  const uploaded = (await disk.list())
    .filter((file) => wanted(file.path) && !file.path.includes("-thumb."))
    .map((file) => {
      const url = disk.url(file.path);

      return item(file.path.startsWith("products/") ? SOURCE_PRODUCT : SOURCE_UPLOADED, file.path, file.size, file.modified, url.startsWith("/") ? appUrl(url) : url);
    });
  // each listing by path first (Flysystem's sortByPath, Finder's sortByName), so files of the same age keep Laravel's order
  const byPath = (a: MediaItem, b: MediaItem) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return [...uploaded.sort(byPath), ...(await siteFiles()).sort(byPath)].sort((a, b) => b.modified - a.modified);
}

/** MediaLibrary::search(): one source (or all) and the paths containing the term. */
export async function searchMedia(source: string | null, term: string): Promise<MediaItem[]> {
  const needle = term.trim().toLowerCase();

  return (await mediaItems()).filter((media) => (!source || media.source === source) && (needle === "" || media.path.toLowerCase().includes(needle)));
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

/** MediaLibrary::storedName(): "banner-promo-x7k2p.png", the extension from the file's (sniffed) type, never from its name. */
export function storedName(file: File): string {
  // pathinfo($name, PATHINFO_FILENAME): ".hidden" has no file name, so it becomes "file"
  const dot = file.name.lastIndexOf(".");
  const base = slugify(dot >= 0 ? file.name.slice(0, dot) : file.name) || "file";

  return `${base}-${randomString(5).toLowerCase()}.${MIME_EXTENSIONS[file.type] ?? "bin"}`;
}

export async function storeMedia(file: File): Promise<string> {
  const filePath = `${UPLOAD_DIRECTORY}/${storedName(file)}`;

  await uploadsDisk().put(filePath, Buffer.from(await file.arrayBuffer()), file.type);

  return filePath;
}

/** MediaLibrary::delete(): only files uploaded through Media File. */
export async function deleteMedia(filePath: string): Promise<boolean> {
  if (!isUploadedHere(filePath)) {
    return false;
  }

  await uploadsDisk().delete([filePath]);
  await forgetMedia();

  return true;
}
