import { staffForAction } from "@/server/admin/staff-guard";

/**
 * GET /form/admin/cari?q=…: Filament's global search. Resources with a record title
 * (Pesanan, Produk, Pelanggan, …) add their search here as they are ported; none yet.
 */
export async function GET(request: Request) {
  const { response } = await staffForAction(request);

  return response ?? Response.json({ groups: [] });
}
