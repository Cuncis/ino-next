"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListAction } from "./ListTable";
import { FiConfirmModal, FiModal, FiTextField, useFiToast, type FiToast } from "./Modal";
import { FiButton } from "./ui";

/**
 * A page's header actions (Filament `getHeaderActions()`): each runs at once, after its
 * "are you sure?", or after its one-field form; then the toast and the page refreshed.
 * A link action is a plain link styled as a button.
 */
type Labels = { close: string; cancel: string };

type Result = { toast?: Omit<FiToast, "id">; redirect?: string; errors?: Record<string, string[]> };

export function FiHeaderActions({ actions, labels }: { actions: ListAction[]; labels: Labels }) {
  const router = useRouter();
  const toast = useFiToast();
  const [pending, setPending] = useState<ListAction | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (action: ListAction, data: Record<string, string> = {}) => {
    setBusy(action.key);

    try {
      const response = await fetch(action.endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(data),
        credentials: "same-origin",
      });
      const result = (await response.json().catch(() => ({}))) as Result;

      if (response.status === 422 && action.form) {
        setError(result.errors?.[action.form.field.name]?.[0]);

        return;
      }

      setPending(null);
      setError(undefined);

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

  const start = (action: ListAction) => {
    if (action.confirm || action.form) {
      setValue(action.form?.field.value ?? "");
      setError(undefined);
      setPending(action);
    } else {
      void run(action);
    }
  };

  return (
    <>
      {actions.map((action) =>
        action.href ? (
          <a key={action.key} href={action.href} className={`fi-ac-btn-action fi-btn fi-size-md ${action.color === "gray" ? "" : "fi-color fi-color-primary fi-bg-color-400 hover:fi-bg-color-300 dark:fi-bg-color-600 dark:hover:fi-bg-color-700 fi-text-color-950 hover:fi-text-color-800 dark:fi-text-color-0 dark:hover:fi-text-color-0"}`}>
            {action.label}
          </a>
        ) : (
          <FiButton key={action.key} icon={action.icon || undefined} color={action.color ?? "primary"} loading={busy === action.key} onClick={() => start(action)}>
            {action.label}
          </FiButton>
        ),
      )}
      {pending?.confirm ? (
        <FiConfirmModal
          open
          onClose={() => setPending(null)}
          onConfirm={() => void run(pending)}
          heading={pending.confirm.heading}
          color={pending.confirm.color}
          icon={pending.confirm.icon}
          processing={busy === pending.key}
          t={(text) => (text === "Konfirmasi" ? pending.confirm!.submitLabel : text === "Apakah Anda yakin ingin melakukan ini?" ? pending.confirm!.description : text === "Batal" ? labels.cancel : labels.close)}
        />
      ) : null}
      {pending?.form ? (
        <FiModal
          open
          onClose={() => setPending(null)}
          heading={pending.form.heading}
          width="4xl"
          closeLabel={labels.close}
          onSubmit={() => void run(pending, { [pending.form!.field.name]: value })}
          footer={
            <>
              <FiButton type="submit" loading={busy === pending.key} wrapLabel>
                {pending.form.submitLabel}
              </FiButton>
              <FiButton color="gray" onClick={() => setPending(null)}>
                {pending.form.cancelLabel}
              </FiButton>
            </>
          }
        >
          <FiTextField id={`mountedActionSchema0.${pending.form.field.name}`} label={pending.form.field.label} required={pending.form.field.required} value={value} onChange={setValue} error={error} autoFocus />
        </FiModal>
      ) : null}
    </>
  );
}
