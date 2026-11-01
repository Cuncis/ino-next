import { redirectTo } from "@/lib/http";
import { auditLog } from "@/server/audit";
import { logoutStaff } from "@/server/admin/staff-auth";
import { staffForAction } from "@/server/admin/staff-guard";

/** POST /admin/keluar (admin). AdminAuthController::logout(): audited, then the sign-in page. */
export async function POST(request: Request) {
  const { staff, response } = await staffForAction(request);

  if (response) {
    return response;
  }

  await auditLog({ action: "logout", auditable: { type: "App\\Models\\User", id: staff.id }, userId: staff.id, branchId: staff.branchId });
  await logoutStaff();

  return redirectTo(request, "/admin/masuk");
}
