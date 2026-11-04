import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { pathFromUrl, uploadsDisk } from "@/lib/storage";

/**
 * Ported from App\Support\ProductImageUploader: an uploaded product photo becomes two
 * JPEGs on the uploads disk, the photo scaled down to fit 1600×1600 and a 400×400 crop
 * of its middle, both at quality 82. Only the photo's URL is stored; the thumbnail is
 * found by convention (`-thumb` before the extension).
 *
 * Like Intervention Image, the photo is turned upright from its EXIF orientation and a
 * transparent background becomes white.
 */
const MAX_DIMENSION = 1600;
const THUMB_DIMENSION = 400;
const QUALITY = 82;
export const THUMB_SUFFIX = "-thumb";

/** Throws when the file isn't an image sharp can read (Laravel: a decode error). */
export async function storeProductImage(contents: Buffer, productId: number): Promise<{ path: string }> {
  const source = sharp(contents, { failOn: "error" }).rotate();
  const path = `products/${productId}/${randomUUID()}.jpg`;

  const [original, thumb] = await Promise.all([
    source
      .clone()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: QUALITY })
      .toBuffer(),
    source.clone().resize(THUMB_DIMENSION, THUMB_DIMENSION, { fit: "cover", position: "centre" }).flatten({ background: "#ffffff" }).jpeg({ quality: QUALITY }).toBuffer(),
  ]);

  const disk = uploadsDisk();

  await disk.put(path, original, "image/jpeg");
  await disk.put(thumbPath(path), thumb, "image/jpeg");

  return { path: disk.url(path) };
}

/** Deletes both the photo and its thumbnail; missing files are not an error. */
export async function destroyProductImage(url: string): Promise<void> {
  const path = pathFromUrl(url);

  await uploadsDisk().delete([path, thumbPath(path)]);
}

export function thumbPath(path: string): string {
  return path.replace(/(\.\w+)$/, `${THUMB_SUFFIX}$1`);
}
