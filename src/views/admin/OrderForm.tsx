"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FiInput, FiNativeSelect, FiSearchableSelect, FiTextarea, type SelectOption } from "@/components/admin/filament/Fields";
import { FiIcon } from "@/components/admin/filament/Icon";
import type { ListAction } from "@/components/admin/filament/ListTable";
import { FiConfirmModal, useFiToast, type FiToast } from "@/components/admin/filament/Modal";
import { FiButton } from "@/components/admin/filament/ui";

/**
 * OrderForm (Filament), for CreateOrder and EditOrder: the order's details on the left,
 * its lines in a repeater on the right. Create has its buttons under the form; edit has
 * Batal / Simpan in the page header (EditHeaderButtons) and Hapus (with Hapus selamanya /
 * Pulihkan for a deleted order) under the form.
 */
export type OrderFormValues = {
  customer_id: string;
  branch_id: string;
  fulfilment: string;
  payment_method: string;
  shipping_total: string;
  note: string;
  items: { key: string; id?: number; product_id: string; quantity: string }[];
};

type Labels = Record<
  | "heading"
  | "info"
  | "itemsSection"
  | "customer"
  | "branch"
  | "fulfilment"
  | "paymentMethod"
  | "shippingTotal"
  | "note"
  | "items"
  | "product"
  | "quantity"
  | "addItem"
  | "deleteItem"
  | "placeholder"
  | "search"
  | "noResults"
  | "clear"
  | "create"
  | "createAnother"
  | "cancel"
  | "save"
  | "close"
  | "sure",
  string
>;

const grid = (vars: Record<string, string>) => vars as CSSProperties;
const repeat = (columns: number) => `repeat(${columns}, minmax(0, 1fr))`;

function Col({ span, full, children }: { span?: number; full?: boolean; children: ReactNode }) {
  return (
    <div
      className={`fi-grid-col${span ? "  lg:fi-grid-col-span" : ""}`}
      style={grid(full ? { "--col-span-default": "1 / -1" } : span ? { "--col-span-default": "span 1 / span 1", "--col-span-lg": `span ${span} / span ${span}` } : { "--col-span-default": "span 1 / span 1" })}
    >
      <div className="fi-sc-component">{children}</div>
    </div>
  );
}

function Section({ id, heading, columns, children }: { id: string; heading: string; columns?: number; children: ReactNode }) {
  return (
    <div id={`form.${id}::data::section`} className="fi-sc-section">
      <section className="fi-section fi-section-has-header">
        <header className="fi-section-header">
          <div className="fi-section-header-content fi-section-header-content-has-heading">
            <div className="fi-section-header-text-ctn">
              <h2 className="fi-section-header-heading">{heading}</h2>
            </div>
          </div>
        </header>
        <div className="fi-section-content-ctn">
          <div className={`fi-section-content fi-grid${columns ? " lg:fi-grid-cols" : ""} fi-sc fi-sc-has-gap`} style={grid(columns ? { "--cols-lg": repeat(columns), "--cols-default": repeat(1) } : { "--cols-default": repeat(1) })}>
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}

let nextKey = 1;
const newItem = () => ({ key: `new-${nextKey++}`, product_id: "", quantity: "1" });

export default function OrderForm({
  mode,
  endpoint,
  initial,
  options,
  fulfilmentEditable,
  pageActions,
  cancelUrl,
  labels,
}: {
  mode: "create" | "edit";
  endpoint: string;
  initial: OrderFormValues;
  options: { customers: SelectOption[]; branches: SelectOption[]; products: SelectOption[]; fulfilments: SelectOption[]; paymentMethods: SelectOption[] };
  fulfilmentEditable: boolean;
  /** edit: Hapus / Hapus selamanya / Pulihkan, under the form */
  pageActions: ListAction[];
  cancelUrl: string;
  labels: Labels;
}) {
  const router = useRouter();
  const toast = useFiToast();
  const [values, setValues] = useState<OrderFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ListAction | null>(null);
  const set = (field: keyof OrderFormValues, value: string) => setValues({ ...values, [field]: value });
  const selectLabels = { placeholder: labels.placeholder, search: labels.search, noResults: labels.noResults, clear: labels.clear };

  const submit = async (another = false) => {
    setBusy(another ? "another" : "submit");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ ...values, items: values.items.map(({ id, product_id, quantity }) => ({ id, product_id, quantity })), another }),
        credentials: "same-origin",
      });
      const result = (await response.json().catch(() => ({}))) as { toast?: Omit<FiToast, "id">; redirect?: string; errors?: Record<string, string[]> };

      if (response.status === 422) {
        setErrors(Object.fromEntries(Object.entries(result.errors ?? {}).map(([field, messages]) => [field, messages[0]])));

        return;
      }

      setErrors({});

      if (result.toast) {
        toast(result.toast);
      }

      if (result.redirect) {
        if (another) {
          setValues({ ...initial, items: [newItem()] });
        }

        router.push(result.redirect);
      } else {
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
        toast(result.toast);
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

  const updateItem = (key: string, field: "product_id" | "quantity", value: string) =>
    setValues({ ...values, items: values.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)) });

  return (
    <>
      <div className="fi-grid fi-sc fi-sc-has-gap" style={grid({ "--cols-default": repeat(1) })}>
            <Col>
              <form
                id="form"
                className="fi-sc-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <div className="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style={grid({ "--cols-lg": repeat(2), "--cols-default": repeat(1) })}>
                  <Col>
                    <Section id="informasi-pesanan" heading={labels.info} columns={2}>
                      <Col>
                        <FiSearchableSelect id="form.customer_id" label={labels.customer} required value={values.customer_id} onChange={(value) => set("customer_id", value)} options={options.customers} labels={selectLabels} error={errors.customer_id} />
                      </Col>
                      <Col>
                        <FiSearchableSelect id="form.branch_id" label={labels.branch} required value={values.branch_id} onChange={(value) => set("branch_id", value)} options={options.branches} labels={selectLabels} error={errors.branch_id} />
                      </Col>
                      <Col>
                        <FiNativeSelect
                          id="form.fulfilment"
                          label={labels.fulfilment}
                          required={fulfilmentEditable}
                          value={values.fulfilment}
                          onChange={(value) => set("fulfilment", value)}
                          options={options.fulfilments}
                          placeholder={fulfilmentEditable ? labels.placeholder : null}
                          disabled={!fulfilmentEditable}
                          error={errors.fulfilment}
                        />
                      </Col>
                      <Col>
                        <FiNativeSelect id="form.payment_method" label={labels.paymentMethod} required value={values.payment_method} onChange={(value) => set("payment_method", value)} options={options.paymentMethods} placeholder={labels.placeholder} error={errors.payment_method} />
                      </Col>
                      <Col>
                        <FiInput id="form.shipping_total" label={labels.shippingTotal} required type="number" value={values.shipping_total} onChange={(value) => set("shipping_total", value)} error={errors.shipping_total} />
                      </Col>
                      <Col full>
                        <FiTextarea id="form.note" label={labels.note} value={values.note} onChange={(value) => set("note", value)} error={errors.note} />
                      </Col>
                    </Section>
                  </Col>
                  <Col>
                    <Section id="item-pesanan" heading={labels.itemsSection}>
                      <Col>
                        <div data-field-wrapper="" className="fi-fo-field">
                          <div className="fi-fo-field-label-col">
                            <div className="fi-fo-field-label-ctn">
                              <div id="form.items-label" className="fi-fo-field-label">
                                <span className="fi-fo-field-label-content">
                                  {labels.items}
                                  <sup className="fi-fo-field-label-required-mark">*</sup>
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="fi-fo-field-content-col">
                            <div id="form.items" role="group" className="fi-fo-repeater">
                              <ul className="fi-grid fi-fo-repeater-items" style={grid({ "--cols-default": repeat(1) })}>
                                {values.items.map((item, index) => (
                                  <li key={item.key} className="fi-fo-repeater-item fi-fo-repeater-item-has-header">
                                    <div className="fi-fo-repeater-item-header">
                                      <ul className="fi-fo-repeater-item-header-end-actions">
                                        <li>
                                          <button
                                            title={labels.deleteItem}
                                            aria-label={labels.deleteItem}
                                            type="button"
                                            className="fi-ac-icon-btn-action fi-icon-btn fi-size-sm fi-color fi-color-danger fi-text-color-600 hover:fi-text-color-500 dark:fi-text-color-400 dark:hover:fi-text-color-300"
                                            onClick={() => setValues({ ...values, items: values.items.filter((other) => other.key !== item.key) })}
                                          >
                                            <FiIcon name="m-trash" />
                                          </button>
                                        </li>
                                      </ul>
                                    </div>
                                    <div className="fi-fo-repeater-item-content">
                                      <div className="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style={grid({ "--cols-lg": repeat(3), "--cols-default": repeat(1) })}>
                                        <Col span={2}>
                                          <FiSearchableSelect
                                            id={`form.items.${item.key}.product_id`}
                                            label={labels.product}
                                            required
                                            value={item.product_id}
                                            onChange={(value) => updateItem(item.key, "product_id", value)}
                                            options={options.products}
                                            labels={selectLabels}
                                            error={errors[`items.${index}.product_id`]}
                                          />
                                        </Col>
                                        <Col>
                                          <FiInput
                                            id={`form.items.${item.key}.quantity`}
                                            label={labels.quantity}
                                            required
                                            type="number"
                                            value={item.quantity}
                                            onChange={(value) => updateItem(item.key, "quantity", value)}
                                            error={errors[`items.${index}.quantity`]}
                                          />
                                        </Col>
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              <div className="fi-fo-repeater-add">
                                <button type="button" className="fi-ac-btn-action fi-btn fi-size-sm" onClick={() => setValues({ ...values, items: [...values.items, newItem()] })}>
                                  {labels.addItem}
                                </button>
                              </div>
                            </div>
                            {errors.items ? (
                              <p data-validation-error="" className="fi-fo-field-wrp-error-message">
                                {errors.items}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </Col>
                    </Section>
                  </Col>
                </div>
              </form>
            </Col>
            {mode === "create" ? (
              <Col>
                <div id="content.form-actions" className="fi-sc-actions">
                  <div className="fi-ac fi-align-start">
                    <FiButton type="submit" form="form" loading={busy === "submit"} wrapLabel>
                      {labels.create}
                    </FiButton>
                    <FiButton color="gray" loading={busy === "another"} onClick={() => void submit(true)}>
                      {labels.createAnother}
                    </FiButton>
                    <a href={cancelUrl} className="fi-ac-btn-action fi-btn fi-size-md">
                      {labels.cancel}
                    </a>
                  </div>
                </div>
              </Col>
            ) : pageActions.length ? (
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
      </div>
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

/** EditOrder's header buttons: Batal back to the order, Simpan submitting the form below. */
export function EditHeaderButtons({ cancelUrl, labels }: { cancelUrl: string; labels: { cancel: string; save: string } }) {
  return (
    <>
      <a href={cancelUrl} className="fi-ac-btn-action fi-btn fi-size-md">
        {labels.cancel}
      </a>
      <FiButton type="submit" form="form" wrapLabel>
        {labels.save}
      </FiButton>
    </>
  );
}
