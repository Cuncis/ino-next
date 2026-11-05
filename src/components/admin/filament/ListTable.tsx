"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FiActionFormModal, postAction, type ActionFormSpec, type ActionResult } from "./ActionForm";
import { FiIcon } from "./Icon";
import { FiConfirmModal, toastOnNextPage, useFiToast } from "./Modal";
import { FiPreviewModal } from "./PreviewModal";
import { FiBadge, FiButton, FiLinkAction, type FiColor } from "./ui";

/**
 * A resource's list (Filament's `fi-ta` table on a List page): search, filters in a
 * dropdown, bulk selection with its "Tindakan" menu, record actions, and pagination.
 * The server sends the whole spec already translated; search, filters and the page live
 * in the address (`?search=&filter_x=&page=&perPage=`), so the server renders the rows.
 */
export type ListCell =
  | { kind: "text"; text: string; weight?: "semibold" | "bold" | "medium"; alignRight?: boolean; tooltip?: string; color?: FiColor }
  /** a text with `->description()` under it */
  | { kind: "described"; text: string; description: string; weight?: "medium" }
  /** `->copyable()`: a click copies the text */
  | { kind: "copyable"; text: string; copiedMessage: string }
  /** a badge per item, with `->limitList()`'s "dan :count lainnya" */
  | { kind: "badges"; items: string[]; color: FiColor; more?: string }
  | { kind: "badge"; text: string; color: FiColor; alignRight?: boolean }
  /** ImageColumn ->square() */
  | { kind: "image"; src: string }
  /** IconColumn ->boolean() */
  | { kind: "icon"; value: boolean; label: string }
  /** `->placeholder('—')` on an empty value */
  | { kind: "placeholder"; text: string }
  | { kind: "empty" };

export type { ActionFormSpec };

export type ListAction = {
  key: string;
  label: string;
  icon: string;
  color?: FiColor;
  href?: string;
  /** POSTed with `{ ids }` for bulk actions, or the form's data for a record action */
  endpoint?: string;
  confirm?: { heading: string; description: string; submitLabel: string; color: FiColor; icon?: string };
  form?: ActionFormSpec;
  /** a modal showing the HTML this endpoint answers (`{ html }`), with only a "back" button */
  preview?: { heading: string; backLabel: string };
  /** an ActionGroup: these actions in a dropdown under this button */
  items?: ListAction[];
};

export type ListRow = { id: string; url: string | null; cells: Record<string, ListCell>; actions: ListAction[]; /** names the row for screen readers while reordering */ title?: string };

/** a select filter, or (`checkbox`) a plain Filter that is on ("1") or off ("") */
export type ListFilter = { name: string; label: string; options: { value: string; label: string }[]; value: string; defaultValue: string; checkbox?: boolean };

export type ListColumn = {
  name: string;
  className: string;
  label: string;
  alignRight?: boolean;
  /** `->toggleable()`: shown, or hidden until picked in the column manager */
  toggleable?: "shown" | "hidden";
  sortable?: boolean;
};

export type ListSpec = {
  heading: string;
  /** remembers the columns picked in the column manager, per table */
  tableKey?: string;
  columns: ListColumn[];
  /** `?sort=column:direction`, for a sortable column */
  sort?: { column: string; direction: "asc" | "desc" } | null;
  /** a relation manager's table: its heading and header actions above the toolbar */
  header?: { heading?: string; actions: ListAction[] };
  /** `->reorderable()`: drag rows into order, posting the ids in their new order */
  reorder?: { endpoint: string; labels: { enable: string; disable: string; indicator: string; position: string; moveUp: string; moveDown: string } };
  /** a relation manager pages its rows itself, not in the address */
  localPaging?: boolean;
  rows: ListRow[];
  total: number;
  page: number;
  perPage: number;
  search: string | null;
  filters: ListFilter[];
  bulkActions: ListAction[];
  emptyHeading: string;
  emptyDescription?: string;
  labels: Record<
    | "search"
    | "filters"
    | "resetFilters"
    | "applyFilters"
    | "actions"
    | "selected"
    | "selectAll"
    | "deselectAll"
    | "overview"
    | "perPage"
    | "pagination"
    | "previous"
    | "next"
    | "close"
    | "cancel"
    | "sure"
    | "confirm"
    | "actionsColumn",
    string
  > &
    Partial<Record<"columns" | "columnManager" | "applyColumns" | "resetColumns", string>>;
};

/**
 * Laravel's UrlWindow with Filament's `onEachSide(0)`: every page up to 7; otherwise the
 * first four (or last four) near an end, or the current page alone in the middle, with
 * the first two and last two pages around it.
 */
function pageElements(current: number, last: number): (number | "...")[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

  if (last < 8) {
    return range(1, last);
  }

  if (current <= 4) {
    return [...range(1, 4), "...", last - 1, last];
  }

  if (current > last - 4) {
    return [1, 2, "...", ...range(last - 3, last)];
  }

  return [1, 2, "...", current, "...", last - 1, last];
}

/** Follows a link that answers with a file, as Livewire's streamDownload() hands one over. */
function download(url: string) {
  const link = document.createElement("a");

  link.href = url;
  link.click();
}

/** Filament's text shades per colour in a table cell (TextColumn ->color()). */
const TEXT_SHADES: Record<FiColor, string> = {
  gray: "fi-text-color-500 dark:fi-text-color-400",
  success: "fi-text-color-700 dark:fi-text-color-600",
  danger: "fi-text-color-600 dark:fi-text-color-400",
  warning: "fi-text-color-600 dark:fi-text-color-400",
  info: "fi-text-color-600 dark:fi-text-color-400",
  primary: "fi-text-color-600 dark:fi-text-color-400",
};

function Cell({ cell }: { cell: ListCell | undefined }) {
  if (!cell || cell.kind === "empty") {
    return null;
  }

  if (cell.kind === "badge") {
    return (
      <div className={`fi-ta-text fi-ta-text-item fi-ta-text-has-badges${cell.alignRight ? " fi-align-right" : ""}`}>
        <FiBadge color={cell.color}>{cell.text}</FiBadge>
      </div>
    );
  }

  if (cell.kind === "copyable") {
    return <CopyableText text={cell.text} copiedMessage={cell.copiedMessage} />;
  }

  if (cell.kind === "described") {
    return (
      <div className="fi-ta-text fi-ta-text-has-descriptions">
        <p className={`fi-ta-text-item fi-size-sm${cell.weight ? ` fi-font-${cell.weight}` : ""}`}>{cell.text}</p>
        <p className="fi-ta-text-description">{cell.description}</p>
      </div>
    );
  }

  if (cell.kind === "badges") {
    const items = cell.items.map((item, index) => (
      <li key={index} className="fi-ta-text-item">
        <FiBadge color={cell.color}>{item}</FiBadge>
      </li>
    ));

    if (cell.items.length === 1) {
      return (
        <div className="fi-ta-text fi-ta-text-item fi-ta-text-has-badges">
          <FiBadge color={cell.color}>{cell.items[0]}</FiBadge>
        </div>
      );
    }

    return cell.more ? (
      <div className="fi-ta-text fi-ta-text-has-badges fi-ta-text-list-limited">
        <ul>{items}</ul>
        <div className="fi-ta-text-list-limited-message">{cell.more}</div>
      </div>
    ) : (
      <ul className="fi-ta-text fi-ta-text-has-badges">{items}</ul>
    );
  }

  if (cell.kind === "placeholder") {
    return (
      <div className="fi-ta-text">
        <p className="fi-ta-placeholder">{cell.text}</p>
      </div>
    );
  }

  if (cell.kind === "image") {
    return (
      <div className="fi-ta-image">
        {/* eslint-disable-next-line @next/next/no-img-element -- Filament's ImageColumn */}
        <img alt="" src={cell.src} style={{ height: "2.5rem", width: "2.5rem" }} />
      </div>
    );
  }

  if (cell.kind === "icon") {
    return (
      <div className="fi-ta-icon">
        <FiIcon name={cell.value ? "o-check-circle" : "o-x-circle"} size="lg" className={`fi-color fi-color-${cell.value ? "success" : "danger"} fi-text-color-600 dark:fi-text-color-600`} />
        <span className="fi-sr-only">{cell.label}</span>
      </div>
    );
  }

  if (cell.tooltip) {
    return (
      <div className={`fi-ta-text-item  fi-size-sm  fi-ta-text${cell.alignRight ? " fi-align-right" : ""}`}>
        <span title={cell.tooltip}>{cell.text}</span>
      </div>
    );
  }

  if (cell.color) {
    return (
      <div className={`fi-ta-text fi-ta-text-item fi-size-sm fi-color fi-color-${cell.color} ${TEXT_SHADES[cell.color]}${cell.alignRight ? " fi-align-right" : ""}`}>
        {cell.text}
      </div>
    );
  }

  if (cell.weight) {
    return <div className={`fi-ta-text-item  fi-size-sm fi-font-${cell.weight} fi-ta-text${cell.alignRight ? " fi-align-right" : ""}`}>{cell.text}</div>;
  }

  return <div className={`fi-ta-text fi-ta-text-item fi-size-sm${cell.alignRight ? " fi-align-right" : ""}`}>{cell.text}</div>;
}

function CopyableText({ text, copiedMessage }: { text: string; copiedMessage: string }) {
  const [status, setStatus] = useState("");
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setStatus(copiedMessage);
      window.setTimeout(() => setStatus(""), 2000);
    });
  };

  return (
    <div className="fi-ta-text-item fi-size-sm fi-ta-text">
      <span
        className="fi-copyable"
        role="button"
        tabIndex={0}
        aria-label={`Copy ${text}`}
        title={status || undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          copy();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") copy();
        }}
      >
        {text}
      </span>
      <span className="fi-sr-only" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

/** The columns picked in the column manager, remembered in this browser per table. */
function useColumnChoice(spec: ListSpec): [Record<string, boolean>, (next: Record<string, boolean>) => void] {
  const defaults = useMemo(() => Object.fromEntries(spec.columns.map((column) => [column.name, column.toggleable !== "hidden"])), [spec.columns]);
  const [shown, setShown] = useState(defaults);
  const storageKey = spec.tableKey ? `fi-ta-columns:${spec.tableKey}` : null;

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Record<string, boolean> | null;

      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the browser's choice is only known after hydration
        setShown({ ...defaults, ...saved });
      }
    } catch {
      // no storage: the defaults stay
    }
  }, [storageKey, defaults]);

  const save = (next: Record<string, boolean>) => {
    setShown(next);

    try {
      if (storageKey) {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
    } catch {
      // no storage: only this page view remembers
    }
  };

  return [shown, save];
}

export function FiListTable({ spec }: { spec: ListSpec }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useFiToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState(spec.search ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(() => Object.fromEntries(spec.filters.map((filter) => [filter.name, filter.value])));
  const [pending, setPending] = useState<{ action: ListAction; ids: string[] } | null>(null);
  const [preview, setPreview] = useState<{ heading: string; backLabel: string; html: string } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [shownColumns, saveShownColumns] = useColumnChoice(spec);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [draftColumns, setDraftColumns] = useState(shownColumns);
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [localPage, setLocalPage] = useState(1);
  const [localPerPage, setLocalPerPage] = useState(10);
  const filtersRef = useRef<HTMLDivElement>(null);
  const bulkRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const columns = spec.columns.filter((column) => shownColumns[column.name] !== false);
  // a relation manager pages in the browser; reordering shows every row
  const paging = spec.localPaging ? { page: localPage, perPage: localPerPage } : { page: spec.page, perPage: spec.perPage };
  const rows = reordering
    ? order.map((id) => spec.rows.find((row) => row.id === id)!).filter(Boolean)
    : spec.localPaging
      ? spec.rows.slice((paging.page - 1) * paging.perPage, paging.page * paging.perPage)
      : spec.rows;

  const go = (changes: Record<string, string | null>) => {
    if (spec.localPaging) {
      if ("perPage" in changes) {
        setLocalPerPage(Number(changes.perPage ?? 10));
        setLocalPage(1);
      } else if ("page" in changes) {
        setLocalPage(Number(changes.page ?? 1));
      }

      return;
    }

    const query = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") {
        query.delete(key);
      } else {
        query.set(key, value);
      }
    }

    const text = query.toString();

    router.push(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  // Filament searches as the staff member types, half a second after they stop
  useEffect(() => {
    if (search === (spec.search ?? "")) {
      return;
    }

    const timer = window.setTimeout(() => go({ search, page: null }), 500);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (filtersOpen && !filtersRef.current?.contains(event.target as Node)) setFiltersOpen(false);
      if (bulkOpen && !bulkRef.current?.contains(event.target as Node)) setBulkOpen(false);
      if (columnsOpen && !columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };

    document.addEventListener("mousedown", close);

    return () => document.removeEventListener("mousedown", close);
  }, [filtersOpen, bulkOpen, columnsOpen]);

  const activeFilters = spec.filters.filter((filter) => filter.value !== filter.defaultValue).length;
  const pageIds = rows.map((row) => row.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const lastPage = Math.max(Math.ceil(spec.total / paging.perPage), 1);
  const first = spec.total === 0 ? 0 : (paging.page - 1) * paging.perPage + 1;
  const last = Math.min(paging.page * paging.perPage, spec.total);
  const overview = useMemo(
    () =>
      spec.labels.overview
        .split("|")
        .map((form) => form.replace(/^\s*(\{\d+\}|\[[^\]]*\])\s*/, ""))
        [spec.total === 1 ? 0 : 1]?.replace(":first", String(first))
        .replace(":last", String(last))
        .replace(":total", String(spec.total)) ?? "",
    [spec.labels.overview, spec.total, first, last],
  );

  const finish = (result: ActionResult) => {
    if (result.toast) {
      if (result.redirect) toastOnNextPage([result.toast]);
      else toast(result.toast);
    }

    if (result.redirect) {
      router.push(result.redirect);
    } else {
      router.refresh();
    }
  };

  const run = async (action: ListAction, ids: string[], data: Record<string, string> = {}, files: Record<string, File[]> = {}) => {
    if (!action.endpoint) {
      return;
    }

    setBusy(true);

    try {
      const result = await postAction(action.endpoint, { ids, ...data }, files);

      if (result.status === 422 && action.form) {
        setFormErrors(Object.fromEntries(Object.entries(result.errors ?? {}).map(([field, messages]) => [field, messages[0]])));

        return;
      }

      setPending(null);
      setFormErrors({});
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      finish(result);
    } finally {
      setBusy(false);
    }
  };

  const start = (action: ListAction, ids: string[]) => {
    setBulkOpen(false);

    if (action.preview) {
      void postAction(action.endpoint!, { saved: "1" }).then((result) => setPreview({ heading: action.preview!.heading, backLabel: action.preview!.backLabel, html: String((result as { html?: string }).html ?? "") }));

      return;
    }

    if (action.confirm || action.form) {
      setFormErrors({});
      setPending({ action, ids });
    } else {
      void run(action, ids);
    }
  };

  const t = (text: string) => ({ "Apakah Anda yakin ingin melakukan ini?": spec.labels.sure, Tutup: spec.labels.close, Batal: spec.labels.cancel, Konfirmasi: spec.labels.confirm })[text] ?? text;

  const actionLink = (action: ListAction, row: ListRow): ReactNode =>
    action.href ? (
      <a key={action.key} href={action.href} className={`fi-ac-link-action fi-link fi-size-sm${action.color ? ` fi-color fi-color-${action.color} ${action.color === "danger" ? "fi-text-color-600 dark:fi-text-color-300" : "fi-text-color-700 dark:fi-text-color-400"}` : ""}`}>
        <FiIcon name={action.icon} size="sm" />
        <span className="fi-link-label">{action.label}</span>
      </a>
    ) : (
      <button
        key={action.key}
        type="button"
        onClick={() => start(action, [row.id])}
        className={`fi-ac-link-action fi-link fi-size-sm${action.color ? ` fi-color fi-color-${action.color} ${action.color === "danger" ? "fi-text-color-600 dark:fi-text-color-300" : "fi-text-color-700 dark:fi-text-color-400"}` : ""}`}
      >
        <FiIcon name={action.icon} size="sm" />
        <span className="fi-link-label">{action.label}</span>
      </button>
    );

  const hasActions = !reordering && rows.some((row) => row.actions.length > 0);
  const bulk = spec.bulkActions.length > 0 && !reordering;
  const toggleable = spec.columns.some((column) => column.toggleable);
  const hasRightTools = spec.search !== null || spec.filters.length > 0 || toggleable;
  const footer = spec.total > 0 && !reordering;

  const sortBy = (column: string) => {
    // Filament: a new column sorts up, then down, then back to the table's default
    const next = spec.sort?.column !== column ? `${column}:asc` : spec.sort.direction === "asc" ? `${column}:desc` : null;

    go({ sort: next, page: null });
  };

  const toggleReordering = () => {
    if (!reordering) {
      setOrder(spec.rows.map((row) => row.id));
      setSelected([]);
    }

    setReordering(!reordering);
  };

  const move = async (ids: string[]) => {
    setOrder(ids);

    if (spec.reorder) {
      await postAction(spec.reorder.endpoint, { order: ids });
      router.refresh();
    }
  };

  return (
    <div className="fi-ta">
      <div className={`fi-ta-ctn${footer ? " fi-ta-ctn-with-footer" : ""} fi-ta-ctn-with-header`}>
        <div className="fi-ta-main">
          <div className="fi-ta-header-ctn">
            {spec.header ? (
              <div className="fi-ta-header fi-ta-header-adaptive-actions-position">
                {spec.header.heading ? (
                  <div>
                    <h2 className="fi-ta-header-heading">{spec.header.heading}</h2>
                  </div>
                ) : null}
                {spec.header.actions.length && !reordering ? (
                  <div className="fi-ta-actions fi-align-start fi-wrapped">
                    {spec.header.actions.map((action) => (
                      <FiButton
                        key={action.key}
                        icon={action.icon || undefined}
                        color={action.color ?? "primary"}
                        // a download takes the list's search and filters along, like getFilteredTableQuery()
                        onClick={() => (action.href ? download(`${action.href}?${searchParams.toString()}`) : start(action, []))}
                      >
                        {action.label}
                      </FiButton>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="fi-ta-header-toolbar">
              <div className="fi-ta-actions fi-align-start fi-wrapped">
                {spec.reorder && spec.rows.length > 0 ? (
                  <button
                    title={reordering ? spec.reorder.labels.disable : spec.reorder.labels.enable}
                    aria-label={reordering ? spec.reorder.labels.disable : spec.reorder.labels.enable}
                    type="button"
                    className="fi-force-enabled fi-ac-icon-btn-action fi-icon-btn fi-size-md"
                    onClick={toggleReordering}
                  >
                    <FiIcon name={reordering ? "m-check" : "m-arrows-up-down"} />
                  </button>
                ) : null}
                {bulk && selected.length > 0 ? (
                  <div className="fi-dropdown" ref={bulkRef} style={{ position: "relative" }}>
                    <div className="fi-dropdown-trigger">
                      {/* Filament's icon-only twin, for narrow screens */}
                      <button title={spec.labels.actions} type="button" className="fi-ac-btn-group fi-icon-btn fi-size-md" onClick={() => setBulkOpen(!bulkOpen)}>
                        <FiIcon name="m-ellipsis-vertical" />
                      </button>
                      <button type="button" className="fi-ac-btn-group fi-btn fi-size-md fi-labeled-from-sm" aria-haspopup="menu" aria-expanded={bulkOpen} onClick={() => setBulkOpen(!bulkOpen)}>
                        <FiIcon name="m-ellipsis-vertical" />
                        {spec.labels.actions}
                      </button>
                    </div>
                    {bulkOpen ? (
                      <div className="fi-dropdown-panel" role="menu" style={{ position: "absolute", left: 0, top: "calc(100% + 8px)", zIndex: 20 }}>
                        <div className="fi-dropdown-list" role="group">
                          {spec.bulkActions.map((action) => (
                            <button
                              key={action.key}
                              role="menuitem"
                              type="button"
                              onClick={() => start(action, selected)}
                              className={`fi-ac-grouped-action fi-dropdown-list-item${action.color === "danger" ? " fi-color fi-color-danger fi-text-color-600 hover:fi-text-color-700 dark:fi-text-color-400 dark:hover:fi-text-color-400" : ""}`}
                            >
                              <FiIcon name={action.icon} className={action.color === "danger" ? "fi-color fi-color-danger" : ""} />
                              <span className="fi-dropdown-list-item-label">{action.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {hasRightTools ? (
              <div>
                {spec.search !== null ? (
                  <div className="fi-ta-search-field">
                    <label className="fi-sr-only" htmlFor="table-search">
                      {spec.labels.search}
                    </label>
                    <div className="fi-input-wrp">
                      <div className="fi-input-wrp-prefix fi-input-wrp-prefix-has-content fi-inline">
                        <FiIcon name="m-magnifying-glass" />
                      </div>
                      <div className="fi-input-wrp-content-ctn">
                        <input className="fi-input fi-input-has-inline-prefix" placeholder={spec.labels.search} type="search" id="table-search" value={search} onChange={(event) => setSearch(event.target.value)} />
                      </div>
                    </div>
                  </div>
                ) : null}
                {spec.filters.length ? (
                  <div className="fi-dropdown fi-ta-filters-dropdown" ref={filtersRef} style={{ position: "relative" }}>
                    <div className="fi-dropdown-trigger">
                      <button title={spec.labels.filters} aria-label={spec.labels.filters} type="button" className="fi-force-enabled fi-ac-icon-btn-action fi-icon-btn fi-size-md" onClick={() => setFiltersOpen(!filtersOpen)}>
                        <FiIcon name="m-funnel" />
                        <div className="fi-icon-btn-badge-ctn">
                          <FiBadge color="primary" size="xs">
                            {activeFilters}
                          </FiBadge>
                        </div>
                      </button>
                    </div>
                    {filtersOpen ? (
                      <div className="fi-dropdown-panel fi-width-xs" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 20 }}>
                        <div className="fi-ta-filters">
                          <div className="fi-ta-filters-header">
                            <h2 className="fi-ta-filters-heading">{spec.labels.filters}</h2>
                            <div>
                              <FiLinkAction
                                color="danger"
                                onClick={() => {
                                  setFiltersOpen(false);
                                  go({ page: null, ...Object.fromEntries(spec.filters.map((filter) => [`filter_${filter.name}`, null])) });
                                }}
                              >
                                {spec.labels.resetFilters}
                              </FiLinkAction>
                            </div>
                          </div>
                          <div className="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style={{ "--cols-lg": "repeat(1, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" } as React.CSSProperties}>
                            {spec.filters.map((filter) => (
                              <div key={filter.name} className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as React.CSSProperties}>
                                <div className="fi-sc-component">
                                  {filter.checkbox ? (
                                    <div data-field-wrapper="" className="fi-fo-field">
                                      <div className="fi-fo-field-label-col">
                                        <div className="fi-fo-field-label-ctn">
                                          <label htmlFor={`tableFiltersForm.${filter.name}.isActive`} className="fi-fo-field-label">
                                            <input
                                              type="checkbox"
                                              id={`tableFiltersForm.${filter.name}.isActive`}
                                              className="fi-checkbox-input fi-valid"
                                              checked={draftFilters[filter.name] === "1"}
                                              onChange={(event) => setDraftFilters({ ...draftFilters, [filter.name]: event.target.checked ? "1" : "" })}
                                            />
                                            <span className="fi-fo-field-label-content">{filter.label}</span>
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                  <div data-field-wrapper="" className="fi-fo-select-wrp fi-fo-field">
                                    <div className="fi-fo-field-label-col">
                                      <div className="fi-fo-field-label-ctn">
                                        <label htmlFor={`tableFiltersForm.${filter.name}.value`} className="fi-fo-field-label">
                                          <span className="fi-fo-field-label-content">{filter.label}</span>
                                        </label>
                                      </div>
                                    </div>
                                    <div className="fi-fo-field-content-col">
                                      <div className="fi-fo-select fi-fo-select-native fi-input-wrp">
                                        <div className="fi-input-wrp-content-ctn">
                                          <select
                                            id={`tableFiltersForm.${filter.name}.value`}
                                            className="fi-select-input"
                                            value={draftFilters[filter.name] ?? ""}
                                            onChange={(event) => setDraftFilters({ ...draftFilters, [filter.name]: event.target.value })}
                                          >
                                            {filter.options.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="fi-ta-filters-actions-ctn">
                            <FiButton
                              onClick={() => {
                                setFiltersOpen(false);
                                go({ page: null, ...Object.fromEntries(spec.filters.map((filter) => [`filter_${filter.name}`, draftFilters[filter.name] === filter.defaultValue ? null : draftFilters[filter.name]])) });
                              }}
                            >
                              {spec.labels.applyFilters}
                            </FiButton>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {toggleable ? (
                  <div className="fi-dropdown fi-ta-col-manager-dropdown" ref={columnsRef} style={{ position: "relative" }}>
                    <div className="fi-dropdown-trigger">
                      <button
                        title={spec.labels.columnManager}
                        aria-label={spec.labels.columnManager}
                        type="button"
                        className="fi-force-enabled fi-ac-icon-btn-action fi-icon-btn fi-size-md"
                        aria-haspopup="true"
                        aria-expanded={columnsOpen}
                        onClick={() => {
                          setDraftColumns(shownColumns);
                          setColumnsOpen(!columnsOpen);
                        }}
                      >
                        <FiIcon name="m-view-columns" />
                      </button>
                    </div>
                    {columnsOpen ? (
                      <div className="fi-dropdown-panel fi-width-xs" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 20 }}>
                        <div className="fi-ta-col-manager">
                          <div className="fi-ta-col-manager-header">
                            <h2 className="fi-ta-col-manager-heading">{spec.labels.columns}</h2>
                            <div>
                              <FiLinkAction color="danger" onClick={() => setDraftColumns(Object.fromEntries(spec.columns.map((column) => [column.name, column.toggleable !== "hidden"])))}>
                                {spec.labels.resetColumns}
                              </FiLinkAction>
                            </div>
                          </div>
                          <div className="fi-ta-col-manager-group">
                            {spec.columns.map((column) => (
                              <div key={column.name} className="fi-ta-col-manager-item">
                                <label className="fi-ta-col-manager-label" htmlFor={`fi-ta-col-manager-column-checkbox-${column.name}`}>
                                  <input
                                    type="checkbox"
                                    className="fi-checkbox-input fi-valid"
                                    id={`fi-ta-col-manager-column-checkbox-${column.name}`}
                                    checked={draftColumns[column.name] !== false}
                                    disabled={!column.toggleable}
                                    onChange={(event) => setDraftColumns({ ...draftColumns, [column.name]: event.target.checked })}
                                  />
                                  <span>{column.label}</span>
                                </label>
                              </div>
                            ))}
                          </div>
                          <div className="fi-ta-col-manager-actions-ctn">
                            <FiButton
                              onClick={() => {
                                saveShownColumns(draftColumns);
                                setColumnsOpen(false);
                              }}
                            >
                              {spec.labels.applyColumns}
                            </FiButton>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              ) : null}
            </div>
          </div>
          {reordering && spec.reorder ? (
            <div role="status" aria-live="polite" className="fi-ta-reorder-indicator">
              {spec.reorder.labels.indicator}
            </div>
          ) : null}
          {selected.length > 0 ? (
            <div role="status" className="fi-ta-selection-indicator">
              <div>
                <span>{spec.labels.selected.replace(":count", String(selected.length))}</span>
              </div>
              <div>
                <div className="fi-ta-selection-indicator-actions-ctn">
                  {selected.length < pageIds.length ? (
                    <button className="fi-color fi-color-primary fi-text-color-700 dark:fi-text-color-400 fi-link fi-size-md" type="button" onClick={() => setSelected(pageIds)}>
                      <span className="fi-link-label">{spec.labels.selectAll}</span>
                    </button>
                  ) : null}
                  <button className="fi-color fi-color-danger fi-text-color-600 dark:fi-text-color-300 fi-link fi-size-md" type="button" onClick={() => setSelected([])}>
                    <span className="fi-link-label">{spec.labels.deselectAll}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="fi-ta-content-ctn fi-fixed-positioning-context">
            <div role="status" aria-live="polite" aria-atomic="true" className="fi-sr-only">
              {spec.rows.length ? `${spec.total} ${spec.total === 1 ? "result" : "results"}` : "No results"}
            </div>
            <table aria-label={spec.heading} className="fi-ta-table">
              <thead>
                <tr>
                  {reordering ? <th /> : null}
                  {/* Filament leaves the select-all column out of an empty table */}
                  {bulk && spec.rows.length ? (
                    <th className="fi-ta-cell fi-ta-selection-cell">
                      <input
                        aria-label="Select/deselect all items for bulk actions."
                        type="checkbox"
                        className="fi-ta-page-checkbox fi-checkbox-input"
                        checked={allOnPage}
                        onChange={() => setSelected(allOnPage ? selected.filter((id) => !pageIds.includes(id)) : [...new Set([...selected, ...pageIds])])}
                      />
                    </th>
                  ) : null}
                  {columns.map((column) => {
                    const sorted = spec.sort?.column === column.name;

                    return (
                      <th
                        key={column.name}
                        scope="col"
                        aria-sort={column.sortable ? (sorted ? (spec.sort!.direction === "asc" ? "ascending" : "descending") : "none") : undefined}
                        className={`fi-ta-header-cell fi-ta-header-cell-${column.className}${sorted ? " fi-ta-header-cell-sorted" : ""}${column.alignRight ? " fi-align-right" : ""}`}
                      >
                        {column.sortable && !reordering ? (
                          <button type="button" className="fi-ta-header-cell-sort-btn" onClick={() => sortBy(column.name)}>
                            {column.label}
                            <FiIcon name={sorted && spec.sort!.direction === "asc" ? "m-chevron-up" : "m-chevron-down"} />
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                  {hasActions ? <th aria-label={spec.labels.actionsColumn} className="fi-ta-actions-header-cell fi-ta-empty-header-cell" /> : null}
                </tr>
              </thead>
              {rows.length ? (
                <tbody className="fi-ta-records">
                  {rows.map((row, index) => {
                    const isSelected = selected.includes(row.id);
                    const reorderLabel = (text: string) =>
                      text.replace(":label", row.title ?? row.id).replace(":position", String(index + 1)).replace(":count", String(rows.length));

                    return (
                      <tr
                        key={row.id}
                        className={`fi-ta-row${row.url && !reordering ? " fi-clickable" : ""}${isSelected ? " fi-selected" : ""}`}
                        draggable={reordering}
                        onDragStart={() => setDragging(row.id)}
                        onDragOver={(event) => {
                          if (!dragging || dragging === row.id) {
                            return;
                          }

                          event.preventDefault();
                          setOrder((current) => {
                            const without = current.filter((id) => id !== dragging);
                            const at = without.indexOf(row.id);

                            return [...without.slice(0, at + (current.indexOf(dragging) < current.indexOf(row.id) ? 1 : 0)), dragging, ...without.slice(at + (current.indexOf(dragging) < current.indexOf(row.id) ? 1 : 0))];
                          });
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          void move(order);
                        }}
                      >
                        {reordering && spec.reorder ? (
                          <td className="fi-ta-cell">
                            <button aria-hidden="true" tabIndex={-1} className="fi-ta-reorder-handle fi-icon-btn" type="button">
                              <FiIcon name="m-bars-2" />
                            </button>
                            <span id={`table-reorder-${row.id}`} className="fi-sr-only">
                              {reorderLabel(spec.reorder.labels.position)}
                            </span>
                            <div className="fi-sr-only">
                              <button
                                type="button"
                                aria-describedby={`table-reorder-${row.id}`}
                                disabled={index === 0}
                                onClick={() => void move([...order.slice(0, index - 1), row.id, order[index - 1], ...order.slice(index + 1)])}
                              >
                                {reorderLabel(spec.reorder.labels.moveUp)}
                              </button>
                              <button
                                type="button"
                                aria-describedby={`table-reorder-${row.id}`}
                                disabled={index === rows.length - 1}
                                onClick={() => void move([...order.slice(0, index), order[index + 1], row.id, ...order.slice(index + 2)])}
                              >
                                {reorderLabel(spec.reorder.labels.moveDown)}
                              </button>
                            </div>
                          </td>
                        ) : null}
                        {bulk ? (
                          <td className="fi-ta-cell fi-ta-selection-cell">
                            <input
                              aria-label={`Select/deselect item ${row.id} for bulk actions.`}
                              type="checkbox"
                              value={row.id}
                              className="fi-ta-record-checkbox fi-checkbox-input"
                              checked={isSelected}
                              onChange={() => setSelected(isSelected ? selected.filter((id) => id !== row.id) : [...selected, row.id])}
                            />
                          </td>
                        ) : null}
                        {columns.map((column) => (
                          <td key={column.name} className={`fi-ta-cell fi-ta-cell-${column.className}${column.alignRight ? " fi-align-right" : ""}`}>
                            {row.url && !reordering ? (
                              <a href={row.url} className="fi-ta-col">
                                <Cell cell={row.cells[column.name]} />
                              </a>
                            ) : (
                              <div className="fi-ta-col">
                                <Cell cell={row.cells[column.name]} />
                              </div>
                            )}
                          </td>
                        ))}
                        {hasActions ? (
                          <td className="fi-ta-cell">
                            <div className="fi-ta-actions ">{row.actions.map((action) => actionLink(action, row))}</div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              ) : null}
            </table>
          </div>
          {rows.length ? null : (
            <div className="fi-ta-empty-state" role="status">
              <div className="fi-ta-empty-state-content">
                <div className="fi-ta-empty-state-icon-bg">
                  <FiIcon name="o-x-mark" size="lg" />
                </div>
                <h3 className="fi-ta-empty-state-heading">{spec.emptyHeading}</h3>
                {spec.emptyDescription ? <p className="fi-ta-empty-state-description">{spec.emptyDescription}</p> : null}
              </div>
            </div>
          )}
          {footer ? (
              <nav aria-label={spec.labels.pagination} className="fi-pagination">
                {paging.page > 1 ? (
                  <FiButton color="gray" className="fi-pagination-previous-btn" onClick={() => go({ page: String(paging.page - 1) })}>
                    {spec.labels.previous}
                  </FiButton>
                ) : null}
                <span className="fi-pagination-overview">{overview}</span>
                <div className="fi-pagination-records-per-page-select-ctn">
                  {(["fi-compact", ""] as const).map((variant) => (
                    <label key={variant} className={`fi-pagination-records-per-page-select${variant ? ` ${variant}` : ""}`}>
                      <div className="fi-input-wrp">
                        {variant ? null : (
                          <div className="fi-input-wrp-prefix fi-input-wrp-prefix-has-content fi-input-wrp-prefix-has-label">
                            <span className="fi-input-wrp-label">{spec.labels.perPage}</span>
                          </div>
                        )}
                        <div className="fi-input-wrp-content-ctn">
                          <select className="fi-select-input" value={paging.perPage} onChange={(event) => go({ perPage: event.target.value === "10" ? null : event.target.value, page: null })}>
                            {[5, 10, 25, 50].map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {variant ? <span className="fi-sr-only">{spec.labels.perPage}</span> : null}
                    </label>
                  ))}
                </div>
                {paging.page < lastPage ? (
                  <FiButton color="gray" className="fi-pagination-next-btn" onClick={() => go({ page: String(paging.page + 1) })}>
                    {spec.labels.next}
                  </FiButton>
                ) : null}
                {lastPage > 1 ? (
                  <ol className="fi-pagination-items">
                    {paging.page > 1 ? (
                      <li className="fi-pagination-item">
                        <button aria-label={spec.labels.previous} type="button" className="fi-pagination-item-btn" onClick={() => go({ page: String(paging.page - 1) })}>
                          <FiIcon name="m-chevron-left" className="fi-pagination-item-icon" />
                        </button>
                      </li>
                    ) : null}
                    {pageElements(paging.page, lastPage).map((element, index) =>
                      element === "..." ? (
                        <li key={`gap-${index}`} className="fi-pagination-item fi-disabled">
                          <button aria-hidden="true" disabled type="button" className="fi-pagination-item-btn">
                            <span className="fi-pagination-item-label">...</span>
                          </button>
                        </li>
                      ) : (
                        <li key={element} className={`fi-pagination-item${element === paging.page ? " fi-active" : ""}`}>
                          <button aria-current={element === paging.page ? "page" : undefined} type="button" className="fi-pagination-item-btn" onClick={() => go({ page: element === 1 ? null : String(element) })}>
                            <span className="fi-pagination-item-label">{element}</span>
                          </button>
                        </li>
                      ),
                    )}
                    {paging.page < lastPage ? (
                      <li className="fi-pagination-item">
                        <button aria-label={spec.labels.next} type="button" className="fi-pagination-item-btn" onClick={() => go({ page: String(paging.page + 1) })}>
                          <FiIcon name="m-chevron-right" className="fi-pagination-item-icon" />
                        </button>
                      </li>
                    ) : null}
                  </ol>
                ) : null}
              </nav>
          ) : null}
        </div>
      </div>

      {preview ? <FiPreviewModal heading={preview.heading} html={preview.html} backLabel={preview.backLabel} closeLabel={spec.labels.close} onClose={() => setPreview(null)} /> : null}
      {pending?.action.confirm ? (
        <FiConfirmModal
          open
          onClose={() => setPending(null)}
          onConfirm={() => void run(pending.action, pending.ids)}
          heading={pending.action.confirm.heading}
          color={pending.action.confirm.color}
          icon={pending.action.confirm.icon}
          processing={busy}
          t={(text) => (text === "Konfirmasi" ? pending.action.confirm!.submitLabel : text === "Apakah Anda yakin ingin melakukan ini?" ? pending.action.confirm!.description : t(text))}
        />
      ) : null}
      {pending?.action.form ? (
        <FiActionFormModal
          form={pending.action.form}
          busy={busy}
          errors={formErrors}
          closeLabel={spec.labels.close}
          onClose={() => setPending(null)}
          onSubmit={(values, files) => void run(pending.action, pending.ids, values, files)}
        />
      ) : null}
    </div>
  );
}
