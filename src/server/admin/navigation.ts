import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { can, isSuperAdmin, type StaffAccess } from "@/lib/permissions";

/**
 * The admin sidebar, as Filament built it from every resource and page: label, link,
 * icon, `navigationSort`, `getNavigationParentItem()`, and who may see it
 * (`canViewAny()` / `canAccess()` / AuthorizesByPermission's `viewAny`).
 *
 * Screens arrive in steps 7.2–7.7; until a screen is ported its link leads to a 404.
 */
type Requirement = { permission: string } | { superAdmin: true } | null;

type Definition = {
  /** Indonesian label, translated with __() */
  label: string;
  url: string;
  icon?: string;
  sort: number;
  parent?: string;
  requires: Requirement;
};

const DEFINITIONS: Definition[] = [
  { label: "Dasbor", url: "/admin", icon: "o-home", sort: -10, requires: null },
  { label: "plural:Pesanan", url: "/admin/pesanan", icon: "o-shopping-bag", sort: -9, requires: { permission: "Pesanan:Lihat" } },
  { label: "plural:Pengambilan", url: "/admin/pengambilan", icon: "o-qr-code", sort: 1, parent: "plural:Pesanan", requires: { permission: "Pesanan:Proses" } },
  { label: "plural:Faktur", url: "/admin/faktur", icon: "o-document-text", sort: 2, parent: "plural:Pesanan", requires: { permission: "Pesanan:Lihat" } },
  { label: "plural:Rekonsiliasi", url: "/admin/rekonsiliasi", icon: "o-banknotes", sort: 3, parent: "plural:Pesanan", requires: { permission: "Pesanan:Lihat" } },
  { label: "plural:Produk", url: "/admin/produk", icon: "o-cube", sort: -8, requires: { permission: "Produk:Lihat" } },
  { label: "plural:Kategori", url: "/admin/kategori", icon: "o-tag", sort: 1, parent: "plural:Produk", requires: { permission: "Produk:Lihat" } },
  { label: "plural:Atribut", url: "/admin/atribut", icon: "o-tag", sort: 2, parent: "plural:Produk", requires: { permission: "Produk:Lihat" } },
  { label: "plural:Pemasok", url: "/admin/pemasok", icon: "o-truck", sort: 3, parent: "plural:Produk", requires: { permission: "Produk:Lihat" } },
  { label: "Stok", url: "/admin/inventaris/stok", icon: "o-archive-box", sort: 4, parent: "plural:Produk", requires: { permission: "Inventaris:Lihat" } },
  { label: "Matriks Stok", url: "/admin/inventaris/matriks", icon: "o-table-cells", sort: 5, parent: "plural:Produk", requires: { permission: "Inventaris:Lihat" } },
  { label: "Transfer", url: "/admin/inventaris/transfer", icon: "o-arrows-right-left", sort: 6, parent: "plural:Produk", requires: { permission: "Inventaris:Lihat" } },
  { label: "plural:Pelanggan", url: "/admin/pelanggan", icon: "o-users", sort: -7, requires: { permission: "Pelanggan:Lihat" } },
  { label: "Inbox", url: "/admin/inbox", icon: "o-chat-bubble-left-right", sort: -6, requires: { permission: "Inbox:Lihat" } },
  { label: "plural:Kupon", url: "/admin/kupon", icon: "o-ticket", sort: -5, requires: { superAdmin: true } },
  { label: "plural:Newsletter", url: "/admin/newsletter", icon: "o-envelope", sort: -4, requires: { permission: "Konten:Lihat" } },
  { label: "plural:Subscriber", url: "/admin/subscriber", icon: "o-user-group", sort: 1, parent: "plural:Newsletter", requires: { permission: "Konten:Lihat" } },
  { label: "plural:Cabang", url: "/admin/cabang", icon: "o-building-storefront", sort: -3, requires: { permission: "Cabang:Lihat" } },
  { label: "plural:Staf", url: "/admin/staf", icon: "o-user-group", sort: -2, requires: { permission: "Pengaturan:Ubah" } },
  { label: "plural:Peran", url: "/admin/peran", icon: "o-shield-check", sort: 1, parent: "plural:Staf", requires: { permission: "Peran:Lihat" } },
  { label: "Hak Akses", url: "/admin/hak-akses", icon: "o-key", sort: 2, parent: "plural:Staf", requires: { permission: "Peran:Lihat" } },
  { label: "Keamanan", url: "/admin/keamanan", icon: "o-shield-exclamation", sort: 3, parent: "plural:Staf", requires: null },
  { label: "Media File", url: "/admin/media-file", icon: "o-photo", sort: 6, requires: { permission: "Media:Lihat" } },
  { label: "Konten Website", url: "/admin/konten-website", icon: "o-paint-brush", sort: 7, requires: { permission: "Konten:Lihat" } },
];

export type NavItem = {
  label: string;
  url: string;
  icon?: string;
  active: boolean;
  children: NavItem[];
  hasActiveChild: boolean;
  /** `getNavigationBadge()`, with its colour and tooltip */
  badge?: { text: string; color: "danger"; tooltip: string };
};

function allowed(requires: Requirement, access: StaffAccess): boolean {
  if (requires === null) {
    return true;
  }

  return "superAdmin" in requires ? isSuperAdmin(access) : can(access, requires.permission);
}

/** Filament's `isActiveWhen`: the dashboard only on itself, a resource on any of its pages. */
function isActive(url: string, pathname: string): boolean {
  return url === "/admin" ? pathname === "/admin" : pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * The sidebar for one staff member on one page. Filament keeps navigation sort order
 * (ties by label), and lists a parent's sub-items only while the parent or one of them
 * is the current page. A sub-item whose parent the staff member can't see is not shown
 * at all, as in Filament: a Kasir with Inventaris:Lihat gets no Stok entry (it sits
 * under Produk), and only staff who see Staf get Keamanan. The pages still open by URL.
 */
export function adminNavigation(access: StaffAccess, pathname: string, locale: AdminLocale, badges: Record<string, NavItem["badge"]> = {}): NavItem[] {
  const visible = DEFINITIONS.filter((definition) => allowed(definition.requires, access));
  const toItem = (definition: Definition): NavItem => ({
    label: translate(locale, definition.label),
    url: definition.url,
    icon: definition.icon,
    active: isActive(definition.url, pathname),
    children: [],
    hasActiveChild: false,
    badge: badges[definition.url],
  });
  const bySort = (a: Definition, b: Definition) => a.sort - b.sort || translate(locale, a.label).localeCompare(translate(locale, b.label));

  return visible
    .filter((definition) => !definition.parent)
    .sort(bySort)
    .map((definition) => {
      const item = toItem(definition);
      const children = visible
        .filter((child) => child.parent === definition.label)
        .sort(bySort)
        .map(toItem);

      item.hasActiveChild = children.some((child) => child.active);
      item.children = item.active || item.hasActiveChild ? children : [];

      return item;
    });
}
