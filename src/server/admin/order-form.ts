import { and, inArray, isNull } from "drizzle-orm";
import { branches, customers, db, products } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { PAYMENT_METHODS } from "@/lib/admin-options";
import { addError, validate, type ValidationErrors } from "@/lib/validation";
import type { OrderFormData } from "./orders";

/**
 * OrderForm's rules. Filament names a field by its label with a lowercase first letter
 * ("cara Terima"), in the panel's language; a select only accepts one of its options.
 */
const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export async function validateOrderForm(
  body: Record<string, unknown>,
  locale: AdminLocale,
  fulfilmentRequired: boolean,
): Promise<{ data: OrderFormData; errors: null } | { data: null; errors: ValidationErrors }> {
  const t = (text: string) => lcfirst(translate(locale, text));
  const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  const rules: Record<string, string[]> = {
    customer_id: ["required"],
    branch_id: ["required"],
    fulfilment: fulfilmentRequired ? ["required", "in:antar,ambil"] : ["nullable"],
    payment_method: ["required", `in:${PAYMENT_METHODS.join(",")}`],
    shipping_total: ["required", "numeric", "min:0", "max:10000000"],
    note: ["nullable", "string", "max:500"],
    items: ["required", "array", "min:1"],
  };
  const attributes: Record<string, string> = {
    customer_id: t("Pelanggan"),
    branch_id: t("Cabang"),
    fulfilment: t("Cara Terima"),
    payment_method: t("Metode Pembayaran"),
    shipping_total: t("Ongkos Kirim"),
    note: t("Catatan"),
    items: "items",
  };

  items.forEach((_, index) => {
    rules[`items.${index}.product_id`] = ["required"];
    rules[`items.${index}.quantity`] = ["required", "numeric", "min:1", "max:10000"];
    attributes[`items.${index}.product_id`] = t("Produk");
    attributes[`items.${index}.quantity`] = t("Jumlah");
  });

  const result = validate<Record<string, unknown>>(body, rules, {}, attributes, locale);
  let errors = result.errors;

  // a select only takes one of its options (deleted customers, branches and products aren't offered)
  const pick = async (field: string, table: typeof customers | typeof branches | typeof products, ids: number[]) => {
    const found = ids.length
      ? await db
          .select({ id: table.id })
          .from(table)
          .where(and(inArray(table.id, ids), isNull(table.deletedAt)))
      : [];
    const known = new Set(found.map((row) => row.id));

    return (id: unknown) => (id === null || id === undefined || id === "" || known.has(Number(id)) ? null : field);
  };
  const customerCheck = await pick("customer_id", customers, [Number(body.customer_id)].filter(Number.isFinite));
  const branchCheck = await pick("branch_id", branches, [Number(body.branch_id)].filter(Number.isFinite));
  const productCheck = await pick("product", products, items.map((item) => Number(item.product_id)).filter(Number.isFinite));
  const invalid = (field: string, attribute: string) => {
    // Laravel's `in` message
    errors = addError(errors, field, locale === "en" ? `The selected ${attribute} is invalid.` : `Kolom ${attribute} yang dipilih tidak valid.`);
  };

  if (customerCheck(body.customer_id)) invalid("customer_id", attributes.customer_id);
  if (branchCheck(body.branch_id)) invalid("branch_id", attributes.branch_id);
  items.forEach((item, index) => {
    if (productCheck(item.product_id)) invalid(`items.${index}.product_id`, attributes[`items.${index}.product_id`]);
  });

  if (errors) {
    return { data: null, errors };
  }

  return {
    data: {
      customer_id: Number(body.customer_id),
      branch_id: Number(body.branch_id),
      fulfilment: String(body.fulfilment ?? ""),
      payment_method: String(body.payment_method),
      shipping_total: Number(body.shipping_total),
      note: typeof body.note === "string" && body.note.trim() !== "" ? body.note : null,
      items: items.map((item) => ({ id: item.id ? Number(item.id) : undefined, product_id: Number(item.product_id), quantity: Number(item.quantity) })),
    },
    errors: null,
  };
}
