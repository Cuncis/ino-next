import { previousUrl, redirectResponse } from "@/lib/http";
import { isAdminLocale } from "@/lib/admin-i18n";
import { setStaffLocale } from "@/server/admin/staff-auth";
import { staffForAction } from "@/server/admin/staff-guard";
import { errorPageResponse } from "@/server/error-page";

/** POST /admin/bahasa/{locale} (admin). LocaleController: id or en for this session, then back. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/bahasa/[locale]">) {
  const { response } = await staffForAction(request);

  if (response) {
    return response;
  }

  const { locale } = await params;

  if (!isAdminLocale(locale)) {
    return errorPageResponse(404, "Not Found");
  }

  await setStaffLocale(locale);

  return redirectResponse(previousUrl(request, "/admin"), 303);
}
