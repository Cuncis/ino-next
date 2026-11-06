import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiIcon } from "@/components/admin/filament/Icon";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { editorSchema, editorState, editorTitle, findEditor } from "@/server/admin/website-content";
import { queryString } from "@/server/admin/list-labels";
import { ContentEditor } from "@/views/admin/ContentEditor";

export const metadata: Metadata = { title: "Konten Website - Inofarma" };

/** GET /admin/konten-website/{slug}: one ContentEditorPage. Read-only without Konten:Ubah. */
export default async function Page({ params, searchParams }: PageProps<"/admin/konten-website/[slug]">) {
  const context = await adminContext((access) => can(access, "Konten:Lihat"));
  const { access, locale, t } = context;
  const editor = findEditor((await params).slug);

  if (!editor) {
    notFound();
  }

  return (
    <AdminShell context={context} pathname={`/admin/konten-website/${editor.slug}`}>
      <FiPage
        header={
          <FiPageHeader
            heading={editorTitle(editor, locale)}
            actions={
              editor.storefrontUrl ? (
                <a href={editor.storefrontUrl} target="_blank" className="fi-ac-btn-action fi-btn fi-size-md">
                  <FiIcon name="o-arrow-top-right-on-square" />
                  {t("Lihat di Toko")}
                </a>
              ) : null
            }
          />
        }
      >
        <ContentEditor
          endpoint={`/admin/konten-website/${editor.slug}/simpan`}
          schema={await editorSchema(editor, locale, access)}
          initial={await editorState(editor)}
          canEdit={can(access, "Konten:Ubah")}
          query={Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, queryString(value)]))}
          labels={{
            save: t("Simpan"),
            hint: t("Perubahan langsung tampil di toko setelah disimpan."),
            collapseAll: t("Sembunyikan semua"),
            expandAll: t("Tampilkan semua"),
            move: t("Pindahkan"),
            moveUp: t("Naikkan"),
            moveDown: t("Turunkan"),
            remove: t("Hapus"),
            collapse: t("Sembunyikan"),
            expand: t("Tampilkan"),
          }}
        />
      </FiPage>
    </AdminShell>
  );
}
