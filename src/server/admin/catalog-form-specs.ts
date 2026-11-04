import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { ATTRIBUTE_TYPES, CATEGORY_STATUSES, options, PRODUCT_STATUSES, SELLABLE_DRUG_CLASSES, SUPPLIER_STATUSES, UNITS } from "@/lib/admin-options";
import type { FormBlock } from "@/views/admin/ResourceForm";
import { categoryOptions, MAX_QUANTITY_PER_ORDER, OVER_LIMIT_MESSAGE, supplierOptions } from "./products";

/**
 * The catalogue forms as ResourceForm draws them: ProductForm, CategoryForm,
 * AttributeForm and SupplierForm, in the panel's language.
 */
const choices = (locale: AdminLocale, map: Record<string, string>) => Object.entries(options(map)).map(([value, label]) => ({ value, label: translate(locale, label) }));

/** Filament's words around a form. */
export function formLabels(locale: AdminLocale) {
  const t = (text: string) => translate(locale, text);

  return {
    create: t("Buat"),
    createAnother: t("Buat & buat lainnya"),
    cancel: t("Batal"),
    save: t("Simpan"),
    close: t("Tutup"),
    placeholder: t("Pilih salah satu opsi"),
    search: t("Ketik untuk mencari..."),
    noResults: t("Tidak ada opsi yang tersedia."),
    clear: "Clear selection",
    removeTag: t("Hapus"),
  };
}

export async function productFormBlocks(locale: AdminLocale, mode: "create" | "edit"): Promise<FormBlock[]> {
  const t = (text: string, replace?: Record<string, string>) => translate(locale, text, replace);
  const [categories, suppliers] = await Promise.all([categoryOptions(), supplierOptions()]);
  const blocks: FormBlock[] = [
    {
      section: { id: "informasi-umum", heading: t("Informasi Umum") },
      columns: 2,
      fields: [
        { kind: "text", name: "name", label: t("Nama Produk"), required: true, maxLength: 120, full: true },
        { kind: "searchable", name: "category_id", label: t("Kategori"), required: true, options: categories },
        { kind: "searchable", name: "supplier_id", label: t("Penjual"), required: true, options: suppliers },
        { kind: "select", name: "unit", label: t("Satuan"), required: true, placeholder: t("Pilih salah satu opsi"), options: UNITS.map((unit) => ({ value: unit, label: t(unit) })) },
        { kind: "select", name: "status", label: t("Status"), required: true, placeholder: t("Pilih salah satu opsi"), options: choices(locale, PRODUCT_STATUSES) },
        {
          kind: "select",
          name: "drug_class",
          label: t("Golongan Obat"),
          required: true,
          placeholder: t("Pilih salah satu opsi"),
          options: choices(locale, SELLABLE_DRUG_CLASSES),
          helper: t("Apotek ini tidak menjual obat keras atau obat yang butuh resep dokter."),
        },
        { kind: "number", name: "price", label: t("Harga Jual"), required: true, integer: true, min: 0, max: 1000000000 },
        { kind: "number", name: "old_price", label: t("Harga Coret"), integer: true, min: 0, max: 1000000000 },
        {
          kind: "number",
          name: "max_qty_per_order",
          label: t("Maks. pembelian per transaksi"),
          required: true,
          integer: true,
          min: 1,
          max: 65535,
          helper: t("Pembeli yang melewati batas ini melihat pesan: \":message\".", { message: t(OVER_LIMIT_MESSAGE) }),
        },
        {
          kind: "textarea",
          name: "blurb",
          label: t("Deskripsi"),
          rows: 10,
          maxLength: 5000,
          full: true,
          helper: t("Tulis komposisi, indikasi, aturan pakai, efek samping, produsen, nomor izin edar, dan kondisi penyimpanan di sini."),
        },
      ],
    },
  ];

  if (mode === "create") {
    blocks.push({
      section: { id: "foto-produk", heading: t("Foto Produk") },
      columns: 1,
      fields: [
        {
          kind: "files",
          name: "photos",
          label: "Photos",
          hiddenLabel: true,
          multiple: true,
          accept: ["image/*"],
          maxSizeKb: 5120,
          maxFiles: 8,
          reorderable: true,
          helper: t("Opsional. Foto pertama menjadi foto utama. Foto bisa ditambah atau diurutkan lagi nanti di tab Gambar."),
        },
      ],
    });
  }

  return blocks;
}

/** A new product's starting values: the default purchase limit and "bebas". */
export const PRODUCT_DEFAULTS = { max_qty_per_order: String(MAX_QUANTITY_PER_ORDER), drug_class: "bebas" };

export function categoryFormBlocks(locale: AdminLocale): FormBlock[] {
  const t = (text: string) => translate(locale, text);

  return [
    {
      columns: 2,
      fields: [
        { kind: "text", name: "name", label: t("Nama Kategori"), required: true, maxLength: 80 },
        { kind: "text", name: "slug", label: t("Slug"), maxLength: 80, helper: t("Kosongkan untuk membuat otomatis dari nama.") },
        { kind: "select", name: "status", label: t("Status"), required: true, placeholder: t("Pilih salah satu opsi"), options: choices(locale, CATEGORY_STATUSES) },
        { kind: "textarea", name: "description", label: t("Deskripsi"), maxLength: 500, full: true },
      ],
    },
  ];
}

export function attributeFormBlocks(locale: AdminLocale): FormBlock[] {
  const t = (text: string) => translate(locale, text);

  return [
    {
      columns: 2,
      fields: [
        { kind: "text", name: "name", label: t("Nama Atribut"), required: true, maxLength: 80, placeholder: t("Bentuk Sediaan") },
        { kind: "select", name: "type", label: t("Tipe"), required: true, placeholder: t("Pilih salah satu opsi"), options: choices(locale, ATTRIBUTE_TYPES) },
        {
          kind: "tags",
          name: "values",
          label: t("Nilai"),
          required: true,
          placeholder: t("Tablet, Kapsul, Sirup, Salep"),
          helper: t("Tekan Enter setelah setiap nilai."),
          splitKeys: [","],
          full: true,
          visibleWhen: { field: "type", equals: "pilihan" },
        },
      ],
    },
  ];
}

export function supplierFormBlocks(locale: AdminLocale, productCount = 0): FormBlock[] {
  const t = (text: string, replace?: Record<string, string>) => translate(locale, text, replace);

  return [
    {
      columns: 2,
      fields: [
        {
          kind: "text",
          name: "name",
          label: t("Nama Toko"),
          required: true,
          maxLength: 80,
          placeholder: t("Apotek Sehat Bersama"),
          helper: productCount > 0 ? t("Mengubah nama toko akan otomatis memperbarui :count produk yang dipasoknya.", { count: String(productCount) }) : undefined,
        },
        { kind: "text", name: "contact_person", label: t("Nama Pemilik"), required: true, maxLength: 80, placeholder: t("Kirana Wijaya") },
        { kind: "text", inputType: "email", name: "email", label: t("Email"), required: true, maxLength: 120, placeholder: t("apotek@mail.com") },
        { kind: "text", inputType: "tel", name: "phone", label: t("Nomor Telepon"), required: true, maxLength: 30, placeholder: "+62 21 5551 0001" },
        { kind: "text", name: "license_number", label: t("Nomor Izin Apotek"), required: true, maxLength: 40, placeholder: "SIA/2025/00123", helper: t("Harus unik untuk setiap pemasok.") },
        { kind: "text", name: "kota", label: t("Kota"), required: true, maxLength: 60, placeholder: t("Jakarta Selatan") },
        { kind: "select", name: "status", label: t("Status"), required: true, placeholder: t("Pilih salah satu opsi"), options: choices(locale, SUPPLIER_STATUSES) },
        { kind: "textarea", name: "address_line", label: t("Alamat Toko"), placeholder: t("Jl. Jend. Sudirman Kav. 52-53"), full: true },
      ],
    },
  ];
}
