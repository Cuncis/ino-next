import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  branchStocks,
  chatConversations,
  chatMessages,
  db,
  inventoryBatches,
  modelHasPermissions,
  modelHasRoles,
  notifications,
  orders,
  permissions,
  products,
  roleHasPermissions,
  users,
  type DbExecutor,
} from "@/db";
import { appUrl } from "@/lib/app-url";
import { indonesianDate } from "@/lib/dates";
import { rupiah } from "@/lib/money";
import { dispatch, type StaffNotificationName } from "@/lib/queue";

/**
 * Staff notifications, ported from App\Notifications\Admin\*: a row in `notifications`
 * in Filament's own format, which the admin panel's bell shows. One queued job per
 * staff member, as Laravel's Notification::send() queued them.
 */
const STAFF_MODEL = "App\\Models\\User";

/** The active staff of one branch (Laravel's `User::where('branch_id', …)->where('is_active', true)`). */
export async function activeBranchStaff(branchId: number, executor: DbExecutor = db): Promise<number[]> {
  const rows = await executor
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.branchId, branchId), eq(users.isActive, true), isNull(users.deletedAt)));

  return rows.map((row) => row.id);
}

/**
 * Active staff holding a permission, directly or through a role (spatie's
 * `User::permission()` scope: a Super Admin without it isn't included).
 */
export async function activeStaffWithPermission(permission: string, executor: DbExecutor = db): Promise<number[]> {
  const viaRole = executor
    .select({ id: modelHasRoles.modelId })
    .from(modelHasRoles)
    .innerJoin(roleHasPermissions, eq(roleHasPermissions.roleId, modelHasRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, roleHasPermissions.permissionId))
    .where(and(eq(modelHasRoles.modelType, STAFF_MODEL), eq(permissions.name, permission), eq(permissions.guardName, "web")));
  const direct = executor
    .select({ id: modelHasPermissions.modelId })
    .from(modelHasPermissions)
    .innerJoin(permissions, eq(permissions.id, modelHasPermissions.permissionId))
    .where(and(eq(modelHasPermissions.modelType, STAFF_MODEL), eq(permissions.name, permission), eq(permissions.guardName, "web")));

  const rows = await executor
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt), or(inArray(users.id, viaRole), inArray(users.id, direct))));

  return rows.map((row) => row.id);
}

/** Queues one notification for each staff member. */
export async function notifyStaff(userIds: number[], notification: StaffNotificationName, subjectId: number, extraId?: number): Promise<void> {
  for (const userId of userIds) {
    await dispatch("notify-staff", { notification, userId, subjectId, extraId });
  }
}

/** A Filament database notification with one link button, exactly as Filament stores it. */
export function filamentMessage(title: string, body: string, action: { label: string; url: string }) {
  return {
    body,
    icon: null,
    view: null,
    color: null,
    title,
    format: "filament",
    status: null,
    actions: [
      {
        url: action.url,
        icon: null,
        name: "view",
        size: "sm",
        view: "filament::components.link",
        color: null,
        event: null,
        label: action.label,
        tooltip: null,
        iconSize: null,
        eventData: [],
        isDisabled: false,
        isOutlined: false,
        shouldClose: false,
        iconPosition: "before",
        extraAttributes: [],
        shouldPostToUrl: false,
        shouldMarkAsRead: false,
        dispatchDirection: false,
        alpineClickHandler: null,
        shouldMarkAsUnread: false,
        dispatchToComponent: null,
        shouldOpenUrlInNewTab: false,
      },
    ],
    duration: "persistent",
    viewData: [],
    iconColor: null,
    iconSize: null,
  };
}

/** Laravel's Str::limit($value, $limit): cut and end with "..." when longer. */
export function limitText(value: string, limit: number): string {
  const characters = [...value];

  return characters.length <= limit ? value : `${characters.slice(0, limit).join("").trimEnd()}...`;
}

/** The message for one notification, from the subject as it is now; null when the subject is gone. */
async function staffMessage(notification: StaffNotificationName, subjectId: number, extraId?: number) {
  switch (notification) {
    case "NewOrderAtBranch": {
      const [order] = await db.select().from(orders).where(eq(orders.id, subjectId)).limit(1);

      return order
        ? filamentMessage("Pesanan baru", `#${order.number} — ${rupiah(order.grandTotal)}`, { label: "Lihat Pesanan", url: appUrl(`/admin/pesanan/${order.id}`) })
        : null;
    }
    case "PickupDeadlineApproaching": {
      const [order] = await db.select().from(orders).where(eq(orders.id, subjectId)).limit(1);

      return order
        ? filamentMessage("Batas ambil mendekat", `#${order.number} belum diambil, berlaku sampai ${indonesianDate(order.pickupCodeExpiresAt, true) ?? ""}`, {
            label: "Lihat Pengambilan",
            url: appUrl("/admin/pengambilan"),
          })
        : null;
    }
    case "LowStock": {
      const [row] = await db
        .select({ stock: branchStocks, productName: products.name })
        .from(branchStocks)
        .innerJoin(products, eq(products.id, branchStocks.productId))
        .where(eq(branchStocks.id, subjectId))
        .limit(1);

      return row
        ? filamentMessage(
            "Stok menipis",
            `${row.productName}: tersisa ${Math.max(row.stock.quantity - row.stock.reservedQuantity, 0)} (batas ${row.stock.reorderPoint})`,
            { label: "Lihat Stok", url: appUrl("/admin/inventaris/stok") },
          )
        : null;
    }
    case "ExpiringProduct": {
      const [row] = await db
        .select({ batch: inventoryBatches, productName: products.name })
        .from(inventoryBatches)
        .innerJoin(products, eq(products.id, inventoryBatches.productId))
        .where(eq(inventoryBatches.id, subjectId))
        .limit(1);

      return row
        ? filamentMessage(
            "Batch mendekati kedaluwarsa",
            `${row.productName} (batch ${row.batch.batchNumber}): kedaluwarsa ${indonesianDate(new Date(`${row.batch.expiresAt}T00:00:00+07:00`))}, sisa ${row.batch.quantity}`,
            { label: "Lihat Stok", url: appUrl("/admin/inventaris/stok") },
          )
        : null;
    }
    case "NewChatMessage": {
      const [[conversation], [message]] = await Promise.all([
        db.select().from(chatConversations).where(eq(chatConversations.id, subjectId)).limit(1),
        db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.id, extraId ?? 0))
          .limit(1),
      ]);

      return conversation && message
        ? filamentMessage(`Pesan baru dari ${conversation.name}`, limitText(message.body, 120), {
            label: "Buka Inbox",
            url: appUrl(`/admin/inbox/${conversation.id}`),
          })
        : null;
    }
  }
}

/** The queued job: writes the notification for one staff member. */
export async function sendStaffNotification(payload: { notification: StaffNotificationName; userId: number; subjectId: number; extraId?: number }) {
  const data = await staffMessage(payload.notification, payload.subjectId, payload.extraId);

  if (!data) {
    return;
  }

  const now = new Date();

  await db.insert(notifications).values({
    id: randomUUID(),
    type: `App\\Notifications\\Admin\\${payload.notification}`,
    notifiableType: STAFF_MODEL,
    notifiableId: payload.userId,
    data,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

/** Unread admin notifications of one staff member, newest first (for tests and the admin later). */
export async function unreadStaffNotifications(userId: number) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.notifiableType, STAFF_MODEL), eq(notifications.notifiableId, userId), isNull(notifications.readAt)))
    .orderBy(sql`${notifications.createdAt} desc`);
}
