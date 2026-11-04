import { and, eq, isNull, ne, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { attributes, categories, db, suppliers } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { ATTRIBUTE_TYPES, CATEGORY_STATUSES, PRODUCT_STATUSES, SELLABLE_DRUG_CLASSES, SUPPLIER_STATUSES, UNITS } from "@/lib/admin-options";
import { addError, validate, type ValidationErrors } from "@/lib/validation";
import { categoryOptions, supplierOptions, type ProductFormData } from "./products";

/**
 * The rules of the catalogue forms (ProductForm, CategoryForm, AttributeForm,
 * SupplierForm) in Filament's order for each field: required (or nullable), the length,
 * a select's options, the pattern, then the field's own rules as it declares them.
 * Fields are named by their label with a lowercase first letter, in the panel's language.
 */
const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

type Result<T> = { data: T; errors: null } | { data: null; errors: ValidationErrors };

const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
/** Filament keeps an emptied field as null. */
const optional = (value: unknown): string | null => (text(value).trim() === "" ? null : text(value));
const values = (map: Record<string, string>) => Object.values(map).join(",");

/** Laravel's `in` message, for a select whose choice isn't one of its options. */
function invalidChoice(locale: AdminLocale, attribute: string): string {
  return locale === "en" ? `The selected ${attribute} is invalid.` : `Kolom ${attribute} yang dipilih tidak valid.`;
}

/** `unique(ignoreRecord: true)` among records that aren't deleted. */
async function taken(table: PgTable & { deletedAt: AnyPgColumn; id: AnyPgColumn }, column: AnyPgColumn, value: string, ignoreId: number | null): Promise<boolean> {
  const conditions: (SQL | undefined)[] = [eq(column, value), isNull(table.deletedAt), ignoreId ? ne(table.id, ignoreId) : undefined];
  const [row] = await db
    .select({ id: table.id })
    .from(table as PgTable)
    .where(and(...conditions))
    .limit(1);

  return row !== undefined;
}

/* ---------------- Produk ---------------- */

export async function validateProductForm(body: Record<string, unknown>, locale: AdminLocale): Promise<Result<ProductFormData>> {
  const t = (label: string) => lcfirst(translate(locale, label));
  const attributeNames = {
    name: t("Nama Produk"),
    category_id: t("Kategori"),
    supplier_id: t("Penjual"),
    unit: t("Satuan"),
    status: t("Status"),
    drug_class: t("Golongan Obat"),
    price: t("Harga Jual"),
    old_price: t("Harga Coret"),
    max_qty_per_order: t("Maks. pembelian per transaksi"),
    blurb: t("Deskripsi"),
  };
  const result = validate<Record<string, unknown>>(
    body,
    {
      name: ["required", "max:120"],
      category_id: ["required"],
      supplier_id: ["required"],
      unit: ["required", `in:${UNITS.join(",")}`],
      status: ["required", `in:${values(PRODUCT_STATUSES)}`],
      drug_class: ["required", `in:${values(SELLABLE_DRUG_CLASSES)}`],
      price: ["required", "numeric", "integer", "min:0", "max:1000000000"],
      old_price: ["nullable", "numeric", "integer", "min:0", "max:1000000000", "gt:price"],
      max_qty_per_order: ["required", "numeric", "integer", "min:1", "max:65535"],
      blurb: ["nullable", "max:5000"],
    },
    { "old_price.gt": translate(locale, "Harga coret harus lebih besar dari harga jual.") },
    attributeNames,
    locale,
  );
  let errors = result.errors;
  const [categoryChoices, supplierChoices] = await Promise.all([categoryOptions(), supplierOptions()]);

  for (const [field, choices] of [
    ["category_id", categoryChoices],
    ["supplier_id", supplierChoices],
  ] as const) {
    const value = text(body[field]);

    if (value !== "" && !choices.some((choice) => choice.value === value)) {
      errors = addError(errors, field, invalidChoice(locale, attributeNames[field]));
    }
  }

  if (errors) {
    return { data: null, errors };
  }

  return {
    data: {
      name: text(body.name),
      category_id: Number(body.category_id),
      supplier_id: Number(body.supplier_id),
      unit: text(body.unit),
      status: text(body.status),
      drug_class: text(body.drug_class),
      price: Number(body.price),
      old_price: optional(body.old_price) === null ? null : Number(body.old_price),
      max_qty_per_order: Number(body.max_qty_per_order),
      blurb: optional(body.blurb),
    },
    errors: null,
  };
}

/* ---------------- Kategori ---------------- */

export type CategoryFormData = { name: string; slug: string | null; status: string; description: string | null };

export async function validateCategoryForm(body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null): Promise<Result<CategoryFormData>> {
  const t = (label: string) => lcfirst(translate(locale, label));
  const result = validate<Record<string, unknown>>(
    body,
    {
      name: ["required", "max:80"],
      slug: ["nullable", "max:80", "regex:/^[a-z0-9-]+$/"],
      status: ["required", `in:${values(CATEGORY_STATUSES)}`],
      description: ["nullable", "max:500"],
    },
    { "slug.regex": translate(locale, "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.") },
    { name: t("Nama Kategori"), slug: t("Slug"), status: t("Status"), description: t("Deskripsi") },
    locale,
  );
  let errors = result.errors;

  if (!errors?.name && (await taken(categories, categories.name, text(body.name), ignoreId))) {
    errors = addError(errors, "name", translate(locale, "Kategori dengan nama ini sudah ada."));
  }

  return errors
    ? { data: null, errors }
    : { data: { name: text(body.name), slug: optional(body.slug), status: text(body.status), description: optional(body.description) }, errors: null };
}

/* ---------------- Atribut ---------------- */

export type AttributeFormData = { name: string; type: string; values: string[] | null };

export async function validateAttributeForm(body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null): Promise<Result<AttributeFormData>> {
  const t = (label: string) => lcfirst(translate(locale, label));
  const choice = text(body.type) === "pilihan";
  const tags = Array.isArray(body.values) ? body.values.map(text) : [];
  const result = validate<Record<string, unknown>>(
    { ...body, values: tags },
    {
      name: ["required", "max:80"],
      type: ["required", `in:${values(ATTRIBUTE_TYPES)}`],
      // the tags are only on the form (and only required) for a "Pilihan" attribute
      ...(choice ? { values: ["required"] } : {}),
    },
    {},
    { name: t("Nama Atribut"), type: t("Tipe"), values: t("Nilai") },
    locale,
  );
  let errors = result.errors;

  if (!errors?.name && (await taken(attributes, attributes.name, text(body.name), ignoreId))) {
    errors = addError(errors, "name", translate(locale, "Atribut dengan nama ini sudah ada."));
  }

  return errors ? { data: null, errors } : { data: { name: text(body.name), type: text(body.type), values: choice ? tags : null }, errors: null };
}

/* ---------------- Pemasok ---------------- */

export type SupplierFormData = {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  license_number: string;
  kota: string;
  status: string;
  address_line: string | null;
};

export async function validateSupplierForm(body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null): Promise<Result<SupplierFormData>> {
  const t = (label: string) => lcfirst(translate(locale, label));
  const result = validate<Record<string, unknown>>(
    body,
    {
      name: ["required", "max:80"],
      contact_person: ["required", "max:80"],
      email: ["required", "max:120", "email"],
      phone: ["required", "max:30", "regex:/^[0-9+\\-\\s()]+$/"],
      license_number: ["required", "max:40"],
      kota: ["required", "max:60"],
      status: ["required", `in:${values(SUPPLIER_STATUSES)}`],
      address_line: ["nullable"],
    },
    { "phone.regex": translate(locale, "Nomor telepon hanya boleh berisi angka, spasi, dan tanda + - ( ).") },
    {
      name: t("Nama Toko"),
      contact_person: t("Nama Pemilik"),
      email: t("Email"),
      phone: t("Nomor Telepon"),
      license_number: t("Nomor Izin Apotek"),
      kota: t("Kota"),
      status: t("Status"),
      address_line: t("Alamat Toko"),
    },
    locale,
  );
  let errors = result.errors;
  const unique: [keyof SupplierFormData, AnyPgColumn, string][] = [
    ["name", suppliers.name, "Nama toko ini sudah terdaftar."],
    ["email", suppliers.email, "Email ini sudah dipakai pemasok lain."],
    ["license_number", suppliers.licenseNumber, "Nomor izin apotek ini sudah terdaftar."],
  ];

  for (const [field, column, message] of unique) {
    if (!errors?.[field] && (await taken(suppliers, column, text(body[field]), ignoreId))) {
      errors = addError(errors, field, translate(locale, message));
    }
  }

  if (errors) {
    return { data: null, errors };
  }

  return {
    data: {
      name: text(body.name),
      contact_person: text(body.contact_person),
      email: text(body.email),
      phone: text(body.phone),
      license_number: text(body.license_number),
      kota: text(body.kota),
      status: text(body.status),
      address_line: optional(body.address_line),
    },
    errors: null,
  };
}
