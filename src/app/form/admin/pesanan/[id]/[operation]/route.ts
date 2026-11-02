import { jsonBody } from "@/lib/http";
import { adminActionContext, toastJson } from "@/server/admin/action-response";
import { authorizes, findAdminOrder, forceDeleteOrders, isDeletable, ORDER_PERMISSIONS, restoreOrders, softDeleteOrders } from "@/server/admin/orders";

/**
 * POST /admin/pesanan/{id}/{hapus|hapus-permanen|pulihkan}: delete one order (not a
 * completed one), or remove or restore a deleted one. Super Admin only. From the edit
 * page (`back: "list"`) a removal goes back to the list.
 */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pesanan/[id]/[operation]">) {
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, ORDER_PERMISSIONS, "delete"));

  if (response) {
    return response;
  }

  const { id, operation } = await params;
  const order = await findAdminOrder(Number(id), staff);

  if (!order) {
    return Response.json({ message: "Not Found" }, { status: 404 });
  }

  const toList = (await jsonBody(request)).back === "list" ? { redirect: "/admin/pesanan" } : {};

  switch (operation) {
    case "hapus":
      if (!isDeletable(order)) {
        return toastJson(locale, { status: "danger", title: "Pesanan #:number sudah selesai dan tidak bisa dihapus.", replace: { number: order.number }, body: "Batalkan pesanan bila perlu." });
      }

      await softDeleteOrders([order.id]);

      return toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList);
    case "hapus-permanen":
      return (await forceDeleteOrders([order.id]))
        ? toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList)
        : toastJson(locale, { status: "danger", title: "Gagal menghapus" });
    case "pulihkan":
      await restoreOrders([order.id]);

      return toastJson(locale, { status: "success", title: "Data berhasil dipulihkan" });
    default:
      return Response.json({ message: "Not Found" }, { status: 404 });
  }
}
