import { translate } from "@/lib/admin-i18n";
import { jsonBody } from "@/lib/http";
import { validationErrorResponse } from "@/lib/validation";
import { staffForAction } from "@/server/admin/staff-guard";
import { activateTwoFactor, confirmTwoFactor, disableTwoFactor, regenerateRecoveryCodes } from "@/server/admin/two-factor";

/**
 * POST /admin/keamanan/{aktifkan|konfirmasi|kode-baru|nonaktifkan}: the Security page's
 * header actions. Each answers with the toast to show, and new recovery codes when made
 * (shown once, as Laravel flashed them for one request).
 */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/keamanan/[action]">) {
  const { staff, locale, response } = await staffForAction(request);

  if (response) {
    return response;
  }

  const t = (text: string) => translate(locale, text);

  switch ((await params).action) {
    case "aktifkan":
      return Response.json({
        recoveryCodes: await activateTwoFactor(staff),
        toast: { status: "success", title: t("Pindai kode QR dengan aplikasi authenticator Anda, lalu konfirmasi kodenya.") },
      });
    case "konfirmasi": {
      const code = String((await jsonBody(request)).code ?? "").trim();

      if (code === "") {
        return validationErrorResponse({ code: [locale === "en" ? "The authenticator code field is required." : "Kolom kode authenticator wajib diisi."] });
      }

      if (!(await confirmTwoFactor(staff, code))) {
        return validationErrorResponse({ code: ["Kode tidak valid."] });
      }

      return Response.json({ toast: { status: "success", title: t("Autentikasi dua faktor aktif.") } });
    }
    case "kode-baru":
      return Response.json({ recoveryCodes: await regenerateRecoveryCodes(staff), toast: { status: "success", title: t("Kode pemulihan baru telah dibuat.") } });
    case "nonaktifkan":
      await disableTwoFactor(staff);

      return Response.json({ toast: { status: "success", title: t("Autentikasi dua faktor dinonaktifkan.") } });
    default:
      return Response.json({ message: "Not Found" }, { status: 404 });
  }
}
