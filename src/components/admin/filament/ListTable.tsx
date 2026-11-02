"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FiIcon } from "./Icon";
import { FiConfirmModal, FiModal, FiTextField, useFiToast, type FiToast } from "./Modal";
import { FiBadge, FiButton, FiLinkAction, type FiColor } from "./ui";

/**
 * A resource's list (Filament's `fi-ta` table on a List page): search, filters in a
 * dropdown, bulk selection with its "Tindakan" menu, record actions, and pagination.
 * The server sends the whole spec already translated; search, filters and the page live
 * in the address (`?search=&filter_x=&page=&perPage=`), so the server renders the rows.
 */
export type ListCell =
  | { kind: "text"; text: string; weight?: "semibold" | "bold"; alignRight?: boolean }
  | { kind: "badge"; text: string; color: FiColor }
  | { kind: "empty" };

export type ActionForm = { name: string; label: string; required?: boolean; maxLength?: number; value?: string };

export type ListAction = {
  key: string;
  label: string;
  icon: string;
  color?: FiColor;
  href?: string;
  /** POSTed with `{ ids }` for bulk actions, or the form's data for a record action */
  endpoint?: string;
  confirm?: { heading: string; description: string; submitLabel: string; color: FiColor; icon?: string };
  form?: { heading: string; field: ActionForm; submitLabel: string; cancelLabel: string };
};

export type ListRow = { id: string; url: string | null; cells: Record<string, ListCell>; actions: ListAction[] };

export type ListFilter = { name: string; label: string; options: { value: string; label: string }[]; value: string; defaultValue: string };

export type ListSpec = {
  heading: string;
  columns: { name: string; className: string; label: string; alignRight?: boolean }[];
  rows: ListRow[];
  total: number;
  page: number;
  perPage: number;
  search: string | null;
  filters: ListFilter[];
  bulkActions: ListAction[];
  emptyHeading: string;
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
  >;
};

type ActionResult = { toast?: Omit<FiToast, "id">; redirect?: string; errors?: Record<string, string[]> };

async function postAction(endpoint: string, body: unknown): Promise<ActionResult & { status: number }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });

  return { status: response.status, ...((await response.json().catch(() => ({}))) as ActionResult) };
}

/** Laravel's paginator window: every page up to 13, otherwise the ends and 3 around the current one. */
function pageElements(current: number, last: number): (number | "...")[] {
  if (last < 14) {
    return Array.from({ length: last }, (_, index) => index + 1);
  }

  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

  if (current <= 7) {
    return [...range(1, 10), "...", last - 1, last];
  }

  if (current > last - 7) {
    return [1, 2, "...", ...range(last - 9, last)];
  }

  return [1, 2, "...", ...range(current - 3, current + 3), "...", last - 1, last];
}

function Cell({ cell }: { cell: ListCell | undefined }) {
  if (!cell || cell.kind === "empty") {
    return null;
  }

  if (cell.kind === "badge") {
    return (
      <div className="fi-ta-text fi-ta-text-item fi-ta-text-has-badges">
        <FiBadge color={cell.color}>{cell.text}</FiBadge>
      </div>
    );
  }

  if (cell.weight) {
    return <div className={`fi-ta-text-item  fi-size-sm fi-font-${cell.weight} fi-ta-text${cell.alignRight ? " fi-align-right" : ""}`}>{cell.text}</div>;
  }

  return <div className={`fi-ta-text fi-ta-text-item fi-size-sm${cell.alignRight ? " fi-align-right" : ""}`}>{cell.text}</div>;
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
  const [formValue, setFormValue] = useState("");
  const [formError, setFormError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const bulkRef = useRef<HTMLDivElement>(null);

  const go = (changes: Record<string, string | null>) => {
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
    };

    document.addEventListener("mousedown", close);

    return () => document.removeEventListener("mousedown", close);
  }, [filtersOpen, bulkOpen]);

  const activeFilters = spec.filters.filter((filter) => filter.value !== filter.defaultValue).length;
  const pageIds = spec.rows.map((row) => row.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const lastPage = Math.max(Math.ceil(spec.total / spec.perPage), 1);
  const first = spec.total === 0 ? 0 : (spec.page - 1) * spec.perPage + 1;
  const last = Math.min(spec.page * spec.perPage, spec.total);
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
      toast(result.toast);
    }

    if (result.redirect) {
      router.push(result.redirect);
    } else {
      router.refresh();
    }
  };

  const run = async (action: ListAction, ids: string[], data: Record<string, string> = {}) => {
    if (!action.endpoint) {
      return;
    }

    setBusy(true);

    try {
      const result = await postAction(action.endpoint, { ids, ...data });

      if (result.status === 422 && action.form) {
        setFormError(result.errors?.[action.form.field.name]?.[0]);

        return;
      }

      setPending(null);
      setFormError(undefined);
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      finish(result);
    } finally {
      setBusy(false);
    }
  };

  const start = (action: ListAction, ids: string[]) => {
    setBulkOpen(false);

    if (action.confirm || action.form) {
      setFormValue(action.form?.field.value ?? "");
      setFormError(undefined);
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

  const hasActions = spec.rows.some((row) => row.actions.length > 0);
  const bulk = spec.bulkActions.length > 0;

  return (
    <div className="fi-ta">
      <div className="fi-ta-ctn fi-ta-ctn-with-footer fi-ta-ctn-with-header">
        <div className="fi-ta-main">
          <div className="fi-ta-header-ctn">
            <div className="fi-ta-header-toolbar">
              <div className="fi-ta-actions fi-align-start fi-wrapped">
                {bulk && selected.length > 0 ? (
                  <div className="fi-dropdown" ref={bulkRef} style={{ position: "relative" }}>
                    <div className="fi-dropdown-trigger">
                      <button type="button" className="fi-ac-btn-group fi-btn fi-size-md fi-labeled-from-sm" onClick={() => setBulkOpen(!bulkOpen)}>
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
              </div>
            </div>
          </div>
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
              {spec.rows.length ? `${spec.total} results` : "No results"}
            </div>
            <table aria-label={spec.heading} className="fi-ta-table">
              <thead>
                <tr>
                  {bulk ? (
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
                  {spec.columns.map((column) => (
                    <th key={column.name} className={`fi-ta-header-cell fi-ta-header-cell-${column.className}${column.alignRight ? " fi-align-right" : ""}`}>
                      {column.label}
                    </th>
                  ))}
                  {hasActions ? <th aria-label={spec.labels.actionsColumn} className="fi-ta-actions-header-cell fi-ta-empty-header-cell" /> : null}
                </tr>
              </thead>
              {spec.rows.length ? (
                <tbody className="fi-ta-records">
                  {spec.rows.map((row) => {
                    const isSelected = selected.includes(row.id);

                    return (
                      <tr key={row.id} className={`fi-ta-row${row.url ? " fi-clickable" : ""}${isSelected ? " fi-selected" : ""}`}>
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
                        {spec.columns.map((column) => (
                          <td key={column.name} className={`fi-ta-cell fi-ta-cell-${column.className}${column.alignRight ? " fi-align-right" : ""}`}>
                            {row.url ? (
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
          {spec.rows.length ? null : (
            <div className="fi-ta-empty-state" role="status">
              <div className="fi-ta-empty-state-content">
                <div className="fi-ta-empty-state-icon-bg">
                  <FiIcon name="o-x-mark" size="lg" />
                </div>
                <h3 className="fi-ta-empty-state-heading">{spec.emptyHeading}</h3>
              </div>
            </div>
          )}
          {spec.total > 0 ? (
            <div className="fi-ta-footer">
              <nav aria-label={spec.labels.pagination} className="fi-pagination">
                {spec.page > 1 ? (
                  <FiButton color="gray" className="fi-pagination-previous-btn" onClick={() => go({ page: String(spec.page - 1) })}>
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
                          <select className="fi-select-input" value={spec.perPage} onChange={(event) => go({ perPage: event.target.value === "10" ? null : event.target.value, page: null })}>
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
                {spec.page < lastPage ? (
                  <FiButton color="gray" className="fi-pagination-next-btn" onClick={() => go({ page: String(spec.page + 1) })}>
                    {spec.labels.next}
                  </FiButton>
                ) : null}
                {lastPage > 1 ? (
                  <ol className="fi-pagination-items">
                    {spec.page > 1 ? (
                      <li className="fi-pagination-item">
                        <button aria-label={spec.labels.previous} type="button" className="fi-pagination-item-btn" onClick={() => go({ page: String(spec.page - 1) })}>
                          <FiIcon name="m-chevron-left" className="fi-pagination-item-icon" />
                        </button>
                      </li>
                    ) : null}
                    {pageElements(spec.page, lastPage).map((element, index) =>
                      element === "..." ? (
                        <li key={`gap-${index}`} className="fi-pagination-item fi-disabled">
                          <button aria-hidden="true" disabled type="button" className="fi-pagination-item-btn">
                            <span className="fi-pagination-item-label">...</span>
                          </button>
                        </li>
                      ) : (
                        <li key={element} className={`fi-pagination-item${element === spec.page ? " fi-active" : ""}`}>
                          <button aria-current={element === spec.page ? "page" : undefined} type="button" className="fi-pagination-item-btn" onClick={() => go({ page: element === 1 ? null : String(element) })}>
                            <span className="fi-pagination-item-label">{element}</span>
                          </button>
                        </li>
                      ),
                    )}
                    {spec.page < lastPage ? (
                      <li className="fi-pagination-item">
                        <button aria-label={spec.labels.next} type="button" className="fi-pagination-item-btn" onClick={() => go({ page: String(spec.page + 1) })}>
                          <FiIcon name="m-chevron-right" className="fi-pagination-item-icon" />
                        </button>
                      </li>
                    ) : null}
                  </ol>
                ) : null}
              </nav>
            </div>
          ) : null}
        </div>
      </div>

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
        <FiModal
          open
          onClose={() => setPending(null)}
          heading={pending.action.form.heading}
          width="4xl"
          closeLabel={spec.labels.close}
          onSubmit={() => void run(pending.action, pending.ids, { [pending.action.form!.field.name]: formValue })}
          footer={
            <>
              <FiButton type="submit" loading={busy} wrapLabel>
                {pending.action.form.submitLabel}
              </FiButton>
              <FiButton color="gray" onClick={() => setPending(null)}>
                {pending.action.form.cancelLabel}
              </FiButton>
            </>
          }
        >
          <FiTextField
            id={`mountedActionSchema0.${pending.action.form.field.name}`}
            label={pending.action.form.field.label}
            required={pending.action.form.field.required}
            value={formValue}
            onChange={setFormValue}
            error={formError}
            autoFocus
          />
        </FiModal>
      ) : null}
    </div>
  );
}
