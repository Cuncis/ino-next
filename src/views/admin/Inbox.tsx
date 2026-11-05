"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { postAction } from "@/components/admin/filament/ActionForm";
import { FiHelperText, FiInput, FiSearchableSelect, FiTextarea } from "@/components/admin/filament/Fields";
import { FiIcon } from "@/components/admin/filament/Icon";
import { FiConfirmModal, FiModal, useFiToast } from "@/components/admin/filament/Modal";
import { FiButton } from "@/components/admin/filament/ui";

/**
 * The Inbox's moving parts: the list refreshing itself (`->poll('10s')`), Pengaturan
 * Chat with its repeater of quick questions, and a conversation's thread that marks
 * itself read and refreshes every five seconds, with the reply box under it.
 */

const grid = (vars: Record<string, string>) => vars as CSSProperties;

/** Re-renders the page from the server every `seconds`, as Livewire's wire:poll does. */
export function Poll({ seconds, endpoint }: { seconds: number; endpoint?: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.hidden) {
        return;
      }

      if (endpoint) {
        await postAction(endpoint, {}).catch(() => null);
      }

      router.refresh();
    }, seconds * 1000);

    return () => window.clearInterval(timer);
  }, [router, seconds, endpoint]);

  return null;
}

/* ---------------- Pengaturan Chat ---------------- */

export type QuestionItem = { key: string; type: string; question: string; url: string; answer: string; phone: string };

type SettingsLabels = {
  button: string;
  heading: string;
  description: string;
  welcome: string;
  questions: string;
  questionsHelper: string;
  type: string;
  question: string;
  url: string;
  urlHelper: string;
  answer: string;
  answerHelper: string;
  phone: string;
  phoneHelper: string;
  add: string;
  move: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  submit: string;
  cancel: string;
  close: string;
};

let itemSequence = 0;
const newKey = () => `item-${Date.now().toString(36)}-${itemSequence++}`;

export function ChatSettingsAction({
  welcome,
  questions,
  types,
  max,
  labels,
}: {
  welcome: string;
  questions: Omit<QuestionItem, "key">[];
  types: { value: string; label: string }[];
  max: number;
  labels: SettingsLabels;
}) {
  const router = useRouter();
  const toast = useFiToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(welcome);
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<string | null>(null);

  const start = () => {
    // `fillForm()`: what is saved now, each time the modal opens
    setMessage(welcome);
    setItems(questions.map((item) => ({ ...item, key: newKey() })));
    setErrors({});
    setOpen(true);
  };

  const update = (key: string, patch: Partial<QuestionItem>) => setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const move = (from: number, to: number) =>
    setItems((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);

      next.splice(to, 0, item);

      return next;
    });

  const submit = async () => {
    setBusy(true);

    try {
      const result = await postAction("/admin/inbox/pengaturan", {
        welcome_message: message,
        quick_questions: items.map(({ type, question, url, answer, phone }) => ({ type, question, url, answer, phone })),
      } as never);

      if (result.status === 422) {
        setErrors(Object.fromEntries(Object.entries(result.errors ?? {}).map(([field, messages]) => [field, messages[0]])));

        return;
      }

      setOpen(false);

      if (result.toast) {
        toast(result.toast);
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const field = (index: number, name: string) => `quick_questions.${index}.${name}`;

  return (
    <>
      <FiButton icon="o-cog-6-tooth" color="gray" onClick={start}>
        {labels.button}
      </FiButton>
      <FiModal
        open={open}
        onClose={() => setOpen(false)}
        heading={labels.heading}
        description={labels.description}
        width="4xl"
        closeLabel={labels.close}
        onSubmit={() => void submit()}
        footer={
          <>
            <FiButton type="submit" loading={busy} wrapLabel>
              {labels.submit}
            </FiButton>
            <FiButton color="gray" onClick={() => setOpen(false)}>
              {labels.cancel}
            </FiButton>
          </>
        }
      >
        <div className="fi-grid fi-sc fi-sc-has-gap" style={grid({ "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
          <div className="fi-grid-col" style={grid({ "--col-span-default": "span 1 / span 1" })}>
            <div className="fi-sc-component">
              <FiTextarea id="mountedActionSchema0.welcome_message" label={labels.welcome} required rows={3} maxLength={500} value={message} error={errors.welcome_message} onChange={setMessage} />
            </div>
          </div>
          <div className="fi-grid-col" style={grid({ "--col-span-default": "span 1 / span 1" })}>
            <div className="fi-sc-component">
              <div data-field-wrapper="" className="fi-fo-field">
                <div className="fi-fo-field-label-col">
                  <div className="fi-fo-field-label-ctn">
                    <div id="mountedActionSchema0.quick_questions-label" className="fi-fo-field-label">
                      <span className="fi-fo-field-label-content">{labels.questions}</span>
                    </div>
                  </div>
                </div>
                <div className="fi-fo-field-content-col">
                  <div
                    aria-describedby="mountedActionSchema0.quick_questions-helper-text"
                    aria-labelledby="mountedActionSchema0.quick_questions-label"
                    id="mountedActionSchema0.quick_questions"
                    role="group"
                    className="fi-fo-repeater"
                  >
                    {items.length ? (
                      <ul className="fi-grid fi-fo-repeater-items" style={grid({ "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
                        {items.map((item, index) => {
                          const id = `mountedActionSchema0.quick_questions.${item.key}`;
                          const needsPhone = item.type === "whatsapp" || item.type === "phone";

                          return (
                            <li
                              key={item.key}
                              className="fi-fo-repeater-item fi-fo-repeater-item-has-header"
                              draggable={dragging === item.key}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => {
                                const from = items.findIndex((other) => other.key === dragging);

                                if (from >= 0 && from !== index) move(from, index);
                                setDragging(null);
                              }}
                              onDragEnd={() => setDragging(null)}
                            >
                              <div className="fi-fo-repeater-item-header">
                                <ul className="fi-fo-repeater-item-header-start-actions">
                                  <li>
                                    <button
                                      title={labels.move}
                                      aria-label={labels.move}
                                      type="button"
                                      className="fi-ac-icon-btn-action fi-icon-btn fi-size-sm"
                                      tabIndex={-1}
                                      aria-hidden="true"
                                      onMouseDown={() => setDragging(item.key)}
                                      onMouseUp={() => setDragging(null)}
                                    >
                                      <FiIcon name="m-arrows-up-down" />
                                    </button>
                                  </li>
                                  <li className="fi-sr-only">
                                    <button title={labels.moveUp} aria-label={labels.moveUp} type="button" disabled={index === 0} className={`fi-ac-icon-btn-action fi-icon-btn${index === 0 ? " fi-disabled" : ""} fi-size-sm`} onClick={() => move(index, index - 1)}>
                                      <FiIcon name="m-chevron-up" />
                                    </button>
                                  </li>
                                  <li className="fi-sr-only">
                                    <button
                                      title={labels.moveDown}
                                      aria-label={labels.moveDown}
                                      type="button"
                                      disabled={index === items.length - 1}
                                      className={`fi-ac-icon-btn-action fi-icon-btn${index === items.length - 1 ? " fi-disabled" : ""} fi-size-sm`}
                                      onClick={() => move(index, index + 1)}
                                    >
                                      <FiIcon name="m-chevron-down" />
                                    </button>
                                  </li>
                                </ul>
                                <ul className="fi-fo-repeater-item-header-end-actions">
                                  <li>
                                    <button
                                      title={labels.remove}
                                      aria-label={labels.remove}
                                      type="button"
                                      className="fi-ac-icon-btn-action fi-icon-btn fi-size-sm fi-color fi-color-danger fi-text-color-600 hover:fi-text-color-500 dark:fi-text-color-400 dark:hover:fi-text-color-300"
                                      onClick={() => setItems((current) => current.filter((other) => other.key !== item.key))}
                                    >
                                      <FiIcon name="m-trash" />
                                    </button>
                                  </li>
                                </ul>
                              </div>
                              <div className="fi-fo-repeater-item-content">
                                <div className="fi-grid fi-sc fi-sc-has-gap" style={grid({ "--cols-default": "repeat(1, minmax(0, 1fr))" })}>
                                  <Cell>
                                    <FiSearchableSelect
                                      id={`${id}.type`}
                                      label={labels.type}
                                      options={types}
                                      searchable={false}
                                      clearable={false}
                                      labels={{ placeholder: "", search: "", noResults: "", clear: "" }}
                                      value={item.type}
                                      error={errors[field(index, "type")]}
                                      onChange={(value) => {
                                        // `->live()`: the round trip clears the shown errors
                                        setErrors({});
                                        update(item.key, { type: value });
                                      }}
                                    />
                                  </Cell>
                                  <Cell>
                                    <FiInput id={`${id}.question`} label={labels.question} required maxLength={120} value={item.question} error={errors[field(index, "question")]} onChange={(value) => update(item.key, { question: value })} />
                                  </Cell>
                                  {item.type === "message" ? (
                                    <Cell>
                                      <FiInput id={`${id}.url`} label={labels.url} maxLength={255} placeholder="/shop" helper={labels.urlHelper} value={item.url} error={errors[field(index, "url")]} onChange={(value) => update(item.key, { url: value })} />
                                    </Cell>
                                  ) : (
                                    <Cell hidden />
                                  )}
                                  {item.type === "auto_reply" ? (
                                    <Cell>
                                      <FiTextarea
                                        id={`${id}.answer`}
                                        label={labels.answer}
                                        required
                                        rows={3}
                                        maxLength={600}
                                        helper={labels.answerHelper}
                                        value={item.answer}
                                        error={errors[field(index, "answer")]}
                                        onChange={(value) => update(item.key, { answer: value })}
                                      />
                                    </Cell>
                                  ) : (
                                    <Cell hidden />
                                  )}
                                  {needsPhone ? (
                                    <Cell>
                                      <FiInput
                                        id={`${id}.phone`}
                                        label={labels.phone}
                                        type="tel"
                                        required
                                        maxLength={20}
                                        helper={labels.phoneHelper}
                                        value={item.phone}
                                        error={errors[field(index, "phone")]}
                                        onChange={(value) => update(item.key, { phone: value })}
                                      />
                                    </Cell>
                                  ) : (
                                    <Cell hidden />
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {items.length < max ? (
                      <div className="fi-fo-repeater-add">
                        <FiButton
                          color="gray"
                          size="sm"
                          onClick={() => {
                            // a Livewire round trip, which clears the shown errors
                            setErrors({});
                            setItems((current) => [...current, { key: newKey(), type: "message", question: "", url: "", answer: "", phone: "" }]);
                          }}
                        >
                          {labels.add}
                        </FiButton>
                      </div>
                    ) : null}
                  </div>
                  <FiHelperText id="mountedActionSchema0.quick_questions" text={labels.questionsHelper} />
                  {errors.quick_questions ? (
                    <p data-validation-error="" className="fi-fo-field-wrp-error-message">
                      {errors.quick_questions}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </FiModal>
    </>
  );
}

function Cell({ hidden = false, children }: { hidden?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`fi-grid-col${hidden ? " fi-hidden" : ""}`} style={grid({ "--col-span-default": "span 1 / span 1" })}>
      {hidden ? null : <div className="fi-sc-component">{children}</div>}
    </div>
  );
}

/* ---------------- One conversation ---------------- */

export type ThreadMessage = { id: number; fromAdmin: boolean; author: string; meta: string; body: string };

/** ViewChatConversation's header actions: Tutup Percakapan (after "are you sure?") or Buka Kembali. */
export function ConversationActions({ id, status, labels }: { id: number; status: "open" | "closed"; labels: { close: string; reopen: string; sure: string; confirm: string; cancel: string; dismiss: string } }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (action: "tutup" | "buka") => {
    setBusy(true);

    try {
      await postAction(`/admin/inbox/${id}/${action}`, {});
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return status === "open" ? (
    <>
      <FiButton icon="o-check-circle" color="gray" onClick={() => setConfirming(true)}>
        {labels.close}
      </FiButton>
      <FiConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void run("tutup")}
        heading={labels.close}
        color="gray"
        icon="o-exclamation-triangle"
        processing={busy}
        t={(text) => (text === "Konfirmasi" ? labels.confirm : text === "Apakah Anda yakin ingin melakukan ini?" ? labels.sure : text === "Batal" ? labels.cancel : labels.dismiss)}
      />
    </>
  ) : (
    <FiButton icon="o-arrow-uturn-left" color="gray" loading={busy} onClick={() => void run("buka")}>
      {labels.reopen}
    </FiButton>
  );
}

export function ConversationThread({
  id,
  messages,
  canReply,
  labels,
}: {
  id: number;
  messages: ThreadMessage[];
  canReply: boolean;
  labels: { placeholder: string; hint: string; send: string };
}) {
  const router = useRouter();
  const toast = useFiToast();
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;

  // a new message scrolls the thread to the bottom, as the Blade view's x-init does
  useEffect(() => {
    if (thread.current) {
      thread.current.scrollTop = thread.current.scrollHeight;
    }
  }, [lastId]);

  const send = async () => {
    setBusy(true);

    try {
      const result = await postAction(`/admin/inbox/${id}/balas`, { reply });

      if (result.status === 422) {
        setError(result.errors?.reply?.[0] ?? null);

        return;
      }

      setError(null);
      setReply("");

      if (result.toast) {
        toast(result.toast);
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="space-y-4">
      <Poll seconds={5} endpoint={`/admin/inbox/${id}/baca`} />
      <div ref={thread} className="max-h-[60vh] min-h-[16rem] space-y-3 overflow-y-auto rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.fromAdmin ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%]">
              <p className={`mb-1 text-xs text-gray-500 dark:text-gray-400 ${message.fromAdmin ? "text-right" : ""}`}>
                {message.author} &middot; {message.meta}
              </p>
              <div
                className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${message.fromAdmin ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-950 dark:bg-white/10 dark:text-white"}`}
              >
                {message.body}
              </div>
            </div>
          </div>
        ))}
      </div>
      {canReply ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <div className={`fi-input-wrp${error ? " fi-invalid" : ""}`}>
            <div className="fi-input-wrp-content-ctn">
              <textarea
                rows={3}
                maxLength={2000}
                placeholder={labels.placeholder}
                className="block w-full resize-y border-none bg-transparent px-3 py-2 text-base text-gray-950 outline-none placeholder:text-gray-400 dark:text-white sm:text-sm"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{labels.hint}</p>
            <FiButton type="submit" loading={busy}>
              {labels.send}
            </FiButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
