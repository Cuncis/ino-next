import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FLASH_HEADER, parseFlash } from "@/lib/flash";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { loadStaffAccess, type StaffAccess } from "@/lib/permissions";
import { unreadNotificationCount } from "@/server/admin/database-notifications";
import { adminNavigation, type NavItem } from "@/server/admin/navigation";
import { currentStaff, type Staff } from "@/server/admin/staff-auth";
import { FiIcon } from "./Icon";
import { FiToaster } from "./Modal";
import { GlobalSearch, NotificationsBell, SidebarFrame, SidebarProvider, SidebarToggles, UserMenu } from "./Shell";

/**
 * Filament's panel layout for one page: black top bar (search, bell, avatar menu), the
 * sidebar for this staff member, and the page itself. Each page renders it, so the
 * sidebar's active item and the staff member's rights are fresh on every visit.
 */
export type AdminContext = { staff: Staff; access: StaffAccess; locale: AdminLocale; t: (text: string, replace?: Record<string, string | number>) => string };

/** The signed-in staff member, their rights and language; 404 when they may not see the page. */
export async function adminContext(allowed: (access: StaffAccess) => boolean = () => true): Promise<AdminContext> {
  const current = await currentStaff();

  // src/proxy.ts only lets signed-in staff through
  if (!current) {
    notFound();
  }

  const access = await loadStaffAccess(current.staff.id);

  // Filament answers a page the staff member may not open with 403
  if (!allowed(access)) {
    notFound();
  }

  return { staff: current.staff, access, locale: current.locale, t: (text, replace) => translate(current.locale, text, replace) };
}

/** Filament's default avatar (ui-avatars.com, the initials on the panel's darkest grey). */
function avatarUrl(name: string): string {
  const initials = name
    .trim()
    .split(" ")
    .map((part) => (part ? [...part][0] : ""))
    .join(" ");

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials).replace(/%20/g, "+")}&format=svg&color=FFFFFF&background=%2309090b`;
}

function SidebarItem({ item, grouped }: { item: NavItem; grouped?: { first: boolean; last: boolean } }) {
  const classes = ["fi-sidebar-item", item.active ? "fi-active" : "", item.hasActiveChild ? "fi-sidebar-item-has-active-child-items" : "", "fi-sidebar-item-has-url"].filter(Boolean).join(" ");

  return (
    <li className={classes}>
      <a href={item.url} aria-current={item.active ? "page" : undefined} className="fi-sidebar-item-btn">
        {grouped ? (
          <div className="fi-sidebar-item-grouped-border">
            {grouped.first ? null : <div className="fi-sidebar-item-grouped-border-part-not-first" />}
            {grouped.last ? null : <div className="fi-sidebar-item-grouped-border-part-not-last" />}
            <div className="fi-sidebar-item-grouped-border-part" />
          </div>
        ) : item.icon ? (
          <FiIcon name={item.icon} size="lg" className="fi-sidebar-item-icon" />
        ) : null}
        <span className="fi-sidebar-item-label">{item.label}</span>
      </a>
      {item.children.length ? (
        <ul className="fi-sidebar-sub-group-items">
          {item.children.map((child, index) => (
            <SidebarItem key={child.url} item={child} grouped={{ first: index === 0, last: index === item.children.length - 1 }} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export async function AdminShell({ context, pathname, children }: { context: AdminContext; pathname: string; children: ReactNode }) {
  const { staff, access, locale, t } = context;
  const navigation = adminNavigation(access, pathname, locale);
  const unread = await unreadNotificationCount(staff.id);
  const flash = parseFlash((await headers()).get(FLASH_HEADER));
  const labels = {
    expand: t("Perluas menu"),
    collapse: t("Persempit menu"),
    search: t("Cari"),
    globalSearch: t("Pencarian global"),
    noResults: t("Pencarian tidak ditemukan."),
    openNotifications: t("Buka notifikasi"),
    notifications: t("Notifikasi"),
    markAllRead: t("Tandai semua sudah dibaca"),
    clear: t("Bersihkan"),
    emptyHeading: t("Tidak ada notifikasi"),
    emptyDescription: t("Silakan periksa kembali nanti"),
    close: t("Tutup"),
    userMenu: t("Menu pengguna"),
    light: t("Mode Terang"),
    dark: t("Mode Gelap"),
    system: t("Sesuai tema perangkat"),
    signOut: t("Keluar"),
    avatarAlt: t("Avatar :name", { name: staff.name }),
  };
  const toasts = [
    ...(flash.success ? [{ status: "success" as const, title: flash.success }] : []),
    ...(flash.error ? [{ status: "danger" as const, title: flash.error }] : []),
  ];

  return (
    <FiToaster initial={toasts}>
      <SidebarProvider>
        <a href="#fi-main-content" className="fi-skip-link fi-sr-only">
          Skip to content
        </a>
        <div className="fi-topbar-ctn">
          <nav aria-label="Topbar" className="fi-topbar">
            <SidebarToggles labels={labels} />
            <div className="fi-topbar-start">
              <a href="/admin">
                <div className="fi-logo">Inofarma</div>
              </a>
            </div>
            <div className="fi-topbar-end">
              <GlobalSearch labels={labels} />
              <NotificationsBell initialUnread={unread} labels={labels} />
              <UserMenu name={staff.name} avatarUrl={avatarUrl(staff.name)} locale={locale} labels={labels} />
            </div>
          </nav>
        </div>
        <div className="fi-layout">
          <SidebarFrame>
            <div className="fi-sidebar-header-ctn">
              <header className="fi-sidebar-header">
                <div className="fi-sidebar-header-logo-ctn">
                  <a href="/admin">
                    <div className="fi-logo">Inofarma</div>
                  </a>
                </div>
              </header>
            </div>
            <nav aria-label="Sidebar navigation" className="fi-sidebar-nav">
              <ul className="fi-sidebar-nav-groups">
                <li data-group-label="" className="fi-sidebar-group fi-collapsible">
                  <ul className="fi-sidebar-group-items">
                    {navigation.map((item) => (
                      <SidebarItem key={item.url} item={item} />
                    ))}
                  </ul>
                </li>
              </ul>
            </nav>
          </SidebarFrame>
          <div className="fi-main-ctn" style={{ display: "flex", opacity: 1 }}>
            <main id="fi-main-content" tabIndex={-1} className="fi-main fi-width-7xl">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </FiToaster>
  );
}
