"use client";

import { useState, type ReactNode } from "react";
import { FiHeaderActions } from "@/components/admin/filament/HeaderActions";
import type { ListAction } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";

/**
 * The Import & Export CSV page (ProductImport): the header actions, and under them the
 * instructions or, after an import, its summary with the failed rows folded by cause.
 * Like the Livewire page, the summary lasts until the page is left.
 */
export type ImportResult = {
  kind: "produk-stok" | "produk";
  created: number;
  updated: number;
  warnedInactive: number;
  groups: number;
  zeroed: number;
  failedCount: number;
  imagesFailed: string[];
  failures: { message: string; count: number; rows: number[]; more: number }[];
};

type Labels = Record<
  | "heading"
  | "close"
  | "cancel"
  | "created"
  | "updated"
  | "warnedInactive"
  | "groups"
  | "zeroed"
  | "failed"
  | "failedRows"
  | "rowCount"
  | "rows"
  | "andMore"
  | "imagesFailed",
  string
>;

function Tile({ label, value, tone }: { label: string; value: number; tone: "success" | "plain" | "warning" | "danger" }) {
  const color = { success: "text-success-600 dark:text-success-400", plain: "text-gray-950 dark:text-white", warning: "text-warning-600 dark:text-warning-400", danger: "text-danger-600 dark:text-danger-400" }[tone];

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function ProductImportView({ actions, intro, labels }: { actions: ListAction[]; intro: ReactNode; labels: Labels }) {
  const [result, setResult] = useState<ImportResult | null>(null);

  return (
    <FiPage
      header={
        <FiPageHeader
          heading={labels.heading}
          actions={<FiHeaderActions actions={actions} labels={{ close: labels.close, cancel: labels.cancel }} onResult={(_key, value) => setResult(value as ImportResult)} />}
        />
      }
    >
      <div className="fi-section rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
        {!result ? (
          intro
        ) : (
          <>
            {result.kind === "produk-stok" ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Tile label={labels.created} value={result.created} tone="success" />
                <Tile label={labels.updated} value={result.updated} tone="plain" />
                <Tile label={labels.warnedInactive} value={result.warnedInactive} tone="warning" />
                <Tile label={labels.groups} value={result.groups} tone="success" />
                <Tile label={labels.zeroed} value={result.zeroed} tone="warning" />
                <Tile label={labels.failed} value={result.failedCount} tone="danger" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Tile label={labels.created} value={result.created} tone="success" />
                <Tile label={labels.updated} value={result.updated} tone="plain" />
                <Tile label={labels.warnedInactive} value={result.warnedInactive} tone="warning" />
                <Tile label={labels.failed} value={result.failedCount} tone="danger" />
              </div>
            )}
            {result.failures.length ? (
              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold text-gray-950 dark:text-white">{labels.failedRows}</p>
                <ul className="space-y-2 text-sm text-danger-600 dark:text-danger-400">
                  {result.failures.map((failure) => (
                    <li key={failure.message}>
                      <span className="font-medium">{failure.message}</span>
                      <span className="block text-xs opacity-80">
                        {labels.rowCount.replace(":count", String(failure.count))}: {labels.rows.replace(":rows", failure.rows.join(", "))}
                        {failure.more > 0 ? `, ${labels.andMore.replace(":count", String(failure.more))}` : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.imagesFailed.length ? (
              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold text-gray-950 dark:text-white">{labels.imagesFailed}</p>
                <ul className="space-y-1 text-sm text-warning-600 dark:text-warning-400">
                  {result.imagesFailed.map((sku) => (
                    <li key={sku}>{sku}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </FiPage>
  );
}
