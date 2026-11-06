import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { can, isSuperAdmin, uploadTypes, type StaffAccess } from "@/lib/permissions";
import { adminActionContext, toastJson } from "./action-response";
import { withSniffedTypes } from "@/lib/sniff-mime";
import { validationErrorResponse } from "@/lib/validation";
import { formBody } from "./form-body";
import { ACCEPTED_TYPES, DEFAULT_VIEW, deleteMedia, forgetMedia, MAX_SIZE_KB, searchMedia, SOURCE_PRODUCT, SOURCE_SITE, SOURCE_UPLOADED, storeMedia, VIEWS, type MediaItem, type ViewMode } from "./media-library";

/**
 * Media File behind /admin/media-file/…: a page of files for the current search, source
 * and display; uploading (the header's "Upload File" and files dropped on the page)
 * with Media:Unggah; deleting a file uploaded here with Media:Hapus.
 */
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** number_format($n, $decimals, ',', '.') */
function numberFormat(value: number, decimals = 0): string {
  const [whole, fraction] = value.toFixed(decimals).split(".");

  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${fraction ? `,${fraction}` : ""}`;
}

const formatSize = (bytes: number) => (bytes >= 1048576 ? `${numberFormat(bytes / 1048576, 1)} MB` : `${numberFormat(Math.max(bytes / 1024, 1))} KB`);

/** Carbon::createFromTimestamp($t)->translatedFormat('d M Y[, H:i]') in Jakarta. */
function stamp(seconds: number, locale: AdminLocale, withTime: boolean): string {
  const jakarta = new Date(seconds * 1000 + 7 * 3600_000).toISOString();
  const day = `${jakarta.slice(8, 10)} ${(locale === "en" ? EN_MONTHS : SHORT_MONTHS)[Number(jakarta.slice(5, 7)) - 1]} ${jakarta.slice(0, 4)}`;

  return withTime ? `${day}, ${jakarta.slice(11, 16)}` : day;
}

export type MediaRow = {
  key: string;
  path: string;
  name: string;
  url: string;
  isImage: boolean;
  folder: string;
  type: string;
  size: string;
  date: string;
  day: string;
  source: string;
  sourceLabel: string;
  deletable: boolean;
};

export type MediaPage = { rows: MediaRow[]; total: number; counts: Record<string, number>; page: number; pageCount: number; from: number; to: number; view: ViewMode; search: string };

export const sourceLabels = (locale: AdminLocale): Record<string, string> => ({
  "": translate(locale, "Semua"),
  [SOURCE_UPLOADED]: translate(locale, "Unggahan"),
  [SOURCE_PRODUCT]: translate(locale, "Foto Produk"),
  [SOURCE_SITE]: translate(locale, "Aset Situs"),
});

export const viewMode = (value: string | null | undefined): ViewMode => (value && value in VIEWS ? (value as ViewMode) : DEFAULT_VIEW);

/** The page Livewire rendered for this search, source, display and page number. */
export async function mediaPage(query: { search: string; source: string; view: string; page: number }, access: StaffAccess, locale: AdminLocale): Promise<MediaPage> {
  const view = viewMode(query.view);
  const perPage = VIEWS[view];
  const results = await searchMedia(query.source || null, query.search);
  const everything = await searchMedia(null, query.search);
  const counts: Record<string, number> = { "": everything.length };

  for (const media of everything) {
    counts[media.source] = (counts[media.source] ?? 0) + 1;
  }

  const pageCount = Math.max(Math.ceil(results.length / perPage), 1);
  const page = Math.min(Math.max(query.page, 1), pageCount);
  const shown = results.slice((page - 1) * perPage, page * perPage);
  const labels = sourceLabels(locale);
  const canDelete = can(access, "Media:Hapus");
  const row = (media: MediaItem): MediaRow => ({
    key: `${media.source}:${media.path}`,
    path: media.path,
    name: media.name,
    url: media.url,
    isImage: media.isImage,
    folder: media.folder,
    type: media.name.includes(".") ? media.name.slice(media.name.lastIndexOf(".") + 1).toUpperCase() : "",
    size: formatSize(media.size),
    date: stamp(media.modified, locale, true),
    day: stamp(media.modified, locale, false),
    source: media.source,
    sourceLabel: labels[media.source],
    deletable: media.deletable && canDelete,
  });

  return { rows: shown.map(row), total: results.length, counts, page, pageCount, from: (page - 1) * perPage + 1, to: (page - 1) * perPage + shown.length, view, search: query.search };
}

/** GET /form/admin/media-file/daftar?cari=&sumber=&tampilan=&page=: Media:Lihat. */
export async function mediaPageAction(request: Request): Promise<Response> {
  const { access, locale, response } = await adminActionContext(request, (current) => can(current, "Media:Lihat"));

  if (response) {
    return response;
  }

  const params = new URL(request.url).searchParams;

  return Response.json(await mediaPage({ search: params.get("cari") ?? "", source: params.get("sumber") ?? "", view: params.get("tampilan") ?? "", page: Number(params.get("page") ?? 1) || 1 }, access, locale));
}

/**
 * POST /admin/media-file/unggah: the files dropped or picked (`saveDropped()`), at most
 * 20, images or PDF (SVG for Super Admin only), 8 MB each. A failed check is one danger
 * notification, as Laravel's catch block sends it.
 */
export async function uploadMediaAction(request: Request): Promise<Response> {
  const { access, locale, response } = await adminActionContext(request, (current) => can(current, "Media:Lihat"));

  if (response) {
    return response;
  }

  if (!can(access, "Media:Unggah")) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  // the `mimetypes` rule and guessExtension() go by what the file is (finfo), not by the browser's word
  const files = (await withSniffedTypes((await formBody(request)).files)).files ?? [];
  const allowed = uploadTypes(access, ACCEPTED_TYPES);
  const t = (text: string, replace?: Record<string, string | number>) => translate(locale, text, replace);
  const fail = (body: string) => toastJson(locale, { status: "danger", title: "Upload gagal", body });

  // the header's "Upload File" form: FilePond already checked type and size in the browser
  if (new URL(request.url).searchParams.has("form") && !files.length) {
    return validationErrorResponse({ files: [locale === "en" ? "The file field is required." : "Kolom file wajib diisi."] });
  }

  if (!files.length) {
    return fail(locale === "en" ? "The dropped field is required." : "Kolom dropped wajib diisi.");
  }

  if (files.length > 20) {
    return fail(t("Maksimal :max file sekali unggah.", { max: 20 }));
  }

  for (const file of files) {
    if (!allowed.includes(file.type)) {
      return fail(
        isSuperAdmin(access)
          ? t("Hanya gambar (JPG, PNG, GIF, WebP, SVG, AVIF) dan PDF yang bisa diunggah.")
          : t("Hanya gambar (JPG, PNG, GIF, WebP, AVIF) dan PDF yang bisa diunggah. SVG hanya bisa diunggah Super Admin."),
      );
    }

    if (file.size > MAX_SIZE_KB * 1024) {
      return fail(t("Ukuran file maksimal :max KB.", { max: MAX_SIZE_KB }));
    }
  }

  for (const file of files) {
    await storeMedia(file);
  }

  await forgetMedia();

  return toastJson(locale, { status: "success", title: ":count file diunggah.", replace: { count: files.length } });
}

/** POST /admin/media-file/hapus: Media:Hapus, and only a file uploaded here. */
export async function deleteMediaAction(request: Request): Promise<Response> {
  const { access, locale, response } = await adminActionContext(request, (current) => can(current, "Media:Lihat"));

  if (response) {
    return response;
  }

  if (!can(access, "Media:Hapus")) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const filePath = String((await formBody(request)).data.path ?? "");

  return (await deleteMedia(filePath)) ? toastJson(locale, { status: "success", title: "File dihapus." }) : Response.json({});
}
