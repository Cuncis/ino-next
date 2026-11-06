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
  previewHeight,
  openable = false,
  openLabel = "Open in new tab",
  avatar = false,
  onChange,
}: {
  /** `->imagePreviewHeight()`, in pixels */
  previewHeight?: number;
  /** `->openable()`: a link to open the saved file in a new tab */
  openable?: boolean;
  openLabel?: string;
  /** `->avatar()`: a round panel, and the photo cropped square and resized to 500 × 500 in the browser before it is sent */
  avatar?: boolean;
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
      const [{ create, registerPlugin }, size, type, exif, preview, crop, resize, transform] = await Promise.all([
        import("filepond"),
        import("filepond-plugin-file-validate-size"),
        import("filepond-plugin-file-validate-type"),
        import("filepond-plugin-image-exif-orientation"),
        import("filepond-plugin-image-preview"),
        import("filepond-plugin-image-crop"),
        import("filepond-plugin-image-resize"),
        import("filepond-plugin-image-transform"),
      ]);

      if (destroyed || !input.current) {
        return;
      }

      registerPlugin(size.default, type.default, exif.default, preview.default, crop.default, resize.default, transform.default);

      // the file as FilePond's transform plugin left it (cropped and resized for an avatar)
      const prepared = new Map<string, File>();
      // FileOrigin.LOCAL (3) is the saved file, not one to send
      const publish = () =>
        changed.current(order.filter((item) => item.status !== 8 /* load error */ && item.origin !== 3).map((item) => prepared.get(item.id) ?? (item.file as File)));

      pond = create(input.current, {
        acceptedFileTypes: accept,
        allowMultiple: multiple,
        allowReorder: reorderable,
        allowImagePreview: true,
        credits: false,
        ...(previewHeight ? { imagePreviewHeight: previewHeight } : {}),
        imageTransformOutputStripImageHead: false,
        ...(avatar
          ? {
              imageCropAspectRatio: "1:1",
              imageResizeTargetWidth: 500,
              imageResizeTargetHeight: 500,
              imageResizeMode: "cover" as const,
              imageResizeUpscale: false,
            }
          : {}),
        itemInsertLocation: "before",
        maxFiles: maxFiles ?? null,
        maxFileSize: maxSizeKb ? `${maxSizeKb}KB` : null,
        styleButtonProcessItemPosition: avatar ? "center bottom" : "right",
        styleButtonRemoveItemPosition: avatar ? "center bottom" : "left",
        styleLoadIndicatorPosition: avatar ? "center bottom" : "right",
        stylePanelLayout: avatar ? "compact circle" : "compact",
        styleProgressIndicatorPosition: avatar ? "center bottom" : "right",
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
          if (error) {
            return;
          }

          order = [...order, item];
          publish();

          // Filament's insertOpenLink(): only for the saved file, and not on an avatar
          if (openable && !avatar && item.origin === 3) {
            const anchor = document.createElement("a");

            anchor.className = "filepond--open-icon";
            anchor.href = String(item.source);
            anchor.target = "_blank";
            anchor.setAttribute("aria-label", openLabel);
            anchor.setAttribute("title", openLabel);
            document.getElementById(`filepond--item-${item.id}`)?.querySelector(".filepond--file-info-main")?.prepend(anchor);
          }
        },
        onpreparefile: (item, output) => {
          if (output instanceof Blob) {
            prepared.set(item.id, output instanceof File ? output : new File([output], item.filename, { type: output.type }));
            publish();
          }
        },
        onremovefile: (_error, item) => {
          if (item.origin === 3) {
            onExistingRemoved?.();
          }

          prepared.delete(item.id);
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
      <div aria-labelledby={`${id}-label`} id={id} role="group" className={`fi-fo-file-upload${avatar ? " fi-fo-file-upload-avatar" : ""} fi-align-start`}>
        <div className="fi-fo-file-upload-input-ctn">
          <input ref={input} aria-labelledby={`${id}-label`} multiple={multiple} type="file" />
        </div>
        <div role="alert" className="fi-fo-file-upload-error-message" style={{ display: "none" }} />
      </div>
    </>
  );
}
