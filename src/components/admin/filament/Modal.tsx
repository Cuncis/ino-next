"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FiIcon } from "./Icon";
import { FiButton, type FiColor } from "./ui";

/**
 * Filament's modal (`<x-filament::modal>`): an action's form or its "are you sure?"
 * confirmation, or the notifications slide-over. Same markup and classes as Filament,
 * so its CSS draws it; Escape and the overlay close it.
 */
type ModalProps = {
  open: boolean;
  onClose: () => void;
  heading: ReactNode;
  description?: ReactNode;
  icon?: string;
  iconColor?: FiColor;
  width?: "md" | "4xl";
  alignment?: "start" | "center";
  slideOver?: boolean;
  /** an action's form: the footer's submit button submits it */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  footer?: ReactNode;
  headerActions?: ReactNode;
  stickyHeader?: boolean;
  children?: ReactNode;
  closeLabel: string;
  id?: string;
  /** extra classes on the modal's root, e.g. `fi-no-database` for the notifications */
  className?: string;
};

export function FiModal({
  open,
  onClose,
  heading,
  description,
  icon,
  iconColor,
  width = "md",
  alignment = "start",
  slideOver = false,
  onSubmit,
  footer,
  headerActions,
  stickyHeader = false,
  children,
  closeLabel,
  id = "fi-modal",
  className = "",
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // only ever opened by a click, so `document` exists by then
  if (!open || typeof document === "undefined") {
    return null;
  }

  const windowClass = [
    "fi-modal-window",
    "fi-modal-window-has-close-btn",
    children ? "fi-modal-window-has-content" : "",
    footer ? "fi-modal-window-has-footer" : "",
    icon ? "fi-modal-window-has-icon" : "",
    `fi-align-${alignment}`,
    `fi-width-${width}`,
  ]
    .filter(Boolean)
    .join(" ");

  const header = (
    <div className="fi-modal-header">
      <button className="fi-icon-btn fi-size-md fi-modal-close-btn" title={closeLabel} aria-label={closeLabel} tabIndex={-1} type="button" onClick={onClose}>
        <FiIcon name="o-x-mark" size="lg" />
      </button>
      {icon ? (
        <div className="fi-modal-icon-ctn">
          <div className={`${iconColor ? `fi-color fi-color-${iconColor} ` : ""}fi-modal-icon-bg`}>
            <FiIcon name={icon} size="lg" />
          </div>
        </div>
      ) : null}
      <div>
        <h2 id={`${id}.heading`} className="fi-modal-heading">
          {heading}
        </h2>
        {description ? (
          <p id={`${id}.description`} className="fi-modal-description">
            {description}
          </p>
        ) : null}
        {headerActions}
      </div>
    </div>
  );

  const body = (
    <>
      {header}
      {children ? <div className="fi-modal-content">{children}</div> : null}
      {footer ? (
        <div className={`fi-modal-footer fi-align-${alignment}`}>
          <div className="fi-modal-footer-actions">{footer}</div>
        </div>
      ) : null}
    </>
  );

  return createPortal(
    <div
      aria-labelledby={`${id}.heading`}
      aria-modal="true"
      role={onSubmit && !children ? "alertdialog" : "dialog"}
      tabIndex={-1}
      className={`fi-modal fi-absolute-positioning-context fi-modal-open${slideOver ? " fi-modal-slide-over fi-modal-slide-over-from-end" : ""}${stickyHeader ? " fi-modal-has-sticky-header" : ""}${className ? ` ${className}` : ""}`}
    >
      <div aria-hidden="true" className="fi-modal-close-overlay" />
      <div tabIndex={-1} className="fi-modal-window-ctn fi-clickable" onClick={(event) => event.target === event.currentTarget && onClose()}>
        {onSubmit ? (
          <form
            className={windowClass}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(event);
            }}
          >
            {body}
          </form>
        ) : (
          <div className={windowClass}>{body}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** An action's "are you sure?" (`->requiresConfirmation()`). */
export function FiConfirmModal({
  open,
  onClose,
  onConfirm,
  heading,
  color = "primary",
  processing,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  heading: string;
  color?: FiColor;
  processing: boolean;
  t: (text: string) => string;
}) {
  return (
    <FiModal
      open={open}
      onClose={onClose}
      heading={heading}
      description={t("Apakah Anda yakin ingin melakukan ini?")}
      icon="o-exclamation-triangle"
      iconColor={color}
      alignment="center"
      onSubmit={onConfirm}
      closeLabel={t("Tutup")}
      footer={
        <>
          <FiButton color="gray" onClick={onClose}>
            {t("Batal")}
          </FiButton>
          <FiButton type="submit" color={color} loading={processing} wrapLabel>
            {t("Konfirmasi")}
          </FiButton>
        </>
      }
    />
  );
}

/** A labelled text field with its validation error (`fi-fo-field`). */
export function FiTextField({
  id,
  label,
  required = false,
  value,
  onChange,
  error,
  type = "text",
  autoFocus = false,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div data-field-wrapper="" className="fi-fo-field">
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
        <div className={`fi-fo-text-input fi-input-wrp${error ? " fi-invalid" : ""}`}>
          <div className="fi-input-wrp-content-ctn">
            <input
              id={id}
              required={required}
              type={type}
              className="fi-input"
              value={value}
              autoFocus={autoFocus}
              onChange={(event) => onChange(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </div>
        </div>
        {error ? (
          <p id={`${id}-error`} data-validation-error="" className="fi-fo-field-wrp-error-message">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Toasts (Filament\Notifications\Notification::make()->send()) ---------------- */

export type FiToast = { id: number; status: "success" | "danger" | "warning" | "info"; title: string; body?: string };

const TOAST_ICONS: Record<FiToast["status"], string> = {
  success: "o-check-circle",
  danger: "o-x-circle",
  warning: "o-exclamation-triangle",
  info: "o-information-circle",
};

const ToastContext = createContext<(toast: Omit<FiToast, "id">) => void>(() => {});

export const useFiToast = () => useContext(ToastContext);

/** Holds the toasts; each closes itself after 6 seconds, like Filament's default duration. */
export function FiToaster({ initial = [], children }: { initial?: Omit<FiToast, "id">[]; children: ReactNode }) {
  const [toasts, setToasts] = useState<FiToast[]>([]);
  const next = useRef(1);

  const remove = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const push = useCallback(
    (toast: Omit<FiToast, "id">) => {
      const id = next.current++;

      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => remove(id), 6000);
    },
    [remove],
  );

  useEffect(() => {
    initial.forEach(push);
    // only the toasts the page arrived with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fi-no fi-align-right fi-vertical-align-start" role="status" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`fi-no-notification fi-status-${toast.status}`} style={{ display: "flex", visibility: "visible" }}>
            <FiIcon name={TOAST_ICONS[toast.status]} className={`fi-color fi-color-${toast.status} fi-no-notification-icon`} />
            <div className="fi-no-notification-main">
              <div className="fi-no-notification-text">
                <h3 className="fi-no-notification-title">{toast.title}</h3>
                {toast.body ? <div className="fi-no-notification-body">{toast.body}</div> : null}
              </div>
            </div>
            <button type="button" aria-label="Close notification" title="Close notification" className="fi-icon-btn fi-no-notification-close-btn" onClick={() => remove(toast.id)}>
              <FiIcon name="m-x-mark" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
