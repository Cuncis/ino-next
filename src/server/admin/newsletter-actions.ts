import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { withSniffedTypes } from "@/lib/sniff-mime";
import { sendMail } from "@/lib/mail";
import { can } from "@/lib/permissions";
import { dispatch } from "@/lib/queue";
import { randomString } from "@/lib/random";
import { publicDisk } from "@/lib/storage";
import { validate, validationErrorResponse } from "@/lib/validation";
import { newsletterEmail, type Newsletter } from "@/server/newsletter/newsletter-mail";
import type { Subscriber } from "@/server/newsletter/subscribers";
import { isPhpValidEmail } from "@/lib/php-email";
import { adminActionContext, toastJson } from "./action-response";
import { formBody } from "./form-body";
import { claimForSending, createNewsletter, deleteNewsletter, findNewsletter, isDraft, updateNewsletter, validateNewsletterForm } from "./newsletters";

/**
 * Newsletter behind /admin/newsletter/…: the form, its delete, Pratinjau and Kirim Email
 * Uji (both of what is on screen, unsaved edits included), Kirim ke Subscriber (which
 * saves first), and the editor's image upload. All need Konten:Ubah except the preview.
 */
const notFound = () => Response.json({ message: "Not Found" }, { status: 404 });
const unauthorized = () => Response.json({ message: "This action is unauthorized." }, { status: 403 });

/** A stand-in subscriber for a preview or a test email: no real person, no real unsubscribe link. */
const standIn = (email: string, token: string) => ({ email, unsubscribeToken: token }) as Subscriber;

/**
 * The newsletter as it is on screen: the saved one with the form's values over it
 * (`replicate()->forceFill($this->form->getState())`), after the form's own rules. A
 * newsletter no longer a draft has a disabled form, so it is the saved one.
 */
function onScreen(saved: Newsletter | null, body: Record<string, unknown>, locale: AdminLocale): { newsletter: Newsletter; errors: null } | { newsletter: null; errors: Record<string, string[]> } {
  if (saved && !isDraft(saved)) {
    return { newsletter: saved, errors: null };
  }

  const result = validateNewsletterForm(body, locale);

  if (!result.data) {
    return { newsletter: null, errors: result.errors };
  }

  const base = saved ?? ({ id: 0, status: "draf", sentAt: null, recipientCount: 0, successCount: 0, failedCount: 0, createdAt: null, updatedAt: null } as Newsletter);

  return { newsletter: { ...base, ...result.data }, errors: null };
}

/** POST /admin/newsletter/buat: CreateNewsletter, then its edit page. */
export async function createNewsletterAction(request: Request): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Konten:Ubah"));

  if (response) {
    return response;
  }

  const { data } = await formBody(request);
  const result = validateNewsletterForm(data, locale);

  if (!result.data) {
    return validationErrorResponse(result.errors);
  }

  const newsletter = await createNewsletter(result.data);

  return toastJson(locale, { status: "success", title: "Data berhasil dibuat" }, { redirect: data.another ? "/admin/newsletter/create" : `/admin/newsletter/${newsletter.id}/edit` });
}

/** POST /admin/newsletter/pratinjau (a new one) or /admin/newsletter/{id}/pratinjau: the email as HTML, for the preview's iframe. */
export async function previewNewsletterAction(request: Request, id: string | null): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Konten:Lihat"));

  if (response) {
    return response;
  }

  const saved = id === null ? null : await findNewsletter(Number(id));

  if (id !== null && !saved) {
    return notFound();
  }

  const { data } = await formBody(request);
  // a list row previews the record as saved; the edit page sends its form
  const result = data.saved ? { newsletter: saved!, errors: null } : onScreen(saved, data, locale);

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  return Response.json({ html: newsletterEmail(result.newsletter, standIn("", "pratinjau")).html });
}

/** POST /admin/newsletter/{id}/{simpan|hapus|uji|kirim}. */
export async function newsletterAction(request: Request, id: string, action: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Konten:Ubah"));

  if (response) {
    return response;
  }

  const newsletter = await findNewsletter(Number(id));

  if (!newsletter) {
    return notFound();
  }

  const { data } = await formBody(request);

  switch (action) {
    case "simpan": {
      const result = onScreen(newsletter, data, locale);

      if (result.errors) {
        return validationErrorResponse(result.errors);
      }

      await updateNewsletter(newsletter, result.newsletter);

      return toastJson(locale, { status: "success", title: "Data berhasil disimpan" });
    }
    case "hapus":
      // DeleteAction is only there for a draft
      if (!isDraft(newsletter)) {
        return unauthorized();
      }

      await deleteNewsletter(newsletter.id);

      return toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, { redirect: "/admin/newsletter" });
    case "uji":
      return sendTest(newsletter, data, locale);
    case "kirim":
      return send(newsletter, data, locale);
    default:
      return notFound();
  }
}

/** "Kirim Email Uji": the newsletter on screen to each address typed, marked as a test. */
async function sendTest(saved: Newsletter, body: Record<string, unknown>, locale: AdminLocale): Promise<Response> {
  const emails = Array.isArray(body.emails) ? body.emails.map(String) : [];
  // the field's label with a lowercase first letter, as Filament names it in messages
  const attribute = ((label: string) => label.charAt(0).toLowerCase() + label.slice(1))(translate(locale, "Alamat Email"));
  let errors = validate<Record<string, unknown>>({ emails }, { emails: ["required"] }, {}, { emails: attribute }, locale).errors;

  emails.forEach((email, index) => {
    if (!isPhpValidEmail(email) && !errors?.emails) {
      errors = { ...(errors ?? {}), [`emails.${index}`]: validate({ email }, { email: ["email"] }, {}, { email: attribute }, locale).errors?.email ?? [] };
    }
  });

  if (errors) {
    return validationErrorResponse(errors);
  }

  const result = onScreen(saved, body, locale);

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  for (const email of emails) {
    await sendMail(newsletterEmail(result.newsletter, standIn(email, "uji-coba"), true));
  }

  return toastJson(locale, { status: "success", title: "Email uji dikirim ke :count alamat.", replace: { count: emails.length } });
}

/** "Kirim ke Subscriber": the form saved first, so what goes out is what is on screen. */
async function send(newsletter: Newsletter, body: Record<string, unknown>, locale: AdminLocale): Promise<Response> {
  if (!isDraft(newsletter)) {
    return unauthorized();
  }

  // save(shouldRedirect: false) first, with its own "saved" notification
  const toasts: { status: string; title: string }[] = [];

  if (body.save) {
    const result = onScreen(newsletter, body, locale);

    if (result.errors) {
      return validationErrorResponse(result.errors);
    }

    await updateNewsletter(newsletter, result.newsletter);
    toasts.push({ status: "success", title: translate(locale, "Data berhasil disimpan") });
  }

  const { recipients, claimed } = await claimForSending(newsletter.id);

  if (recipients === 0) {
    toasts.push({ status: "danger", title: translate(locale, "Belum ada subscriber yang berlangganan.") });
  } else if (claimed) {
    await dispatch("send-newsletter", { newsletterId: newsletter.id });
    toasts.push({ status: "success", title: translate(locale, "Newsletter sedang dikirim ke :count subscriber.", { count: recipients }) });
  }

  return Response.json({ toasts });
}

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/**
 * POST /admin/newsletter/lampiran: an image for the editor (png, jpeg, webp or gif, 2 MB
 * at most) on the public disk under newsletters/, named as Laravel's hashName() names it.
 */
export async function uploadAttachmentAction(request: Request): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Konten:Ubah"));

  if (response) {
    return response;
  }

  const [file] = (await withSniffedTypes((await formBody(request)).files)).file ?? [];
  const attribute = { file: translate(locale, "file") };

  if (!file) {
    return validationErrorResponse({ file: validate({}, { file: ["required"] }, {}, attribute, locale).errors!.file });
  }

  const extension = IMAGE_TYPES[file.type];

  if (!extension) {
    return validationErrorResponse({ file: [translate(locale, "Kolom :attribute harus berupa berkas berjenis: :values.", { attribute: attribute.file, values: Object.keys(IMAGE_TYPES).join(", ") })] });
  }

  if (file.size > 2048 * 1024) {
    return validationErrorResponse({ file: [translate(locale, "Kolom :attribute maksimal berukuran :max kilobita.", { attribute: attribute.file, max: 2048 })] });
  }

  const path = `newsletters/${randomString(40)}.${extension}`;
  const disk = publicDisk();

  await disk.put(path, Buffer.from(await file.arrayBuffer()), file.type);

  return Response.json({ id: path, src: disk.url(path) });
}
