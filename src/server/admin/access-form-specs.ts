import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { BRANCH_STATUSES, options } from "@/lib/admin-options";
import { uploadTypes, type StaffAccess } from "@/lib/permissions";
import type { FormBlock } from "@/views/admin/ResourceForm";
import { branchOptions } from "./branches";
import { permissionOptions } from "./roles";
import { roleOptions } from "./staff-accounts";

/** BranchForm, StaffForm and RoleForm as ResourceForm draws them, in the panel's language. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif"];

export function branchFormBlocks(locale: AdminLocale, access: StaffAccess, photo: { url: string } | null = null): FormBlock[] {
  const t = (text: string) => translate(locale, text);

  return [
    {
      section: { id: "identitas-cabang", heading: t("Identitas Cabang"), half: true },
      columns: 2,
      fields: [
        { kind: "text", name: "name", label: t("Nama Cabang"), required: true, maxLength: 120, placeholder: t("Apotek Inofarma Cinere"), full: true },
        {
          kind: "select",
          name: "status",
          label: t("Status"),
          required: true,
          placeholder: t("Pilih salah satu opsi"),
          options: Object.entries(options(BRANCH_STATUSES)).map(([value, label]) => ({ value, label: t(label) })),
        },
        { kind: "text", inputType: "tel", name: "phone", label: t("Telepon"), maxLength: 30, placeholder: "+62 21 5551 0001" },
        { kind: "text", inputType: "tel", name: "whatsapp", label: t("WhatsApp"), maxLength: 30, placeholder: "+62 812-0000-1111" },
      ],
    },
    {
      section: { id: "alamat-lokasi", heading: t("Alamat & Lokasi"), half: true },
      columns: 2,
      fields: [
        { kind: "text", name: "address_line", label: t("Alamat Jalan"), required: true, maxLength: 255, placeholder: t("Jl. Contoh No. 1"), full: true },
        { kind: "text", name: "kelurahan", label: "Kelurahan", maxLength: 80 },
        { kind: "text", name: "kecamatan", label: "Kecamatan", maxLength: 80 },
        { kind: "text", name: "kota", label: t("Kota/Kabupaten"), required: true, maxLength: 80 },
        { kind: "text", name: "provinsi", label: t("Provinsi"), required: true, maxLength: 80 },
        { kind: "text", name: "postal_code", label: t("Kode Pos"), maxLength: 10 },
        {
          kind: "number",
          name: "latitude",
          label: t("Lintang (Latitude)"),
          min: -90,
          max: 90,
          placeholder: "-6.200000",
          requiredWhen: { field: "supports_delivery", equals: "1" },
          helper: t("Wajib bila cabang melayani antar: dipakai untuk ongkos kirim dan resi. Bila kosong, cabang tidak muncul di pencarian terdekat."),
        },
        { kind: "number", name: "longitude", label: t("Bujur (Longitude)"), min: -180, max: 180, placeholder: "106.816666", requiredWhen: { field: "supports_delivery", equals: "1" } },
      ],
    },
    {
      section: { id: "perizinan", heading: t("Perizinan"), half: true },
      columns: 2,
      fields: [
        { kind: "text", name: "sia_number", label: t("Nomor SIA"), maxLength: 60, placeholder: "SIA/2025/00123" },
        { kind: "text", name: "apj_name", label: t("Nama APJ"), maxLength: 120 },
        { kind: "text", name: "apj_sipa_number", label: t("Nomor SIPA APJ"), maxLength: 60 },
        { kind: "text", name: "practice_schedule", label: t("Waktu Praktik"), maxLength: 120, placeholder: "Senin - Jumat (08.00-16.00)" },
        { kind: "text", name: "store_schedule", label: t("Jadwal Toko"), maxLength: 120, placeholder: "Senin - Jumat (08.00-16.00)" },
      ],
    },
    {
      section: { id: "halaman-apotek", heading: t("Halaman Apotek"), description: t("Cabang dengan foto tampil di bagian Apotek Inofarma Terdekat di beranda dan punya halaman sendiri di toko."), half: true },
      columns: 1,
      fields: [{ kind: "files", name: "photo_path", label: t("Foto Apotek"), accept: uploadTypes(access, IMAGE_TYPES), maxSizeKb: 4096, existing: photo }],
    },
    {
      section: { id: "layanan", heading: t("Layanan"), half: true },
      columns: 2,
      fields: [
        { kind: "toggle", name: "supports_delivery", label: t("Melayani antar"), required: true },
        { kind: "toggle", name: "supports_pickup", label: t("Melayani ambil di tempat"), required: true },
        { kind: "number", name: "delivery_radius_km", label: t("Radius Antar (km)"), required: true, min: 1, max: 100 },
      ],
    },
  ];
}

export const BRANCH_DEFAULTS = {
  name: "",
  status: "aktif",
  phone: "",
  whatsapp: "",
  address_line: "",
  kelurahan: "",
  kecamatan: "",
  kota: "",
  provinsi: "",
  postal_code: "",
  latitude: "",
  longitude: "",
  sia_number: "",
  apj_name: "",
  apj_sipa_number: "",
  practice_schedule: "",
  store_schedule: "",
  supports_delivery: "1",
  supports_pickup: "1",
  delivery_radius_km: "10",
};

const bulk = (locale: AdminLocale) => ({ selectAll: translate(locale, "Pilih semua"), deselectAll: translate(locale, "Batalkan semua pilihan") });

export async function staffFormBlocks(locale: AdminLocale, mode: "create" | "edit"): Promise<FormBlock[]> {
  const t = (text: string) => translate(locale, text);
  const passwordLabels = { show: t("Tampilkan kata sandi"), hide: t("Sembunyikan kata sandi") };

  return [
    {
      section: { id: "akun", heading: t("Akun"), half: true },
      columns: 2,
      fields: [
        { kind: "text", name: "name", label: t("Nama"), required: true, maxLength: 255 },
        { kind: "text", inputType: "email", name: "email", label: t("Email"), required: true, maxLength: 255 },
        { kind: "text", name: "phone", label: t("Telepon"), maxLength: 30 },
        { kind: "searchable", name: "branch_id", label: t("Cabang"), options: await branchOptions(), placeholder: t("Pusat (semua cabang)") },
        { kind: "password", name: "password", label: t("Kata Sandi"), required: mode === "create", labels: passwordLabels },
        { kind: "password", name: "password_confirmation", label: t("Konfirmasi Kata Sandi"), required: mode === "create", labels: passwordLabels },
        { kind: "toggle", name: "is_active", label: t("Aktif") },
      ],
    },
    {
      section: { id: "peran", heading: t("Peran"), half: true },
      columns: 1,
      // `->label('')` leaves Filament's label from the field name
      fields: [{ kind: "checkboxes", name: "roles", label: "Roles", options: await roleOptions(), columns: 3, bulk: bulk(locale) }],
    },
  ];
}

export async function roleFormBlocks(locale: AdminLocale): Promise<FormBlock[]> {
  const t = (text: string) => translate(locale, text);

  return [
    {
      section: { id: "peran", heading: t("Peran"), half: true },
      columns: 1,
      fields: [
        { kind: "text", name: "name", label: t("Nama"), required: true, maxLength: 100 },
        { kind: "textarea", name: "description", label: t("Deskripsi"), maxLength: 255 },
      ],
    },
    {
      section: { id: "hak-akses", heading: t("Hak Akses"), half: true },
      columns: 1,
      fields: [
        {
          kind: "checkboxes",
          name: "permissions",
          label: "Permissions",
          options: await permissionOptions(),
          columns: 3,
          bulk: bulk(locale),
          search: { prompt: t("Ketik untuk mencari..."), noResults: t("Tidak ada opsi yang tersedia.") },
        },
      ],
    },
  ];
}
