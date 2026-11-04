"use client";

import { useState, type CSSProperties } from "react";
import { FiDateInput, FiHelperText, FiInput, FiNativeSelect, FiSearchableSelect, FiTextarea, type SelectOption } from "./Fields";
import { FiFileUpload } from "./FileUpload";
import { FiModal, type FiToast } from "./Modal";
import { FiButton } from "./ui";

/**
 * An action with a form (Filament's `->schema([...])` on an action): a modal with its
 * fields, Kirim and Batal. Files go up as multipart, everything else as JSON.
 */
type Base = { name: string; label: string; required?: boolean; value?: string; helper?: string };

export type ActionField =
  | (Base & { kind: "text" | "number"; maxLength?: number; integer?: boolean; min?: number; max?: number })
  | (Base & { kind: "select"; options: SelectOption[]; placeholder: string | null })
  | (Base & { kind: "searchable"; options: SelectOption[]; searchUrl?: string; labels: { placeholder: string; search: string; noResults: string; clear: string; prompt?: string } })
  | (Base & { kind: "date" })
  | (Base & { kind: "textarea"; maxLength?: number })
  | (Base & { kind: "file"; multiple?: boolean; accept?: string[]; maxSizeKb?: number; maxFiles?: number })
  /**
   * A line of text worked out from the form (Filament's `Text::make(fn (Get $get) => …)`):
   * the stock now at the chosen branch, or what it becomes after the typed difference.
   */
  | {
      kind: "stock";
      name: string;
      label: "";
      show: "current" | "after";
      /** the count at each branch, or at the only one */
      quantities: Record<string, number> | number;
      branchField?: string;
      deltaField: string;
      labels: { pick: string; current: string; after: string };
    };

export type ActionFormSpec = { heading: string; description?: string; fields: ActionField[]; submitLabel: string; cancelLabel: string };

export type ActionResult = { toast?: Omit<FiToast, "id">; redirect?: string; errors?: Record<string, string[]>; result?: unknown };

/** POSTs an action: JSON, or multipart with the data as `data` when there are files. */
export async function postAction(endpoint: string, data: Record<string, unknown>, files: Record<string, File[]> = {}): Promise<ActionResult & { status: number }> {
  const hasFiles = Object.values(files).some((list) => list.length > 0);
  const headers: Record<string, string> = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
  let body: BodyInit;

  if (hasFiles) {
    const form = new FormData();

    form.set("data", JSON.stringify(data));

    for (const [name, list] of Object.entries(files)) {
      for (const file of list) {
        form.append(name, file);
      }
    }

    body = form;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, { method: "POST", headers, body, credentials: "same-origin" });

  return { status: response.status, ...((await response.json().catch(() => ({}))) as ActionResult) };
}

export function FiActionFormModal({
  form,
  busy,
  errors,
  closeLabel,
  onClose,
  onSubmit,
}: {
  form: ActionFormSpec;
  busy: boolean;
  errors: Record<string, string>;
  closeLabel: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>, files: Record<string, File[]>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(form.fields.filter((field) => field.kind !== "file" && field.kind !== "stock").map((field) => [field.name, (field as Base).value ?? ""])),
  );
  const [files, setFiles] = useState<Record<string, File[]>>({});

  return (
    <FiModal
      open
      onClose={onClose}
      heading={form.heading}
      description={form.description}
      width="4xl"
      closeLabel={closeLabel}
      onSubmit={() => onSubmit(values, files)}
      footer={
        <>
          <FiButton type="submit" loading={busy} wrapLabel>
            {form.submitLabel}
          </FiButton>
          <FiButton color="gray" onClick={onClose}>
            {form.cancelLabel}
          </FiButton>
        </>
      }
    >
      <div className="fi-grid fi-sc fi-sc-has-gap" style={{ "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}>
        {form.fields.map((field, index) => {
          const id = `mountedActionSchema0.${field.name}`;

          return (
            <div key={field.name} className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
              <div className="fi-sc-component">
                {field.kind === "stock" ? (
                  <StockLine field={field} values={values} />
                ) : field.kind === "searchable" ? (
                  <FiSearchableSelect
                    id={id}
                    label={field.label}
                    required={field.required}
                    helper={field.helper}
                    options={field.options}
                    searchUrl={field.searchUrl}
                    labels={field.labels}
                    value={values[field.name] ?? ""}
                    error={errors[field.name]}
                    onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
                  />
                ) : field.kind === "date" ? (
                  <FiDateInput id={id} label={field.label} required={field.required} helper={field.helper} value={values[field.name] ?? ""} error={errors[field.name]} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} />
                ) : field.kind === "textarea" ? (
                  <FiTextarea id={id} label={field.label} required={field.required} helper={field.helper} maxLength={field.maxLength} value={values[field.name] ?? ""} error={errors[field.name]} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} />
                ) : field.kind === "select" ? (
                  <FiNativeSelect id={id} label={field.label} required={field.required} helper={field.helper} options={field.options} placeholder={field.placeholder} value={values[field.name] ?? ""} error={errors[field.name]} onChange={(value) => setValues({ ...values, [field.name]: value })} />
                ) : field.kind === "file" ? (
                  <div data-field-wrapper="" className="fi-fo-field">
                    <div className="fi-fo-field-label-col">
                      <div className="fi-fo-field-label-ctn">
                        <div id={`${id}-label`} className="fi-fo-field-label">
                          <span className="fi-fo-field-label-content">
                            {field.label}
                            {field.required ? <sup className="fi-fo-field-label-required-mark">*</sup> : null}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="fi-fo-field-content-col">
                      <FiFileUpload
                        id={id}
                        multiple={field.multiple}
                        accept={field.accept}
                        maxSizeKb={field.maxSizeKb}
                        maxFiles={field.maxFiles}
                        describedBy={field.helper ? `${id}-helper-text` : undefined}
                        onChange={(list) => setFiles((current) => ({ ...current, [field.name]: list }))}
                      />
                      {field.helper ? <FiHelperText id={id} text={field.helper} /> : null}
                      {errors[field.name] ? (
                        <p id={`${id}-error`} data-validation-error="" className="fi-fo-field-wrp-error-message">
                          {errors[field.name]}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <FiInput
                    id={id}
                    label={field.label}
                    required={field.required}
                    type={field.kind === "number" ? "number" : "text"}
                    integer={field.integer}
                    min={field.min}
                    max={field.max}
                    helper={field.helper}
                    maxLength={field.maxLength}
                    value={values[field.name] ?? ""}
                    error={errors[field.name]}
                    onChange={(value) => setValues({ ...values, [field.name]: value })}
                    autoFocus={index === 0}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </FiModal>
  );
}

const thousands = (count: number) => String(Math.abs(count)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** number_format($count, 0, ',', '.') */
const formatCount = (count: number) => (count < 0 ? `-${thousands(count)}` : thousands(count));

function StockLine({ field, values }: { field: Extract<ActionField, { kind: "stock" }>; values: Record<string, string> }) {
  const branch = field.branchField ? values[field.branchField] : "";
  const current = typeof field.quantities === "number" ? field.quantities : branch ? (field.quantities[branch] ?? null) : null;

  if (field.show === "current") {
    return <span className="fi-sc-text  fi-font-bold">{current === null ? field.labels.pick : field.labels.current.replace(":count", formatCount(current))}</span>;
  }

  const delta = values[field.deltaField] ?? "";
  const known = current !== null && delta.trim() !== "" && Number.isFinite(Number(delta));
  const after = known ? current + Math.trunc(Number(delta)) : null;

  return (
    <span className={`fi-color fi-color-${after !== null && after < 0 ? "danger" : "success"} fi-text-color-700 dark:fi-text-color-400 fi-sc-text`}>
      {after === null ? "" : field.labels.after.replace(":count", formatCount(after))}
    </span>
  );
}
