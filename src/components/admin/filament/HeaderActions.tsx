"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiActionFormModal, postAction } from "./ActionForm";
import type { ListAction } from "./ListTable";
import { FiConfirmModal, toastOnNextPage, useFiToast } from "./Modal";
import { FiIcon } from "./Icon";
import { FiButton } from "./ui";

/**
 * A page's header actions (Filament `getHeaderActions()`): each runs at once, after its
 * "are you sure?", or after its one-field form; then the toast and the page refreshed.
 * A link action is a plain link styled as a button.
 */
type Labels = { close: string; cancel: string };

export function FiHeaderActions({ actions, labels, onResult }: { actions: ListAction[]; labels: Labels; onResult?: (key: string, result: unknown) => void }) {
  const router = useRouter();
  const toast = useFiToast();
  const [pending, setPending] = useState<ListAction | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (action: ListAction, data: Record<string, string> = {}, files: Record<string, File[]> = {}) => {
    setBusy(action.key);

    try {
      const result = await postAction(action.endpoint!, data, files);

      if (result.status === 422 && action.form) {
        setErrors(Object.fromEntries(Object.entries(result.errors ?? {}).map(([field, messages]) => [field, messages[0]])));

        return;
      }

      setPending(null);
      setErrors({});

      if (result.result !== undefined) {
        onResult?.(action.key, result.result);
      }

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

  const start = (action: ListAction) => {
    if (action.confirm || action.form) {
      setErrors({});
      setPending(action);
    } else {
      void run(action);
    }
  };

  return (
    <>
      {actions.map((action) =>
        action.items ? (
          <ActionGroup key={action.key} group={action} onPick={start} />
        ) : action.href ? (
          <a key={action.key} href={action.href} className={`fi-ac-btn-action fi-btn fi-size-md ${action.color === "gray" ? "" : "fi-color fi-color-primary fi-bg-color-400 hover:fi-bg-color-300 dark:fi-bg-color-600 dark:hover:fi-bg-color-700 fi-text-color-950 hover:fi-text-color-800 dark:fi-text-color-0 dark:hover:fi-text-color-0"}`}>
            {action.icon ? <FiIcon name={action.icon} /> : null}
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
        <FiActionFormModal form={pending.form} busy={busy === pending.key} errors={errors} closeLabel={labels.close} onClose={() => setPending(null)} onSubmit={(values, files) => void run(pending, values, files)} />
      ) : null}
    </>
  );
}

/** An ActionGroup shown as a button (`->button()`): its actions in a dropdown; a download is a link. */
function ActionGroup({ group, onPick }: { group: ListAction; onPick: (action: ListAction) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (event: MouseEvent) => !root.current?.contains(event.target as Node) && setOpen(false);

    document.addEventListener("mousedown", close);

    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="fi-dropdown" ref={root} style={{ position: "relative" }}>
      <div className="fi-dropdown-trigger">
        <button type="button" className="fi-ac-btn-group fi-btn fi-size-md" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          {group.icon ? <FiIcon name={group.icon} /> : null}
          {group.label}
        </button>
      </div>
      {open ? (
        <div className="fi-dropdown-panel" role="menu" style={{ position: "absolute", left: 0, top: "calc(100% + 8px)", zIndex: 20 }}>
          <div className="fi-dropdown-list" role="group">
            {group.items!.map((item) =>
              item.href ? (
                <a key={item.key} href={item.href} download className="fi-dropdown-list-item fi-ac-grouped-action" role="menuitem" tabIndex={-1} onClick={() => setOpen(false)}>
                  <span className="fi-dropdown-list-item-label">{item.label}</span>
                </a>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  className="fi-dropdown-list-item fi-ac-grouped-action"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setOpen(false);
                    onPick(item);
                  }}
                >
                  <span className="fi-dropdown-list-item-label">{item.label}</span>
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
