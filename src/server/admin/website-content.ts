import { asc, eq } from "drizzle-orm";
import { categories, db } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { lines, writeContent } from "@/lib/content-store";
import type { EditorMessages, EditorNode } from "@/lib/content-editor";
import { uploadTypes, type StaffAccess } from "@/lib/permissions";
import { randomString } from "@/lib/random";
import { uploadsDisk } from "@/lib/storage";
import { auditLog } from "@/server/audit";
import { documentContent, type DocumentKey } from "@/server/shop/content/documents";
import { FAQ_CONTENT_KEY, faqItems, MAX_FAQ_QUESTIONS, cleanFaq } from "@/server/shop/content/faq";
import { FOOTER_CONTENT_KEY, FOOTER_DEFAULTS, footerContent } from "@/server/shop/content/footer";
import { HEADINGS, HOME_CONTENT_KEY, homeContent } from "@/server/shop/content/home";
import { imageUrl } from "@/server/shop/content/image-url";
import type { Staff } from "./staff-auth";

/**
 * Konten Website (WebsiteContent and its ContentEditorPage subclasses): one editor per
 * storefront page, each loading what is saved now and saving it through the page's own
 * content class, with a "konten_diubah" audit entry. Konten:Lihat to look, Konten:Ubah to save.
 */
export type EditorSlug = "beranda" | "faq" | "info-pengiriman" | "pengembalian-dana" | "syarat-ketentuan" | "kebijakan-privasi" | "footer";

type EditorInfo = { slug: EditorSlug; navigation: string; title: string; description: string; icon: string; storefrontUrl: string | null; document?: DocumentKey };

/** WebsiteContent::EDITORS, in order. */
export const EDITORS: EditorInfo[] = [
  { slug: "beranda", navigation: "Beranda", title: "Konten Beranda", description: "Hero carousel, ikon kategori, banner promo, brand, keuntungan, testimoni, dan teks penutup.", icon: "o-home", storefrontUrl: "/" },
  { slug: "faq", navigation: "FAQ", title: "Konten FAQ", description: "Pertanyaan yang sering diajukan beserta jawabannya.", icon: "o-question-mark-circle", storefrontUrl: "/faq" },
  {
    slug: "info-pengiriman",
    navigation: "Info Pengiriman",
    title: "Konten :page",
    description: "Ongkos kirim, area, estimasi waktu, ambil di toko, dan metode pembayaran.",
    icon: "o-truck",
    storefrontUrl: "/shipping-info",
    document: "shipping",
  },
  {
    slug: "pengembalian-dana",
    navigation: "Kebijakan Pengembalian Dana",
    title: "Konten :page",
    description: "Kapan, bagaimana, dan berapa lama dana dikembalikan.",
    icon: "o-receipt-refund",
    storefrontUrl: "/kebijakan-pengembalian-dana",
    document: "refund",
  },
  {
    slug: "syarat-ketentuan",
    navigation: "Syarat & Ketentuan",
    title: "Konten :page",
    description: "Popup di halaman Daftar, Checkout, dan Profil. Nomor pasal dibuat otomatis.",
    icon: "o-scale",
    storefrontUrl: null,
    document: "terms",
  },
  {
    slug: "kebijakan-privasi",
    navigation: "Kebijakan Privasi",
    title: "Konten :page",
    description: "Popup di halaman Daftar, Checkout, dan Profil. Nomor pasal dibuat otomatis.",
    icon: "o-shield-check",
    storefrontUrl: null,
    document: "privacy",
  },
  {
    slug: "footer",
    navigation: "Footer & Perusahaan",
    title: "Konten Footer & Perusahaan",
    description: "Teks dan tautan di footer setiap halaman (desktop), serta data perusahaan di dokumen legal.",
    icon: "o-building-office-2",
    storefrontUrl: "/",
  },
];

export const findEditor = (slug: string) => EDITORS.find((editor) => editor.slug === slug) ?? null;

export const editorTitle = (editor: EditorInfo, locale: AdminLocale) => translate(locale, editor.title, { page: translate(locale, editor.navigation) });

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif"];
const IMAGE_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif" };
const LINK = "^(/|https?://)";

const HEADING_LABELS: Record<string, string> = {
  recommended: "Produk rekomendasi",
  newArrivals: "Produk terbaru",
  trending: "Produk terlaris",
  brands: "Logo brand",
  benefits: "Keuntungan",
  nearest: "Apotek terdekat",
  testimonials: "Testimoni",
};

async function homeCategories() {
  return db.select({ id: categories.id, name: categories.name, imagePath: categories.imagePath }).from(categories).orderBy(asc(categories.position), asc(categories.id));
}

/** The editor's schema, in the panel's language. */
export async function editorSchema(editor: EditorInfo, locale: AdminLocale, access: StaffAccess): Promise<EditorNode[]> {
  const t = (text: string, replace?: Record<string, string | number>) => translate(locale, text, replace);
  const image = (name: string, label: string, extra: Partial<Extract<EditorNode, { type: "image" }>> = {}): EditorNode => ({
    type: "image",
    name,
    label,
    accept: uploadTypes(access, IMAGE_TYPES),
    maxSizeKb: 4096,
    ...extra,
  });

  switch (editor.slug) {
    case "beranda": {
      const slides = (name: string, help: string, min?: number): EditorNode => ({
        type: "repeater",
        name,
        label: "",
        hiddenLabel: true,
        helper: help,
        min,
        max: 10,
        itemLabel: "alt",
        grid: { default: 1, lg: 2, "2xl": 3 },
        addLabel: t("Tambah slide"),
        children: [
          image("image", t("Gambar"), { required: true, previewHeight: 180 }),
          {
            type: "grid",
            // Grid::make(2): a bare number is the column count from lg up
            columns: { default: 1, lg: 2 },
            children: [
              { type: "text", name: "href", label: t("Tautan"), placeholder: "/shop", helper: t("Halaman toko (misalnya /shop) atau alamat lengkap https://..."), required: true, maxLength: 500, regex: LINK },
              { type: "text", name: "alt", label: t("Teks alternatif"), helper: t("Isi gambar dalam kata-kata, untuk pembaca layar dan Google."), required: true, maxLength: 200 },
            ],
          },
        ],
      });

      return [
        {
          type: "tabs",
          queryKey: "bagian",
          tabs: [
            { key: "hero-carousel", label: t("Hero Carousel"), icon: "o-photo", children: [slides("hero", t("Slide besar paling atas. Ukuran ideal 1600 x 900 px (16:9)."), 1)] },
            {
              key: "ikon-kategori",
              label: t("Ikon Kategori"),
              icon: "o-squares-2x2",
              children: [
                {
                  type: "section",
                  description: t("Nama tiap ikon adalah nama kategorinya, jadi tautan ke toko tetap benar. Nama dan urutan diubah di menu Kategori."),
                  columns: { default: 1 },
                  children: [
                    {
                      type: "grid",
                      columns: { default: 2, md: 4, "2xl": 8 },
                      children: [
                        ...(await homeCategories()).map((category) => image(`categoryIcons.category${category.id}`, category.name, { previewHeight: 120 })),
                        image("allProductsIcon", t("Semua Produk"), { previewHeight: 120 }),
                      ],
                    },
                  ],
                },
              ],
            },
            { key: "banner-promo", label: t("Banner Promo"), icon: "o-megaphone", children: [slides("promo", t("Banner tipis di bawah ikon kategori. Ukuran ideal 1740 x 396 px. Kosongkan untuk menyembunyikan."))] },
            { key: "banner-bawah", label: t("Banner Bawah"), icon: "o-rectangle-group", children: [slides("bottom", t("Banner setelah daftar produk. Ukuran ideal 1920 x 601 px. Kosongkan untuk menyembunyikan."))] },
            {
              key: "brand",
              label: t("Brand"),
              icon: "o-star",
              children: [
                {
                  type: "repeater",
                  name: "brands",
                  label: "",
                  hiddenLabel: true,
                  helper: t('Logo "Brand Terlaris", ditampilkan dalam lingkaran. Pakai logo persegi.'),
                  itemLabel: "name",
                  grid: { default: 1, md: 3, xl: 4, "2xl": 6 },
                  max: 18,
                  addLabel: t("Tambah brand"),
                  children: [{ type: "text", name: "name", label: t("Nama Brand"), required: true, maxLength: 60 }, image("image", t("Logo"), { required: true })],
                },
              ],
            },
            {
              key: "keuntungan",
              label: t("Keuntungan"),
              icon: "o-check-badge",
              children: [
                {
                  type: "repeater",
                  name: "benefits",
                  label: "",
                  hiddenLabel: true,
                  helper: t('"Keuntungan Belanja di Inofarma". Di desktop tampil 9 per baris.'),
                  itemLabel: "label",
                  grid: { default: 1, md: 3, xl: 4, "2xl": 6 },
                  max: 18,
                  addLabel: t("Tambah keuntungan"),
                  children: [{ type: "text", name: "label", label: t("Judul"), required: true, maxLength: 60 }, image("image", t("Ikon"), { required: true })],
                },
              ],
            },
            {
              key: "testimoni",
              label: t("Testimoni"),
              icon: "o-chat-bubble-left-right",
              children: [
                {
                  type: "repeater",
                  name: "testimonials",
                  label: "",
                  hiddenLabel: true,
                  itemLabel: "name",
                  grid: { default: 1, lg: 2, "2xl": 3 },
                  max: 12,
                  addLabel: t("Tambah testimoni"),
                  children: [
                    {
                      type: "grid",
                      columns: { default: 1, md: 3 },
                      children: [
                        image("image", t("Foto"), { required: true, avatar: true }),
                        {
                          type: "grid",
                          columns: { default: 1, lg: 1 },
                          span: { md: 2 },
                          children: [
                            { type: "text", name: "name", label: t("Nama"), required: true, maxLength: 60 },
                            { type: "text", name: "branch", label: t("Cabang"), required: true, maxLength: 80 },
                          ],
                        },
                      ],
                    },
                    { type: "textarea", name: "quote", label: t("Ulasan"), required: true, rows: 3, maxLength: 600 },
                  ],
                },
              ],
            },
            {
              key: "judul-bagian",
              label: t("Judul Bagian"),
              icon: "o-h1",
              children: [
                {
                  type: "section",
                  description: t("Judul di atas tiap bagian Beranda, urut dari atas ke bawah."),
                  columns: { default: 1, md: 2 },
                  children: Object.entries(HEADING_LABELS).map(([key, label]) => ({ type: "text" as const, name: `headings.${key}`, label: t(label), placeholder: HEADINGS[key], required: true, maxLength: 80 })),
                },
              ],
            },
            {
              key: "teks-kontak",
              label: t("Teks & Kontak"),
              icon: "o-document-text",
              children: [
                {
                  type: "repeater",
                  name: "texts",
                  label: t("Teks penutup"),
                  itemLabel: "title",
                  collapsible: true,
                  max: 6,
                  addLabel: t("Tambah teks"),
                  children: [
                    { type: "text", name: "title", label: t("Judul"), required: true, maxLength: 120 },
                    { type: "textarea", name: "body", label: t("Isi"), helper: t("Pisahkan paragraf dengan satu baris kosong."), required: true, rows: 6, maxLength: 5000 },
                  ],
                },
                {
                  type: "section",
                  heading: t("Kontak"),
                  columns: { default: 1 },
                  children: [
                    { type: "text", name: "contactTitle", label: t("Judul"), required: true, maxLength: 120 },
                    { type: "textarea", name: "contactIntro", label: t("Pengantar"), rows: 2, maxLength: 500 },
                    {
                      type: "repeater",
                      name: "contacts",
                      label: t("Kotak kontak"),
                      itemLabel: "title",
                      grid: { default: 1, lg: 2 },
                      max: 4,
                      addLabel: t("Tambah kontak"),
                      children: [
                        { type: "select", name: "icon", label: t("Ikon"), required: true, placeholder: t("Pilih salah satu opsi"), options: [{ value: "phone", label: t("Telepon") }, { value: "email", label: t("Email") }] },
                        { type: "text", name: "title", label: t("Judul"), required: true, maxLength: 120 },
                        { type: "textarea", name: "lines", label: t("Isi"), helper: t("Satu baris per informasi."), required: true, rows: 3, maxLength: 500 },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
    }
    case "faq":
      return [
        {
          type: "repeater",
          name: "items",
          label: "",
          hiddenLabel: true,
          helper: t("Pertanyaan pertama tampil terbuka. Seret untuk mengubah urutan."),
          itemLabel: "question",
          collapsible: true,
          collapsed: true,
          grid: { default: 1, xl: 2 },
          min: 1,
          max: MAX_FAQ_QUESTIONS,
          addLabel: t("Tambah pertanyaan"),
          children: [
            { type: "text", name: "question", label: t("Pertanyaan"), required: true, maxLength: 200 },
            { type: "textarea", name: "answer", label: t("Jawaban"), helper: t("Pisahkan paragraf dengan satu baris kosong."), required: true, rows: 4, maxLength: 3000 },
          ],
        },
      ];
    case "footer":
      return [
        {
          type: "section",
          heading: t("Footer"),
          description: t("Tampil di bagian bawah setiap halaman versi desktop. Kolom pendaftaran newsletter tetap ada di sebelahnya."),
          columns: { default: 1, lg: 2 },
          children: [
            { type: "text", name: "aboutTitle", label: t("Judul kolom tentang"), required: true, maxLength: 80 },
            { type: "text", name: "menuTitle", label: t("Judul kolom menu"), required: true, maxLength: 80 },
            { type: "textarea", name: "aboutText", label: t("Teks tentang"), required: true, rows: 3, maxLength: 500, full: true },
            {
              type: "repeater",
              name: "links",
              label: t("Tautan menu"),
              itemLabel: "label",
              columns: 2,
              max: 8,
              full: true,
              addLabel: t("Tambah tautan"),
              children: [
                { type: "text", name: "label", label: t("Teks"), required: true, maxLength: 60 },
                { type: "text", name: "href", label: t("Tautan"), placeholder: "/shop", required: true, maxLength: 500, regex: LINK },
              ],
            },
            {
              type: "text",
              name: "copyright",
              label: t("Teks hak cipta"),
              prefix: `© ${new Date(Date.now() + 7 * 3600_000).getUTCFullYear()}`,
              helper: t("Tahun diisi otomatis."),
              required: true,
              maxLength: 120,
              full: true,
            },
          ],
        },
        {
          type: "section",
          heading: t("Data perusahaan"),
          description: t("Tampil di akhir Syarat & Ketentuan dan Kebijakan Privasi."),
          columns: { default: 1, lg: 2 },
          children: [
            { type: "text", name: "company.name", label: t("Nama perusahaan"), required: true, maxLength: 120 },
            { type: "text", name: "company.email", label: t("Email"), required: true, maxLength: 120, email: true },
            { type: "text", name: "company.phone", label: t("Telepon"), required: true, maxLength: 40 },
            { type: "textarea", name: "company.address", label: t("Alamat"), required: true, rows: 3, maxLength: 500, full: true },
          ],
        },
      ];
    default: {
      const legal = editor.document === "terms" || editor.document === "privacy";
      const current = await documentContent(editor.document!);
      const head: EditorNode = {
        type: "section",
        columns: { default: 1, lg: 2 },
        children: [
          { type: "text", name: "title", label: t("Judul"), required: true, maxLength: 120 },
          ...(legal
            ? ([
                { type: "note", text: t("Terakhir diperbarui: :date. Diisi otomatis dengan bulan ini setiap kali isi dokumen berubah.", { date: (current as { updatedAt: string }).updatedAt }) },
                {
                  type: "textarea",
                  name: "contactHeading",
                  label: t("Kalimat sebelum kontak"),
                  helper: t("Tampil di akhir dokumen, di atas data perusahaan (diubah di Footer & Perusahaan)."),
                  required: true,
                  rows: 2,
                  maxLength: 500,
                  full: true,
                },
              ] satisfies EditorNode[])
            : []),
        ],
      };

      const sections: EditorNode = legal
        ? {
            type: "repeater",
            name: "sections",
            label: t("Bagian"),
            helper: t("Nomor bagian (1., 2., ...) dan pasal (1.1, 1.2, ...) dibuat otomatis sesuai urutan, jadi jangan ditulis di judul atau isi."),
            itemLabel: "title",
            itemNumbers: true,
            collapsible: true,
            collapsed: true,
            min: 1,
            max: 40,
            addLabel: t("Tambah bagian"),
            children: [
              { type: "text", name: "title", label: t("Judul bagian"), required: true, maxLength: 160 },
              {
                type: "repeater",
                name: "clauses",
                label: t("Pasal"),
                itemNumbers: true,
                collapsible: true,
                min: 1,
                max: 40,
                addLabel: t("Tambah pasal"),
                children: [
                  { type: "textarea", name: "text", label: t("Isi pasal"), required: true, rows: 3, maxLength: 3000 },
                  { type: "textarea", name: "items", label: t("Poin-poin (opsional)"), helper: t("Satu poin per baris. Tampil sebagai daftar di bawah isi pasal."), rows: 3, maxLength: 5000 },
                ],
              },
            ],
          }
        : {
            type: "repeater",
            name: "sections",
            label: t("Bagian"),
            itemLabel: "title",
            collapsible: true,
            collapsed: true,
            grid: { default: 1, xl: 2 },
            min: 1,
            max: 30,
            addLabel: t("Tambah bagian"),
            children: [
              { type: "text", name: "title", label: t("Judul bagian"), required: true, maxLength: 160 },
              { type: "textarea", name: "body", label: t("Isi"), helper: t("Pisahkan paragraf dengan satu baris kosong."), required: true, rows: 5, maxLength: 5000 },
            ],
          };

      return [head, sections];
    }
  }
}

/** The form's state from what is saved now (`currentContent()`). */
export async function editorState(editor: EditorInfo): Promise<Record<string, unknown>> {
  switch (editor.slug) {
    case "beranda":
      return {
        ...(await homeContent()),
        categoryIcons: Object.fromEntries((await homeCategories()).map((category) => [`category${category.id}`, category.imagePath])),
      };
    case "faq":
      return { items: await faqItems() };
    case "footer":
      return (await footerContent()) as unknown as Record<string, unknown>;
    default:
      return (await documentContent(editor.document!)) as unknown as Record<string, unknown>;
  }
}

/** Laravel's messages for the editors' rules. */
export function editorMessages(locale: AdminLocale): EditorMessages {
  const en = locale === "en";

  return {
    required: (attribute) => (en ? `The ${attribute} field is required.` : `Kolom ${attribute} wajib diisi.`),
    max: (attribute, max) => (en ? `The ${attribute} field must not be greater than ${max} characters.` : `Kolom ${attribute} tidak boleh lebih dari ${max} karakter.`),
    regex: (attribute) => (en ? `The ${attribute} field format is invalid.` : `Format kolom ${attribute} tidak valid.`),
    email: (attribute) => (en ? `The ${attribute} field must be a valid email address.` : `Kolom ${attribute} harus berupa alamat email yang valid.`),
    minItems: (attribute, min) => (en ? `The ${attribute} field must have at least ${min} items.` : `Kolom ${attribute} harus memiliki minimal ${min} item.`),
    maxItems: (attribute, max) => (en ? `The ${attribute} field must not have more than ${max} items.` : `Kolom ${attribute} tidak boleh memiliki lebih dari ${max} item.`),
  };
}

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value)).trim();
const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((item) => typeof item === "object" && item !== null) : []) as Record<string, unknown>[];

/** Files the browser sent for "upload:<key>" values, stored on the uploads disk under content/ as Laravel's hashName() names them. */
export async function storeUploads(state: unknown, files: Record<string, File[]>): Promise<unknown> {
  if (typeof state === "string" && state.startsWith("upload:")) {
    const [file] = files[state.slice("upload:".length)] ?? [];

    if (!file) {
      return null;
    }

    const path = `content/${randomString(40)}.${IMAGE_EXTENSIONS[file.type] ?? "bin"}`;

    await uploadsDisk().put(path, Buffer.from(await file.arrayBuffer()), file.type);

    return path;
  }

  if (Array.isArray(state)) {
    return Promise.all(state.map((item) => storeUploads(item, files)));
  }

  if (typeof state === "object" && state !== null) {
    return Object.fromEntries(await Promise.all(Object.entries(state).map(async ([key, value]) => [key, await storeUploads(value, files)])));
  }

  return state;
}

/** Every file waiting in the state, checked as FileUpload checks it. */
export function invalidUploads(state: unknown, files: Record<string, File[]>, allowed: string[], path = ""): Record<string, string> {
  const errors: Record<string, string> = {};

  if (typeof state === "string" && state.startsWith("upload:")) {
    const [file] = files[state.slice("upload:".length)] ?? [];

    if (file && (!allowed.includes(file.type) || file.size > 4096 * 1024)) {
      errors[path] = !allowed.includes(file.type) ? `Kolom ${path.split(".").at(-1)} harus berupa berkas berjenis: ${allowed.join(", ")}.` : `Kolom ${path.split(".").at(-1)} maksimal berukuran 4096 kilobita.`;
    }
  } else if (typeof state === "object" && state !== null) {
    for (const [key, value] of Object.entries(state)) {
      Object.assign(errors, invalidUploads(value, files, allowed, path ? `${path}.${key}` : key));
    }
  }

  return errors;
}

/** The value as the schema's fields give it, in their order (a repeater item holds only its own fields). */
function itemOf(item: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, item[key] ?? null]));
}

const ITEM_KEYS: Record<string, string[]> = {
  hero: ["image", "href", "alt"],
  promo: ["image", "href", "alt"],
  bottom: ["image", "href", "alt"],
  brands: ["name", "image"],
  benefits: ["label", "image"],
  testimonials: ["image", "name", "branch", "quote"],
  texts: ["title", "body"],
  contacts: ["icon", "title", "lines"],
};

/** The Beranda form's top-level fields in schema order (categoryIcons aside, which persist() takes out). */
const HOME_STATE_ORDER = ["hero", "allProductsIcon", "promo", "bottom", "brands", "benefits", "testimonials", "headings", "texts", "contactTitle", "contactIntro", "contacts"] as const;

/** "November 2026": now()->locale('id')->translatedFormat('F Y') in Jakarta. */
function monthYear(now = new Date()): string {
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const jakarta = new Date(now.getTime() + 7 * 3600_000);

  return `${months[jakarta.getUTCMonth()]} ${jakarta.getUTCFullYear()}`;
}

/** `persist()`: each page through its own content class's save(). */
export async function saveEditor(editor: EditorInfo, state: Record<string, unknown>, actor: Staff): Promise<void> {
  switch (editor.slug) {
    case "beranda": {
      const icons = (typeof state.categoryIcons === "object" && state.categoryIcons !== null ? state.categoryIcons : {}) as Record<string, unknown>;

      for (const category of await homeCategories()) {
        const icon = text(icons[`category${category.id}`]);

        if (icon !== "" && imageUrl(icon) !== category.imagePath) {
          await db.update(categories).set({ imagePath: imageUrl(icon), updatedAt: new Date() }).where(eq(categories.id, category.id));
        }
      }

      const content: Record<string, unknown> = {};

      // array_intersect_key($state, DEFAULTS) keeps the form's order: the fields tab by tab
      for (const key of HOME_STATE_ORDER) {
        if (!(key in state)) continue;

        if (key === "headings") {
          const headings = (typeof state.headings === "object" && state.headings !== null ? state.headings : {}) as Record<string, unknown>;

          content.headings = Object.fromEntries(Object.keys(HEADINGS).filter((heading) => heading in headings).map((heading) => [heading, text(headings[heading])]));
        } else if (Array.isArray(state[key])) {
          content[key] = list(state[key]).map((item) => {
            const kept = itemOf(item, ITEM_KEYS[key] ?? Object.keys(item));

            return text(kept.image) !== "" ? { ...kept, image: imageUrl(String(kept.image)) } : kept;
          });
        } else {
          content[key] = text(state[key]);
        }
      }

      if (text(content.allProductsIcon) !== "") {
        content.allProductsIcon = imageUrl(String(content.allProductsIcon));
      }

      await writeContent(HOME_CONTENT_KEY, content);
      break;
    }
    case "faq":
      await writeContent(FAQ_CONTENT_KEY, { items: cleanFaq(state.items ?? []).slice(0, MAX_FAQ_QUESTIONS) });
      break;
    case "footer": {
      const current = await footerContent();
      const company = (typeof state.company === "object" && state.company !== null ? state.company : {}) as Record<string, unknown>;

      await writeContent(FOOTER_CONTENT_KEY, {
        aboutTitle: text(state.aboutTitle),
        aboutText: text(state.aboutText),
        menuTitle: text(state.menuTitle),
        links: list(state.links)
          .map((link) => ({ label: text(link.label), href: text(link.href) }))
          .filter((link) => link.label !== "" && link.href !== "")
          .slice(0, 8),
        copyright: text(state.copyright),
        company: Object.fromEntries(Object.keys(FOOTER_DEFAULTS.company).map((field) => [field, text(company[field]) || current.company[field as keyof typeof current.company]])),
      });
      break;
    }
    default: {
      const document = editor.document!;
      const legal = document === "terms" || document === "privacy";
      const current = (await documentContent(document)) as Record<string, unknown>;
      const sections = legal
        ? list(state.sections)
            .map((section) => ({
              title: text(section.title),
              clauses: list(section.clauses)
                .map((clause) => ({ text: text(clause.text), items: lines(String(clause.items ?? "")).join("\n") }))
                .filter((clause) => clause.text !== ""),
            }))
            .filter((section) => section.title !== "" && section.clauses.length > 0)
        : list(state.sections)
            .map((section) => ({ title: text(section.title), body: text(section.body) }))
            .filter((section) => section.title !== "" && section.body !== "");
      const cleaned: Record<string, unknown> = { title: text(state.title) || current.title, sections };

      if (legal) {
        cleaned.contactHeading = text(state.contactHeading);

        const changed = JSON.stringify(sections) !== JSON.stringify(current.sections) || cleaned.contactHeading !== current.contactHeading;

        cleaned.updatedAt = changed ? monthYear() : current.updatedAt;
      }

      await writeContent(`content.document.${document}`, cleaned);
    }
  }

  await auditLog({ action: "konten_diubah", auditable: { type: "App\\Models\\User", id: actor.id }, newValues: { halaman: `konten-website/${editor.slug}` }, userId: actor.id, branchId: actor.branchId });
}
