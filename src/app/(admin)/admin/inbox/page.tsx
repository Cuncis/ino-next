import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiListTable, type ListRow, type ListSpec } from "@/components/admin/filament/ListTable";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { diffForHumans } from "@/lib/diff-for-humans";
import { can } from "@/lib/permissions";
import { listConversations, INBOX_SORTABLE } from "@/server/admin/inbox";
import { listLabels, paging, queryString } from "@/server/admin/list-labels";
import { parseSort } from "@/server/admin/list-query";
import { OPEN } from "@/server/chat";
import { MAX_QUESTIONS, quickQuestions, welcomeMessage } from "@/server/shop/content/chat-settings";
import { ChatSettingsAction, Poll } from "@/views/admin/Inbox";

export const metadata: Metadata = { title: "Percakapan - Inofarma" };

/** Str::limit($text, 70): cut to 70 characters (trailing space dropped), then "...". */
const limit = (text: string, length = 70) => ([...text].length <= length ? text : `${[...text].slice(0, length).join("").trimEnd()}...`);

/** GET /admin/inbox: ListChatConversations, newest activity first, refreshing every ten seconds. */
export default async function Page({ searchParams }: PageProps<"/admin/inbox">) {
  const context = await adminContext((access) => can(access, "Inbox:Lihat"));
  const { access, locale, t } = context;
  const query = await searchParams;
  const { page, perPage } = paging(query);
  const needsReply = queryString(query.filter_needs_reply);
  const status = queryString(query.filter_status);
  const search = queryString(query.search);
  const sort = parseSort(query.sort, INBOX_SORTABLE);
  const { rows, total } = await listConversations({ search, needsReply: needsReply === "1", status: status || undefined, sort, page, perPage });
  const statusLabels: Record<string, string> = { terbuka: t("Terbuka"), ditutup: t("Ditutup") };

  const tableRows: ListRow[] = rows.map((conversation) => ({
    id: String(conversation.id),
    url: `/admin/inbox/${conversation.id}`,
    cells: {
      name: { kind: "described", text: conversation.name, description: conversation.email, weight: "medium" },
      "latestMessage.body": conversation.latestBody === null ? { kind: "empty" } : { kind: "text", text: limit(conversation.latestBody), color: "gray" },
      admin_unread_count: { kind: "badge", text: String(conversation.adminUnreadCount), color: conversation.adminUnreadCount > 0 ? "danger" : "gray" },
      status: { kind: "badge", text: statusLabels[conversation.status] ?? conversation.status, color: conversation.status === OPEN ? "success" : "gray" },
      last_message_at: conversation.lastMessageAt ? { kind: "text", text: diffForHumans(conversation.lastMessageAt, locale) } : { kind: "empty" },
    },
    actions: [],
  }));

  const spec: ListSpec = {
    heading: t("plural:Percakapan"),
    columns: [
      { name: "name", className: "name", label: t("Nama") },
      { name: "latestMessage.body", className: "latest-message.body", label: t("Pesan Terakhir") },
      { name: "admin_unread_count", className: "admin-unread-count", label: t("Belum Dibaca"), sortable: true },
      { name: "status", className: "status", label: t("Status") },
      { name: "last_message_at", className: "last-message-at", label: t("Aktivitas Terakhir"), sortable: true },
    ],
    sort,
    rows: tableRows,
    total,
    page,
    perPage,
    search,
    filters: [
      { name: "needs_reply", label: t("Perlu dibalas"), value: needsReply === "1" ? "1" : "", defaultValue: "", options: [], checkbox: true },
      {
        name: "status",
        label: t("Status"),
        value: status,
        defaultValue: "",
        options: [{ value: "", label: t("Semua") }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))],
      },
    ],
    bulkActions: [],
    emptyHeading: t("Belum ada percakapan"),
    emptyDescription: t("Pesan dari pengunjung toko akan muncul di sini."),
    labels: listLabels(locale),
  };

  const types = [
    { value: "message", label: t("Pertanyaan atau tautan") },
    { value: "auto_reply", label: t("Jawaban otomatis (mis. jam buka, info antar)") },
    { value: "track_order", label: t("Lacak Pesanan (formulir nomor pesanan dan email)") },
    { value: "ask_product", label: t("Cek ketersediaan obat (formulir nama obat)") },
    { value: "whatsapp", label: t("Chat WhatsApp") },
    { value: "phone", label: t("Telepon") },
  ];

  return (
    <AdminShell context={context} pathname="/admin/inbox">
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Percakapan"), url: "/admin/inbox" }, { label: t("Daftar") }]}
            heading={t("plural:Percakapan")}
            actions={
              can(access, "Inbox:Balas") ? (
                <ChatSettingsAction
                  welcome={await welcomeMessage()}
                  questions={(await quickQuestions()).map((item) => ({ type: item.type, question: item.question, url: item.url ?? "", answer: item.answer ?? "", phone: item.phone ?? "" }))}
                  types={types}
                  max={MAX_QUESTIONS}
                  labels={{
                    button: t("Pengaturan Chat"),
                    heading: t("Pengaturan Chat"),
                    description: t("Pesan sambutan dan pertanyaan cepat yang tampil di jendela chat toko sebelum pengunjung menulis pesan."),
                    welcome: t("Pesan sambutan"),
                    questions: t("Pertanyaan cepat"),
                    questionsHelper: t("Tampil sebagai tombol di atas kolom ketik. Pengunjung cukup menekannya untuk mengirim pertanyaan itu."),
                    type: t("Jenis tombol"),
                    question: t("Pertanyaan"),
                    url: t("Tautan (opsional)"),
                    urlHelper: t("Bila diisi, menekan tombol ini membuka halaman tersebut, bukan mengirim pesan. Contoh: /shop atau https://inofarma.com."),
                    answer: t("Jawaban"),
                    answerHelper: t("Ditampilkan langsung di chat saat tombol ditekan."),
                    phone: t("Nomor telepon / WhatsApp"),
                    phoneHelper: t("Boleh diawali 0 atau 62. Contoh: 0812-1401-8964."),
                    add: t("Tambah pertanyaan"),
                    move: t("Pindahkan"),
                    moveUp: t("Naikkan"),
                    moveDown: t("Turunkan"),
                    remove: t("Hapus"),
                    submit: t("Kirim"),
                    cancel: t("Batal"),
                    close: t("Tutup"),
                  }}
                />
              ) : null
            }
          />
        }
      >
        <Poll seconds={10} />
        <FiListTable spec={spec} />
      </FiPage>
    </AdminShell>
  );
}
