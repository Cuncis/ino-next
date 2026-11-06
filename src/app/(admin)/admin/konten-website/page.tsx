import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiIcon } from "@/components/admin/filament/Icon";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { EDITORS } from "@/server/admin/website-content";

export const metadata: Metadata = { title: "Konten Website - Inofarma" };

/** GET /admin/konten-website: WebsiteContent, a card per editor. */
export default async function Page() {
  const context = await adminContext((access) => can(access, "Konten:Lihat"));
  const { t } = context;

  return (
    <AdminShell context={context} pathname="/admin/konten-website">
      <FiPage header={<FiPageHeader heading={t("Konten Website")} />}>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("Ubah gambar dan teks halaman toko tanpa mengubah kode. Pilih halaman yang ingin diubah.")}</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {EDITORS.map((editor) => (
            <div key={editor.slug} className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400">
                  <FiIcon name={editor.icon} className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-gray-950 dark:text-white">{t(editor.navigation)}</h2>
              </div>
              <p className="flex-1 text-sm text-gray-500 dark:text-gray-400">{t(editor.description)}</p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`/admin/konten-website/${editor.slug}`}
                  className="fi-color fi-color-primary fi-bg-color-400 hover:fi-bg-color-300 dark:fi-bg-color-600 dark:hover:fi-bg-color-700 fi-text-color-950 hover:fi-text-color-800 dark:fi-text-color-0 dark:hover:fi-text-color-0 fi-btn fi-size-sm"
                >
                  <FiIcon name="o-pencil-square" size="sm" />
                  {t("Ubah Konten")}
                </a>
                {editor.storefrontUrl ? (
                  <a href={editor.storefrontUrl} target="_blank" className="fi-color fi-color-primary fi-text-color-700 dark:fi-text-color-400 fi-link fi-size-sm">
                    <FiIcon name="o-arrow-top-right-on-square" size="sm" />
                    <span className="fi-link-label">{t("Lihat halaman")}</span>
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </FiPage>
    </AdminShell>
  );
}
