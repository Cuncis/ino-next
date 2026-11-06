import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can, uploadTypes } from "@/lib/permissions";
import { mediaPage, sourceLabels, viewMode } from "@/server/admin/media-actions";
import { ACCEPTED_TYPES, DEFAULT_VIEW, MAX_SIZE_KB } from "@/server/admin/media-library";
import { actionForm } from "@/server/admin/stock-forms";
import { queryString } from "@/server/admin/list-labels";
import { MediaFiles } from "@/views/admin/MediaFiles";

export const metadata: Metadata = { title: "Media File - Inofarma" };

/** GET /admin/media-file?cari=&sumber=&tampilan=: MediaFiles (Media:Lihat; uploading needs Media:Unggah). */
export default async function Page({ searchParams }: PageProps<"/admin/media-file">) {
  const context = await adminContext((access) => can(access, "Media:Lihat"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const search = queryString(query.cari);
  const source = queryString(query.sumber);
  const view = viewMode(queryString(query.tampilan));
  const initial = await mediaPage({ search, source, view, page: 1 }, access, locale);
  const canUpload = can(access, "Media:Unggah");
  const accept = uploadTypes(access, ACCEPTED_TYPES);
  const labels = sourceLabels(locale);

  return (
    <AdminShell context={context} pathname="/admin/media-file">
      <FiPage
        header={
          <FiPageHeader
            heading={t("Media File")}
            actions={
              canUpload ? (
                <FiHeaderActions
                  actions={[
                    {
                      key: "upload",
                      label: t("Upload File"),
                      icon: "o-arrow-up-tray",
                      endpoint: "/admin/media-file/unggah?form=1",
                      form: actionForm(locale, t("Upload File"), [{ kind: "file" as const, name: "files", label: t("File"), required: true, multiple: true, accept, maxSizeKb: MAX_SIZE_KB }]),
                    },
                  ]}
                  labels={{ close: t("Tutup"), cancel: t("Batal") }}
                />
              ) : null
            }
          />
        }
      >
        <MediaFiles
          initial={initial}
          query={{ search, source, view }}
          sources={Object.entries(labels).map(([value, label]) => ({ value, label }))}
          views={["daftar", "kecil", "sedang", "besar"].map((value) => ({ value, label: t(value.charAt(0).toUpperCase() + value.slice(1)) }))}
          canUpload={canUpload}
          accept={accept}
          maxSizeMb={MAX_SIZE_KB / 1024}
          defaultView={DEFAULT_VIEW}
          labels={{
            confirmDelete: t("Hapus file ini? Halaman yang memakai tautannya akan kehilangan gambar."),
            uploadFailed: t("Upload gagal"),
            uploading: t("Mengunggah…"),
            dropHere: t("Lepaskan file untuk mengunggah"),
            dropHint: t("Gambar atau PDF, maksimal :size MB per file."),
            source: t("Sumber"),
            searchPlaceholder: t("Cari nama file…"),
            count: t(":count file"),
            display: t("Tampilan"),
            noMatch: t("Tidak ada file yang cocok."),
            empty: t("Belum ada file."),
            tryOther: t("Coba kata kunci lain atau pilih sumber lain."),
            dragOr: t("Seret file ke sini untuk mengunggah, atau"),
            pick: t("Pilih file"),
            name: t("Nama"),
            size: t("Ukuran"),
            date: t("Tanggal"),
            actions: t("Aksi"),
            copy: t("Salin tautan"),
            copied: t("Tersalin!"),
            delete: t("Hapus"),
            showing: t("Menampilkan :from-:to dari :total"),
            previous: t("Sebelumnya"),
            next: t("Berikutnya"),
            details: t("Detail file"),
            close: t("Tutup"),
            type: t("Tipe"),
            dimensions: t("Dimensi"),
            link: t("Tautan file"),
            open: t("Buka di tab baru"),
            deleteForever: t("Hapus permanen"),
          }}
        />
      </FiPage>
    </AdminShell>
  );
}
