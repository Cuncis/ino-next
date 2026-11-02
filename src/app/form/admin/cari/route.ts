import { loadStaffAccess } from "@/lib/permissions";
import { globalSearch } from "@/server/admin/global-search";
import { staffForAction } from "@/server/admin/staff-guard";

/** GET /form/admin/cari?q=…: Filament's global search across the ported resources. */
export async function GET(request: Request) {
  const { staff, locale, response } = await staffForAction(request);

  if (response) {
    return response;
  }

  const term = new URL(request.url).searchParams.get("q") ?? "";

  return Response.json({ groups: await globalSearch(term, staff, await loadStaffAccess(staff.id), locale) });
}
