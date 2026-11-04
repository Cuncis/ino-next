"use client";

import { useState, type CSSProperties } from "react";
import { FiInput, FiNativeSelect, type SelectOption } from "./Fields";
import { FiFileUpload } from "./FileUpload";
import { FiModal, type FiToast } from "./Modal";
import { FiButton } from "./ui";

/**
 * An action with a form (Filament's `->schema([...])` on an action): a modal with its
 * fields, Kirim and Batal. Files go up as multipart, everything else as JSON.
 */
export type ActionField =
  | { kind: "text" | "number"; name: string; label: string; required?: boolean; maxLength?: number; integer?: boolean; value?: string }
  | { kind: "select"; name: string; label: string; required?: boolean; options: SelectOption[]; placeholder: string | null; value?: string }
  | { kind: "file"; name: string; label: string; required?: boolean; multiple?: boolean; accept?: string[]; maxSizeKb?: number; maxFiles?: number };

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
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(form.fields.filter((field) => field.kind !== "file").map((field) => [field.name, field.value ?? ""])));
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
                {field.kind === "select" ? (
                  <FiNativeSelect id={id} label={field.label} required={field.required} options={field.options} placeholder={field.placeholder} value={values[field.name] ?? ""} error={errors[field.name]} onChange={(value) => setValues({ ...values, [field.name]: value })} />
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
                      <FiFileUpload id={id} multiple={field.multiple} accept={field.accept} maxSizeKb={field.maxSizeKb} maxFiles={field.maxFiles} onChange={(list) => setFiles((current) => ({ ...current, [field.name]: list }))} />
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
