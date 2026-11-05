import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { FiPage, FiPageHeader } from "@/components/admin/filament/ui";
import { can } from "@/lib/permissions";
import { conversationThread, findConversation, markConversationRead } from "@/server/admin/inbox";
import { FROM_ADMIN, OPEN } from "@/server/chat";
import { ConversationActions, ConversationThread } from "@/views/admin/Inbox";

export const metadata: Metadata = { title: "Lihat Percakapan - Inofarma" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `$date->format('d M Y, H:i')` in Jakarta: PHP's format(), so the month stays in English. */
function stamp(date: Date | null): string {
  if (!date) {
    return "";
  }

  const jakarta = new Date(date.getTime() + 7 * 3600_000).toISOString();

  return `${jakarta.slice(8, 10)} ${MONTHS[Number(jakarta.slice(5, 7)) - 1]} ${jakarta.slice(0, 4)}, ${jakarta.slice(11, 16)}`;
}

/** GET /admin/inbox/{id}: ViewChatConversation. Opening it counts as reading it. */
export default async function Page({ params }: PageProps<"/admin/inbox/[id]">) {
  const context = await adminContext((access) => can(access, "Inbox:Lihat"));
  const { access, t } = context;
  const conversation = await findConversation(Number((await params).id));

  if (!conversation) {
    notFound();
  }

  await markConversationRead(conversation);

  const canReply = can(access, "Inbox:Balas");
  const messages = (await conversationThread(conversation.id)).map(({ message, author }) => {
    const fromAdmin = message.sender === FROM_ADMIN;
    const seen = message.visitorSeenAt ? t("Dibaca di chat") : message.emailedAt ? t("Dikirim lewat email") : t("Belum dibaca");

    return {
      id: message.id,
      fromAdmin,
      author: fromAdmin ? (author ?? t("Admin")) : conversation.name,
      meta: fromAdmin ? `${stamp(message.createdAt)} · ${seen}` : stamp(message.createdAt),
      body: message.body,
    };
  });

  return (
    <AdminShell context={context} pathname={`/admin/inbox/${conversation.id}`}>
      <FiPage
        header={
          <FiPageHeader
            breadcrumbs={[{ label: t("plural:Percakapan"), url: "/admin/inbox" }, { label: conversation.name, url: `/admin/inbox/${conversation.id}` }, { label: t("Lihat") }]}
            heading={conversation.name}
            subheading={conversation.email}
            actions={
              canReply ? (
                <ConversationActions
                  id={conversation.id}
                  status={conversation.status === OPEN ? "open" : "closed"}
                  labels={{
                    close: t("Tutup Percakapan"),
                    reopen: t("Buka Kembali"),
                    sure: t("Apakah Anda yakin ingin melakukan ini?"),
                    confirm: t("Konfirmasi"),
                    cancel: t("Batal"),
                    dismiss: t("Tutup"),
                  }}
                />
              ) : null
            }
          />
        }
      >
        <ConversationThread
          id={conversation.id}
          messages={messages}
          canReply={canReply}
          labels={{ placeholder: t("Tulis balasan"), hint: t("Balasan muncul di jendela chat pengunjung. Bila mereka tidak membukanya, balasan dikirim lewat email."), send: t("Kirim Balasan") }}
        />
      </FiPage>
    </AdminShell>
  );
}
