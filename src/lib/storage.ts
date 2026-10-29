import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * The uploads disk, ported from the Laravel app's `filesystems.uploads` config: where
 * product photos and content images go. `UPLOADS_DISK` picks it with no code change:
 *
 * - `public` (default, development): files under `public/storage` (or `UPLOADS_PUBLIC_ROOT`),
 *   the same folder Laravel's `storage:link` serves, at `${APP_URL}/storage/...`
 * - `s3`: an S3-compatible bucket such as Cloudflare R2, from the `AWS_*` variables
 * - `gcs`: a Google Cloud Storage bucket, from the `GOOGLE_CLOUD_*` variables
 *
 * Stored URLs are absolute, as Laravel's `$disk->url()` made them. Rows written by
 * Laravel in development point at its own server (`http://localhost:8000/storage/...`);
 * list such prefixes in `UPLOADS_LEGACY_URLS` so they still display and can be deleted.
 */
export interface UploadsDisk {
  put(filePath: string, contents: Buffer, contentType: string): Promise<void>;
  /** Missing files are not an error. */
  delete(filePaths: string[]): Promise<void>;
  url(filePath: string): string;
}

export type UploadsDiskName = "public" | "s3" | "gcs";

export function uploadsDiskName(): UploadsDiskName {
  const name = process.env.UPLOADS_DISK ?? "public";

  if (name !== "public" && name !== "s3" && name !== "gcs") {
    throw new Error(`UPLOADS_DISK tidak dikenal: ${name}`);
  }

  return name;
}

let cachedDisk: { name: UploadsDiskName; disk: UploadsDisk } | undefined;

export function uploadsDisk(): UploadsDisk {
  const name = uploadsDiskName();

  if (cachedDisk?.name !== name) {
    cachedDisk = { name, disk: createDisk(name) };
  }

  return cachedDisk.disk;
}

/** The disk-relative path behind a stored URL, for deleting it. A URL from another disk comes back unchanged. */
export function pathFromUrl(url: string): string {
  for (const prefix of urlPrefixes()) {
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length);
    }
  }

  return url;
}

/**
 * A stored URL as the browser should load it. Files on the public disk are served
 * from this app's own `/storage`, whichever server the URL was saved under; bucket
 * URLs and shipped `/media/...` art are returned as they are.
 */
export function displayUrl(url: string): string {
  if (uploadsDiskName() !== "public") {
    return url;
  }

  const filePath = pathFromUrl(url);

  return filePath === url ? url : `/storage/${filePath}`;
}

/** The current disk's URL prefix, then any legacy ones, each ending in `/`. */
function urlPrefixes(): string[] {
  const legacy = (process.env.UPLOADS_LEGACY_URLS ?? "")
    .split(",")
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix !== "");

  return [uploadsDisk().url(""), ...legacy].map((prefix) => prefix.replace(/\/*$/, "/"));
}

function createDisk(name: UploadsDiskName): UploadsDisk {
  switch (name) {
    case "public":
      return publicDisk();
    case "s3":
      return s3Disk();
    case "gcs":
      return gcsDisk();
  }
}

function publicDisk(): UploadsDisk {
  // turbopackIgnore: this folder is runtime data (a symlink to the uploads), never part of the bundle
  const root = path.resolve(process.env.UPLOADS_PUBLIC_ROOT || path.join(/* turbopackIgnore: true */ process.cwd(), "public", "storage"));
  const baseUrl = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/storage`;
  const resolve = (filePath: string) => {
    const absolute = path.resolve(root, filePath);

    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      throw new Error(`Path di luar disk: ${filePath}`);
    }

    return absolute;
  };

  return {
    async put(filePath, contents) {
      const absolute = resolve(filePath);

      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, contents);
    },
    async delete(filePaths) {
      await Promise.all(filePaths.map((filePath) => rm(resolve(filePath), { force: true })));
    },
    url: (filePath) => `${baseUrl}/${filePath}`,
  };
}

function s3Disk(): UploadsDisk {
  const bucket = requiredEnv("AWS_BUCKET");
  const region = process.env.AWS_DEFAULT_REGION || "auto";
  const endpoint = process.env.AWS_ENDPOINT || undefined;
  const pathStyle = process.env.AWS_USE_PATH_STYLE_ENDPOINT === "true";
  const client = import("@aws-sdk/client-s3").then(
    ({ S3Client }) =>
      new S3Client({
        region,
        endpoint,
        forcePathStyle: pathStyle,
        credentials: {
          accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
          secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY"),
        },
      }),
  );

  const baseUrl = (() => {
    if (process.env.AWS_URL) {
      return process.env.AWS_URL.replace(/\/+$/, "");
    }

    if (endpoint) {
      const host = endpoint.replace(/\/+$/, "");

      return pathStyle ? `${host}/${bucket}` : host.replace("://", `://${bucket}.`);
    }

    return `https://${bucket}.s3.${region}.amazonaws.com`;
  })();

  return {
    async put(filePath, contents, contentType) {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");

      await (await client).send(new PutObjectCommand({ Bucket: bucket, Key: filePath, Body: contents, ContentType: contentType }));
    },
    async delete(filePaths) {
      if (filePaths.length === 0) {
        return;
      }

      const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");

      await (await client).send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: filePaths.map((Key) => ({ Key })), Quiet: true } }),
      );
    },
    url: (filePath) => `${baseUrl}/${filePath}`,
  };
}

function gcsDisk(): UploadsDisk {
  const bucketName = requiredEnv("GOOGLE_CLOUD_STORAGE_BUCKET");
  const prefix = (process.env.GOOGLE_CLOUD_STORAGE_PATH_PREFIX ?? "").replace(/^\/+|\/+$/g, "");
  const objectName = (filePath: string) => (prefix ? `${prefix}/${filePath}` : filePath);
  const bucket = import("@google-cloud/storage").then(({ Storage }) =>
    new Storage({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE || undefined,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || undefined,
    }).bucket(bucketName),
  );
  const baseUrl = (process.env.GOOGLE_CLOUD_STORAGE_API_URI || `https://storage.googleapis.com/${bucketName}`).replace(/\/+$/, "");

  return {
    async put(filePath, contents, contentType) {
      // Uniform bucket-level access: the bucket's own policy makes objects public, so no per-object ACL
      await (await bucket).file(objectName(filePath)).save(contents, {
        contentType,
        metadata: { cacheControl: "public, max-age=604800" },
        resumable: false,
      });
    },
    async delete(filePaths) {
      const target = await bucket;

      await Promise.all(filePaths.map((filePath) => target.file(objectName(filePath)).delete({ ignoreNotFound: true })));
    },
    url: (filePath) => `${baseUrl}/${objectName(filePath)}`,
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} belum diisi di .env`);
  }

  return value;
}
