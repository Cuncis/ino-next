"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { FiIcon } from "./Icon";
import { FiModal } from "./Modal";
import { FiBadge, FiLinkAction } from "./ui";

/**
 * The interactive parts of Filament's panel layout: the sidebar's open state, the user
 * menu (theme, language, sign out), the notifications bell and the global search. The
 * labels come translated from the server; markup and classes are Filament's.
 */
type Labels = Record<
  | "expand"
  | "collapse"
  | "search"
  | "globalSearch"
  | "noResults"
  | "openNotifications"
  | "notifications"
  | "markAllRead"
  | "clear"
  | "emptyHeading"
  | "emptyDescription"
  | "close"
  | "userMenu"
  | "light"
  | "dark"
  | "system"
  | "signOut"
  | "avatarAlt",
  string
>;

const SidebarContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: true, setOpen: () => {} });

/** Open on a wide screen, closed on a phone, like Filament's `$store.sidebar`. */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => setOpen(desktop.matches);

    sync();
    desktop.addEventListener("change", sync);

    return () => desktop.removeEventListener("change", sync);
  }, []);

  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

export function SidebarToggles({ labels }: { labels: Pick<Labels, "expand" | "collapse"> }) {
  const { open, setOpen } = useContext(SidebarContext);

  return (
    <>
      <button
        className="fi-icon-btn fi-size-md fi-topbar-open-sidebar-btn"
        title={labels.expand}
        aria-label={labels.expand}
        type="button"
        aria-controls="fi-main-sidebar"
        aria-expanded={open}
        style={open ? { display: "none" } : undefined}
        onClick={() => setOpen(true)}
      >
        <FiIcon name="o-bars-3" size="lg" />
      </button>
      <button
        className="fi-icon-btn fi-size-md fi-topbar-close-sidebar-btn"
        title={labels.collapse}
        aria-label={labels.collapse}
        type="button"
        aria-controls="fi-main-sidebar"
        aria-expanded={open}
        style={open ? undefined : { display: "none" }}
        onClick={() => setOpen(false)}
      >
        <FiIcon name="o-x-mark" size="lg" />
      </button>
    </>
  );
}

/** The sidebar wrapper: `fi-sidebar-open` while open, and the dimming overlay on a phone. */
export function SidebarFrame({ children }: { children: ReactNode }) {
  const { open, setOpen } = useContext(SidebarContext);

  return (
    <>
      {open ? <div className="fi-sidebar-close-overlay lg:hidden" onClick={() => setOpen(false)} /> : null}
      <div>
        <div id="fi-main-sidebar" className={`fi-sidebar fi-main-sidebar${open ? " fi-sidebar-open" : ""}`}>
          {children}
        </div>
      </div>
    </>
  );
}

/* ------------------------------- user menu ------------------------------- */

type ThemeMode = "light" | "dark" | "system";

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", dark);
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: MouseEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const position = () => {
    const rect = trigger.current?.getBoundingClientRect();

    return rect ? { position: "fixed" as const, top: rect.bottom + 8, right: window.innerWidth - rect.right } : undefined;
  };

  return { open, setOpen, trigger, panel, position };
}

function Flag({ locale }: { locale: "id" | "en" }) {
  const style = { borderRadius: 3, display: "block", boxShadow: "0 0 0 1px rgb(0 0 0 / .15)" };

  return (
    <span className="fi-icon fi-size-md">
      {locale === "id" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="24" height="16" aria-hidden="true" style={style}>
          <rect width="30" height="10" fill="#e70011" />
          <rect y="10" width="30" height="10" fill="#fff" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="24" height="16" aria-hidden="true" style={style}>
          <rect width="60" height="40" fill="#012169" />
          <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
          <path d="M0 0l60 40M60 0L0 40" stroke="#c8102e" strokeWidth="3" />
          <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" />
          <path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="8" />
        </svg>
      )}
    </span>
  );
}

/**
 * The avatar menu: name, light/dark/system theme (kept in this browser, as Filament's
 * `filament:theme:mode`), the ID/EN language switch and "Keluar". The language and sign
 * out are plain form posts, as in Filament.
 */
export function UserMenu({ name, avatarUrl, locale, labels }: { name: string; avatarUrl: string; locale: "id" | "en"; labels: Labels }) {
  const { open, setOpen, trigger, panel, position } = useDropdown();
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    let stored: string | null = null;

    try {
      stored = localStorage.getItem("filament:theme:mode");
    } catch {}

    // the browser's saved choice is only known after mounting
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored === "dark" || stored === "system" ? stored : "light");
  }, []);

  const choose = (mode: ThemeMode) => {
    setTheme(mode);

    try {
      localStorage.setItem("filament:theme:mode", mode);
    } catch {}

    applyTheme(mode);
  };

  return (
    <div className="fi-dropdown fi-user-menu">
      <div className="fi-dropdown-trigger" ref={trigger}>
        <button aria-label={labels.userMenu} type="button" className="fi-user-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={labels.avatarAlt} className="fi-avatar fi-circular fi-size-md fi-user-avatar" src={avatarUrl} loading="lazy" />
        </button>
      </div>
      {open ? (
        <div className="fi-dropdown-panel" ref={panel} style={position()} role="menu">
          <div className="fi-dropdown-header">
            <FiIcon name="m-user-circle" />
            <span>{name}</span>
          </div>
          <div className="fi-dropdown-list" role="group">
            <div role="group" aria-label="Theme" className="fi-theme-switcher">
              {(
                [
                  ["light", "m-sun", labels.light],
                  ["dark", "m-moon", labels.dark],
                  ["system", "m-computer-desktop", labels.system],
                ] as const
              ).map(([mode, icon, label]) => (
                <button
                  key={mode}
                  aria-label={label}
                  role="menuitemradio"
                  type="button"
                  className={`fi-theme-switcher-btn${theme === mode ? " fi-active" : ""}`}
                  aria-checked={theme === mode}
                  onClick={() => choose(mode)}
                >
                  <FiIcon name={icon} />
                </button>
              ))}
            </div>
          </div>
          <div className="fi-dropdown-list" role="group">
            {(["id", "en"] as const).map((code) => (
              <form key={code} action={`/admin/bahasa/${code}`} method="post">
                <button
                  role="menuitem"
                  type="submit"
                  title={code === "id" ? "Bahasa Indonesia" : "English"}
                  data-lang={code}
                  data-active={locale === code ? "true" : undefined}
                  className="fi-dropdown-list-item"
                >
                  <Flag locale={code} />
                  <span className="fi-dropdown-list-item-label">{code.toUpperCase()}</span>
                </button>
              </form>
            ))}
            <form action="/admin/logout" method="post">
              <button role="menuitem" type="submit" className="fi-dropdown-list-item">
                <FiIcon name="m-arrow-left-end-on-rectangle" />
                <span className="fi-dropdown-list-item-label">{labels.signOut}</span>
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------- notifications ----------------------------- */

type BellNotification = {
  id: string;
  title: string;
  body: string | null;
  date: string;
  unread: boolean;
  actions: { label: string; url: string | null; newTab: boolean }[];
};

async function post(url: string) {
  await fetch(url, { method: "POST", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin" });
}

/** Filament's database notifications: the bell, its unread badge, and the slide-over list. */
export function NotificationsBell({ initialUnread, labels }: { initialUnread: number; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [list, setList] = useState<BellNotification[] | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/form/admin/notifikasi", { headers: { Accept: "application/json" }, credentials: "same-origin" });

    if (response.ok) {
      const body = (await response.json()) as { unread: number; notifications: BellNotification[] } | { redirect: string };

      // the session ended (idle, turned off, signed out elsewhere): Filament goes to sign-in
      if ("redirect" in body) {
        window.location.assign(body.redirect);

        return;
      }

      setUnread(body.unread);
      setList(body.notifications);
    }
  }, []);

  // Filament polls every 30 seconds
  useEffect(() => {
    const timer = window.setInterval(load, 30_000);

    return () => window.clearInterval(timer);
  }, [load]);

  const title = unread > 0 ? `Notifications, ${unread} unread notification${unread === 1 ? "" : "s"}` : labels.openNotifications;
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="fi-no-database">
      <div>
        <div className="fi-modal-trigger">
          <button
            className="fi-icon-btn fi-size-md fi-topbar-database-notifications-btn"
            title={title}
            aria-label={title}
            type="button"
            onClick={() => {
              setOpen(true);
              void load();
            }}
          >
            <FiIcon name="o-bell" size="lg" />
            {unread > 0 ? (
              <div className="fi-icon-btn-badge-ctn">
                <FiBadge color="primary" size="xs">
                  {unread}
                </FiBadge>
              </div>
            ) : null}
          </button>
        </div>
        {list !== null && list.length === 0 ? (
          <FiModal
            open={open}
            onClose={close}
            slideOver
            id="database-notifications"
            className="fi-no-database"
            heading={labels.emptyHeading}
            description={labels.emptyDescription}
            icon="o-bell-slash"
            alignment="center"
            closeLabel={labels.close}
          />
        ) : (
          <FiModal
            open={open}
            onClose={close}
            slideOver
            stickyHeader
            id="database-notifications"
            className="fi-no-database"
            closeLabel={labels.close}
            heading={
              <>
                {labels.notifications}{" "}
                {unread > 0 ? (
                  <FiBadge color="primary" size="xs">
                    {unread}
                  </FiBadge>
                ) : null}
              </>
            }
            headerActions={
              list?.length ? (
                <div className="fi-ac">
                  {unread > 0 ? (
                    <FiLinkAction onClick={() => void post("/admin/notifikasi/baca-semua").then(load)}>{labels.markAllRead}</FiLinkAction>
                  ) : null}
                  <FiLinkAction color="danger" onClick={() => void post("/admin/notifikasi/bersihkan").then(load)}>
                    {labels.clear}
                  </FiLinkAction>
                </div>
              ) : null
            }
          >
            <div aria-label={labels.notifications} role="list" className="fi-no-notifications">
              {(list ?? []).map((notification) => (
                <div key={notification.id} role="listitem" className={notification.unread ? "fi-no-notification-unread-ctn" : "fi-no-notification-read-ctn"}>
                  {notification.unread ? <span className="fi-sr-only">Unread notification</span> : null}
                  <div className="fi-no-notification fi-inline" style={{ display: "flex", visibility: "visible" }}>
                    <div className="fi-no-notification-main">
                      <div className="fi-no-notification-text">
                        <h3 className="fi-no-notification-title">{notification.title}</h3>
                        <time className="fi-no-notification-date">{notification.date}</time>
                        {notification.body ? <div className="fi-no-notification-body">{notification.body}</div> : null}
                      </div>
                      {notification.actions.length ? (
                        <div className="fi-ac fi-no-notification-actions">
                          {notification.actions.map((action) => (
                            <FiLinkAction key={action.label} size="sm" href={action.url ?? undefined}>
                              {action.label}
                            </FiLinkAction>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label="Close notification"
                      title="Close notification"
                      className="fi-icon-btn fi-no-notification-close-btn"
                      onClick={() => void post(`/admin/notifikasi/${notification.id}/hapus`).then(load)}
                    >
                      <FiIcon name="m-x-mark" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </FiModal>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ global search ------------------------------ */

type SearchGroup = { label: string; results: { title: string; url: string; details: { label: string; value: string }[] }[] };

/**
 * Filament's global search across the resources with a record title. Each resource adds
 * its search as it is ported (steps 7.2–7.7); until then nothing is found.
 */
export function GlobalSearch({ labels }: { labels: Pick<Labels, "search" | "globalSearch" | "noResults"> }) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[] | null>(null);

  useEffect(() => {
    const term = query.trim();

    if (term === "") {
      return;
    }

    const timer = window.setTimeout(async () => {
      const response = await fetch(`/form/admin/cari?${new URLSearchParams({ q: term })}`, { headers: { Accept: "application/json" }, credentials: "same-origin" });

      setGroups(response.ok ? ((await response.json()) as { groups: SearchGroup[] }).groups : []);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [query]);

  const showing = query.trim() !== "" && groups !== null;

  return (
    <div className="fi-global-search-ctn">
      <div className="fi-global-search">
        <div className="fi-global-search-field">
          <label htmlFor="global-search-input" className="fi-sr-only">
            {labels.globalSearch}
          </label>
          <div className="fi-input-wrp">
            <div className="fi-input-wrp-prefix fi-input-wrp-prefix-has-content fi-inline">
              <FiIcon name="m-magnifying-glass" />
            </div>
            <div className="fi-input-wrp-content-ctn">
              <input
                autoComplete="off"
                maxLength={1000}
                placeholder={labels.search}
                type="search"
                id="global-search-input"
                className="fi-input fi-input-has-inline-prefix"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);

                  if (event.target.value.trim() === "") {
                    setGroups(null);
                  }
                }}
                onKeyDown={(event) => event.key === "Escape" && setQuery("")}
              />
            </div>
          </div>
        </div>
        {showing ? (
          <div role="region" aria-label="Global search results" className="fi-global-search-results-ctn">
            {groups!.length === 0 ? (
              <p className="fi-global-search-no-results-message">{labels.noResults}</p>
            ) : (
              <ul className="fi-global-search-results">
                {groups!.map((group, index) => (
                  <li key={group.label} className="fi-global-search-result-group">
                    <h3 id={`global-search-group-${index}`} className="fi-global-search-result-group-header">
                      {group.label}
                    </h3>
                    <ul className="fi-global-search-result-group-results">
                      {group.results.map((result, position) => (
                        <li key={result.url} className="fi-global-search-result">
                          <a href={result.url} className="fi-global-search-result-link">
                            <h4 id={`global-search-group-${index}-result-${position}`} className="fi-global-search-result-heading">
                              {result.title}
                            </h4>
                            {result.details.length ? (
                              <dl className="fi-global-search-result-details">
                                {result.details.map((detail) => (
                                  <div key={detail.label} className="fi-global-search-result-detail">
                                    <dt className="fi-global-search-result-detail-label">{detail.label}:</dt>{" "}
                                    <dd className="fi-global-search-result-detail-value">{detail.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            ) : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
