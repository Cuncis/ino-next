import { Link, usePage } from '@/lib/inertia';
import useDragScroll from './useDragScroll';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

type Message = {
    id: number;
    sender: 'pengunjung' | 'admin';
    body: string;
    createdAt: string;
};

type Profile = { name: string; email: string };
type QuickQuestion = {
    question: string;
    url: string | null;
    type: 'message' | 'track_order' | 'auto_reply' | 'whatsapp' | 'phone' | 'ask_product';
    answer: string | null;
    phone: string | null;
};
/** A line shown only to this visitor (a shortcut's fixed answer), never stored in the inbox. */
type LocalNote = { id: number; mine: boolean; text: string };
type TrackedOrder = {
    number: string;
    status: string;
    step: string | null;
    payment: string | null;
    fulfilment: string;
    date: string;
    total: number;
    courier: string | null;
    waybill: string | null;
};

const TOKEN_KEY = 'inofarma-chat-token';
const PROFILE_KEY = 'inofarma-chat-profile';
const ACTIVITY_KEY = 'inofarma-chat-last-activity';
const MAX_LENGTH = 1000;
/** A chat untouched for this long is forgotten by the browser, so a new visit starts fresh. */
const CHAT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const POLL_OPEN_MS = 5000;
const POLL_CLOSED_MS = 30000;

function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string | null) {
    try {
        if (value === null) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, value);
        }
    } catch {
        // Blocked storage: the chat still works until the tab is closed.
    }
}

function readProfile(): Profile | null {
    try {
        const parsed = JSON.parse(readStorage(PROFILE_KEY) ?? 'null');

        return parsed && typeof parsed.name === 'string' && typeof parsed.email === 'string' ? parsed : null;
    } catch {
        return null;
    }
}

function markActivity() {
    writeStorage(ACTIVITY_KEY, String(Date.now()));
}

function isExpired(): boolean {
    const lastActivity = Number(readStorage(ACTIVITY_KEY));

    // No timestamp (a chat saved before expiry existed) counts as expired.
    return ! lastActivity || Date.now() - lastActivity > CHAT_EXPIRY_MS;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Floating chat with the shop's admin. A visitor gives a name and email once;
 * the conversation is then identified by a token kept in this browser, so it
 * survives closing the tab, and the same token is in the link of the reply
 * email (`/?chat=TOKEN`) for picking it up on another device.
 *
 * It asks the server for new messages every few seconds while open (slowly
 * while closed, only to show the unread badge). An admin reply the visitor
 * does not see in the window is emailed to them by the server.
 *
 * `placement` is "frame" inside the phone-width shell and "viewport" on desktop.
 */
export default function ChatWidget({
    placement,
    showLauncher = true,
}: {
    placement: 'frame' | 'viewport';
    showLauncher?: boolean;
}) {
    const { shopUser, chatSettings } = usePage().props as {
        shopUser?: { name: string; email: string } | null;
        chatSettings?: { welcome: string; quickQuestions: QuickQuestion[] };
    };
    const quickQuestions = chatSettings?.quickQuestions ?? [];

    const [open, setOpen] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [unread, setUnread] = useState(0);
    const [draft, setDraft] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [honeypot, setHoneypot] = useState('');
    const [pending, setPending] = useState<string | null>(null);
    const [subscribe, setSubscribe] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<LocalNote[]>([]);
    const [askOpen, setAskOpen] = useState(false);
    const [askProduct, setAskProduct] = useState('');
    const [trackOpen, setTrackOpen] = useState(false);
    const [trackNumber, setTrackNumber] = useState('');
    const [trackEmail, setTrackEmail] = useState('');
    const [trackBusy, setTrackBusy] = useState(false);
    const [trackError, setTrackError] = useState<string | null>(null);
    const [trackResult, setTrackResult] = useState<TrackedOrder | null>(null);

    const listRef = useRef<HTMLDivElement>(null);
    const lastIdRef = useRef(0);

    // Restore the saved chat, or pick up one from an email link (?chat=TOKEN).
    useEffect(() => {
        const url = new URL(window.location.href);
        const fromLink = url.searchParams.get('chat');

        if (fromLink && fromLink.length === 40) {
            writeStorage(TOKEN_KEY, fromLink);
            markActivity();
            url.searchParams.delete('chat');
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
            setOpen(true);
        }

        if (readStorage(TOKEN_KEY) && isExpired()) {
            writeStorage(TOKEN_KEY, null);
            writeStorage(ACTIVITY_KEY, null);
        }

        setToken(readStorage(TOKEN_KEY));
        setProfile(readProfile());
    }, []);

    // Prefill the start form for a signed-in shopper.
    useEffect(() => {
        setName((current) => current || shopUser?.name || profile?.name || '');
        setEmail((current) => current || shopUser?.email || profile?.email || '');
    }, [shopUser, profile]);

    const forgetChat = useCallback(() => {
        writeStorage(TOKEN_KEY, null);
        writeStorage(ACTIVITY_KEY, null);
        setToken(null);
        setMessages([]);
        setUnread(0);
        lastIdRef.current = 0;
    }, []);

    const merge = useCallback((incoming: Message[]) => {
        if (incoming.length === 0) {
            return;
        }

        setMessages((current) => {
            const known = new Set(current.map((message) => message.id));
            const merged = [...current, ...incoming.filter((message) => ! known.has(message.id))];

            lastIdRef.current = Math.max(0, ...merged.map((message) => message.id));

            return merged;
        });
    }, []);

    const poll = useCallback(async () => {
        if (! token || document.hidden) {
            return;
        }

        try {
            const isFirstLoad = lastIdRef.current === 0;
            const response = await fetch(`/api/chat?after=${lastIdRef.current}&open=${open ? 1 : 0}`, {
                headers: { Accept: 'application/json', 'X-Chat-Token': token },
            });

            if (response.status === 404) {
                forgetChat();

                return;
            }

            if (! response.ok) {
                return;
            }

            const data: { messages: Message[]; unread: number } = await response.json();

            // Loading the saved history is not activity; only a new message is.
            if (! isFirstLoad && data.messages.length > 0) {
                markActivity();
            }

            merge(data.messages);
            setUnread(open ? 0 : data.unread);
        } catch {
            // Offline for a moment: the next tick tries again.
        }
    }, [token, open, forgetChat, merge]);

    useEffect(() => {
        if (! token) {
            return;
        }

        void poll();
        const timer = window.setInterval(() => void poll(), open ? POLL_OPEN_MS : POLL_CLOSED_MS);

        return () => window.clearInterval(timer);
    }, [token, open, poll]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages, open, sending, trackOpen, trackResult, notes, askOpen]);

    useEffect(() => {
        if (! open) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

    async function failureMessage(response: Response): Promise<string> {
        if (response.status === 429) {
            return 'Terlalu banyak pesan dalam waktu singkat. Coba lagi sebentar lagi.';
        }

        if (response.status === 422) {
            const body = await response.json().catch(() => null);
            const first = body?.errors ? Object.values<string[]>(body.errors)[0]?.[0] : null;

            return first ?? 'Periksa kembali isian Anda.';
        }

        return 'Pesan belum terkirim. Coba lagi.';
    }

    async function startChat(event: FormEvent) {
        event.preventDefault();

        if (sending || pending === null) {
            return;
        }

        setSending(true);
        setError(null);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ name: name.trim(), email: email.trim(), message: pending, website: honeypot, subscribe }),
            });

            if (! response.ok) {
                setError(await failureMessage(response));

                return;
            }

            const data: { token: string; messages: Message[] } = await response.json();
            const saved = { name: name.trim(), email: email.trim() };

            writeStorage(TOKEN_KEY, data.token);
            markActivity();
            writeStorage(PROFILE_KEY, JSON.stringify(saved));
            setProfile(saved);
            setToken(data.token);
            setPending(null);
            merge(data.messages);
        } catch {
            setError('Tidak bisa terhubung. Periksa koneksi Anda.');
        } finally {
            setSending(false);
        }
    }

    async function sendMessage(event: FormEvent) {
        event.preventDefault();

        await sendText(draft);
    }

    async function sendText(text: string) {
        if (sending || text.trim() === '' || ! token) {
            return;
        }

        setSending(true);
        setError(null);

        try {
            const response = await fetch('/api/chat/pesan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Chat-Token': token },
                body: JSON.stringify({ message: text.trim() }),
            });

            if (response.status === 404) {
                forgetChat();
                setError('Percakapan tidak ditemukan. Mulai chat baru.');

                return;
            }

            if (! response.ok) {
                setError(await failureMessage(response));

                return;
            }

            const data: { message: Message } = await response.json();

            setDraft((current) => (current === text ? '' : current));
            markActivity();
            merge([data.message]);
        } catch {
            setError('Tidak bisa terhubung. Periksa koneksi Anda.');
        } finally {
            setSending(false);
        }
    }

    function pickQuickQuestion(item: QuickQuestion) {
        if (item.type === 'track_order') {
            setTrackResult(null);
            setTrackError(null);
            setTrackEmail((current) => current || shopUser?.email || profile?.email || '');
            setAskOpen(false);
            setTrackOpen(true);

            return;
        }

        if (item.type === 'ask_product') {
            setTrackOpen(false);
            setAskOpen(true);

            return;
        }

        if (item.type === 'auto_reply') {
            const stamp = Date.now();

            setNotes((current) => [
                ...current,
                { id: stamp, mine: true, text: item.question },
                { id: stamp + 1, mine: false, text: item.answer ?? '' },
            ]);

            return;
        }

        if (token) {
            void sendText(item.question);
        } else {
            setPending(item.question);
        }
    }

    async function submitTrack(event: FormEvent) {
        event.preventDefault();

        if (trackBusy) {
            return;
        }

        setTrackBusy(true);
        setTrackError(null);

        try {
            const response = await fetch('/api/chat/lacak-pesanan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ order_number: trackNumber.trim(), email: trackEmail.trim() }),
            });

            if (response.ok) {
                const data: { order: TrackedOrder } = await response.json();

                setTrackResult(data.order);
                setTrackOpen(false);
                setTrackNumber('');

                return;
            }

            if (response.status === 404) {
                const body = await response.json().catch(() => null);
                setTrackError(body?.message ?? 'Pesanan tidak ditemukan.');
            } else {
                setTrackError(await failureMessage(response));
            }
        } catch {
            setTrackError('Tidak bisa terhubung. Periksa koneksi Anda.');
        } finally {
            setTrackBusy(false);
        }
    }

    function submitAsk(event: FormEvent) {
        event.preventDefault();

        const product = askProduct.trim();

        if (product === '') {
            return;
        }

        const message = `Halo, apakah ${product} tersedia?`;

        setAskOpen(false);
        setAskProduct('');

        if (token) {
            void sendText(message);
        } else {
            setPending(message);
        }
    }

    const trackCard = (
        <>
            {notes.map((note) => (
                <Bubble key={note.id} mine={note.mine}>{note.text}</Bubble>
            ))}
            {askOpen ? (
                <AskProductCard value={askProduct} onChange={setAskProduct} onSubmit={submitAsk} onCancel={() => setAskOpen(false)} />
            ) : null}
            {trackOpen ? (
                <TrackOrderCard
                    number={trackNumber}
                    email={trackEmail}
                    onNumber={setTrackNumber}
                    onEmail={setTrackEmail}
                    onSubmit={submitTrack}
                    onCancel={() => setTrackOpen(false)}
                    busy={trackBusy}
                    error={trackError}
                />
            ) : null}
            {trackResult ? <TrackResultBubble order={trackResult} /> : null}
        </>
    );

    const anchor = placement === 'frame' ? 'absolute' : 'fixed';

    return (
        <>
            {showLauncher && ! open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={unread > 0 ? `Buka chat, ${unread} balasan baru` : 'Buka chat dengan admin'}
                    className={`${anchor} bottom-[84px] right-[18px] z-30 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-brand text-white shadow-[0_4px_14px_rgba(9,0,170,.35)] lg:bottom-6 lg:right-6 lg:w-auto lg:gap-2 lg:pl-4 lg:pr-5`}
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-white">
                        {/* Greeting lines, then the hand, which waves a couple of times when the page loads. */}
                        <path d="M2.2 9.2a6.6 6.6 0 0 1 3.1-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        <path d="M0.9 12.6a10 10 0 0 1 1.4-7.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        <g transform="translate(4.6 2.6) scale(0.8)">
                            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
                                <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
                                <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
                                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                            </g>
                            <animateTransform
                                attributeName="transform"
                                type="rotate"
                                additive="sum"
                                values="0 12 20;16 12 20;-8 12 20;14 12 20;0 12 20"
                                dur="1.6s"
                                repeatCount="2"
                            />
                        </g>
                    </svg>
                    <span className="hidden text-[13px] font-semibold lg:inline">Tanya apa saja</span>
                    {unread > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                            {unread}
                        </span>
                    ) : null}
                </button>
            ) : null}

            {open ? (
                <section
                    role="dialog"
                    aria-label="Chat dengan admin Inofarma"
                    className={`${anchor} inset-x-3 bottom-3 top-14 z-40 flex flex-col overflow-hidden rounded-2xl border border-line bg-white font-shop text-ink shadow-[0_8px_32px_rgba(0,0,0,.22)] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-auto lg:h-[520px] lg:w-[350px]`}
                >
                    <header className="flex items-center justify-between gap-2 bg-brand px-4 py-3 text-white">
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold">Chat dengan Admin</p>
                            <p className="text-[10px] opacity-80">Apotek Inofarma membalas secepatnya</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Tutup chat"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                            </svg>
                        </button>
                    </header>

                    {token ? (
                        <>
                            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas px-3 py-3" aria-live="polite">
                                {messages.map((message) => (
                                    <Bubble key={message.id} mine={message.sender === 'pengunjung'} time={formatTime(message.createdAt)}>
                                        {message.body}
                                    </Bubble>
                                ))}
                                {trackCard}
                                <p className="px-2 pt-1 text-center text-[10.5px] leading-snug text-muted">
                                    {profile?.email
                                        ? `Balasan admin juga kami kirim ke ${profile.email} bila Anda sedang tidak membuka chat.`
                                        : 'Balasan admin juga kami kirim ke email Anda bila Anda sedang tidak membuka chat.'}
                                </p>
                            </div>

                            <form onSubmit={sendMessage} className="border-t border-line bg-white p-2.5">
                                {error ? <p role="alert" className="px-1 pb-2 text-[11px] text-danger">{error}</p> : null}
                                <QuickQuestions questions={quickQuestions} onPick={pickQuickQuestion} disabled={sending} />
                                <MessageInput draft={draft} setDraft={setDraft} disabled={sending} />
                            </form>
                        </>
                    ) : pending === null ? (
                        <>
                            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas px-3 py-3" aria-live="polite">
                                <Bubble mine={false}>{chatSettings?.welcome ?? 'Halo! Ada yang bisa kami bantu? Tulis pertanyaan Anda di bawah, admin kami siap membantu.'}</Bubble>
                                {trackCard}
                            </div>

                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();

                                    if (draft.trim() !== '') {
                                        setPending(draft.trim());
                                        setDraft('');
                                    }
                                }}
                                className="border-t border-line bg-white p-2.5"
                            >
                                <QuickQuestions questions={quickQuestions} onPick={pickQuickQuestion} disabled={false} />
                                <MessageInput draft={draft} setDraft={setDraft} disabled={false} autoFocus />
                            </form>
                        </>
                    ) : (
                        <form onSubmit={startChat} className="flex flex-1 flex-col gap-4 overflow-y-auto bg-white p-5">
                            <div>
                                <h3 className="text-[19px] font-semibold text-ink">Sebelum kita mulai</h3>
                                <p className="mt-1.5 text-[12px] leading-snug text-muted">
                                    Harap berikan informasi Anda agar kami dapat membalas jika Anda meninggalkan obrolan.
                                </p>
                            </div>

                            <label className="block text-[11px] font-semibold text-ink">
                                Nama
                                <input
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    required
                                    maxLength={120}
                                    autoComplete="name"
                                    className="mt-1 h-11 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] font-normal outline-none focus:border-brand"
                                />
                            </label>

                            <label className="block text-[11px] font-semibold text-ink">
                                Email
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                    maxLength={190}
                                    autoComplete="email"
                                    className="mt-1 h-11 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] font-normal outline-none focus:border-brand"
                                />
                            </label>

                            {/* Honeypot: invisible to people, tempting to form-filling bots. */}
                            <input
                                tabIndex={-1}
                                autoComplete="off"
                                aria-hidden="true"
                                value={honeypot}
                                onChange={(event) => setHoneypot(event.target.value)}
                                name="website"
                                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                            />

                            {error ? <p role="alert" className="text-[11px] text-danger">{error}</p> : null}

                            <div className="space-y-3">
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="h-12 w-full rounded-full bg-brand text-[13px] font-semibold text-white disabled:opacity-50"
                                >
                                    {sending ? 'Mengirim...' : 'Mulai Obrolan'}
                                </button>

                                <label className="flex items-start gap-2 text-[11.5px] leading-snug text-ink">
                                    <input
                                        type="checkbox"
                                        checked={subscribe}
                                        onChange={(event) => setSubscribe(event.target.checked)}
                                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#0900aa]"
                                    />
                                    Kirimi saya email berisi berita dan penawaran
                                </label>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setDraft(pending);
                                    setPending(null);
                                    setError(null);
                                }}
                                className="mt-auto self-start text-[11px] text-link underline"
                            >
                                Ubah pesan saya
                            </button>
                        </form>
                    )}
                </section>
            ) : null}
        </>
    );
}

function QuickQuestions({ questions, onPick, disabled }: { questions: QuickQuestion[]; onPick: (item: QuickQuestion) => void; disabled: boolean }) {
    const drag = useDragScroll();
    const [moreToRight, setMoreToRight] = useState(false);

    // Shows the right arrow only while there are buttons hidden past the edge.
    useEffect(() => {
        const strip = drag.ref.current;

        if (! strip) {
            return;
        }

        const update = () => setMoreToRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2);

        update();
        strip.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);

        return () => {
            strip.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [drag.ref, questions.length]);

    if (questions.length === 0) {
        return null;
    }

    const chipClass = 'shrink-0 whitespace-nowrap rounded-full border border-brand/30 bg-white px-3 py-1.5 text-[11.5px] leading-snug text-brand hover:bg-blush disabled:opacity-50';

    return (
        <div className="relative">
            <div {...drag} className={`flex gap-1.5 overflow-x-auto pb-2 pl-1 pr-9 scrollbar-none ${drag.className}`}>
                {questions.map((item) => {
                    if (item.type === 'whatsapp' && item.phone) {
                        return (
                            <a
                                key={item.question}
                                href={`https://wa.me/${item.phone}?text=${encodeURIComponent(item.question)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={chipClass}
                            >
                                {item.question}
                            </a>
                        );
                    }

                    if (item.type === 'phone' && item.phone) {
                        return (
                            <a key={item.question} href={`tel:+${item.phone}`} className={chipClass}>
                                {item.question}
                            </a>
                        );
                    }

                    if (! item.url) {
                        return (
                            <button key={item.question} type="button" disabled={disabled} onClick={() => onPick(item)} className={chipClass}>
                                {item.question}
                            </button>
                        );
                    }

                    // A question with a link opens that page, instead of sending a message.
                    return item.url.startsWith('/') ? (
                        <Link key={item.question} href={item.url} className={chipClass}>
                            {item.question}
                        </Link>
                    ) : (
                        <a key={item.question} href={item.url} target="_blank" rel="noopener noreferrer" className={chipClass}>
                            {item.question}
                        </a>
                    );
                })}
            </div>
            {moreToRight ? (
                <button
                    type="button"
                    aria-label="Lihat pertanyaan berikutnya"
                    onClick={() => drag.ref.current?.scrollBy({ left: 160, behavior: 'smooth' })}
                    className="absolute bottom-2 right-0 flex h-[30px] w-8 items-center justify-end bg-gradient-to-l from-white from-60% to-transparent pr-1 text-brand"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            ) : null}
        </div>
    );
}

function AskProductCard({
    value,
    onChange,
    onSubmit,
    onCancel,
}: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    onCancel: () => void;
}) {
    return (
        <div className="flex justify-start">
            <form onSubmit={onSubmit} className="w-full max-w-[92%] rounded-2xl rounded-bl-md bg-white p-4 shadow-sm">
                <h3 className="text-[16px] font-semibold text-ink">Cek ketersediaan obat</h3>
                <p className="mt-0.5 text-[11.5px] text-muted">Tulis nama obat yang Anda cari, admin kami akan mengeceknya.</p>

                <label className="mt-3 block text-[11px] font-semibold text-ink">
                    Nama Obat
                    <input
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        required
                        maxLength={120}
                        autoFocus
                        className="mt-1 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] font-normal outline-none focus:border-brand"
                    />
                </label>

                <div className="mt-3 flex items-center gap-3">
                    <button type="submit" className="h-10 flex-1 rounded-full bg-brand text-[12.5px] font-semibold text-white">
                        Tanyakan
                    </button>
                    <button type="button" onClick={onCancel} className="text-[11px] text-link underline">Batal</button>
                </div>
            </form>
        </div>
    );
}

function TrackOrderCard({
    number,
    email,
    onNumber,
    onEmail,
    onSubmit,
    onCancel,
    busy,
    error,
}: {
    number: string;
    email: string;
    onNumber: (value: string) => void;
    onEmail: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    onCancel: () => void;
    busy: boolean;
    error: string | null;
}) {
    return (
        <div className="flex justify-start">
            <form onSubmit={onSubmit} className="w-full max-w-[92%] rounded-2xl rounded-bl-md bg-white p-4 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M21 8 12 3 3 8m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
                <h3 className="mt-3 text-[16px] font-semibold text-ink">Lacak pesanan saya</h3>
                <p className="mt-0.5 text-[11.5px] text-muted">Harap berikan informasi Anda.</p>

                <label className="mt-3 block text-[11px] font-semibold text-ink">
                    Nomer Pesanan
                    <input
                        value={number}
                        onChange={(event) => onNumber(event.target.value)}
                        required
                        maxLength={60}
                        autoComplete="off"
                        className="mt-1 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] font-normal outline-none focus:border-brand"
                    />
                </label>

                <label className="mt-3 block text-[11px] font-semibold text-ink">
                    Alamat Email
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => onEmail(event.target.value)}
                        required
                        maxLength={190}
                        autoComplete="email"
                        className="mt-1 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-[13px] font-normal outline-none focus:border-brand"
                    />
                </label>

                {error ? <p role="alert" className="mt-2 text-[11px] text-danger">{error}</p> : null}

                <div className="mt-3 flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={busy}
                        className="h-10 flex-1 rounded-full bg-brand text-[12.5px] font-semibold text-white disabled:opacity-50"
                    >
                        {busy ? 'Mencari...' : 'Lacak'}
                    </button>
                    <button type="button" onClick={onCancel} className="text-[11px] text-link underline">Batal</button>
                </div>
            </form>
        </div>
    );
}

function TrackResultBubble({ order }: { order: TrackedOrder }) {
    const rows: [string, string | null][] = [
        ['Status', order.step ?? order.status],
        ['Pembayaran', order.payment],
        ['Cara terima', order.fulfilment],
        ['Tanggal', order.date],
        ['Total', `Rp ${order.total.toLocaleString('id-ID')}`],
        ['Kurir', order.courier],
        ['No. resi', order.waybill],
    ];

    return (
        <Bubble mine={false}>
            <p className="font-semibold">Pesanan {order.number}</p>
            <dl className="mt-1.5 space-y-0.5">
                {rows.filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="flex gap-2 text-[12px]">
                        <dt className="w-[88px] shrink-0 text-muted">{label}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
        </Bubble>
    );
}

function Bubble({ mine, time, children }: { mine: boolean; time?: string; children: ReactNode }) {
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%]">
                {mine ? null : <p className="mb-0.5 px-1 text-[10px] font-semibold text-brand">Admin Inofarma</p>}
                <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-[1.45] ${
                        mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-white text-ink shadow-sm'
                    }`}
                >
                    {children}
                </div>
                {time ? <p className={`mt-0.5 px-1 text-[10px] text-muted ${mine ? 'text-right' : ''}`}>{time}</p> : null}
            </div>
        </div>
    );
}

function MessageInput({
    draft,
    setDraft,
    disabled,
    autoFocus = false,
}: {
    draft: string;
    setDraft: (value: string) => void;
    disabled: boolean;
    autoFocus?: boolean;
}) {
    return (
        <div className="flex items-center gap-2">
            <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_LENGTH}
                placeholder="Tulis pesan"
                aria-label="Pesan Anda"
                autoFocus={autoFocus}
                className="h-10 min-w-0 flex-1 rounded-full border border-line bg-canvas px-4 text-[13px] outline-none focus:border-brand"
            />
            <button
                type="submit"
                disabled={disabled || draft.trim() === ''}
                className="h-10 shrink-0 rounded-full bg-brand px-4 text-[12px] font-semibold text-white disabled:opacity-50"
            >
                Kirim
            </button>
        </div>
    );
}
