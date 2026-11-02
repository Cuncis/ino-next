import { and, inArray } from "drizzle-orm";
import { db, orders } from "@/db";
import { branchScope } from "@/lib/branch-scope";
import { jsonBody } from "@/lib/http";
import { adminActionContext, idsFrom, toastJson } from "@/server/admin/action-response";
import { authorizes, forceDeleteOrders, ORDER_PERMISSIONS, restoreOrders, softDeleteOrders } from "@/server/admin/orders";

/**
 * POST /admin/pesanan/massal/{hapus|hapus-permanen|pulihkan}: the list's bulk actions on the
 * selected orders of the staff member's branch. Like Filament's DeleteBulkAction, a bulk
 * delete doesn't stop at completed orders (only the single delete does).
 */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pesanan/massal/[action]">) {
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, ORDER_PERMISSIONS, "delete"));

  if (response) {
    return response;
  }

  const requested = idsFrom(await jsonBody(request));
  const ids = requested.length
    ? (
        await db
          .select({ id: orders.id })
          .from(orders)
          .where(and(inArray(orders.id, requested), branchScope(orders.branchId, staff)))
      ).map((order) => order.id)
    : [];

  switch ((await params).action) {
    case "hapus":
      await softDeleteOrders(ids);

      return toastJson(locale, { status: "success", title: "Data berhasil dihapus" });
    case "hapus-permanen":
      return (await forceDeleteOrders(ids)) ? toastJson(locale, { status: "success", title: "Data berhasil dihapus" }) : toastJson(locale, { status: "danger", title: "Gagal menghapus" });
    case "pulihkan":
      await restoreOrders(ids);

      return toastJson(locale, { status: "success", title: "Data berhasil dipulihkan" });
    default:

      return Response.json({ message: "Not Found" }, { status: 404 });
  }
}
