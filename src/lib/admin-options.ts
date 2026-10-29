import { statusesFor } from "./order-status";

/**
 * Vocabulary shared between the admin screens and the database, ported from the
 * Laravel app's App\Support\AdminOptions.
 *
 * The database stores lowercase enum values ('menunggu pembayaran'); the screens
 * show title-case Indonesian labels ('Menunggu Pembayaran'). This module is the
 * only place that knows both, so a status never gets translated by hand.
 *
 * Every map is label => stored value, ordered the way it should appear in a dropdown.
 */

export type OptionMap = Readonly<Record<string, string>>;

/** Editable product status. Stock-derived labels live in `stockLabel()`. */
export const PRODUCT_STATUSES = {
  Aktif: "aktif",
  Nonaktif: "nonaktif",
  Arsip: "arsip",
} as const;

export const CATEGORY_STATUSES = {
  Aktif: "aktif",
  Nonaktif: "nonaktif",
} as const;

/** `products.drug_class` — golongan obat, dengan warna logo resminya. */
export const DRUG_CLASSES = {
  "Non-Obat": "non-obat",
  Bebas: "bebas",
  "Bebas Terbatas": "bebas terbatas",
  Keras: "keras",
} as const;

/**
 * What can be chosen for a new or edited product: over-the-counter and limited
 * over-the-counter only. The pharmacy sells no prescription drugs, so "Keras" is
 * left out, and "Non-Obat" is no longer offered either; `DRUG_CLASSES` still
 * knows it so an old row can be shown.
 */
export const SELLABLE_DRUG_CLASSES = {
  Bebas: "bebas",
  "Bebas Terbatas": "bebas terbatas",
} as const;

/** `products.storage` — menentukan cabang mana boleh menjualnya (produk rantai dingin butuh kulkas). */
export const STORAGE_CONDITIONS = {
  "Suhu Ruang": "suhu ruang",
  "Sejuk (15-25°C)": "sejuk",
  "Dingin/Kulkas (2-8°C)": "dingin",
} as const;

export const SUPPLIER_STATUSES = {
  Aktif: "aktif",
  Nonaktif: "nonaktif",
} as const;

export const ATTRIBUTE_TYPES = {
  Pilihan: "pilihan",
  Teks: "teks",
} as const;

export const COUPON_TYPES = {
  Persentase: "persentase",
  Nominal: "nominal",
  "Gratis Ongkir": "ongkir gratis",
} as const;

export const COUPON_STATUSES = {
  Aktif: "aktif",
  Nonaktif: "nonaktif",
} as const;

export const CUSTOMER_STATUSES = {
  Aktif: "aktif",
  Nonaktif: "nonaktif",
  Diblokir: "diblokir",
} as const;

export const ORDER_STATUSES = {
  "Menunggu Pembayaran": "menunggu pembayaran",
  "Pembayaran Diterima": "pembayaran diterima",
  "Siap Dikirim": "siap dikirim",
  "Siap Diambil": "siap diambil",
  Dikirim: "dikirim",
  Selesai: "selesai",
  Dibatalkan: "dibatalkan",
  Kedaluwarsa: "kedaluwarsa",
} as const;

/**
 * What the admin screens show instead of `orders.status`, Shopify style: how far
 * the branch has got with the order. Several statuses share a label, so this maps
 * a label to every status behind it. Payment is shown on its own from
 * `payment_status`; the storefront keeps the detailed status.
 */
export const FULFILMENT_STAGES: Readonly<Record<string, readonly string[]>> = {
  "Belum Diproses": ["menunggu pembayaran", "pembayaran diterima"],
  "Sedang Diproses": ["siap dikirim", "siap diambil"],
  Terpenuhi: ["dikirim", "selesai"],
  Dibatalkan: ["dibatalkan"],
  Kedaluwarsa: ["kedaluwarsa"],
};

export const PAYMENT_STATUSES = {
  "Belum Bayar": "belum bayar",
  Lunas: "lunas",
  Gagal: "gagal",
  Refund: "refund",
} as const;

/**
 * Biteship's shipment statuses, stored verbatim in `shipments.status`, in the
 * order a parcel normally moves through them. A status Biteship adds later has no
 * label here and is shown as Biteship sent it.
 */
export const SHIPMENT_STATUSES = {
  Dikonfirmasi: "confirmed",
  "Kurir Ditugaskan": "allocated",
  "Kurir Menuju Cabang": "pickingUp",
  "Diambil Kurir": "picked",
  "Dalam Perjalanan": "inTransit",
  "Menuju Alamat": "droppingOff",
  "Diterima Pelanggan": "delivered",
  Tertahan: "onHold",
  "Kurir Tidak Tersedia": "courierNotFound",
  "Ditolak Kurir": "rejected",
  "Dalam Pengembalian": "returnInTransit",
  Dikembalikan: "returned",
  Dibatalkan: "cancelled",
  Dimusnahkan: "disposed",
} as const;

/** How the customer receives the order: delivered, or collected at a branch. */
export const FULFILMENTS = {
  Antar: "antar",
  Ambil: "ambil",
} as const;

export const SUBSCRIBER_STATUSES = {
  Berlangganan: "berlangganan",
  Berhenti: "berhenti",
} as const;

export const NEWSLETTER_STATUSES = {
  Draf: "draf",
  Mengirim: "mengirim",
  Terkirim: "terkirim",
  Gagal: "gagal",
} as const;

export const BRANCH_STATUSES = {
  Aktif: "aktif",
  "Tutup Sementara": "tutup sementara",
  "Tutup Permanen": "tutup permanen",
} as const;

export const STOCK_TRANSFER_STATUSES = {
  Diminta: "diminta",
  Dikirim: "dikirim",
  Diterima: "diterima",
  Dibatalkan: "dibatalkan",
} as const;

/** Reasons a manual stock adjustment can give, mapped onto a movement type. */
export const ADJUSTMENT_REASONS = {
  "Penyesuaian (stok opname)": "penyesuaian",
  Rusak: "rusak",
  Kedaluwarsa: "kedaluwarsa",
  "Retur dari pelanggan": "retur masuk",
  "Retur ke pemasok": "retur keluar",
} as const;

/**
 * Sale units. Not an enum in the database — a pharmacy adds units over time, so
 * this is a suggestion list, validated but cheap to extend.
 */
export const UNITS = ["Strip", "Botol", "Box", "Tablet", "Pcs"] as const;

/** The admin's own manual order form only; shop checkout pays online through DOKU. */
export const PAYMENT_METHODS = ["Transfer Bank", "GoPay", "OVO", "DANA"] as const;

/** The order statuses that make sense for one way of receiving the order, in flow order: label => stored value. */
export function orderStatusesFor(fulfilment: string): Record<string, string> {
  const allowed: readonly string[] = statusesFor(fulfilment);

  return Object.fromEntries(
    Object.entries(ORDER_STATUSES)
      .filter(([, value]) => allowed.includes(value))
      .sort(([, a], [, b]) => allowed.indexOf(a) - allowed.indexOf(b)),
  );
}

/** The admin's fulfilment label for an order status: 'siap dikirim' → 'Sedang Diproses'. */
export function fulfilmentStageFor(status: string): string | null {
  for (const [label, statuses] of Object.entries(FULFILMENT_STAGES)) {
    if (statuses.includes(status)) {
      return label;
    }
  }

  return null;
}

/** The labels of a status map, for dropdowns and validation. */
export function labels(map: OptionMap): string[] {
  return Object.keys(map);
}

/** Label to stored value: 'Menunggu Pembayaran' → 'menunggu pembayaran'. */
export function toValue(map: OptionMap, label: string): string {
  const value = map[label];

  if (value === undefined) {
    throw new Error(`Status tidak dikenal: ${label}`);
  }

  return value;
}

/** Stored value back to label, for rendering. */
export function toLabel(map: OptionMap, value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const label = Object.keys(map).find((key) => map[key] === value);

  return label === undefined || label === "" ? null : label;
}

/** Dropdown options for a status map: stored value => label. */
export function options(map: OptionMap): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([label, value]) => [value, label]));
}

/**
 * How stock across every branch reads on a badge.
 *
 * Separate from the product's own status on purpose: a product can be Aktif and
 * still be out of stock everywhere, and those are different facts.
 */
export function stockLabel(quantity: number, lowThreshold = 20): string {
  if (quantity <= 0) {
    return "Habis";
  }

  if (quantity <= lowThreshold) {
    return "Stok Menipis";
  }

  return "Tersedia";
}
