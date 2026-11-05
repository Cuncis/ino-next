import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { can } from "@/lib/permissions";
import { newsletterLabels } from "@/server/admin/newsletter-labels";
import { findNewsletter, isDraft, subscribedTotal } from "@/server/admin/newsletters";
import { NewsletterForm } from "@/views/admin/NewsletterForm";

export const metadata: Metadata = { title: "Ubah Newsletter - Inofarma" };

/** GET /admin/newsletter/{id}/edit: EditNewsletter; once sent, the form is locked. */
export default async function Page({ params }: PageProps<"/admin/newsletter/[id]/edit">) {
  const context = await adminContext((access) => can(access, "Konten:Ubah"));
  const { access, locale, t } = context;
  const record = await findNewsletter(Number((await params).id));

  if (!record) {
    notFound();
  }

  const draft = isDraft(record);

  return (
    <AdminShell context={context} pathname={`/admin/newsletter/${record.id}/edit`}>
      <NewsletterForm
        mode="edit"
        record={{ id: record.id, draft }}
        locked={!draft}
        canChange={can(access, "Konten:Ubah")}
        initial={{ name: record.name, subject: record.subject, preview_text: record.previewText ?? "", content: record.content ?? "", custom_html: record.customHtml ?? "" }}
        breadcrumbs={[{ label: t("plural:Newsletter"), url: "/admin/newsletter" }, { label: record.name, url: `/admin/newsletter/${record.id}/edit` }, { label: t("Ubah") }]}
        heading={t("Ubah :label", { label: record.name })}
        labels={newsletterLabels(locale, await subscribedTotal())}
      />
    </AdminShell>
  );
}
