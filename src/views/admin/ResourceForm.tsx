"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FiField, FiInput, FiNativeSelect, FiSearchableSelect, FiTagsInput, FiTextarea, FiHelperText, type SelectOption } from "@/components/admin/filament/Fields";
import { FiFileUpload } from "@/components/admin/filament/FileUpload";
import type { ListAction } from "@/components/admin/filament/ListTable";
import { FiConfirmModal, toastOnNextPage, useFiToast, type FiToast } from "@/components/admin/filament/Modal";
import { FiButton } from "@/components/admin/filament/ui";

/**
 * A resource's create or edit form (Filament's `form()` schema), described by the page:
 * fields in a two-column grid, optionally inside sections. Create has Buat / Buat & buat
 * lainnya / Batal under the fields; edit puts Batal and Simpan in the page header
 * (FormHeaderButtons) and the delete actions under the form.
 *
 * The form is sent as JSON, or as multipart (`data` plus the files) when it has a file field.
 */
type Common = { name: string; label: string; required?: boolean; helper?: string; full?: boolean; visibleWhen?: { field: string; equals: string } };

export type FormFieldSpec =
  | (Common & { kind: "text"; inputType?: "text" | "email" | "tel"; maxLength?: number; placeholder?: string })
  | (Common & { kind: "number"; integer?: boolean })
  | (Common & { kind: "select"; options: SelectOption[]; placeholder: string | null })
  | (Common & { kind: "searchable"; options: SelectOption[] })
  | (Common & { kind: "textarea"; rows?: number; maxLength?: number; placeholder?: string })
  | (Common & { kind: "tags"; placeholder?: string; splitKeys?: string[] })
  | (Common & { kind: "files"; hiddenLabel?: boolean; multiple?: boolean; accept?: string[]; maxSizeKb?: number; maxFiles?: number; reorderable?: boolean });

export type FormBlock = { section?: { id: string; heading: string }; columns: 1 | 2; fields: FormFieldSpec[] };

export type FormValues = Record<string, string | string[]>;

type Labels = { create: string; createAnother: string; cancel: string; close: string; placeholder: string; search: string; noResults: string; clear: string; removeTag: string };

const grid = (vars: Record<string, string>) => vars as CSSProperties;
const repeat = (columns: number) => `repeat(${columns}, minmax(0, 1fr))`;

function Col({ full, children }: { full?: boolean; children: ReactNode }) {
  return (
    <div className="fi-grid-col" style={grid({ "--col-span-default": full ? "1 / -1" : "span 1 / span 1" })}>
      <div className="fi-sc-component">{children}</div>
    </div>
  );
}

function Grid({ columns, className = "", children }: { columns: number; className?: string; children: ReactNode }) {
  return (
    <div
      className={`${className}fi-grid${columns > 1 ? " lg:fi-grid-cols" : ""} fi-sc fi-sc-has-gap`}
      style={grid(columns > 1 ? { "--cols-lg": repeat(columns), "--cols-default": repeat(1) } : { "--cols-default": repeat(1) })}
    >
      {children}
    </div>
  );
}

export function ResourceForm({
  mode,
  endpoint,
  blocks,
  initial,
  pageActions = [],
  cancelUrl,
  labels,
  after,
}: {
  /** an edit page's relation managers, in the page's grid after the form */
  after?: ReactNode;
  mode: "create" | "edit";
  endpoint: string;
  blocks: FormBlock[];
  initial: FormValues;
  /** edit: Hapus / Hapus selamanya / Pulihkan, under the form */
  pageActions?: ListAction[];
  cancelUrl: string;
  labels: Labels;
}) {
  const router = useRouter();
  const toast = useFiToast();
  const [values, setValues] = useState<FormValues>(initial);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ListAction | null>(null);
  // a new FilePond each time the form is emptied for "Buat & buat lainnya"
  const [generation, setGeneration] = useState(0);
  const set = (name: string, value: string | string[]) => setValues((current) => ({ ...current, [name]: value }));
  const selectLabels = { placeholder: labels.placeholder, search: labels.search, noResults: labels.noResults, clear: labels.clear };
  const visible = (field: FormFieldSpec) => !field.visibleWhen || values[field.visibleWhen.field] === field.visibleWhen.equals;

  const submit = async (another = false) => {
    setBusy(another ? "another" : "submit");

    try {
      const data = Object.fromEntries(Object.entries(values).filter(([name]) => blocks.some((block) => block.fields.some((field) => field.name === name && visible(field)))));
      const hasFiles = blocks.some((block) => block.fields.some((field) => field.kind === "files"));
      let body: BodyInit;
      const headers: Record<string, string> = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };

      if (hasFiles) {
        const form = new FormData();

        form.set("data", JSON.stringify({ ...data, another }));

        for (const [name, list] of Object.entries(files)) {
          for (const file of list) {
            form.append(name, file);
          }
        }

        body = form;
      } else {
        body = JSON.stringify({ ...data, another });
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(endpoint, { method: "POST", headers, body, credentials: "same-origin" });
      const result = (await response.json().catch(() => ({}))) as { toast?: Omit<FiToast, "id">; toasts?: Omit<FiToast, "id">[]; redirect?: string; errors?: Record<string, string[]> };

      if (response.status === 422) {
        setErrors(Object.fromEntries(Object.entries(result.errors ?? {}).map(([field, messages]) => [field, messages[0]])));

        return;
      }

      setErrors({});

      const toasts = [...(result.toast ? [result.toast] : []), ...(result.toasts ?? [])];

      // "Buat & buat lainnya" stays on an emptied form, as Livewire does
      if (another) {
        toasts.forEach(toast);
        setValues(initial);
        setFiles({});
        setGeneration((current) => current + 1);
      } else if (result.redirect) {
        toastOnNextPage(toasts);
        router.push(result.redirect);
      } else {
        toasts.forEach(toast);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const runPageAction = async (action: ListAction) => {
    setBusy(action.key);

    try {
      const response = await fetch(action.endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ back: "list" }),
        credentials: "same-origin",
      });
      const result = (await response.json().catch(() => ({}))) as { toast?: Omit<FiToast, "id">; redirect?: string };

      setConfirming(null);

      if (result.toast) {
        if (result.redirect) toastOnNextPage([result.toast]);
        else toast(result.toast);
      }

      if (result.redirect) {
        router.push(result.redirect);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const renderField = (field: FormFieldSpec): ReactNode => {
    const id = `form.${field.name}`;
    const common = { id, label: field.label, required: field.required, error: errors[field.name], helper: field.helper };
    const text = typeof values[field.name] === "string" ? (values[field.name] as string) : "";

    switch (field.kind) {
      case "text":
        return <FiInput {...common} type={field.inputType ?? "text"} maxLength={field.maxLength} placeholder={field.placeholder} value={text} onChange={(value) => set(field.name, value)} />;
      case "number":
        return <FiInput {...common} type="number" integer={field.integer} value={text} onChange={(value) => set(field.name, value)} />;
      case "select":
        return <FiNativeSelect {...common} options={field.options} placeholder={field.placeholder} value={text} onChange={(value) => set(field.name, value)} />;
      case "searchable":
        return <FiSearchableSelect {...common} options={field.options} labels={selectLabels} value={text} onChange={(value) => set(field.name, value)} />;
      case "textarea":
        return <FiTextarea {...common} rows={field.rows} maxLength={field.maxLength} placeholder={field.placeholder} value={text} onChange={(value) => set(field.name, value)} />;
      case "tags":
        return (
          <FiTagsInput
            {...common}
            placeholder={field.placeholder}
            splitKeys={field.splitKeys}
            removeLabel={labels.removeTag}
            value={Array.isArray(values[field.name]) ? (values[field.name] as string[]) : []}
            onChange={(value) => set(field.name, value)}
          />
        );
      case "files":
        return (
          <div data-field-wrapper="" className="fi-fo-field">
            {field.hiddenLabel ? (
              <div id={`${id}-label`} className="fi-fo-field-label fi-sr-only">
                {field.label}
              </div>
            ) : (
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
            )}
            <div className="fi-fo-field-content-col">
              <FiFileUpload
                key={generation}
                id={id}
                multiple={field.multiple}
                accept={field.accept}
                maxSizeKb={field.maxSizeKb}
                maxFiles={field.maxFiles}
                reorderable={field.reorderable}
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
        );
    }
  };

  const fields = (block: FormBlock) => block.fields.filter(visible).map((field) => <Col key={field.name} full={field.full}>{renderField(field)}</Col>);

  return (
    <>
      <Grid columns={1}>
        <Col>
          <form
            id="form"
            className="fi-sc-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Grid columns={1}>
              <Col>
                <Grid columns={2}>
                  {blocks.map((block, index) =>
                    block.section ? (
                      <Col key={block.section.id} full>
                        <div id={`form.${block.section.id}::data::section`} className="fi-sc-section">
                          <section aria-labelledby={`form.${block.section.id}::data::section-heading`} className="fi-section fi-section-has-header">
                            <header className="fi-section-header">
                              <div className="fi-section-header-content fi-section-header-content-has-heading">
                                <div className="fi-section-header-text-ctn">
                                  <h2 id={`form.${block.section.id}::data::section-heading`} className="fi-section-header-heading">
                                    {block.section.heading}
                                  </h2>
                                </div>
                              </div>
                            </header>
                            <div id={`form.${block.section.id}::data::section-content`} className="fi-section-content-ctn">
                              <Grid columns={block.columns} className="fi-section-content ">
                                {fields(block)}
                              </Grid>
                            </div>
                          </section>
                        </div>
                      </Col>
                    ) : (
                      <FieldsOnly key={index}>{fields(block)}</FieldsOnly>
                    ),
                  )}
                </Grid>
              </Col>
            </Grid>
            {mode === "create" ? (
              <Grid columns={1}>
                <Col>
                  <div id="content.form-actions" className="fi-sc-actions">
                    <div className="fi-ac fi-align-start">
                      <FiButton type="submit" loading={busy === "submit"} wrapLabel>
                        {labels.create}
                      </FiButton>
                      <FiButton color="gray" loading={busy === "another"} onClick={() => void submit(true)}>
                        {labels.createAnother}
                      </FiButton>
                      <FiButton color="gray" onClick={() => router.push(cancelUrl)}>
                        {labels.cancel}
                      </FiButton>
                    </div>
                  </div>
                </Col>
              </Grid>
            ) : null}
          </form>
        </Col>
        {mode === "edit" && pageActions.length ? (
          <Col>
            <div id="content.form-actions" className="fi-sc-actions">
              <div className="fi-ac fi-align-end">
                {pageActions.map((action) => (
                  <FiButton key={action.key} color={action.color ?? "danger"} loading={busy === action.key} onClick={() => setConfirming(action)}>
                    {action.label}
                  </FiButton>
                ))}
              </div>
            </div>
          </Col>
        ) : null}
        {after ? <Col>{after}</Col> : null}
      </Grid>
      {confirming?.confirm ? (
        <FiConfirmModal
          open
          onClose={() => setConfirming(null)}
          onConfirm={() => void runPageAction(confirming)}
          heading={confirming.confirm.heading}
          color={confirming.confirm.color}
          icon={confirming.confirm.icon}
          processing={busy === confirming.key}
          t={(text) => (text === "Konfirmasi" ? confirming.confirm!.submitLabel : text === "Apakah Anda yakin ingin melakukan ini?" ? confirming.confirm!.description : text === "Batal" ? labels.cancel : labels.close)}
        />
      ) : null}
    </>
  );
}

/** Fields straight in the form's grid (no section). */
function FieldsOnly({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** An edit page's header buttons: Batal back, Simpan submitting the form below. */
export function FormHeaderButtons({ cancelUrl, labels }: { cancelUrl: string; labels: { cancel: string; save: string } }) {
  const router = useRouter();

  return (
    <>
      <FiButton color="gray" onClick={() => router.push(cancelUrl)}>
        {labels.cancel}
      </FiButton>
      <FiButton type="submit" form="form" wrapLabel>
        {labels.save}
      </FiButton>
    </>
  );
}

export { FiField };
