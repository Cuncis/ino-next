import type { ActionField, ActionFormSpec } from "@/components/admin/filament/ActionForm";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { ADJUSTMENT_REASONS, options } from "@/lib/admin-options";

/**
 * The stock action forms (BranchStocksTable::receiveFields() and adjustFields()) as
 * ActionForm draws them, shared by the Stok list and the product's page.
 */
export function selectLabels(locale: AdminLocale) {
  const t = (text: string) => translate(locale, text);

  return { placeholder: t("Pilih salah satu opsi"), search: t("Ketik untuk mencari..."), noResults: t("Tidak ada opsi yang tersedia."), clear: "Clear selection", prompt: t("Ketik untuk mencari...") };
}

export function receiveFields(locale: AdminLocale): ActionField[] {
  const t = (text: string) => translate(locale, text);

  return [
    { kind: "text", name: "batchNumber", label: t("Nomor Batch"), maxLength: 60, helper: t("Boleh dikosongkan. Batch dibuat otomatis per tanggal kedaluwarsa.") },
    { kind: "date", name: "expiresAt", label: t("Tanggal Kedaluwarsa"), required: true },
    { kind: "number", name: "quantity", label: t("Jumlah"), required: true, integer: true, min: 1, max: 100000 },
    { kind: "textarea", name: "note", label: t("Catatan"), maxLength: 255 },
  ];
}

/** The adjust form; `quantities` is the count now (one number, or one per branch picked in `branchField`). */
export function adjustFields(locale: AdminLocale, quantities: Record<string, number> | number, branchField?: string): ActionField[] {
  const t = (text: string) => translate(locale, text);
  const labels = { pick: t("Pilih cabang untuk melihat stok saat ini."), current: t("Stok saat ini: :count"), after: t("Stok menjadi: :count") };

  return [
    { kind: "stock", name: "_current", label: "", show: "current", quantities, branchField, deltaField: "delta", labels },
    {
      kind: "number",
      name: "delta",
      label: t("Jumlah Penyesuaian"),
      required: true,
      integer: true,
      min: -100000,
      max: 100000,
      helper: t("Gunakan angka negatif untuk mengurangi stok. Contoh: -3 mengurangi 3."),
    },
    { kind: "stock", name: "_after", label: "", show: "after", quantities, branchField, deltaField: "delta", labels },
    {
      kind: "select",
      name: "reason",
      label: t("Alasan"),
      required: true,
      placeholder: t("Pilih salah satu opsi"),
      options: Object.entries(options(ADJUSTMENT_REASONS)).map(([value, label]) => ({ value, label: t(label) })),
    },
    { kind: "textarea", name: "note", label: t("Catatan"), maxLength: 255 },
  ];
}

export function actionForm(locale: AdminLocale, heading: string, fields: ActionField[], extra: Partial<ActionFormSpec> = {}): ActionFormSpec {
  return { heading, fields, submitLabel: translate(locale, "Kirim"), cancelLabel: translate(locale, "Batal"), ...extra };
}
