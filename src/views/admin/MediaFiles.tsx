"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { MediaPage, MediaRow } from "@/server/admin/media-actions";
import { postAction } from "@/components/admin/filament/ActionForm";
import { useFiToast } from "@/components/admin/filament/Modal";

/**
 * Media File (resources/views/filament/pages/media-files.blade.php): the source tabs,
 * search, display toggle, the files as a table or a grid, the details panel, paging,
 * copying links, deleting, and uploading files dropped anywhere on the window. Laravel's
 * Livewire state (`?cari=&sumber=&tampilan=`) lives in the URL the same way.
 */
type Labels = Record<string, string>;

const CHECKER =
  "bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)]";
const GRID: Record<string, string> = {
  kecil: "grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 2xl:grid-cols-12",
  sedang: "grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7",
  besar: "grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
};
const BADGE: Record<string, string> = {
  unggahan: "bg-primary-50 text-primary-700 ring-primary-600/20 dark:bg-primary-400/10 dark:text-primary-400 dark:ring-primary-400/30",
  produk: "bg-success-50 text-success-700 ring-success-600/20 dark:bg-success-400/10 dark:text-success-400 dark:ring-success-400/30",
  situs: "bg-gray-100 text-gray-700 ring-gray-600/20 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10",
};
const thousands = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

function CopyIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className, width = "2.6" }: { className: string; width?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PdfIcon({ className, width }: { className: string; width: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinejoin="round" />
    </svg>
  );
}

function ViewIcon({ view }: { view: string }) {
  let shapes: ReactNode;

  switch (view) {
    case "daftar":
      shapes = [5, 10.5, 16].map((y) => (
        <Fragment key={y}>
          <rect x="3" y={y} width="3" height="3" rx="0.8" />
          <rect x="8.5" y={y + 0.5} width="12.5" height="2" rx="1" />
        </Fragment>
      ));
      break;
    case "kecil":
      shapes = [3.5, 9, 14.5].flatMap((x) => [3.5, 9, 14.5].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" rx="1.2" />));
      break;
    case "sedang":
      shapes = [
        [3.5, 3.5],
        [13, 3.5],
        [3.5, 13],
        [13, 13],
      ].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="7.5" height="7.5" rx="1.8" />);
      break;
    default:
      shapes = <rect x="4" y="4" width="16" height="16" rx="3" />;
  }

  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {shapes}
    </svg>
  );
}

export function MediaFiles({
  initial,
  query,
  sources,
  views,
  canUpload,
  accept,
  maxSizeMb,
  defaultView,
  labels,
}: {
  initial: MediaPage;
  query: { search: string; source: string; view: string };
  sources: { value: string; label: string }[];
  views: { value: string; label: string }[];
  canUpload: boolean;
  accept: string[];
  maxSizeMb: number;
  defaultView: string;
  labels: Labels;
}) {
  const toast = useFiToast();
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState(query.search);
  const [source, setSource] = useState(query.source);
  const [display, setDisplay] = useState(query.view);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MediaRow | null>(null);
  const [dimensions, setDimensions] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const latest = useRef({ search, source, display, page: initial.page });

  // the header's "Upload File" refreshes the page: start again from what the server drew
  const [drawn, setDrawn] = useState(initial);

  if (drawn !== initial) {
    setDrawn(initial);
    setData(initial);
  }

  const load = useCallback(async (next: { search: string; source: string; display: string; page: number }) => {
    latest.current = next;
    setLoading(true);

    // Livewire's #[Url]: in property order, and left out while at its starting value
    const url = new URL(window.location.href);

    for (const [key, value, initial] of [
      ["cari", next.search, ""],
      ["sumber", next.source, ""],
      ["tampilan", next.display, defaultView],
    ] as const) {
      url.searchParams.delete(key);

      if (value !== initial) url.searchParams.append(key, value);
    }

    window.history.replaceState(null, "", url);

    try {
      const params = new URLSearchParams({ cari: next.search, sumber: next.source, tampilan: next.display, page: String(next.page) });
      const response = await fetch(`/form/admin/media-file/daftar?${params}`, { headers: { Accept: "application/json" }, credentials: "same-origin" });

      if (response.ok && latest.current === next) {
        setData((await response.json()) as MediaPage);
      }
    } finally {
      if (latest.current === next) setLoading(false);
    }
  }, [defaultView]);

  const typing = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onSearch = (value: string) => {
    setSearch(value);
    clearTimeout(typing.current);
    // wire:model.live.debounce: only the search changes; source and display stay as they are by then
    typing.current = setTimeout(() => void load({ ...latest.current, search: value, page: 1 }), 400);
  };

  const copy = (url: string) => {
    const done = () => {
      setCopied(url);
      setTimeout(() => setCopied((current) => (current === url ? null : current)), 1500);
    };

    if (navigator.clipboard && window.isSecureContext) {
      void navigator.clipboard.writeText(url).then(done);
    } else {
      const box = document.createElement("textarea");

      box.value = url;
      document.body.appendChild(box);
      box.select();
      document.execCommand("copy");
      box.remove();
      done();
    }
  };

  const select = (row: MediaRow) => {
    setSelected(row);
    setDimensions("");
  };

  const remove = async (filePath: string) => {
    if (!confirm(labels.confirmDelete)) return;

    if (selected?.path === filePath) setSelected(null);

    setLoading(true);
    const result = await postAction("/admin/media-file/hapus", { path: filePath });

    if (result.toast) toast(result.toast);

    await load({ ...latest.current });
  };

  const upload = useCallback(
    (files: FileList | null | undefined) => {
      if (!canUpload || uploading || !files?.length) return;

      setUploading(true);
      setProgress(0);

      const form = new FormData();

      for (const file of Array.from(files)) form.append("files", file);

      const request = new XMLHttpRequest();

      request.open("POST", "/admin/media-file/unggah");
      request.setRequestHeader("Accept", "application/json");
      request.setRequestHeader("X-Requested-With", "XMLHttpRequest");
      request.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
      request.onload = () => {
        setUploading(false);

        try {
          const result = JSON.parse(request.responseText) as { toast?: Parameters<typeof toast>[0] };

          if (result.toast) toast(result.toast);
        } catch {
          toast({ status: "danger", title: labels.uploadFailed });
        }

        void load({ ...latest.current, page: 1 });
      };
      request.onerror = () => {
        setUploading(false);
        toast({ status: "danger", title: labels.uploadFailed });
      };
      request.send(form);
    },
    [canUpload, uploading, toast, labels.uploadFailed, load],
  );

  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    const enter = (event: DragEvent) => {
      event.preventDefault();
      if (canUpload && event.dataTransfer?.types.includes("Files")) setDragging(true);
    };
    const over = (event: DragEvent) => event.preventDefault();
    const leave = (event: DragEvent) => !event.relatedTarget && setDragging(false);
    const drop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      upload(event.dataTransfer?.files);
    };

    window.addEventListener("keydown", escape);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);

    return () => {
      window.removeEventListener("keydown", escape);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [canUpload, upload]);

  const mode = data.view;
  const rows = data.rows;
  const isSelected = (row: MediaRow) => selected?.path === row.path;

  const copyButtonLabel = (url: string, iconClass: string, textClass?: string) => (
    <>
      {copied !== url ? <CopyIcon className={iconClass} /> : <CheckIcon className={cx(iconClass, textClass)} />}
      {copied !== url ? <span>{labels.copy}</span> : <span className={textClass}>{labels.copied}</span>}
    </>
  );

  return (
    <div className="flex items-start gap-6">
      {canUpload && dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary-600/10 p-6 backdrop-blur-[2px]">
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary-500 bg-white/80 text-center dark:bg-gray-900/80">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 16V5m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-950 dark:text-white">{labels.dropHere}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{labels.dropHint.replace(":size", String(maxSizeMb))}</p>
          </div>
        </div>
      ) : null}

      <section className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
        {uploading ? (
          <div className="absolute inset-x-0 top-0 z-10 h-1 bg-primary-100 dark:bg-primary-400/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={labels.uploading}>
            <div className="h-full bg-primary-600 transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
        ) : null}

        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 px-3 dark:border-white/10" aria-label={labels.source}>
          {sources.map((item) => {
            const active = source === item.value;

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active ? "true" : "false"}
                onClick={() => {
                  setSource(item.value);
                  void load({ search, source: item.value, display, page: 1 });
                }}
                className={cx(
                  "relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition",
                  active
                    ? "text-gray-950 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary-600 dark:text-white"
                    : "text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white",
                )}
              >
                {item.label}{" "}
                <span
                  className={cx(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    active ? "bg-primary-50 text-primary-700 dark:bg-primary-400/10 dark:text-primary-400" : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400",
                  )}
                >
                  {thousands(data.counts[item.value] ?? 0)}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-col gap-3 border-b border-gray-200 p-3 sm:flex-row sm:items-center dark:border-white/10">
          <label className="relative flex-1">
            <span className="sr-only">{labels.searchPlaceholder}</span>
            <svg className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="w-full rounded-lg border-0 bg-white py-2 ps-9 pe-3 text-sm text-gray-950 shadow-sm ring-1 ring-gray-950/10 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600 dark:bg-white/5 dark:text-white dark:ring-white/10"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            {uploading ? (
              <span className="text-sm font-medium whitespace-nowrap text-primary-600 dark:text-primary-400">{`${labels.uploading} ${progress}%`}</span>
            ) : (
              <span className={cx("text-sm whitespace-nowrap text-gray-500 dark:text-gray-400", loading && "opacity-50")}>{labels.count.replace(":count", thousands(data.total))}</span>
            )}

            <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5" role="group" aria-label={labels.display}>
              {views.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  aria-pressed={mode === item.value ? "true" : "false"}
                  onClick={() => {
                    setDisplay(item.value);
                    void load({ search, source, display: item.value, page: 1 });
                  }}
                  className={cx(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    mode === item.value ? "bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white",
                  )}
                >
                  <ViewIcon view={item.value} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={cx("relative", loading && "opacity-60")}>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/5">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                  <circle cx="9" cy="10" r="1.6" />
                  <path d="M4 17l5-4.5 3.5 3L16 12l4 4" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-950 dark:text-white">{data.search !== "" ? labels.noMatch : labels.empty}</p>
              {data.search !== "" ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{labels.tryOther}</p>
              ) : canUpload ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{labels.dragOr}</p>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-500">
                    {labels.pick}
                    <input
                      type="file"
                      multiple
                      accept={accept.join(",")}
                      className="sr-only"
                      onChange={(event) => {
                        upload(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : mode === "daftar" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 dark:bg-white/5 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{labels.name}</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">{labels.source}</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">{labels.size}</th>
                    <th className="hidden px-4 py-2.5 font-medium lg:table-cell">{labels.date}</th>
                    <th className="px-4 py-2.5">
                      <span className="sr-only">{labels.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {rows.map((row) => (
                    <tr key={row.key} onClick={() => select(row)} className={cx("cursor-pointer transition hover:bg-gray-50 dark:hover:bg-white/5", isSelected(row) && "bg-primary-50/60 dark:bg-primary-400/5")}>
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-gray-950/5 dark:ring-white/10 ${CHECKER}`}>
                            {row.isImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={row.url} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
                            ) : (
                              <span className="text-[10px] font-bold text-danger-600">PDF</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[16rem] truncate font-medium text-gray-950 sm:max-w-xs dark:text-white" title={row.path}>
                              {row.name}
                            </p>
                            <p className="max-w-[16rem] truncate text-xs text-gray-500 sm:max-w-xs dark:text-gray-400">
                              {row.type}
                              <span className="sm:hidden"> · {row.size}</span> · {row.folder || "/"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-2.5 md:table-cell">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${BADGE[row.source]}`}>{row.sourceLabel}</span>
                      </td>
                      <td className="hidden px-4 py-2.5 whitespace-nowrap text-gray-600 tabular-nums sm:table-cell dark:text-gray-300">{row.size}</td>
                      <td className="hidden px-4 py-2.5 whitespace-nowrap text-gray-600 lg:table-cell dark:text-gray-300">{row.day}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              copy(row.url);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap text-gray-700 ring-1 ring-gray-950/10 transition hover:bg-gray-50 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-white/5"
                          >
                            {copyButtonLabel(row.url, "h-3.5 w-3.5 shrink-0", "text-success-600 dark:text-success-400")}
                          </button>
                          {row.deletable ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void remove(row.path);
                              }}
                              title={labels.delete}
                              aria-label={labels.delete}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-400/10 dark:hover:text-danger-400"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`grid p-4 ${GRID[mode] ?? ""}`}>
              {rows.map((row) => (
                <div key={row.key} className="group relative min-w-0">
                  <button type="button" onClick={() => select(row)} className="block w-full text-left focus:outline-none" title={row.path}>
                    <div
                      className={cx(
                        `relative flex aspect-square items-center justify-center overflow-hidden rounded-lg transition ${CHECKER}`,
                        isSelected(row)
                          ? "ring-2 ring-primary-600 ring-offset-2 ring-offset-white dark:ring-primary-500 dark:ring-offset-gray-900"
                          : "ring-1 ring-gray-950/10 group-hover:ring-gray-950/25 dark:ring-white/10 dark:group-hover:ring-white/30",
                      )}
                    >
                      {row.isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.url} alt={row.name} loading="lazy" className={cx("h-full w-full object-contain", mode === "kecil" ? "p-1" : "p-2")} />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-danger-600">
                          <PdfIcon className="h-8 w-8" width="1.6" />
                          <span className="text-[10px] font-bold">PDF</span>
                        </div>
                      )}
                      {isSelected(row) ? (
                        <span className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white shadow">
                          <CheckIcon className="h-3 w-3" width="3" />
                        </span>
                      ) : null}
                    </div>
                    {mode !== "kecil" ? (
                      <>
                        <p className="mt-2 truncate text-xs font-medium text-gray-950 dark:text-white">{row.name}</p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                          {row.type} · {row.size}
                        </p>
                      </>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(row.url)}
                    title={labels.copy}
                    aria-label={labels.copy}
                    className={cx(
                      "absolute start-1.5 top-1.5 flex items-center justify-center rounded-md bg-white/95 text-gray-700 shadow-sm ring-1 ring-gray-950/10 transition hover:text-primary-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:bg-gray-900/95 dark:text-gray-200 dark:ring-white/10",
                      mode === "kecil" ? "h-6 w-6" : "h-7 w-7",
                    )}
                  >
                    {copied !== row.url ? <CopyIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5 text-success-600" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {rows.length ? (
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm dark:border-white/10">
            <span className="text-gray-500 dark:text-gray-400">
              {labels.showing.replace(":from", String(data.from)).replace(":to", String(data.to)).replace(":total", thousands(data.total))}
            </span>
            {data.pageCount > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={data.page <= 1}
                  aria-label={labels.previous}
                  onClick={() => void load({ search, source, display, page: data.page - 1 })}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-700 ring-1 ring-gray-950/10 transition hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-200 dark:ring-white/10 dark:hover:bg-white/5"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="text-gray-600 tabular-nums dark:text-gray-300">
                  {data.page} / {data.pageCount}
                </span>
                <button
                  type="button"
                  disabled={data.page >= data.pageCount}
                  aria-label={labels.next}
                  onClick={() => void load({ search, source, display, page: data.page + 1 })}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-700 ring-1 ring-gray-950/10 transition hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-200 dark:ring-white/10 dark:hover:bg-white/5"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {selected ? (
        <>
          <div onClick={() => setSelected(null)} className="fixed inset-0 z-30 bg-gray-950/40 lg:hidden" />
          <aside
            className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl ring-1 ring-gray-950/5 lg:sticky lg:top-24 lg:inset-auto lg:z-auto lg:max-h-[calc(100vh-7rem)] lg:w-80 lg:shrink-0 lg:rounded-xl lg:shadow-sm xl:w-96 dark:bg-gray-900 dark:ring-white/10"
            aria-label={labels.details}
          >
            <div>
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-white/10">
                <h2 className="text-sm font-semibold text-gray-950 dark:text-white">{labels.details}</h2>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={labels.close}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5 dark:hover:text-gray-200"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 p-4">
                <a href={selected.url} target="_blank" rel="noopener" className={`flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg ring-1 ring-gray-950/10 dark:ring-white/10 ${CHECKER}`}>
                  {selected.isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.url}
                      alt={selected.name}
                      onLoad={(event) => {
                        const image = event.currentTarget;

                        setDimensions(image.naturalWidth ? `${image.naturalWidth} × ${image.naturalHeight} px` : "");
                      }}
                      className="h-full w-full object-contain p-3"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-danger-600">
                      <PdfIcon className="h-12 w-12" width="1.4" />
                      <span className="text-xs font-bold">PDF</span>
                    </div>
                  )}
                </a>

                <p className="text-sm font-semibold break-all text-gray-950 dark:text-white">{selected.name}</p>

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">{labels.type}</dt>
                  <dd className="text-right text-gray-950 dark:text-white">{selected.type}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">{labels.size}</dt>
                  <dd className="text-right text-gray-950 dark:text-white">{selected.size}</dd>
                  {dimensions ? (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">{labels.dimensions}</dt>
                      <dd className="text-right text-gray-950 dark:text-white">{dimensions}</dd>
                    </>
                  ) : null}
                  <dt className="text-gray-500 dark:text-gray-400">{labels.date}</dt>
                  <dd className="text-right text-gray-950 dark:text-white">{selected.date}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">{labels.source}</dt>
                  <dd className="text-right text-gray-950 dark:text-white">{selected.sourceLabel}</dd>
                </dl>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="media-file-url">
                    {labels.link}
                  </label>
                  <input
                    id="media-file-url"
                    type="text"
                    readOnly
                    value={selected.url}
                    onFocus={(event) => event.currentTarget.select()}
                    className="w-full rounded-lg border-0 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 ring-1 ring-gray-950/10 focus:ring-2 focus:ring-primary-600 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10"
                  />
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => copy(selected.url)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-500 active:scale-[0.98]"
                  >
                    {copyButtonLabel(selected.url, "h-4 w-4 shrink-0")}
                  </button>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-gray-700 ring-1 ring-gray-950/10 transition hover:bg-gray-50 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-white/5"
                  >
                    {labels.open}
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>

                {selected.deletable ? (
                  <div className="border-t border-gray-200 pt-3 dark:border-white/10">
                    <button type="button" onClick={() => void remove(selected.path)} className="text-sm font-medium text-danger-600 hover:underline dark:text-danger-400">
                      {labels.deleteForever}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
