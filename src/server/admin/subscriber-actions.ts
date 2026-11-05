import { eq } from "drizzle-orm";
import { db, subscribers } from "@/db";
import { translate } from "@/lib/admin-i18n";
import { can } from "@/lib/permissions";
import { validate, validationErrorResponse } from "@/lib/validation";
import { csvDownload, exportStamp } from "@/server/catalog/catalog-export";
import { SUBSCRIBED } from "@/server/newsletter/subscribers";
import { adminActionContext, toastJson } from "./action-response";
import { formBody } from "./form-body";
import { exportSubscribers, findSubscriber, importSubscribers } from "./subscribers";

/** Subscriber behind /admin/subscriber/…: Import CSV, Export CSV and Berhentikan. */
const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** POST /admin/subscriber/impor (Konten:Ubah). */
export async function importSubscribersAction(request: Request): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Konten:Ubah"));

  if (response) {
    return response;
  }

  const [file] = (await formBody(request)).files.file ?? [];

  if (!file) {
    return validationErrorResponse({ file: validate({}, { file: ["required"] }, {}, { file: lcfirst(translate(locale, "File CSV")) }, locale).errors!.file });
  }

  const result = await importSubscribers(new TextDecoder("utf-8", { ignoreBOM: true }).decode(await file.arrayBuffer()));

  return toastJson(locale, { status: "success", title: "Import selesai", body: ":imported ditambahkan, :duplicates sudah ada, :invalid tidak valid.", replace: result });
}

/** GET /form/admin/subscriber/ekspor?search=&filter_status=: the list as filtered on screen (Konten:Lihat). */
export async function exportSubscribersAction(request: Request): Promise<Response> {
  const { response } = await adminActionContext(request, (access) => can(access, "Konten:Lihat"));

  if (response) {
    return response;
  }

  const params = new URL(request.url).searchParams;

  return csvDownload(await exportSubscribers({ search: params.get("search") ?? undefined, status: params.get("filter_status") || undefined }), `subscriber-${exportStamp()}.csv`);
}

/** POST /admin/subscriber/{id}/berhentikan: only a subscribed address (Konten:Ubah). */
export async function unsubscribeAction(request: Request, id: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Konten:Ubah"));

  if (response) {
    return response;
  }

  const subscriber = await findSubscriber(Number(id));

  if (!subscriber) {
    return Response.json({ message: "Not Found" }, { status: 404 });
  }

  if (subscriber.status === SUBSCRIBED) {
    const now = new Date();

    await db.update(subscribers).set({ status: "berhenti", unsubscribedAt: now, updatedAt: now }).where(eq(subscribers.id, subscriber.id));
  }

  return toastJson(locale, { status: "success", title: "Langganan dihentikan." });
}
