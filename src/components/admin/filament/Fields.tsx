"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Filament form fields with Filament's markup: a field wrapper (label, required mark,
 * error), the searchable select (`->searchable()->preload()`), the native select, and
 * text, number and textarea inputs.
 */
type FieldShell = { id: string; label: string; required?: boolean; error?: string; helper?: string; wrapperClass?: string; children: ReactNode };

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

export function FiField({ id, label, required, error, helper, wrapperClass = "", children }: FieldShell) {
  return (
    <div data-field-wrapper="" className={`${wrapperClass ? `${wrapperClass} ` : ""}fi-fo-field`}>
      <div className="fi-fo-field-label-col">
        <div className="fi-fo-field-label-ctn">
          <label htmlFor={id} className="fi-fo-field-label">
            <span className="fi-fo-field-label-content">
              {label}
              {required ? <sup className="fi-fo-field-label-required-mark">*</sup> : null}
            </span>
          </label>
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
}: Omit<FieldShell, "children" | "wrapperClass"> & {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  labels: { placeholder: string; search: string; noResults: string; clear: string };
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase();

    return needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options;
  }, [options, term]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: MouseEvent) => !root.current?.contains(event.target as Node) && setOpen(false);

    document.addEventListener("mousedown", close);

    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <FiField id={id} label={label} required={required} error={error} wrapperClass="fi-fo-select-wrp">
      <div className={`fi-fo-select fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <div className="fi-select-input" ref={root}>
            <div>
              <div className={`fi-select-input-ctn${selected ? " fi-select-input-ctn-clearable" : ""}`}>
                <button className="fi-select-input-btn" type="button" id={id} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
                  <div className="fi-select-input-value-ctn">
                    {selected ? <span className="fi-select-input-value-label">{selected.label}</span> : <span className="fi-select-input-placeholder">{labels.placeholder}</span>}
                  </div>
                </button>
                {open ? (
                  <div className="fi-dropdown-panel fi-scrollable" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30 }}>
                    <div className="fi-select-input-search-ctn">
                      <input className="fi-input" type="text" placeholder={labels.search} role="combobox" aria-controls={`${id}-listbox`} aria-expanded aria-label={`${label}: Search`} autoFocus value={term} onChange={(event) => setTerm(event.target.value)} />
                    </div>
                    {shown.length ? (
                      <ul id={`${id}-listbox`} role="listbox" className="fi-dropdown-list" aria-label={label}>
                        {shown.map((option) => (
                          <li
                            key={option.value}
                            className={`fi-dropdown-list-item fi-select-input-option${option.value === value ? " fi-selected" : ""}`}
                            role="option"
                            aria-selected={option.value === value}
                            onClick={() => {
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
                      <div className="fi-select-input-message">{labels.noResults}</div>
                    )}
                  </div>
                ) : null}
                {selected ? (
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
}: Omit<FieldShell, "children" | "wrapperClass"> & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "email" | "tel";
  placeholder?: string;
  maxLength?: number;
  /** `->integer()`: whole steps */
  integer?: boolean;
  /** the first field of an action's modal, where Filament's focus trap lands */
  autoFocus?: boolean;
}) {
  return (
    <FiField id={id} label={label} required={required} error={error} helper={helper}>
      <div className={`fi-fo-text-input fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <input
            id={id}
            required={required}
            type={type}
            inputMode={type === "number" ? (integer ? "numeric" : "decimal") : undefined}
            step={type === "number" ? (integer ? 1 : "any") : undefined}
            maxLength={maxLength}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="fi-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
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
