"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Filament form fields with Filament's markup: a field wrapper (label, required mark,
 * error), the searchable select (`->searchable()->preload()`), the native select, and
 * text, number and textarea inputs.
 */
type FieldShell = { id: string; label: string; required?: boolean; error?: string; helper?: string; wrapperClass?: string; children: ReactNode; /** a group of inputs is named by a div, not a label */ labelTag?: "label" | "div" };

/** The ids a field's input points at: its helper text, then its error. */
export function describedBy(id: string, helper?: string, error?: string): string | undefined {
  return [helper ? `${id}-helper-text` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

/** A field's helper text (`->helperText()`), under the input. */
export function FiHelperText({ id, text }: { id: string; text: string }) {
  return (
    <div id={`${id}-helper-text`} className="fi-sc fi-inline fi-sc-has-gap fi-sc-dense">
      <div>
        <div className="fi-sc-component">
          <span className="fi-sc-text">{text}</span>
        </div>
      </div>
    </div>
  );
}

export function FiField({ id, label, required, error, helper, wrapperClass = "", children, labelTag = "label" }: FieldShell) {
  const labelContent = (
    <span className="fi-fo-field-label-content">
      {label}
      {required ? <sup className="fi-fo-field-label-required-mark">*</sup> : null}
    </span>
  );

  return (
    <div data-field-wrapper="" className={`${wrapperClass ? `${wrapperClass} ` : ""}fi-fo-field`}>
      <div className="fi-fo-field-label-col">
        <div className="fi-fo-field-label-ctn">
          {labelTag === "div" ? (
            <div id={`${id}-label`} className="fi-fo-field-label">
              {labelContent}
            </div>
          ) : (
            <label htmlFor={id} className="fi-fo-field-label">
              {labelContent}
            </label>
          )}
        </div>
      </div>
      <div className="fi-fo-field-content-col">
        {children}
        {/* Filament puts the helper text (below-content schema) above the error */}
        {helper ? <FiHelperText id={id} text={helper} /> : null}
        {error ? (
          <p id={`${id}-error`} data-validation-error="" className="fi-fo-field-wrp-error-message">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type SelectOption = { value: string; label: string };

/** A native `<select>` (a Select that isn't searchable). */
export function FiNativeSelect({
  id,
  label,
  required,
  error,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  helper,
}: Omit<FieldShell, "children" | "wrapperClass"> & { value: string; onChange: (value: string) => void; options: SelectOption[]; placeholder: string | null; disabled?: boolean }) {
  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper} wrapperClass="fi-fo-select-wrp">
      <div className={`fi-fo-select fi-fo-select-native fi-input-wrp${disabled ? " fi-disabled" : ""}${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <select
            id={id}
            disabled={disabled}
            required={required}
            className="fi-select-input"
            value={value}
            aria-describedby={describedBy(id, helper, error)}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{placeholder ?? ""}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </FiField>
  );
}

/**
 * Filament's searchable select: a button showing the choice (or the placeholder), a
 * dropdown with a search box filtering the preloaded options, and a × to clear it.
 */
export function FiSearchableSelect({
  id,
  label,
  required,
  error,
  value,
  onChange,
  options,
  labels,
  helper,
  searchUrl,
  searchable = true,
  clearable = true,
}: Omit<FieldShell, "children" | "wrapperClass"> & {
  /** `->native(false)` without `->searchable()`: a plain dropdown */
  searchable?: boolean;
  /** `->selectablePlaceholder(false)` keeps the choice from being cleared */
  clearable?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  labels: { placeholder: string; search: string; noResults: string; clear: string; prompt?: string; searching?: string };
  /** `->getSearchResultsUsing()`: options come from the server as the staff member types (`?search=`) */
  searchUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<SelectOption[] | null>(null);
  const [picked, setPicked] = useState<SelectOption | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? (picked?.value === value ? picked : undefined);
  const shown = useMemo(() => {
    if (searchUrl) {
      return found ?? [];
    }

    const needle = term.trim().toLowerCase();

    return needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  }, [options, term, searchUrl, found]);

  // a server-searched select asks again a moment after each keystroke
  useEffect(() => {
    if (!searchUrl) {
      return;
    }

    if (term.trim() === "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing typed: back to the prompt
      setFound(null);

      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch(`${searchUrl}${searchUrl.includes("?") ? "&" : "?"}search=${encodeURIComponent(term)}`, { signal: controller.signal, credentials: "same-origin" }).catch(() => null);

      setFound(response?.ok ? ((await response.json()) as SelectOption[]) : []);
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, searchUrl]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: MouseEvent) => !root.current?.contains(event.target as Node) && setOpen(false);

    document.addEventListener("mousedown", close);

    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper} wrapperClass="fi-fo-select-wrp">
      <div className={`fi-fo-select fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <div className="fi-select-input" ref={root}>
            <div>
              <div className={`fi-select-input-ctn${selected && clearable ? " fi-select-input-ctn-clearable" : ""}`}>
                <button className="fi-select-input-btn" type="button" id={id} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
                  <div className="fi-select-input-value-ctn">
                    {selected ? <span className="fi-select-input-value-label">{selected.label}</span> : <span className="fi-select-input-placeholder">{labels.placeholder}</span>}
                  </div>
                </button>
                {open ? (
                  <div className="fi-dropdown-panel fi-scrollable" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30 }}>
                    {searchable ? (
                      <div className="fi-select-input-search-ctn">
                        <input className="fi-input" type="text" placeholder={labels.search} role="combobox" aria-controls={`${id}-listbox`} aria-expanded aria-label={`${label}: Search`} autoFocus value={term} onChange={(event) => setTerm(event.target.value)} />
                      </div>
                    ) : null}
                    {shown.length ? (
                      <ul id={`${id}-listbox`} role="listbox" className="fi-dropdown-list" aria-label={label}>
                        {shown.map((option) => (
                          <li
                            key={option.value}
                            className={`fi-dropdown-list-item fi-select-input-option${option.value === value ? " fi-selected" : ""}`}
                            role="option"
                            aria-selected={option.value === value}
                            onClick={() => {
                              setPicked(option);
                              onChange(option.value);
                              setOpen(false);
                              setTerm("");
                            }}
                          >
                            <span>{option.label}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="fi-select-input-message">{searchUrl && term.trim() === "" ? (labels.prompt ?? labels.search) : labels.noResults}</div>
                    )}
                  </div>
                ) : null}
                {selected && clearable ? (
                  <button type="button" className="fi-select-input-value-remove-btn" aria-label={labels.clear} onClick={() => onChange("")}>
                    <svg className="fi-icon fi-size-sm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FiField>
  );
}

/** A text, number, email or phone input (`TextInput`). */
export function FiInput({
  id,
  label,
  required,
  error,
  helper,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
  integer = false,
  autoFocus = false,
  min,
  max,
  onBlur,
  disabled = false,
}: Omit<FieldShell, "children" | "wrapperClass"> & {
  onBlur?: () => void;
  disabled?: boolean;
  /** `->minValue()` / `->maxValue()`, which Filament also gives the input */
  min?: number;
  max?: number;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "email" | "tel" | "url";
  placeholder?: string;
  maxLength?: number;
  /** `->integer()`: whole steps */
  integer?: boolean;
  /** the first field of an action's modal, where Filament's focus trap lands */
  autoFocus?: boolean;
}) {
  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper}>
      <div className={`fi-fo-text-input fi-input-wrp${disabled ? " fi-disabled" : ""}${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <input
            id={id}
            disabled={disabled}
            required={required}
            type={type}
            inputMode={type === "number" ? (integer ? "numeric" : "decimal") : undefined}
            step={type === "number" ? (integer ? 1 : "any") : undefined}
            min={min}
            max={max}
            maxLength={maxLength}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="fi-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, helper, error)}
          />
        </div>
      </div>
    </FiField>
  );
}

export function FiTextarea({
  id,
  label,
  required,
  error,
  helper,
  value,
  onChange,
  rows,
  maxLength,
  placeholder,
}: Omit<FieldShell, "children" | "wrapperClass"> & { value: string; onChange: (value: string) => void; rows?: number; maxLength?: number; placeholder?: string }) {
  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper} wrapperClass="fi-fo-textarea-wrp">
      <div className={`fi-fo-textarea fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <div>
            <textarea
              id={id}
              required={required}
              rows={rows}
              maxLength={maxLength}
              placeholder={placeholder}
              value={value}
              aria-describedby={describedBy(id, helper, error)}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        </div>
      </div>
    </FiField>
  );
}

/**
 * Filament's TagsInput: Enter (or a split key) adds the typed tag, unless it is empty or
 * already there; leaving the box adds it too; each tag has its × to remove it.
 */
export function FiTagsInput({
  id,
  label,
  required,
  error,
  helper,
  value,
  onChange,
  placeholder,
  splitKeys = [],
  removeLabel,
}: Omit<FieldShell, "children" | "wrapperClass"> & { value: string[]; onChange: (value: string[]) => void; placeholder?: string; splitKeys?: string[]; removeLabel: string }) {
  const [draft, setDraft] = useState("");
  const add = (text: string) => {
    const tag = text.trim();

    setDraft("");

    if (tag !== "" && !value.includes(tag)) {
      onChange([...value, tag]);
    }
  };

  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper}>
      <div aria-describedby={describedBy(id, helper, error)} aria-label={label} role="group" className={`fi-fo-tags-input fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <div>
            <input
              aria-describedby={describedBy(id, helper, error)}
              autoComplete="off"
              id={id}
              placeholder={placeholder}
              type="text"
              className="fi-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => add(draft)}
              onKeyDown={(event) => {
                if (["Enter", ...splitKeys].includes(event.key)) {
                  event.preventDefault();
                  event.stopPropagation();
                  add(draft);
                }
              }}
            />
            {value.length ? (
              <div className="fi-fo-tags-input-tags-ctn">
                {value.map((tag) => (
                  <span key={tag} className="fi-badge fi-size-md fi-color fi-color-primary fi-text-color-700 dark:fi-text-color-300">
                    <span className="fi-badge-label-ctn">
                      <span className="fi-badge-label">
                        <span>{tag}</span>
                      </span>
                    </span>
                    <button type="button" className="fi-badge-delete-btn" aria-label={`${removeLabel}: ${tag}`} onClick={() => onChange(value.filter((other) => other !== tag))}>
                      <span aria-hidden="true" className="fi-badge-delete-btn-icon" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </FiField>
  );
}

/** Filament's DatePicker (native): a browser date input. */
export function FiDateInput({ id, label, required, error, helper, value, onChange }: Omit<FieldShell, "children" | "wrapperClass"> & { value: string; onChange: (value: string) => void }) {
  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper}>
      <div className={`fi-fo-date-time-picker fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <input id={id} required={required} type="date" className="fi-input" value={value} aria-describedby={describedBy(id, helper, error)} onChange={(event) => onChange(event.target.value)} />
        </div>
      </div>
    </FiField>
  );
}

/** CheckboxList with `->columns()`: the options in column-major order over `columns` columns from lg up. */
export function FiCheckboxList({
  id,
  label,
  required,
  error,
  helper,
  options,
  columns = 1,
  value,
  onChange,
  bulk,
  search,
}: Omit<FieldShell, "children" | "wrapperClass" | "labelTag"> & {
  options: SelectOption[];
  columns?: number;
  value: string[];
  onChange: (value: string[]) => void;
  /** `->bulkToggleable()`: "Pilih semua" / "Batalkan semua pilihan" over the options shown */
  bulk?: { selectAll: string; deselectAll: string };
  /** `->searchable()`: its prompt and "nothing found" message */
  search?: { prompt: string; noResults: string };
}) {
  const [term, setTerm] = useState("");
  const needle = term.trim().toLowerCase();
  const shown = needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  const allChecked = shown.length > 0 && shown.every((option) => value.includes(option.value));
  const toggleAll = () =>
    onChange(allChecked ? value.filter((item) => !shown.some((option) => option.value === item)) : [...value, ...shown.map((option) => option.value).filter((item) => !value.includes(item))]);

  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper} labelTag="div">
      <div role="group" aria-describedby={describedBy(id, helper, error)} aria-labelledby={`${id}-label`} className="fi-fo-checkbox-list">
        {search ? (
          <div className="fi-input-wrp fi-fo-checkbox-list-search-input-wrp">
            <div className="fi-input-wrp-prefix fi-input-wrp-prefix-has-content fi-inline">
              <svg className="fi-icon fi-size-md fi-color fi-color-gray fi-text-color-400 dark:fi-text-color-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="fi-input-wrp-content-ctn">
              <input aria-label={search.prompt} placeholder={search.prompt} type="search" className="fi-input fi-input-has-inline-prefix" value={term} onChange={(event) => setTerm(event.target.value)} />
            </div>
          </div>
        ) : null}
        {bulk && options.length ? (
          <div className="fi-fo-checkbox-list-actions">
            <span>
              <button type="button" className="fi-ac-link-action fi-link fi-size-sm fi-color fi-color-primary fi-text-color-700 dark:fi-text-color-400" onClick={toggleAll}>
                <span className="fi-link-label">{allChecked ? bulk.deselectAll : bulk.selectAll}</span>
              </button>
            </span>
          </div>
        ) : null}
        <div
          className={`fi-grid fi-grid-direction-col${columns > 1 ? " lg:fi-grid-cols" : ""} fi-fo-checkbox-list-options`}
          style={(columns > 1 ? { "--cols-lg": String(columns), "--cols-default": "1" } : { "--cols-default": "1" }) as unknown as CSSProperties}
          hidden={search !== undefined && shown.length === 0}
        >
          {shown.map((option) => (
            <div key={option.value} className="fi-fo-checkbox-list-option-ctn">
              <label className="fi-fo-checkbox-list-option">
                <input
                  type="checkbox"
                  value={option.value}
                  className={`fi-checkbox-input ${error ? "fi-invalid" : "fi-valid"}`}
                  checked={value.includes(option.value)}
                  onChange={(event) => onChange(event.target.checked ? [...value, option.value] : value.filter((item) => item !== option.value))}
                />
                <div className="fi-fo-checkbox-list-option-text">
                  <span className="fi-fo-checkbox-list-option-label">{option.label}</span>
                </div>
              </label>
            </div>
          ))}
        </div>
        {search && needle && shown.length === 0 ? (
          <div role="status" aria-live="polite" className="fi-fo-checkbox-list-no-search-results-message">
            {search.noResults}
          </div>
        ) : null}
      </div>
    </FiField>
  );
}

/** Toggle (`<x-filament::toggle>`) with its label beside it, as a form field. */
export function FiToggle({ id, label, required, value, onChange }: { id: string; label: string; required?: boolean; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div data-field-wrapper="" className="fi-fo-field">
      <div className="fi-fo-field-label-col">
        <div className="fi-fo-field-label-ctn">
          <label htmlFor={id} className="fi-fo-field-label">
            <button
              role="switch"
              type="button"
              aria-checked={value}
              id={id}
              className={`fi-fo-toggle fi-toggle ${value ? "fi-toggle-on fi-color fi-color-primary fi-bg-color-600 fi-text-color-600 dark:fi-bg-color-500" : "fi-toggle-off"}`}
              onClick={() => onChange(!value)}
            >
              <div>
                <div aria-hidden="true" />
                <div aria-hidden="true" />
              </div>
            </button>
            <span className="fi-fo-field-label-content">
              {label}
              {required ? <sup className="fi-fo-field-label-required-mark">*</sup> : null}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

/** A password TextInput with `->revealable()`: the eye shows what was typed, the struck eye hides it again. */
export function FiPasswordInput({
  id,
  label,
  required,
  error,
  helper,
  value,
  onChange,
  labels,
}: Omit<FieldShell, "children" | "wrapperClass"> & { value: string; onChange: (value: string) => void; labels: { show: string; hide: string } }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper}>
      <div className={`fi-fo-text-input fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <input
            id={id}
            required={required}
            type={revealed ? "text" : "password"}
            className="fi-input fi-revealable"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, helper, error)}
          />
        </div>
        <div className="fi-input-wrp-suffix">
          <div className="fi-input-wrp-actions">
            <button title={revealed ? labels.hide : labels.show} aria-label={revealed ? labels.hide : labels.show} type="button" className="fi-ac-icon-btn-action fi-icon-btn fi-size-sm" onClick={() => setRevealed(!revealed)}>
              <svg className="fi-icon fi-size-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                {revealed ? (
                  <>
                    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
                    <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                  </>
                ) : (
                  <>
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
    </FiField>
  );
}
