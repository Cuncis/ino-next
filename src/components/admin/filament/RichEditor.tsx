"use client";

import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { mergeAttributes, Node, type JSONContent } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import { Editor } from "@tiptap/core";
import { FiInput } from "./Fields";
import { FiFileUpload } from "./FileUpload";
import { FiModal } from "./Modal";
import { RICH_EDITOR_ICONS } from "./rich-editor-icons";
import { FiButton } from "./ui";

/**
 * Filament's RichEditor (Tiptap) with the newsletter's toolbar: headings, bold and
 * italic, lists, link, image upload and the "Tombol" block, undo and redo. Its markup
 * and extensions follow Filament's resources/js/components/rich-editor (MIT); the form
 * sends the document as JSON, which the server turns into HTML as tiptap-php did.
 */

export type ButtonConfig = { label?: string; url?: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);

/** ButtonBlock::toPreviewHtml() */
function buttonPreview(config: ButtonConfig): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;"><tr><td align="center" style="background-color:#24CE30;border-radius:2px;"><a href="${escapeHtml(config.url ?? "#")}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#24CE30;border-radius:2px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(config.label ?? "")}</a></td></tr></table>`;
}

const icon = (name: string) => RICH_EDITOR_ICONS[name].replace("<svg ", '<svg class="fi-icon fi-size-md" aria-hidden="true" data-slot="icon" ');

/** extension-custom-block.js: an atom showing the block's name and preview, with edit and delete buttons. */
const CustomBlock = Node.create<{ blockLabel: string; editLabel: string; deleteLabel: string; onEdit: (position: number, config: ButtonConfig) => void }>({
  name: "customBlock",
  group: "block",
  atom: true,
  defining: true,
  draggable: true,
  selectable: true,
  isolating: true,
  inline: false,

  addOptions() {
    return { blockLabel: "Tombol", editLabel: "Edit block", deleteLabel: "Delete block", onEdit: () => {} };
  },

  addAttributes() {
    return {
      config: {
        default: null,
        parseHTML: (element) => JSON.parse(element.getAttribute("data-config") ?? "null"),
        renderHTML: (attributes) => (attributes.config ? { "data-config": JSON.stringify(attributes.config) } : {}),
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-id"),
        renderHTML: (attributes) => (attributes.id ? { "data-id": attributes.id } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="customBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-type": "customBlock" }, HTMLAttributes)];
  },

  addNodeView() {
    return ({ editor, node, getPos, extension }) => {
      const config = (node.attrs.config ?? {}) as ButtonConfig;
      const dom = document.createElement("div");

      dom.setAttribute("data-config", JSON.stringify(node.attrs.config));
      dom.setAttribute("data-id", String(node.attrs.id));
      dom.setAttribute("data-testid", "rich-editor-custom-block");
      dom.setAttribute("data-type", "customBlock");

      const header = document.createElement("div");

      header.className = "fi-fo-rich-editor-custom-block-header fi-not-prose";
      dom.appendChild(header);

      if (editor.isEditable && Object.keys(config).length > 0) {
        const container = document.createElement("div");
        const button = document.createElement("button");

        container.className = "fi-fo-rich-editor-custom-block-edit-btn-ctn";
        button.className = "fi-icon-btn";
        button.dataset.testid = "rich-editor-custom-block-edit-button";
        button.type = "button";
        button.setAttribute("aria-label", extension.options.editLabel);
        button.innerHTML = icon("editBlock");
        button.addEventListener("click", () => {
          const position = typeof getPos === "function" ? getPos() : undefined;

          if (typeof position === "number") {
            editor.commands.setNodeSelection(position);
            extension.options.onEdit(position, config);
          }
        });
        container.appendChild(button);
        header.appendChild(container);
      }

      const heading = document.createElement("p");

      heading.className = "fi-fo-rich-editor-custom-block-heading";
      heading.textContent = `${extension.options.blockLabel}: ${config.label ?? ""}`;
      header.appendChild(heading);

      if (editor.isEditable) {
        const container = document.createElement("div");
        const button = document.createElement("button");

        container.className = "fi-fo-rich-editor-custom-block-delete-btn-ctn";
        button.className = "fi-icon-btn";
        button.dataset.testid = "rich-editor-custom-block-delete-button";
        button.type = "button";
        button.setAttribute("aria-label", extension.options.deleteLabel);
        button.innerHTML = icon("deleteBlock");
        button.addEventListener("click", () => {
          const position = typeof getPos === "function" ? getPos() : undefined;

          if (typeof position === "number") {
            editor.chain().focus().setNodeSelection(position).deleteSelection().run();
          }
        });
        container.appendChild(button);
        header.appendChild(container);
      }

      const preview = document.createElement("div");

      preview.className = "fi-fo-rich-editor-custom-block-preview fi-not-prose";
      preview.innerHTML = buttonPreview(config);
      dom.appendChild(preview);

      return { dom, stopEvent: (event) => event.target instanceof Element && header.contains(event.target.closest("button")) };
    };
  },
});

/** extension-image.js: the uploaded file's path rides along as data-id. */
const FilamentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: { default: null, parseHTML: (element) => element.getAttribute("data-id"), renderHTML: (attributes) => (attributes.id ? { "data-id": attributes.id } : {}) },
    };
  },
});

export type RichEditorLabels = {
  label: string;
  tools: Record<"h2" | "h3" | "bold" | "italic" | "bulletList" | "orderedList" | "link" | "attachFiles" | "customBlocks" | "undo" | "redo", string>;
  toolbar: string;
  blocks: string;
  closePanel: string;
  block: string;
  editBlock: string;
  deleteBlock: string;
  linkHeading: string;
  url: string;
  newTab: string;
  attachHeading: string;
  file: string;
  alt: string;
  blockHeading: string;
  blockDescription: string;
  blockLabel: string;
  blockUrl: string;
  insert: string;
  save: string;
  submit: string;
  cancel: string;
  close: string;
  uploading: string;
};

type Modal =
  | { kind: "link"; url: string; newTab: boolean }
  | { kind: "attach"; alt: string; files: File[]; error?: string }
  | { kind: "block"; position: number | null; label: string; url: string; errors?: Record<string, string> }
  | null;

const GROUPS: (keyof RichEditorLabels["tools"])[][] = [["h2", "h3"], ["bold", "italic"], ["bulletList", "orderedList"], ["link", "attachFiles", "customBlocks"], ["undo", "redo"]];

export function FiRichEditor({
  id,
  initial,
  disabled = false,
  error,
  uploadEndpoint,
  labels,
  onChange,
}: {
  id: string;
  /** the stored HTML */
  initial: string;
  disabled?: boolean;
  error?: string;
  /** POST a file; answers `{ id, src }` (the disk path and its URL) */
  uploadEndpoint: string;
  labels: RichEditorLabels;
  onChange: (document: JSONContent) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [panel, setPanel] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const instance = new Editor({
      element: mount.current!,
      editable: !disabled,
      extensions: [
        StarterKit.configure({
          link: { autolink: true, openOnClick: false, HTMLAttributes: { target: null, rel: null } },
          dropcursor: { class: "fi-not-prose" },
          trailingNode: false,
        }),
        CustomBlock.configure({
          blockLabel: labels.block,
          editLabel: labels.editBlock,
          deleteLabel: labels.deleteBlock,
          onEdit: (position, config) => setModal({ kind: "block", position, label: config.label ?? "", url: config.url ?? "" }),
        }),
        FilamentImage.configure({ inline: true }),
        Highlight,
        Subscript,
        Superscript,
        TableKit.configure({ table: { resizable: true } }),
        TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["start", "center", "end", "justify"], defaultAlignment: "start" }),
      ],
      content: initial,
      editorProps: {
        attributes: { class: "tiptap ProseMirror", "aria-label": labels.label, "aria-multiline": "true", role: "textbox", "data-testid": "rich-editor-content", translate: "no" },
      },
      onTransaction: () => refresh(),
      onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON()),
    });

    // the editor exists only once mounted in the browser
    setEditor(instance);
    onChangeRef.current(instance.getJSON());

    return () => {
      instance.destroy();
      setEditor(null);
    };
    // the editor is built once; its content then lives in Tiptap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = (tool: string) => {
    if (!editor) return false;
    if (tool === "h2") return editor.isActive("heading", { level: 2 });
    if (tool === "h3") return editor.isActive("heading", { level: 3 });
    if (["bold", "italic", "bulletList", "orderedList", "link"].includes(tool)) return editor.isActive(tool);

    return null;
  };

  const run = (tool: keyof RichEditorLabels["tools"]) => {
    if (!editor) return;

    const chain = editor.chain().focus();

    switch (tool) {
      case "h2":
        chain.toggleHeading({ level: 2 }).run();
        break;
      case "h3":
        chain.toggleHeading({ level: 3 }).run();
        break;
      case "bold":
        chain.toggleBold().run();
        break;
      case "italic":
        chain.toggleItalic().run();
        break;
      case "bulletList":
        chain.toggleBulletList().run();
        break;
      case "orderedList":
        chain.toggleOrderedList().run();
        break;
      case "undo":
        chain.undo().run();
        break;
      case "redo":
        chain.redo().run();
        break;
      case "link": {
        const attributes = editor.getAttributes("link");

        setModal({ kind: "link", url: attributes.href ?? "", newTab: attributes.target === "_blank" });
        break;
      }
      case "attachFiles":
        setModal({ kind: "attach", alt: "", files: [] });
        break;
      case "customBlocks":
        setPanel(!panel);
        break;
    }
  };

  /** LinkAction: the link around the cursor (or on the selection) set, or removed when the URL is empty. */
  const applyLink = (url: string, newTab: boolean) => {
    if (!editor) return;

    const single = editor.state.selection.empty;
    const chain = editor.chain().focus();

    if (single) chain.extendMarkRange("link");

    if (url.trim() === "") {
      chain.unsetLink().run();
    } else {
      chain.setLink({ href: url, target: newTab ? "_blank" : null }).run();
    }
  };

  const applyBlock = (position: number | null, config: ButtonConfig) => {
    if (!editor) return;

    const content = { type: "customBlock", attrs: { config, id: "button" } };

    if (position === null) {
      editor.chain().focus().insertContent(content).run();
    } else {
      editor.chain().focus().setNodeSelection(position).insertContent(content).run();
    }
  };

  const upload = async (files: File[], alt: string) => {
    const form = new FormData();

    form.set("file", files[0]);

    const response = await fetch(uploadEndpoint, { method: "POST", body: form, headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }, credentials: "same-origin" });
    const result = (await response.json().catch(() => ({}))) as { id?: string; src?: string; errors?: Record<string, string[]> };

    if (!response.ok || !result.id) {
      setModal({ kind: "attach", alt, files, error: result.errors?.file?.[0] ?? labels.file });

      return;
    }

    editor?.chain().focus().insertContent({ type: "image", attrs: { alt: alt || null, id: result.id, src: result.src } }).run();
    setModal(null);
  };

  const submitModal = async () => {
    if (!modal) return;

    setBusy(true);

    try {
      if (modal.kind === "link") {
        applyLink(modal.url, modal.newTab);
        setModal(null);
      } else if (modal.kind === "attach") {
        if (modal.files.length) await upload(modal.files, modal.alt);
      } else {
        applyBlock(modal.position, { label: modal.label, url: modal.url });
        setModal(null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-field-wrapper="" className="fi-fo-field">
      <div id={`${id}-label`} className="fi-fo-field-label fi-sr-only">
        {labels.label}
      </div>
      <div className="fi-fo-field-content-col">
        <div style={{ "--min-height": "10rem" } as CSSProperties} className={`fi-fo-rich-editor fi-input-wrp${disabled ? " fi-disabled" : ""}${error ? " fi-invalid" : ""}`}>
          <div className="fi-input-wrp-content-ctn">
            <div aria-labelledby={`${id}-label`} data-rich-editor-key={id} id={id} role="group">
              {disabled ? null : (
                <div className="fi-fo-rich-editor-toolbar " data-rich-editor-toolbar="main" role="toolbar" aria-label={labels.toolbar}>
                  {GROUPS.map((group) => (
                    <div key={group[0]} className="fi-fo-rich-editor-toolbar-group">
                      {group.map((tool) => {
                        const active = tool === "customBlocks" ? panel : isActive(tool);

                        return (
                          <button
                            key={tool}
                            data-rich-editor-tool={tool}
                            tabIndex={tool === "h2" ? 0 : -1}
                            type="button"
                            aria-label={labels.tools[tool]}
                            aria-pressed={active === null || tool === "customBlocks" ? undefined : active}
                            className={`fi-fo-rich-editor-tool${active ? " fi-active" : ""}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => run(tool)}
                            dangerouslySetInnerHTML={{ __html: icon(tool) }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
              <div className="fi-fo-rich-editor-main">
                <div className="fi-fo-rich-editor-content fi-prose" ref={mount} />
                {panel && !disabled ? (
                  <div className="fi-fo-rich-editor-panels ">
                    <div className="fi-fo-rich-editor-panel">
                      <div className="fi-fo-rich-editor-panel-header">
                        <p className="fi-fo-rich-editor-panel-heading">{labels.blocks}</p>
                        <div className="fi-fo-rich-editor-panel-close-btn-ctn">
                          <button type="button" className="fi-icon-btn" aria-label={labels.closePanel} onClick={() => setPanel(false)} dangerouslySetInnerHTML={{ __html: icon("closePanel") }} />
                        </div>
                      </div>
                      <div className="fi-fo-rich-editor-custom-blocks-ctn">
                        <div className="fi-fo-rich-editor-custom-blocks-list ">
                          <button type="button" data-block-id="button" className="fi-fo-rich-editor-custom-block-btn" onClick={() => setModal({ kind: "block", position: null, label: "", url: "" })}>
                            <span>{labels.block}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {error ? (
          <p id={`${id}-error`} data-validation-error="" className="fi-fo-field-wrp-error-message">
            {error}
          </p>
        ) : null}
      </div>
      {modal ? (
        <FiModal
          open
          onClose={() => setModal(null)}
          heading={modal.kind === "link" ? labels.linkHeading : modal.kind === "attach" ? labels.attachHeading : labels.blockHeading}
          description={modal.kind === "block" ? labels.blockDescription : undefined}
          width="lg"
          closeLabel={labels.close}
          onSubmit={() => void submitModal()}
          footer={
            <>
              <FiButton type="submit" loading={busy} wrapLabel>
                {modal.kind === "block" ? (modal.position === null ? labels.insert : labels.save) : labels.submit}
              </FiButton>
              <FiButton color="gray" onClick={() => setModal(null)}>
                {labels.cancel}
              </FiButton>
            </>
          }
        >
          {modal.kind === "link" ? (
            <div className="fi-grid fi-sc fi-sc-has-gap" style={{ "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}>
              <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
                <div className="fi-sc-component">
                  <FiInput id="mountedActionSchema0.url" label={labels.url} value={modal.url} autoFocus onChange={(value) => setModal({ ...modal, url: value })} />
                </div>
              </div>
              <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
                <div className="fi-sc-component">
                  <div data-field-wrapper="" className="fi-fo-field">
                    <div className="fi-fo-field-label-col">
                      <div className="fi-fo-field-label-ctn">
                        <label htmlFor="mountedActionSchema0.shouldOpenInNewTab" className="fi-fo-field-label">
                          <input type="checkbox" id="mountedActionSchema0.shouldOpenInNewTab" className="fi-checkbox-input fi-valid" checked={modal.newTab} onChange={(event) => setModal({ ...modal, newTab: event.target.checked })} />
                          <span className="fi-fo-field-label-content">{labels.newTab}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : modal.kind === "attach" ? (
            <div className="fi-grid fi-sc fi-sc-has-gap" style={{ "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}>
              <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
                <div className="fi-sc-component">
                  <div data-field-wrapper="" className="fi-fo-field">
                    <div id="mountedActionSchema0.file-label" className="fi-fo-field-label fi-sr-only">
                      {labels.file}
                    </div>
                    <div className="fi-fo-field-content-col">
                      <FiFileUpload id="mountedActionSchema0.file" accept={["image/png", "image/jpeg", "image/webp", "image/gif"]} maxSizeKb={2048} onChange={(files) => setModal({ ...modal, files })} />
                      {modal.error ? (
                        <p data-validation-error="" className="fi-fo-field-wrp-error-message">
                          {modal.error}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
                <div className="fi-sc-component">
                  <FiInput id="mountedActionSchema0.alt" label={labels.alt} maxLength={1000} value={modal.alt} onChange={(value) => setModal({ ...modal, alt: value })} />
                </div>
              </div>
            </div>
          ) : (
            <div className="fi-grid fi-sc fi-sc-has-gap" style={{ "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}>
              <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
                <div className="fi-sc-component">
                  <FiInput id="mountedActionSchema0.label" label={labels.blockLabel} required maxLength={60} autoFocus value={modal.label} onChange={(value) => setModal({ ...modal, label: value })} />
                </div>
              </div>
              <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
                <div className="fi-sc-component">
                  <FiInput id="mountedActionSchema0.url" label={labels.blockUrl} required type="url" placeholder="https://" value={modal.url} onChange={(value) => setModal({ ...modal, url: value })} />
                </div>
              </div>
            </div>
          )}
        </FiModal>
      ) : null}
    </div>
  );
}
