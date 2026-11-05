import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { can } from "@/lib/permissions";
import { newsletterLabels } from "@/server/admin/newsletter-labels";
import { NewsletterForm } from "@/views/admin/NewsletterForm";

export const metadata: Metadata = { title: "Buat Newsletter - Inofarma" };

/** GET /admin/newsletter/create: CreateNewsletter, which opens the new one's edit page. */
export default async function Page() {
  const context = await adminContext((access) => can(access, "Konten:Ubah"));
  const { locale, t } = context;

  return (
    <AdminShell context={context} pathname="/admin/newsletter/create">
      <NewsletterForm
        mode="create"
        locked={false}
        canChange
        initial={{ name: "", subject: "", preview_text: "", content: "", custom_html: "" }}
        breadcrumbs={[{ label: t("plural:Newsletter"), url: "/admin/newsletter" }, { label: t("Buat") }]}
        heading={t("Buat :label", { label: t("Newsletter") })}
        labels={newsletterLabels(locale, 0)}
      />
    </AdminShell>
  );
}
