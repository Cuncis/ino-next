"use client";

import { useEffect, useRef } from "react";
import type { FilePond as Pond, FilePondFile } from "filepond";

/**
 * Filament's FileUpload: FilePond with the options Filament gives it (compact panel,
 * remove button on the left, image previews, size and type checks). Filament uploads each
 * file the moment it is added; here the file stays in the browser until the form is sent,
 * but it shows the same "Upload complete" state.
 *
 * `onChange` gets the files in the order they were added, or in the order the staff
 * member dragged them to when the field is reorderable.
 */
export function FiFileUpload({
  id,
  multiple = false,
  accept,
  maxSizeKb,
  maxFiles,
  reorderable = false,
  describedBy,
  existing,
  onExistingRemoved,
  onChange,
}: {
  /** the file already saved (`getUploadedFileUsing()`), shown first and loaded from its URL */
  existing?: { url: string } | null;
  onExistingRemoved?: () => void;
  id: string;
  multiple?: boolean;
  accept?: string[];
  maxSizeKb?: number;
  maxFiles?: number;
  reorderable?: boolean;
  describedBy?: string;
  onChange: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const changed = useRef(onChange);

  useEffect(() => {
    changed.current = onChange;
  });

  useEffect(() => {
    let pond: Pond | null = null;
    let destroyed = false;
    // in the order added; FilePond itself shows the newest first
    let order: FilePondFile[] = [];

    void (async () => {
      const [{ create, registerPlugin }, size, type, exif, preview] = await Promise.all([
        import("filepond"),
        import("filepond-plugin-file-validate-size"),
        import("filepond-plugin-file-validate-type"),
        import("filepond-plugin-image-exif-orientation"),
        import("filepond-plugin-image-preview"),
      ]);

      if (destroyed || !input.current) {
        return;
      }

      registerPlugin(size.default, type.default, exif.default, preview.default);

      // FileOrigin.LOCAL (3) is the saved file, not one to send
      const publish = () => changed.current(order.filter((item) => item.status !== 8 /* load error */ && item.origin !== 3).map((item) => item.file as File));

      pond = create(input.current, {
        acceptedFileTypes: accept,
        allowMultiple: multiple,
        allowReorder: reorderable,
        allowImagePreview: true,
        credits: false,
        itemInsertLocation: "before",
        maxFiles: maxFiles ?? null,
        maxFileSize: maxSizeKb ? `${maxSizeKb}KB` : null,
        styleButtonProcessItemPosition: "right",
        styleButtonRemoveItemPosition: "left",
        styleLoadIndicatorPosition: "right",
        stylePanelLayout: "compact",
        styleProgressIndicatorPosition: "right",
        files: existing ? [{ source: existing.url, options: { type: "local" } }] : [],
        // nothing to send yet: mark each file uploaded at once, as Livewire's upload would
        server: {
          load: (source, load, error) => {
            void fetch(source, { credentials: "same-origin" })
              .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
              .then(load)
              .catch(() => error("Gagal memuat berkas"));

            return { abort: () => {} };
          },
          process: (_field, _file, _metadata, load) => {
            load(String(Date.now()));

            return { abort: () => {} };
          },
          revert: (_id, load) => load(),
        },
        onaddfile: (error, item) => {
          if (!error) {
            order = [...order, item];
            publish();
          }
        },
        onremovefile: (_error, item) => {
          if (item.origin === 3) {
            onExistingRemoved?.();
          }

          order = order.filter((other) => other.id !== item.id);
          publish();
        },
        onreorderfiles: (items) => {
          order = [...items];
          publish();
        },
      });

      const browser = pond.element?.querySelector(".filepond--browser");

      browser?.setAttribute("aria-labelledby", `${id}-label`);

      if (describedBy) {
        browser?.setAttribute("aria-describedby", describedBy);
        pond.element?.querySelector(".filepond--label-action")?.setAttribute("aria-describedby", describedBy);
      }
    })();

    return () => {
      destroyed = true;
      pond?.destroy();
    };
    // FilePond is set up once; its options don't change while the form is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div hidden data-field-accessibility="" data-preserve-filepond-description="" aria-describedby={describedBy} />
      <div aria-labelledby={`${id}-label`} id={id} role="group" className="fi-fo-file-upload fi-align-start">
        <div className="fi-fo-file-upload-input-ctn">
          <input ref={input} aria-labelledby={`${id}-label`} multiple={multiple} type="file" />
        </div>
        <div role="alert" className="fi-fo-file-upload-error-message" style={{ display: "none" }} />
      </div>
    </>
  );
}
