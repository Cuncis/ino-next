import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { SHORT_MONTHS } from "@/lib/dates";
import type { ListAction, ListFilter, ListSpec } from "@/components/admin/filament/ListTable";

/** Filament's own words on every list page, in the panel's language. */
export function listLabels(locale: AdminLocale): ListSpec["labels"] {
  const t = (text: string) => translate(locale, text);

  return {
    search: t("Cari"),
    filters: t("Filter"),
    resetFilters: t("Atur ulang filter"),
    applyFilters: t("Terapkan filter"),
    actions: t("Tindakan"),
    selected: t(":count data dipilih"),
    selectAll: t("Pilih semua (:count)"),
    deselectAll: t("Batalkan semua pilihan"),
    overview: t("{1} Menampilkan 1 hasil|[2,*] Menampilkan :first sampai :last dari :total hasil"),
    perPage: t("per halaman"),
    pagination: t("Navigasi halaman"),
    previous: t("Sebelumnya"),
    next: t("Selanjutnya"),
    close: t("Tutup"),
    cancel: t("Batal"),
    sure: t("Apakah Anda yakin ingin melakukan ini?"),
    confirm: t("Konfirmasi"),
    actionsColumn: t("Aksi"),
    columns: t("Kolom"),
    columnManager: t("Pilih kolom"),
    applyColumns: t("Terapkan kolom"),
    resetColumns: t("Atur ulang"),
  };
}

/** Filament's TrashedFilter: without (default), with, or only deleted records. */
export function trashedFilter(locale: AdminLocale, value: string): ListFilter {
  const t = (text: string) => translate(locale, text);

  return {
    name: "trashed",
    label: t("Data yang dihapus"),
    value,
    defaultValue: "",
    options: [
      { value: "", label: t("Tanpa data yang dihapus") },
      { value: "1", label: t("Dengan data yang dihapus") },
      { value: "0", label: t("Hanya data yang dihapus") },
    ],
  };
}

/** Filament's Delete / ForceDelete / Restore actions for one record or a selection. */
export function deletionActions(locale: AdminLocale, modelLabel: string, endpoints: { delete?: string; forceDelete?: string; restore?: string }, bulk: boolean): ListAction[] {
  const t = (text: string, replace?: Record<string, string>) => translate(locale, text, replace);
  const sure = t("Apakah Anda yakin ingin melakukan ini?");
  const label = { label: modelLabel };
  const actions: ListAction[] = [];

  if (endpoints.delete) {
    actions.push({
      key: "delete",
      label: bulk ? t("Hapus yang dipilih") : t("Hapus"),
      icon: bulk ? "m-trash" : "c-trash",
      color: "danger",
      endpoint: endpoints.delete,
      confirm: { heading: bulk ? t("Hapus :label yang dipilih", label) : t("Hapus :label", label), description: sure, submitLabel: t("Hapus"), color: "danger", icon: "o-trash" },
    });
  }

  if (endpoints.forceDelete) {
    actions.push({
      key: "forceDelete",
      label: bulk ? t("Hapus selamanya data yang dipilih") : t("Hapus selamanya"),
      icon: "m-trash",
      color: "danger",
      endpoint: endpoints.forceDelete,
      confirm: { heading: bulk ? t("Hapus selamanya :label yang dipilih", label) : t("Hapus selamanya :label", label), description: sure, submitLabel: t("Hapus"), color: "danger", icon: "o-trash" },
    });
  }

  if (endpoints.restore) {
    actions.push({
      key: "restore",
      label: bulk ? t("Pulihkan data yang dipilih") : t("Pulihkan data"),
      icon: "m-arrow-uturn-left",
      color: "gray",
      endpoint: endpoints.restore,
      confirm: { heading: bulk ? t("Pulihkan :label yang dipilih", label) : t("Pulihkan :label", label), description: sure, submitLabel: t("Pulihkan"), color: "gray", icon: "o-arrow-uturn-left" },
    });
  }

  return actions;
}

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Carbon's translatedFormat('d M Y') (or 'd M Y, H:i') in Jakarta time and the panel's language. */
export function adminDate(date: Date | null | undefined, locale: AdminLocale, withTime = false): string | null {
  if (!date) {
    return null;
  }

  const jakarta = new Date(date.getTime() + 7 * 3600_000).toISOString();
  const day = `${jakarta.slice(8, 10)} ${(locale === "en" ? EN_MONTHS : SHORT_MONTHS)[Number(jakarta.slice(5, 7)) - 1]} ${jakarta.slice(0, 4)}`;

  return withTime ? `${day}, ${jakarta.slice(11, 16)}` : day;
}

/** The list's paging from the address: page 1+, 5/10/25/50 per page (10 by default). */
export function paging(query: Record<string, string | string[] | undefined>): { page: number; perPage: number } {
  const page = Math.max(Number.parseInt(String(query.page ?? "1"), 10) || 1, 1);
  const perPage = [5, 10, 25, 50].includes(Number(query.perPage)) ? Number(query.perPage) : 10;

  return { page, perPage };
}

export const queryString = (value: string | string[] | undefined): string => (typeof value === "string" ? value : "");

/** Filament's TextColumn::dateTime(): Carbon's translatedFormat('M j, Y H:i:s') in Jakarta time. */
export function adminDateTime(date: Date | null | undefined, locale: AdminLocale): string | null {
  if (!date) {
    return null;
  }

  const jakarta = new Date(date.getTime() + 7 * 3600_000).toISOString();
  const month = (locale === "en" ? EN_MONTHS : SHORT_MONTHS)[Number(jakarta.slice(5, 7)) - 1];

  return `${month} ${Number(jakarta.slice(8, 10))}, ${jakarta.slice(0, 4)} ${jakarta.slice(11, 19)}`;
}
