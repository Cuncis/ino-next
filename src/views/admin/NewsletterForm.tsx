"use client";

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { postAction } from "@/components/admin/filament/ActionForm";
import { FiCodeEditor } from "@/components/admin/filament/CodeEditor";
import { FiInput, FiTagsInput } from "@/components/admin/filament/Fields";
import { FiConfirmModal, FiModal, toastOnNextPage, useFiToast, type FiToast } from "@/components/admin/filament/Modal";
import { FiPreviewModal } from "@/components/admin/filament/PreviewModal";
import { FiRichEditor, type RichEditorLabels } from "@/components/admin/filament/RichEditor";
import { FiBadge, FiButton, FiPage, FiPageHeader } from "@/components/admin/filament/ui";

/**
 * CreateNewsletter and EditNewsletter: NewsletterForm (Kampanye, then Isi Email with the
 * Editor and Custom HTML tabs) and, when editing, the header's Pratinjau, Kirim Email Uji
 * and Kirim ke Subscriber, which all act on what is on screen, unsaved edits included.
 */
export type NewsletterFormLabels = {
  campaign: string;
  lockedDescription: string;
  name: string;
  nameHelper: string;
  subject: string;
  previewText: string;
  previewTextHelper: string;
  body: string;
  editorTab: string;
  customTab: string;
  active: string;
  customHtml: string;
  customHelper: string;
  editor: RichEditorLabels;
  create: string;
  createAnother: string;
  cancel: string;
  save: string;
  delete: string;
  close: string;
  preview: string;
  previewHeading: string;
  back: string;
  sendTest: string;
  sendTestDescription: string;
  emails: string;
  emailsHelper: string;
  removeTag: string;
  submit: string;
  send: string;
  sendHeading: string;
  sendDescription: string;
  sendConfirm: string;
  deleteHeading: string;
  sure: string;
  confirmDelete: string;
};

type Values = { name: string; subject: string; preview_text: string; content: JSONContent | null; custom_html: string };

const grid = (vars: Record<string, string>) => vars as CSSProperties;

function Col({ children, hidden = false }: { children?: ReactNode; hidden?: boolean }) {
  return (
    <div className={`fi-grid-col${hidden ? " fi-hidden" : ""}`} style={grid({ "--col-span-default": "span 1 / span 1" })}>
      {hidden ? null : <div className="fi-sc-component">{children}</div>}
    </div>
  );
}

function Section({ id, heading, description, columns, children }: { id: string; heading: string; description?: string; columns: 1 | 2; children: ReactNode }) {
  return (
    <div id={`form.${id}::data::section`} className="fi-sc-section">
      <section aria-labelledby={`form.${id}::data::section-heading`} className="fi-section fi-section-has-header">
        <header className="fi-section-header">
          <div className="fi-section-header-content fi-section-header-content-has-heading">
            <div className="fi-section-header-text-ctn">
              <h2 id={`form.${id}::data::section-heading`} className="fi-section-header-heading">
                {heading}
              </h2>
              {description ? <p className="fi-section-header-description">{description}</p> : null}
            </div>
          </div>
        </header>
        <div id={`form.${id}::data::section-content`} className="fi-section-content-ctn">
          <div
            className={`fi-section-content fi-grid${columns > 1 ? " lg:fi-grid-cols" : ""} fi-sc fi-sc-has-gap`}
            style={grid(columns > 1 ? { "--cols-lg": "repeat(1, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" } : { "--cols-default": "repeat(1, minmax(0, 1fr))" })}
          >
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}

const TABS = { editor: "editor::data::tab", custom: "custom-html::data::tab" };

export function NewsletterForm({
  mode,
  record,
  locked,
  canChange,
  initial,
  breadcrumbs,
  heading,
  labels,
}: {
  mode: "create" | "edit";
  /** the newsletter being edited: its id, and whether it is still a draft */
  record?: { id: number; draft: boolean };
  locked: boolean;
  canChange: boolean;
  initial: { name: string; subject: string; preview_text: string; content: string; custom_html: string };
  breadcrumbs: { label: string; url?: string }[];
  heading: string;
  labels: NewsletterFormLabels;
}) {
  const router = useRouter();
  const toast = useFiToast();
  const [values, setValues] = useState<Values>({ ...initial, content: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"editor" | "custom">(() => {
    if (typeof window !== "undefined") {
      const persisted = new URLSearchParams(window.location.search).get("isi");

      if (persisted === TABS.custom) return "custom";
      if (persisted === TABS.editor) return "editor";
    }

    return initial.custom_html.trim() !== "" ? "custom" : "editor";
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [testing, setTesting] = useState<{ emails: string[]; errors: Record<string, string> } | null>(null);
  const [confirming, setConfirming] = useState<"send" | "delete" | null>(null);
  // a new, empty editor after "Buat & buat lainnya"
  const [generation, setGeneration] = useState(0);
  const set = <K extends keyof Values>(name: K, value: Values[K]) => setValues((current) => ({ ...current, [name]: value }));
  const onContent = useCallback((document: JSONContent) => setValues((current) => ({ ...current, content: document })), []);

  const payload = () => ({ name: values.name, subject: values.subject, preview_text: values.preview_text, content: values.content, custom_html: values.custom_html });

  /** Answers a 422 by showing the form's errors; returns the result otherwise. */
  const post = async (endpoint: string, data: Record<string, unknown>) => {
    const result = await postAction(endpoint, data);

    if (result.status === 422) {
      setErrors(Object.fromEntries(Object.entries(result.errors ?? {}).map(([field, messages]) => [field, messages[0]])));

      return null;
    }

    setErrors({});

    return result;
  };

  const showToasts = (result: { toast?: Omit<FiToast, "id">; toasts?: Omit<FiToast, "id">[]; redirect?: string }) => {
    const all = [...(result.toast ? [result.toast] : []), ...(result.toasts ?? [])];

    if (result.redirect) {
      toastOnNextPage(all);
      router.push(result.redirect);
    } else {
      all.forEach(toast);
      router.refresh();
    }
  };

  const submit = async (another = false) => {
    setBusy(another ? "another" : "submit");

    try {
      const result = await post(mode === "create" ? "/admin/newsletter/buat" : `/admin/newsletter/${record!.id}/simpan`, { ...payload(), another });

      if (!result) return;

      if (another) {
        if (result.toast) toast(result.toast);
        setValues({ ...initial, content: null });
        setGeneration((current) => current + 1);
      } else {
        showToasts(result);
      }
    } finally {
      setBusy(null);
    }
  };

  const openPreview = async () => {
    setBusy("preview");

    try {
      const result = await post(record ? `/admin/newsletter/${record.id}/pratinjau` : "/admin/newsletter/pratinjau", payload());

      if (result) setPreview(String((result as { html?: string }).html ?? ""));
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    if (!testing) return;

    setBusy("test");

    try {
      const result = await postAction(`/admin/newsletter/${record!.id}/uji`, { ...payload(), emails: testing.emails });

      if (result.status === 422) {
        const all = Object.fromEntries(Object.entries(result.errors ?? {}).map(([field, messages]) => [field, messages[0]]));
        const testErrors = Object.fromEntries(Object.entries(all).filter(([field]) => field.startsWith("emails")));

        setTesting({ ...testing, errors: testErrors });
        setErrors(Object.fromEntries(Object.entries(all).filter(([field]) => !field.startsWith("emails"))));

        return;
      }

      setTesting(null);
      showToasts(result);
    } finally {
      setBusy(null);
    }
  };

  const runConfirmed = async () => {
    setBusy(confirming);

    try {
      const result = confirming === "send" ? await post(`/admin/newsletter/${record!.id}/kirim`, { ...payload(), save: true }) : await post(`/admin/newsletter/${record!.id}/hapus`, {});

      setConfirming(null);

      if (result) showToasts(result);
    } finally {
      setBusy(null);
    }
  };

  const pickTab = (next: "editor" | "custom") => {
    setTab(next);

    const url = new URL(window.location.href);

    url.searchParams.set("isi", TABS[next]);
    window.history.replaceState(window.history.state, "", url);
  };

  const headerActions =
    mode === "edit" ? (
      <>
        <FiButton icon="o-eye" color="gray" loading={busy === "preview"} onClick={() => void openPreview()}>
          {labels.preview}
        </FiButton>
        {canChange ? (
          <FiButton icon="o-paper-airplane" color="gray" onClick={() => setTesting({ emails: [], errors: {} })}>
            {labels.sendTest}
          </FiButton>
        ) : null}
        {canChange && record?.draft ? (
          <FiButton icon="o-paper-airplane" onClick={() => setConfirming("send")}>
            {labels.send}
          </FiButton>
        ) : null}
        <FiButton color="gray" onClick={() => router.push("/admin/newsletter")}>
          {labels.cancel}
        </FiButton>
        <FiButton type="submit" form="form" wrapLabel loading={busy === "submit"}>
          {labels.save}
        </FiButton>
      </>
    ) : null;

  return (
    <FiPage header={<FiPageHeader breadcrumbs={breadcrumbs} heading={heading} actions={headerActions} />}>
      <div className="fi-grid fi-sc fi-sc-has-gap" style={grid({ "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
        <Col>
          <form
            id="form"
            className="fi-sc-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="fi-grid fi-sc fi-sc-has-gap" style={grid({ "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
              <Col>
                <div className="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style={grid({ "--cols-lg": "repeat(2, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
                  <Col>
                    <Section id="kampanye" heading={labels.campaign} description={locked ? labels.lockedDescription : undefined} columns={2}>
                      <Col>
                        <FiInput id="form.name" label={labels.name} required maxLength={255} helper={labels.nameHelper} value={values.name} error={errors.name} disabled={locked} onChange={(value) => set("name", value)} />
                      </Col>
                      <Col>
                        <FiInput id="form.subject" label={labels.subject} required maxLength={255} value={values.subject} error={errors.subject} disabled={locked} onChange={(value) => set("subject", value)} />
                      </Col>
                      <Col>
                        <FiInput id="form.preview_text" label={labels.previewText} maxLength={150} helper={labels.previewTextHelper} value={values.preview_text} error={errors.preview_text} disabled={locked} onChange={(value) => set("preview_text", value)} />
                      </Col>
                    </Section>
                  </Col>
                  <Col>
                    <Section id="isi-email" heading={labels.body} columns={1}>
                      <Col>
                        <div id="form.isi::data::tabs" className="fi-sc-tabs fi-contained">
                          <div className="fi-tabs fi-contained">
                            <div role="tablist" aria-label="isi" className="fi-sc-tabs-tablist">
                              {(["editor", "custom"] as const).map((key) => (
                                <button
                                  key={key}
                                  type="button"
                                  id={`fi-sc-tab-${key}`}
                                  role="tab"
                                  aria-controls={`form.${TABS[key]}`}
                                  tabIndex={tab === key ? 0 : -1}
                                  data-tab-key={TABS[key]}
                                  className={`fi-tabs-item${tab === key ? " fi-active" : ""}`}
                                  aria-selected={tab === key}
                                  onClick={() => pickTab(key)}
                                >
                                  <span className="fi-tabs-item-label">{key === "editor" ? labels.editorTab : labels.customTab}</span>
                                  {key === "custom" && values.custom_html.trim() !== "" ? <FiBadge size="sm">{labels.active}</FiBadge> : null}
                                </button>
                              ))}
                            </div>
                          </div>
                          {(["editor", "custom"] as const).map((key) => (
                            <div key={key} aria-labelledby={`fi-sc-tab-${key}`} id={`form.${TABS[key]}`} role="tabpanel" tabIndex={0} className={`fi-sc-tabs-tab${tab === key ? " fi-active" : ""}`}>
                              <div className="fi-grid fi-sc fi-sc-has-gap" style={grid({ "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
                                <Col>
                                  {key === "editor" ? (
                                    <FiRichEditor
                                      key={generation}
                                      id="form.content"
                                      initial={initial.content}
                                      disabled={locked}
                                      error={errors.content}
                                      uploadEndpoint="/admin/newsletter/lampiran"
                                      labels={labels.editor}
                                      onChange={onContent}
                                    />
                                  ) : (
                                    <FiCodeEditor key={generation} id="form.custom_html" label={labels.customHtml} helper={labels.customHelper} initial={initial.custom_html} disabled={locked} onChange={(value) => set("custom_html", value)} />
                                  )}
                                </Col>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Col>
                    </Section>
                  </Col>
                </div>
              </Col>
            </div>
            {mode === "create" ? (
              <div className="fi-grid fi-sc fi-sc-has-gap" style={grid({ "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
                <Col>
                  <div id="content.form-actions" className="fi-sc-actions">
                    <div className="fi-ac fi-align-start">
                      <FiButton type="submit" loading={busy === "submit"} wrapLabel>
                        {labels.create}
                      </FiButton>
                      <FiButton color="gray" loading={busy === "another"} onClick={() => void submit(true)}>
                        {labels.createAnother}
                      </FiButton>
                      <FiButton color="gray" onClick={() => router.push("/admin/newsletter")}>
                        {labels.cancel}
                      </FiButton>
                    </div>
                  </div>
                </Col>
              </div>
            ) : null}
          </form>
        </Col>
        {mode === "edit" && canChange && record?.draft ? (
          <Col>
            <div id="content.form-actions" className="fi-sc-actions">
              <div className="fi-ac fi-align-end">
                <FiButton color="danger" onClick={() => setConfirming("delete")}>
                  {labels.delete}
                </FiButton>
              </div>
            </div>
          </Col>
        ) : null}
      </div>
      {preview !== null ? <FiPreviewModal heading={labels.previewHeading} html={preview} backLabel={labels.back} closeLabel={labels.close} onClose={() => setPreview(null)} /> : null}
      {testing ? (
        <FiModal
          open
          onClose={() => setTesting(null)}
          heading={labels.sendTest}
          description={labels.sendTestDescription}
          width="4xl"
          closeLabel={labels.close}
          onSubmit={() => void sendTest()}
          footer={
            <>
              <FiButton type="submit" loading={busy === "test"} wrapLabel>
                {labels.submit}
              </FiButton>
              <FiButton color="gray" onClick={() => setTesting(null)}>
                {labels.cancel}
              </FiButton>
            </>
          }
        >
          <div className="fi-grid fi-sc fi-sc-has-gap" style={grid({ "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
            <Col>
              <FiTagsInput
                id="mountedActionSchema0.emails"
                label={labels.emails}
                required
                placeholder="nama@email.com"
                helper={labels.emailsHelper}
                removeLabel={labels.removeTag}
                value={testing.emails}
                error={Object.values(testing.errors)[0]}
                onChange={(emails) => setTesting({ ...testing, emails })}
              />
            </Col>
          </div>
        </FiModal>
      ) : null}
      {confirming ? (
        <FiConfirmModal
          open
          onClose={() => setConfirming(null)}
          onConfirm={() => void runConfirmed()}
          heading={confirming === "send" ? labels.sendHeading : labels.deleteHeading}
          color={confirming === "send" ? "primary" : "danger"}
          icon={confirming === "send" ? "o-exclamation-triangle" : "o-trash"}
          processing={busy === confirming}
          t={(text) =>
            text === "Konfirmasi"
              ? confirming === "send"
                ? labels.sendConfirm
                : labels.confirmDelete
              : text === "Apakah Anda yakin ingin melakukan ini?"
                ? confirming === "send"
                  ? labels.sendDescription
                  : labels.sure
                : text === "Batal"
                  ? labels.cancel
                  : labels.close
          }
        />
      ) : null}
    </FiPage>
  );
}
