"use client";

import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { postAction } from "@/components/admin/filament/ActionForm";
import { FiHelperText, FiInput, FiNativeSelect, FiTextarea } from "@/components/admin/filament/Fields";
import { FiFileUpload } from "@/components/admin/filament/FileUpload";
import { FiIcon } from "@/components/admin/filament/Icon";
import { useFiToast } from "@/components/admin/filament/Modal";
import { FiButton } from "@/components/admin/filament/ui";
import { valueAt, withValue, type EditorNode } from "@/lib/content-editor";

/**
 * A Konten Website editor (ContentEditorPage): the page's form drawn from its schema
 * with Filament's markup (sections, tabs, grids, repeaters, image uploads), "Simpan"
 * under it. A picked image waits in the browser as `upload:<key>` until the form is saved.
 */
export type ContentLabels = {
  save: string;
  hint: string;
  collapseAll: string;
  expandAll: string;
  move: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  collapse: string;
  expand: string;
};

type Breakpoints = Partial<Record<"default" | "md" | "lg" | "xl" | "2xl", number>>;

const style = (vars: Record<string, string>) => vars as CSSProperties;

/** Filament's grid classes and variables for these columns. */
function gridProps(columns: Breakpoints) {
  const entries = Object.entries(columns).filter(([key]) => key !== "default") as [string, number][];
  // the `grid` attribute macro: "fi-grid-cols" only when more than one column by default
  const classes = ["fi-grid", ...((columns.default ?? 1) > 1 ? ["fi-grid-cols"] : []), ...entries.map(([key]) => `${key}:fi-grid-cols`)];
  const vars: Record<string, string> = { "--cols-default": `repeat(${columns.default ?? 1}, minmax(0, 1fr))` };

  for (const [key, count] of entries) {
    vars[`--cols-${key}`] = `repeat(${count}, minmax(0, 1fr))`;
  }

  return { className: classes.join(" "), style: style(vars) };
}

function Col({ full, span, children }: { full?: boolean; span?: { md?: number }; children: ReactNode }) {
  if (span?.md) {
    return (
      <div className="fi-grid-col md:fi-grid-col-span" style={style({ "--col-span-default": "span 1 / span 1", "--col-span-md": `span ${span.md} / span ${span.md}` })}>
        <div className="fi-sc-component">{children}</div>
      </div>
    );
  }

  return (
    <div className="fi-grid-col" style={style({ "--col-span-default": full ? "1 / -1" : "span 1 / span 1" })}>
      <div className="fi-sc-component">{children}</div>
    </div>
  );
}

let sequence = 0;
const newKey = () => `k${Date.now().toString(36)}${sequence++}`;

/** A heading at Filament's level: h1–h6, then a paragraph (HasHeadings::getHeadingTag()). */
function Heading({ level, className, children }: { level: number; className: string; children: ReactNode }) {
  const Tag = (level > 6 ? "p" : `h${Math.max(level, 1)}`) as "h2";

  return <Tag className={className}>{children}</Tag>;
}

export function ContentEditor({
  endpoint,
  schema,
  initial,
  canEdit,
  query,
  labels,
}: {
  endpoint: string;
  schema: EditorNode[];
  initial: Record<string, unknown>;
  canEdit: boolean;
  /** the page's query string, for the tab each tab set opens on (`?bagian=brand::data::tab`) */
  query: Record<string, string>;
  labels: ContentLabels;
}) {
  const router = useRouter();
  const toast = useFiToast();
  const [state, setState] = useState<Record<string, unknown>>(initial);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // a stable key for every repeater item, so React keeps each one's inputs (and FilePond) while items move
  const [itemKeys, setItemKeys] = useState<Record<string, string[]>>({});
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});
  // a key that names no tab falls back to the first one, as Filament's does
  const [tabs, setTabs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      schema
        .filter((node): node is Extract<EditorNode, { type: "tabs" }> => node.type === "tabs")
        .map((node) => [node.queryKey, (query[node.queryKey] ?? "").replace(/::data::tab$/, "")] as const)
        .filter(([, value]) => value !== ""),
    ),
  );

  const keysFor = (path: string, count: number): string[] => {
    const known = itemKeys[path] ?? [];

    return known.length === count ? known : Array.from({ length: count }, (_, index) => known[index] ?? `${path}#${index}`);
  };

  const setKeys = (path: string, keys: string[]) => setItemKeys((current) => ({ ...current, [path]: keys }));
  const set = (path: string, value: unknown) => setState((current) => withValue(current, path, value));

  const submit = async () => {
    setBusy(true);

    try {
      const result = await postAction(endpoint, { state }, Object.fromEntries(Object.entries(files).map(([key, file]) => [key, [file]])));

      if (result.status === 422) {
        setErrors(Object.fromEntries(Object.entries(result.errors ?? {}).map(([field, messages]) => [field, messages[0]])));

        return;
      }

      setErrors({});
      setFiles({});

      if (result.toast) {
        toast(result.toast);
      }

      // `$this->mount()`: the form refilled from what is saved now
      const fresh = (result as { state?: Record<string, unknown> }).state;

      if (fresh) {
        setState(fresh);
        setItemKeys({});
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  /**
   * `level`: Filament's heading level here, 2 at the root, one deeper inside a Section with
   * a heading or a Repeater with item labels (HasHeadings::getChildSchemaRootHeadingLevel()).
   */
  const render = (nodes: EditorNode[], base: string, scope: Record<string, unknown>, columns: Breakpoints = { default: 1 }, level = 2, hidden = false): ReactNode => (
    <div {...gridProps(columns)} className={`${gridProps(columns).className} fi-sc fi-sc-has-gap`}>
      {nodes.map((node, index) => (
        <Fragment key={index}>{renderNode(node, base, scope, level, hidden)}</Fragment>
      ))}
    </div>
  );

  const renderNode = (node: EditorNode, base: string, scope: Record<string, unknown>, level: number, hidden: boolean): ReactNode => {
    switch (node.type) {
      case "section": {
        const hasHeader = Boolean(node.heading || node.description);

        return (
          <Col full>
            <div className="fi-sc-section">
              <section className={`fi-section${hasHeader ? " fi-section-has-header" : ""}`}>
                {hasHeader ? (
                  <header className="fi-section-header">
                    <div className="fi-section-header-content fi-section-header-content-has-heading">
                      <div className="fi-section-header-text-ctn">
                        {node.heading ? <Heading level={level} className="fi-section-header-heading">{node.heading}</Heading> : null}
                        {node.description ? <p className="fi-section-header-description">{node.description}</p> : null}
                      </div>
                    </div>
                  </header>
                ) : null}
                <div className="fi-section-content-ctn">
                  <div {...gridProps(node.columns)} className={`fi-section-content ${gridProps(node.columns).className} fi-sc fi-sc-has-gap`}>
                    {node.children.map((child, index) => (
                      <Fragment key={index}>{renderNode(child, base, scope, node.heading ? level + 1 : level, hidden)}</Fragment>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </Col>
        );
      }
      case "tabs": {
        const active = node.tabs.some((tab) => tab.key === tabs[node.queryKey]) ? tabs[node.queryKey] : node.tabs[0].key;

        return (
          <Col full>
            <div className="fi-sc-tabs fi-contained">
              <div className="fi-tabs fi-contained">
                <div role="tablist" aria-label={node.queryKey === "bagian" ? "sections" : node.queryKey} className="fi-sc-tabs-tablist">
                  {node.tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      tabIndex={tab.key === active ? 0 : -1}
                      className={`fi-tabs-item${tab.key === active ? " fi-active" : ""}`}
                      aria-selected={tab.key === active}
                      data-tab-available="true"
                      onClick={() => {
                        setTabs((current) => ({ ...current, [node.queryKey]: tab.key }));

                        const url = new URL(window.location.href);

                        url.searchParams.set(node.queryKey, `${tab.key}::data::tab`);
                        window.history.replaceState(null, "", url);
                      }}
                    >
                      <FiIcon name={tab.icon} className="fi-tabs-item-icon" />
                      <span className="fi-tabs-item-label">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {node.tabs.map((tab) => (
                <div key={tab.key} role="tabpanel" tabIndex={0} className={`fi-sc-tabs-tab${tab.key === active ? " fi-active" : ""}`}>
                  {render(tab.children, base, scope, undefined, level, hidden || tab.key !== active)}
                </div>
              ))}
            </div>
          </Col>
        );
      }
      case "grid":
        return (
          <Col span={node.span}>
            {/* Grid::toEmbeddedHtml(): its own <div> around the child schema */}
            <div>
              <div {...gridProps(node.columns)} className={`${gridProps(node.columns).className} fi-sc fi-sc-has-gap`}>
                {node.children.map((child, index) => (
                  <Fragment key={index}>{renderNode(child, base, scope, level, hidden)}</Fragment>
                ))}
              </div>
            </div>
          </Col>
        );
      case "note":
        return (
          <Col>
            <span className="fi-sc-text">{node.text}</span>
          </Col>
        );
      case "repeater":
        return <Col full>{renderRepeater(node, `${base}${node.name}`, scope, level, hidden)}</Col>;
      default: {
        const path = `${base}${node.name}`;
        const id = `form.${path}`;
        const value = valueAt(scope, node.name);
        const text = value === null || value === undefined ? "" : String(value);
        const common = { id, label: node.label, required: node.required, error: errors[path], helper: node.helper };

        if (node.type === "text") {
          return (
            <Col full={node.full}>
              <FiInput {...common} maxLength={node.maxLength} placeholder={node.placeholder} prefix={node.prefix} disabled={!canEdit} type={node.email ? "email" : "text"} value={text} onChange={(next) => set(path, next)} />
            </Col>
          );
        }

        if (node.type === "textarea") {
          return (
            <Col full={node.full}>
              <FiTextarea {...common} rows={node.rows} maxLength={node.maxLength} disabled={!canEdit} value={text} onChange={(next) => set(path, next)} />
            </Col>
          );
        }

        if (node.type === "select") {
          return (
            <Col full={node.full}>
              <FiNativeSelect {...common} options={node.options} placeholder={node.placeholder} disabled={!canEdit} value={text} onChange={(next) => set(path, next)} />
            </Col>
          );
        }

        // an image: the saved one loaded from its URL, or one waiting to be uploaded
        const existing = text !== "" && !text.startsWith("upload:") ? { url: text } : null;

        return (
          <Col full={node.full}>
            <div data-field-wrapper="" className="fi-fo-field">
              <div className="fi-fo-field-label-col">
                <div className="fi-fo-field-label-ctn">
                  <div id={`${id}-label`} className="fi-fo-field-label">
                    <span className="fi-fo-field-label-content">
                      {node.label}
                      {node.required ? <sup className="fi-fo-field-label-required-mark">*</sup> : null}
                    </span>
                  </div>
                </div>
              </div>
              <div className="fi-fo-field-content-col">
                <FiFileUpload
                  id={id}
                  accept={node.accept}
                  maxSizeKb={node.maxSizeKb}
                  existing={existing}
                  onExistingRemoved={() => set(path, null)}
                  previewHeight={node.previewHeight}
                  avatar={node.avatar}
                  openable
                  onChange={(list) => {
                    if (list.length) {
                      const key = newKey();

                      setFiles((current) => ({ ...current, [key]: list[0] }));
                      set(path, `upload:${key}`);
                    } else if (text.startsWith("upload:")) {
                      set(path, null);
                    }
                  }}
                />
                {errors[path] ? (
                  <p data-validation-error="" className="fi-fo-field-wrp-error-message">
                    {errors[path]}
                  </p>
                ) : null}
              </div>
            </div>
          </Col>
        );
      }
    }
  };

  const renderRepeater = (node: Extract<EditorNode, { type: "repeater" }>, path: string, scope: Record<string, unknown>, level: number, hidden: boolean): ReactNode => {
    const items = (Array.isArray(valueAt(scope, node.name)) ? valueAt(scope, node.name) : []) as Record<string, unknown>[];
    const keys = keysFor(path, items.length);
    const id = `form.${path}`;
    const isCollapsed = (key: string) => collapsedItems[key] ?? Boolean(node.collapsed);
    const move = (from: number, to: number) => {
      const nextItems = [...items];
      const nextKeys = [...keys];
      const [item] = nextItems.splice(from, 1);
      const [key] = nextKeys.splice(from, 1);

      nextItems.splice(to, 0, item);
      nextKeys.splice(to, 0, key);
      setKeys(path, nextKeys);
      set(path, nextItems);
    };

    return (
      <div data-field-wrapper="" className="fi-fo-field">
        {node.hiddenLabel ? (
          <div id={`${id}-label`} className="fi-fo-field-label fi-sr-only">
            {node.name.charAt(0).toUpperCase() + node.name.slice(1)}
          </div>
        ) : (
          <div className="fi-fo-field-label-col">
            <div className="fi-fo-field-label-ctn">
              <div id={`${id}-label`} className="fi-fo-field-label">
                <span className="fi-fo-field-label-content">{node.label}</span>
              </div>
            </div>
          </div>
        )}
        <div className="fi-fo-field-content-col">
          <div aria-labelledby={`${id}-label`} id={id} role="group" className={`fi-fo-repeater${node.collapsible ? " fi-collapsible" : ""}`}>
            <span className="fi-sr-only" role="status" aria-live="polite" aria-atomic="true" />
            {node.collapsible ? (
              <div className={`fi-fo-repeater-actions${items.length < 2 ? " fi-hidden" : ""}`}>
                <span>
                  <button type="button" className="fi-ac-link-action fi-link fi-size-sm" onClick={() => setCollapsedItems((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, true])) }))}>
                    <span className="fi-link-label">{labels.collapseAll}</span>
                  </button>
                </span>
                <span>
                  <button type="button" className="fi-ac-link-action fi-link fi-size-sm" onClick={() => setCollapsedItems((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, false])) }))}>
                    <span className="fi-link-label">{labels.expandAll}</span>
                  </button>
                </span>
              </div>
            ) : null}
            {items.length ? (
              <ul {...gridProps(node.grid ?? { default: 1 })} className={`${gridProps(node.grid ?? { default: 1 }).className} fi-fo-repeater-items`}>
                {items.map((item, index) => {
                  const key = keys[index];
                  const title = node.itemLabel ? String(item?.[node.itemLabel] ?? "").trim() : "";
                  const label = title !== "" ? (node.itemNumbers ? `${title} ${index + 1}` : title) : null;
                  const collapsed = node.collapsible && isCollapsed(key);
                  const handleHidden = items.length > 1 && !hidden;

                  return (
                    <li key={key} className={`fi-fo-repeater-item fi-fo-repeater-item-has-header${collapsed ? " fi-collapsed" : ""}`}>
                      <div className="fi-fo-repeater-item-header">
                        {canEdit ? (
                          <ul className="fi-fo-repeater-item-header-start-actions">
                            <li>
                              {/* reordering.js updateHandles(): hidden from screen readers while a move button can stand in for it */}
                              <button
                                title={labels.move}
                                aria-label={labels.move}
                                type="button"
                                className="fi-ac-icon-btn-action fi-icon-btn fi-size-sm"
                                tabIndex={handleHidden ? -1 : undefined}
                                aria-hidden={handleHidden || undefined}
                              >
                                <FiIcon name="m-arrows-up-down" />
                              </button>
                            </li>
                            <li className="fi-sr-only">
                              <button title={labels.moveUp} aria-label={labels.moveUp} type="button" disabled={index === 0} aria-disabled={index === 0 || undefined} className={`fi-ac-icon-btn-action fi-icon-btn${index === 0 ? " fi-disabled" : ""} fi-size-sm`} onClick={() => move(index, index - 1)}>
                                <FiIcon name="m-chevron-up" />
                              </button>
                            </li>
                            <li className="fi-sr-only">
                              <button
                                title={labels.moveDown}
                                aria-label={labels.moveDown}
                                type="button"
                                disabled={index === items.length - 1}
                                aria-disabled={index === items.length - 1 || undefined}
                                className={`fi-ac-icon-btn-action fi-icon-btn${index === items.length - 1 ? " fi-disabled" : ""} fi-size-sm`}
                                onClick={() => move(index, index + 1)}
                              >
                                <FiIcon name="m-chevron-down" />
                              </button>
                            </li>
                          </ul>
                        ) : null}
                        {label !== null ? (
                          <Heading level={level} className="fi-fo-repeater-item-header-label fi-truncated">
                            {label}
                          </Heading>
                        ) : null}
                        <ul className="fi-fo-repeater-item-header-end-actions">
                          {canEdit ? (
                            <li>
                              <button
                                title={labels.remove}
                                aria-label={labels.remove}
                                type="button"
                                className="fi-ac-icon-btn-action fi-icon-btn fi-size-sm fi-color fi-color-danger fi-text-color-600 hover:fi-text-color-500 dark:fi-text-color-400 dark:hover:fi-text-color-300"
                                onClick={() => {
                                  setKeys(path, keys.filter((_, other) => other !== index));
                                  set(
                                    path,
                                    items.filter((_, other) => other !== index),
                                  );
                                }}
                              >
                                <FiIcon name="m-trash" />
                              </button>
                            </li>
                          ) : null}
                          {node.collapsible ? (
                            <li className="fi-fo-repeater-item-header-collapsible-actions">
                              <div className="fi-fo-repeater-item-header-collapse-action">
                                <button title={labels.collapse} aria-label={labels.collapse} type="button" className="fi-ac-icon-btn-action fi-icon-btn fi-size-sm" onClick={() => setCollapsedItems((current) => ({ ...current, [key]: true }))}>
                                  <FiIcon name="m-chevron-up" />
                                </button>
                              </div>
                              <div className="fi-fo-repeater-item-header-expand-action">
                                <button title={labels.expand} aria-label={labels.expand} type="button" className="fi-ac-icon-btn-action fi-icon-btn fi-size-sm" onClick={() => setCollapsedItems((current) => ({ ...current, [key]: false }))}>
                                  <FiIcon name="m-chevron-down" />
                                </button>
                              </div>
                            </li>
                          ) : null}
                        </ul>
                      </div>
                      <div className="fi-fo-repeater-item-content" style={collapsed ? { display: "none" } : undefined}>
                        {render(node.children, `${path}.${index}.`, item ?? {}, node.columns ? { default: 1, lg: node.columns } : { default: 1 }, node.itemLabel ? level + 1 : level, hidden || Boolean(collapsed))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {canEdit && (node.max === undefined || items.length < node.max) ? (
              <div className="fi-fo-repeater-add">
                <FiButton
                  color="gray"
                  size="sm"
                  onClick={() => {
                    const key = newKey();

                    // a new item opens expanded, even in a repeater that starts collapsed
                    setKeys(path, [...keys, key]);
                    setCollapsedItems((current) => ({ ...current, [key]: false }));
                    set(path, [...items, {}]);
                  }}
                >
                  {node.addLabel}
                </FiButton>
              </div>
            ) : null}
            {/* Repeater::getReorderingDescriptionHtml(): Filament has no Indonesian for it, so English */}
            {items.map((item, index) => {
              const title = node.itemLabel ? String(item?.[node.itemLabel] ?? "").trim() : "";
              const label = title !== "" ? (node.itemNumbers ? `${title} ${index + 1}` : title) : "Item";

              return (
                <span key={keys[index]} className="fi-sr-only">
                  {`${label}, position ${index + 1} of ${items.length}`}
                </span>
              );
            })}
          </div>
          {node.helper ? <FiHelperText id={id} text={node.helper} /> : null}
          {errors[path] ? (
            <p data-validation-error="" className="fi-fo-field-wrp-error-message">
              {errors[path]}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  const form = useMemo(() => schema, [schema]);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {render(form, "", state)}
      {canEdit ? (
        <div className="flex items-center gap-3">
          <FiButton type="submit" plain icon="o-check" loading={busy}>
            {labels.save}
          </FiButton>
          <span className="text-sm text-gray-500 dark:text-gray-400">{labels.hint}</span>
        </div>
      ) : null}
    </form>
  );
}
