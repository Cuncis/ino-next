import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { COUPON_STATUSES, COUPON_TYPES, CUSTOMER_STATUSES, options } from "@/lib/admin-options";
import type { FormBlock } from "@/views/admin/ResourceForm";
import { couponBranchOptions } from "./coupons";

/** CustomerForm and CouponForm as ResourceForm draws them, in the panel's language. */
const choices = (locale: AdminLocale, map: Record<string, string>) => Object.entries(options(map)).map(([value, label]) => ({ value, label: translate(locale, label) }));

export function customerFormBlocks(locale: AdminLocale): FormBlock[] {
  const t = (text: string) => translate(locale, text);

  return [
    {
      columns: 2,
      fields: [
        { kind: "text", name: "name", label: t("Nama Lengkap"), required: true, maxLength: 80, placeholder: t("Kirana Wijaya") },
        { kind: "text", inputType: "email", name: "email", label: t("Email"), required: true, maxLength: 120, placeholder: t("kirana@mail.com"), helper: t("Dipakai untuk menautkan riwayat pesanan.") },
        { kind: "text", inputType: "tel", name: "phone", label: t("Nomor Telepon"), required: true, maxLength: 30, placeholder: "+62 812-3456-7890" },
        { kind: "text", name: "city", label: t("Kota"), required: true, maxLength: 60, placeholder: t("Jakarta Barat") },
        { kind: "select", name: "status", label: t("Status"), required: true, placeholder: t("Pilih salah satu opsi"), options: choices(locale, CUSTOMER_STATUSES) },
        { kind: "textarea", name: "address", label: t("Alamat"), placeholder: t("Jl. Kebon Jeruk Raya No. 27"), full: true },
      ],
    },
  ];
}

export const CUSTOMER_DEFAULTS = { name: "", email: "", phone: "", city: "", status: "aktif", address: "" };

export async function couponFormBlocks(locale: AdminLocale): Promise<FormBlock[]> {
  const t = (text: string) => translate(locale, text);

  return [
    {
      columns: 2,
      fields: [
        { kind: "text", name: "code", label: t("Kode Kupon"), required: true, maxLength: 40, placeholder: "HEMAT15", helper: t("Huruf kapital dan angka saja."), uppercase: true },
        { kind: "select", name: "type", label: t("Tipe Diskon"), required: true, placeholder: t("Pilih salah satu opsi"), options: choices(locale, COUPON_TYPES) },
        {
          kind: "number",
          name: "value",
          label: t("Nilai Diskon (Rp)"),
          labelWhen: { field: "type", equals: "persentase", label: t("Nilai Diskon (%)") },
          required: true,
          min: 0,
          max: 1000000000,
          placeholder: "15",
          visibleWhen: { field: "type", notEquals: "ongkir gratis" },
        },
        { kind: "number", name: "minimum_purchase", label: t("Minimum Belanja (Rp)"), min: 0, max: 1000000000, placeholder: "100000", helper: t("Kosongkan bila tidak ada.") },
        { kind: "number", name: "quota", label: t("Kuota Penggunaan"), min: 1, placeholder: "500", helper: t("Kosongkan bila tidak dibatasi.") },
        { kind: "select", name: "status", label: t("Status"), required: true, placeholder: t("Pilih salah satu opsi"), options: choices(locale, COUPON_STATUSES) },
        { kind: "date", name: "starts_at", label: t("Mulai Berlaku") },
        { kind: "date", name: "expires_at", label: t("Berlaku Sampai") },
        {
          kind: "checkboxes",
          name: "branches",
          label: t("Berlaku di Cabang"),
          helper: t("Tidak mencentang cabang mana pun berarti berlaku di semua cabang."),
          options: await couponBranchOptions(),
          columns: 2,
          full: true,
        },
      ],
    },
  ];
}

export const COUPON_DEFAULTS = { code: "", type: "persentase", value: "", minimum_purchase: "", quota: "", status: "aktif", starts_at: "", expires_at: "", branches: [] as string[] };
