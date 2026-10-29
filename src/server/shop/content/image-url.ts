import { displayUrl, uploadsDisk } from "@/lib/storage";

/**
 * A shipped `/media/...` path or a full URL stays as it is; a file just uploaded to
 * the uploads disk becomes its public URL. Ported from HomePageContent::imageUrl().
 */
export function imageUrl(image: string): string {
  if (image.startsWith("/") || image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  const url = uploadsDisk().url(image);

  return url.startsWith("/") ? `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}${url}` : url;
}

/** `imageUrl()` as the browser should load it (see `displayUrl()`). */
export function storefrontImage(image: string): string {
  return displayUrl(imageUrl(image));
}

/** Laravel's `filled()` for the values these pages store: a non-blank string. */
export function filled(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}
