import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { authorizes, can } from "@/lib/permissions";
import { validate, validationErrorResponse } from "@/lib/validation";
import { csvDownload, exportStamp, exportStock, stockSample } from "@/server/catalog/catalog-export";
import { importStockFile } from "@/server/catalog/catalog-import";
import { CsvError, groupFailures } from "@/server/catalog/csv";
import { InsufficientStockError } from "@/server/inventory/stock-allocator";
import { cancelTransfer, receiveTransfer, shipTransfer, TransferError } from "@/server/inventory/stock-transfers";
import { reconcilePayment } from "@/server/payments/doku-payment";
import { adminActionContext, toastJson } from "./action-response";
import { createTransfer, findInvoice, findPayment, findTransfer, recordRefund, TRANSFER_PERMISSIONS } from "./finance-transfers";
import { formBody } from "./form-body";
import { findAdminProduct } from "./products";
import { adjustGoods, findBranchStock, receiveGoods, searchStockableProducts } from "./stock";
import { staffForAction } from "./staff-guard";

/**
 * The actions of Inventaris (Stok, Transfer), the product page's two stock buttons,
 * Faktur's refund and Rekonsiliasi's status check, behind /admin/… (the proxy sends each
 * POST to /form/admin/…).
 */
const notFound = () => Response.json({ message: "Not Found" }, { status: 404 });

async function received(locale: AdminLocale, result: Awaited<ReturnType<typeof receiveGoods>>): Promise<Response> {
  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  return toastJson(locale, { status: "success", title: ':quantity ":name" diterima di :name2.', replace: { quantity: result.quantity, name: result.productName, name2: result.branchName } });
}

function adjusted(locale: AdminLocale, result: Awaited<ReturnType<typeof adjustGoods>>): Response {
  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  return result.refused
    ? toastJson(locale, { status: "danger", title: result.refused })
    : toastJson(locale, { status: "success", title: 'Stok ":name" di :name2 disesuaikan.', replace: { name: result.productName, name2: result.branchName } });
}

/** POST /admin/inventaris/stok/{id}/{sesuaikan|terima}: the list's row actions. */
export async function stockRowAction(request: Request, id: string, action: string): Promise<Response> {
  const permission = action === "sesuaikan" ? "Inventaris:Sesuaikan Stok" : "Inventaris:Terima Barang";
  const { staff, locale, response } = await adminActionContext(request, (access) => can(access, permission));

  if (response) {
    return response;
  }

  const stock = await findBranchStock(Number(id), staff);

  if (!stock || (action !== "sesuaikan" && action !== "terima")) {
    return notFound();
  }

  const { data } = await formBody(request);

  return action === "sesuaikan"
    ? adjusted(locale, await adjustGoods(data, staff, locale, { productId: stock.productId, branchId: stock.branchId }))
    : received(locale, await receiveGoods(data, staff, locale, { productId: stock.productId, branchId: stock.branchId }));
}

/** POST /admin/inventaris/stok/awal: "Tambah Stok Awal", a branch and product's first batch. */
export async function initialStockAction(request: Request): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, (access) => can(access, "Inventaris:Terima Barang"));

  return response ?? received(locale, await receiveGoods((await formBody(request)).data, staff, locale, {}));
}

/** POST /admin/produk/{id}/{terima-barang|sesuaikan-stok}: ViewProduct's buttons, asking for the branch. */
export async function productStockAction(request: Request, id: string, action: string): Promise<Response> {
  const permission = action === "sesuaikan-stok" ? "Inventaris:Sesuaikan Stok" : "Inventaris:Terima Barang";
  const { staff, locale, response } = await adminActionContext(request, (access) => can(access, permission));

  if (response) {
    return response;
  }

  const product = await findAdminProduct(Number(id));

  if (!product || (action !== "terima-barang" && action !== "sesuaikan-stok")) {
    return notFound();
  }

  const { data } = await formBody(request);

  return action === "sesuaikan-stok" ? adjusted(locale, await adjustGoods(data, staff, locale, { productId: product.id })) : received(locale, await receiveGoods(data, staff, locale, { productId: product.id }));
}

/** GET /form/admin/inventaris/produk-cari?search=: "Tambah Stok Awal"'s product search. */
export async function stockProductSearch(request: Request): Promise<Response> {
  const { response } = await adminActionContext(request, (access) => can(access, "Inventaris:Terima Barang"));

  return response ?? Response.json(await searchStockableProducts(new URL(request.url).searchParams.get("search") ?? ""));
}

/** POST /admin/inventaris/stok/impor: "Import Stok". Failures fold into the toast, five causes at most. */
export async function importStockAction(request: Request): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, (access) => can(access, "Inventaris:Sesuaikan Stok"));

  if (response) {
    return response;
  }

  const [file] = (await formBody(request)).files.file ?? [];
  const t = (text: string, replace?: Record<string, string | number>) => translate(locale, text, replace);

  if (!file) {
    return validationErrorResponse({ file: [validate({}, { file: ["required"] }, {}, { file: lcfirst(t("File CSV")) }, locale).errors!.file[0]] });
  }

  try {
    const result = await importStockFile({
      content: new TextDecoder("utf-8", { ignoreBOM: true }).decode(await file.arrayBuffer()),
      fileName: file.name,
      restrictToBranchId: staff.branchId,
      userId: staff.id,
      locale,
    });
    const failures = groupFailures(result.failed);
    const title = t("Import stok selesai: :groups produk per cabang diperbarui.", { groups: result.groups });

    if (!failures.length) {
      return Response.json({ toast: { status: "success", title } });
    }

    const body = failures
      .slice(0, 5)
      .map(
        (failure) =>
          `${failure.message} (${t(":count baris", { count: failure.count })}: ${t("Baris :rows", { rows: failure.rows.join(", ") })}${failure.more > 0 ? `, ${t("dan :count lainnya", { count: failure.more })}` : ""})`,
      )
      .join("\n");

    return Response.json({ toast: { status: "warning", title, body, persistent: true } });
  } catch (error) {
    if (error instanceof CsvError) {
      return toastJson(locale, { status: "danger", title: "Import gagal", body: error.message });
    }

    throw error;
  }
}

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** GET /form/admin/inventaris/stok/{ekspor|template}: "Export Stok" and "Unduh Template Stok". */
export async function stockDownloadAction(request: Request, which: "ekspor" | "template"): Promise<Response> {
  const guard = await staffForAction(request);

  if (guard.response) {
    return guard.response;
  }

  return which === "ekspor" ? csvDownload(await exportStock(guard.staff), `stok-${exportStamp()}.csv`) : csvDownload(stockSample(), "template-stok.csv");
}

/* ---------------- Transfer ---------------- */

/** POST /admin/inventaris/transfer/buat: CreateStockTransfer, then its page. */
export async function createTransferAction(request: Request): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, TRANSFER_PERMISSIONS, "create"));

  if (response) {
    return response;
  }

  const { data } = await formBody(request);
  const result = await createTransfer(data, staff, locale);

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  return toastJson(locale, { status: "success", title: "Data berhasil dibuat" }, { redirect: data.another ? "/admin/inventaris/transfer/create" : `/admin/inventaris/transfer/${result.id}` });
}

/** POST /admin/inventaris/transfer/{id}/{kirim|terima|batalkan}: each on its own side of the transfer. */
export async function transferStepAction(request: Request, id: string, step: string): Promise<Response> {
  const permission = step === "terima" ? "Inventaris:Terima Barang" : "Inventaris:Sesuaikan Stok";
  const { staff, locale, response } = await adminActionContext(request, (access) => can(access, permission));

  if (response) {
    return response;
  }

  const transfer = await findTransfer(Number(id), staff);

  if (!transfer) {
    return notFound();
  }

  const side = step === "terima" ? transfer.toBranchId : transfer.fromBranchId;

  if (staff.branchId !== null && staff.branchId !== side) {
    return Response.json({ message: "This action is unauthorized." }, { status: 403 });
  }

  try {
    switch (step) {
      case "kirim":
        await shipTransfer(transfer, staff.id);

        return toastJson(locale, { status: "success", title: "Transfer :code dikirim dari :name.", replace: { code: transfer.code, name: transfer.fromName ?? "" } });
      case "terima":
        await receiveTransfer(transfer, staff.id);

        return toastJson(locale, { status: "success", title: "Transfer :code diterima di :name.", replace: { code: transfer.code, name: transfer.toName ?? "" } });
      case "batalkan":
        await cancelTransfer(transfer);

        return toastJson(locale, { status: "success", title: "Transfer :code dibatalkan.", replace: { code: transfer.code } });
      default:
        return notFound();
    }
  } catch (error) {
    // StockTransferManager's refusals and a stock shortfall, both RuntimeExceptions in Laravel
    if (error instanceof TransferError || error instanceof InsufficientStockError) {
      return toastJson(locale, { status: "danger", title: error.message });
    }

    throw error;
  }
}

/* ---------------- Faktur and Rekonsiliasi ---------------- */

/** POST /admin/faktur/{id}/refund: "Catat Refund" (needs Pesanan:Refund and a paid invoice). */
export async function refundAction(request: Request, id: string): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, (access) => can(access, "Pesanan:Refund"));

  if (response) {
    return response;
  }

  const invoice = await findInvoice(Number(id), staff);

  if (!invoice) {
    return notFound();
  }

  if (invoice.paymentStatus !== "lunas") {
    return Response.json({ message: "This action is unauthorized." }, { status: 403 });
  }

  const result = validate<{ note: string }>((await formBody(request)).data, { note: ["required", "max:500"] }, {}, { note: lcfirst(translate(locale, "Catatan")) }, locale);

  if (!result.data) {
    return validationErrorResponse(result.errors);
  }

  await recordRefund(invoice, result.data.note, staff);

  return toastJson(locale, { status: "success", title: "Refund untuk #:number dicatat.", replace: { number: invoice.number } });
}

/** POST /admin/rekonsiliasi/{id}/cek-status: asks DOKU about a payment still pending. */
export async function checkPaymentAction(request: Request, id: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Pesanan:Proses"));

  if (response) {
    return response;
  }

  const payment = await findPayment(Number(id));

  if (!payment || payment.status !== "pending") {
    return notFound();
  }

  let result;

  try {
    result = await reconcilePayment(payment);
  } catch (error) {
    console.error(error);

    return toastJson(locale, { status: "danger", title: "Gagal menghubungi DOKU. Coba lagi sebentar lagi." });
  }

  if (!result) {
    return toastJson(locale, { status: "danger", title: "DOKU tidak mengenali pembayaran ini." });
  }

  if (result.status === "pending") {
    return toastJson(locale, { status: "danger", title: "Menurut DOKU, pembayaran #:invoice_number masih menunggu pembayaran.", replace: { invoice_number: payment.invoiceNumber } });
  }

  return toastJson(locale, { status: "success", title: "Status pembayaran #:invoice_number diperbarui: :status.", replace: { invoice_number: payment.invoiceNumber, status: result.status } });
}
