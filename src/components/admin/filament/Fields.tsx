"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Filament form fields with Filament's markup: a field wrapper (label, required mark,
 * error), the searchable select (`->searchable()->preload()`), the native select, and
 * text, number and textarea inputs.
 */
type FieldShell = { id: string; label: string; required?: boolean; error?: string; wrapperClass?: string; children: ReactNode };

export function FiField({ id, label, required, error, wrapperClass = "", children }: FieldShell) {
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
}: Omit<FieldShell, "children" | "wrapperClass"> & { value: string; onChange: (value: string) => void; options: SelectOption[]; placeholder: string | null; disabled?: boolean }) {
  return (
    <FiField id={id} label={label} required={required} error={error} wrapperClass="fi-fo-select-wrp">
      <div className={`fi-fo-select fi-fo-select-native fi-input-wrp${disabled ? " fi-disabled" : ""}${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <select id={id} disabled={disabled} required={required} className="fi-select-input" value={value} onChange={(event) => onChange(event.target.value)}>
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

/** A text or number input (`TextInput`). */
export function FiInput({
  id,
  label,
  required,
  error,
  value,
  onChange,
  type = "text",
}: Omit<FieldShell, "children" | "wrapperClass"> & { value: string; onChange: (value: string) => void; type?: "text" | "number" }) {
  return (
    <FiField id={id} label={label} required={required} error={error}>
      <div className={`fi-fo-text-input fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <input id={id} required={required} type={type} className="fi-input" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} />
        </div>
      </div>
    </FiField>
  );
}

export function FiTextarea({ id, label, required, error, value, onChange }: Omit<FieldShell, "children" | "wrapperClass"> & { value: string; onChange: (value: string) => void }) {
  return (
    <FiField id={id} label={label} required={required} error={error} wrapperClass="fi-fo-textarea-wrp">
      <div className={`fi-fo-textarea fi-input-wrp${error ? " fi-invalid" : ""}`}>
        <div className="fi-input-wrp-content-ctn">
          <div>
            <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />
          </div>
        </div>
      </div>
    </FiField>
  );
}
