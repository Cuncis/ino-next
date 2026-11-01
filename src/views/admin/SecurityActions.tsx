"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiConfirmModal, FiModal, FiTextField, useFiToast, type FiToast } from "@/components/admin/filament/Modal";
import { FiButton } from "@/components/admin/filament/ui";

/**
 * The Security page's header actions and its recovery codes, ported from
 * App\Filament\Pages\Security. Recovery codes show until the next action, as Laravel
 * flashed them for one request.
 */
type Labels = Record<
  "heading" | "activate" | "confirm" | "regenerate" | "disable" | "code" | "submit" | "cancel" | "close" | "sure" | "confirmButton" | "codesHeading" | "intro" | "manual" | "enabled" | "notEnabled",
  string
>;

type ActionResult = { toast?: Omit<FiToast, "id">; recoveryCodes?: string[]; errors?: Record<string, string[]> };

async function call(action: string, body: Record<string, unknown> = {}): Promise<ActionResult & { status: number }> {
  const response = await fetch(`/admin/keamanan/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });

  return { status: response.status, ...((await response.json().catch(() => ({}))) as ActionResult) };
}

export default function SecurityPage({
  state,
  labels,
}: {
  state: { enabled: boolean; pending: boolean; qrSvg: string | null; secret: string | null };
  labels: Labels;
}) {
  const router = useRouter();
  const toast = useFiToast();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [modal, setModal] = useState<null | "confirm" | "regenerate" | "disable">(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | null>(null);
  const t = (text: string) =>
    ({ "Apakah Anda yakin ingin melakukan ini?": labels.sure, Tutup: labels.close, Batal: labels.cancel, Konfirmasi: labels.confirmButton })[text] ?? text;

  const run = async (action: string, body?: Record<string, unknown>) => {
    setBusy(action);

    try {
      const result = await call(action, body);

      if (result.status === 422) {
        setError(result.errors?.code?.[0]);

        return;
      }

      // shown for this response only, as Laravel flashed them for one request
      setCodes(result.recoveryCodes ?? null);

      if (result.toast) {
        toast(result.toast);
      }

      setModal(null);
      setCode("");
      setError(undefined);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    setModal(null);
    setError(undefined);
  };

  const headerActions = (
    <div className="fi-ac fi-align-start">
      {!state.enabled && !state.pending ? (
        <FiButton icon="o-lock-closed" loading={busy === "aktifkan"} onClick={() => void run("aktifkan")}>
          {labels.activate}
        </FiButton>
      ) : null}
      {state.pending ? (
        <FiButton icon="o-check-circle" onClick={() => setModal("confirm")}>
          {labels.confirm}
        </FiButton>
      ) : null}
      {state.enabled ? (
        <FiButton icon="o-arrow-path" onClick={() => setModal("regenerate")}>
          {labels.regenerate}
        </FiButton>
      ) : null}
      {state.enabled || state.pending ? (
        <FiButton icon="o-lock-open" color="danger" onClick={() => setModal("disable")}>
          {labels.disable}
        </FiButton>
      ) : null}
    </div>
  );

  return (
    <>
      <header className="fi-header">
        <div>
          <h1 className="fi-header-heading">{labels.heading}</h1>
        </div>
        <div className="fi-header-actions-ctn">{headerActions}</div>
      </header>
      <div className="fi-page-main">
        <div className="fi-page-content">
          <div className="fi-section rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
            {state.enabled ? (
              <p className="text-sm font-medium text-success-600 dark:text-success-400">{labels.enabled}</p>
            ) : state.pending ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">{labels.intro}</p>
                <div className="inline-block rounded-lg bg-white p-3" dangerouslySetInnerHTML={{ __html: state.qrSvg ?? "" }} />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {labels.manual} <span className="font-mono font-semibold text-gray-950 dark:text-white">{state.secret}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">{labels.notEnabled}</p>
            )}
            {codes ? (
              <div className="mt-6 rounded-lg bg-warning-50 p-4 dark:bg-warning-500/10">
                <p className="mb-2 text-sm font-semibold text-warning-700 dark:text-warning-400">{labels.codesHeading}</p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm text-gray-950 sm:grid-cols-4 dark:text-white">
                  {codes.map((recovery) => (
                    <span key={recovery}>{recovery}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <FiModal
        open={modal === "confirm"}
        onClose={close}
        heading={labels.confirm}
        width="4xl"
        onSubmit={() => void run("konfirmasi", { code })}
        closeLabel={labels.close}
        footer={
          <>
            <FiButton type="submit" loading={busy === "konfirmasi"} wrapLabel>
              {labels.submit}
            </FiButton>
            <FiButton color="gray" onClick={close}>
              {labels.cancel}
            </FiButton>
          </>
        }
      >
        <FiTextField id="mountedActionSchema0.code" label={labels.code} required value={code} onChange={setCode} error={error} autoFocus />
      </FiModal>
      <FiConfirmModal open={modal === "regenerate"} onClose={close} onConfirm={() => void run("kode-baru")} heading={labels.regenerate} processing={busy === "kode-baru"} t={t} />
      <FiConfirmModal open={modal === "disable"} onClose={close} onConfirm={() => void run("nonaktifkan")} heading={labels.disable} color="danger" processing={busy === "nonaktifkan"} t={t} />
    </>
  );
}
