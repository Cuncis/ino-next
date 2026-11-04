import { createTransferAction } from "@/server/admin/inventory-actions";

/** POST /admin/inventaris/transfer/buat: Minta Transfer. */
export const POST = (request: Request) => createTransferAction(request);
