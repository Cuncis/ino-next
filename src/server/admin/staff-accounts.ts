import { and, asc, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { branches, db, modelHasRoles, roles, users } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { hashLaravelPassword } from "@/lib/password";
import { addError, uniqueMessage, validate, type ValidationErrors } from "@/lib/validation";
import { auditLog } from "@/server/audit";
import { branchOptions } from "./branches";
import { searchWords, trashedCondition } from "./list-query";
import type { Staff } from "./staff-auth";

/**
 * Staf (StaffResource): staff accounts, each with a branch (none means pusat) and roles.
 * Laravel's resource only guards the list (Pengaturan:Ubah) and has no policy, so whoever
 * can see Staf can also create, edit and delete; that is kept. No one deletes themself.
 */
const STAFF_MODEL = "App\\Models\\User";

export type StaffAccount = typeof users.$inferSelect;

export async function listStaff(query: { search?: string; trashed?: string; page: number; perPage: number }) {
  const where = and(trashedCondition(users.deletedAt, query.trashed), searchWords(query.search, [sql`${users.name}`, sql`${users.email}`]));
  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const rows = await db
    .select({ user: users, branchName: branches.name })
    .from(users)
    .leftJoin(branches, eq(branches.id, users.branchId))
    .where(where)
    .orderBy(asc(users.name), asc(users.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);
  const roleNames = await rolesOf(rows.map((row) => row.user.id));

  return {
    total,
    rows: rows.map((row) => ({
      ...row.user,
      branchName: row.branchName,
      roleNames: roleNames.get(row.user.id) ?? [],
      // hasEnabledTwoFactor(): a secret, and a confirmed setup
      twoFactor: row.user.twoFactorSecret !== null && row.user.twoFactorConfirmedAt !== null,
    })),
  };
}

/** Each account's role names, as the pivot lists them. */
async function rolesOf(ids: number[]) {
  const found = new Map<number, string[]>();

  if (!ids.length) {
    return found;
  }

  const rows = await db
    .select({ userId: modelHasRoles.modelId, name: roles.name })
    .from(modelHasRoles)
    .innerJoin(roles, eq(roles.id, modelHasRoles.roleId))
    .where(and(eq(modelHasRoles.modelType, STAFF_MODEL), inArray(modelHasRoles.modelId, ids)))
    .orderBy(asc(roles.id));

  for (const row of rows) {
    found.set(row.userId, [...(found.get(row.userId) ?? []), row.name]);
  }

  return found;
}

export async function findStaffAccount(id: number): Promise<StaffAccount | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return row ?? null;
}

export async function staffRoleIds(id: number): Promise<string[]> {
  const rows = await db.select({ roleId: modelHasRoles.roleId }).from(modelHasRoles).where(and(eq(modelHasRoles.modelType, STAFF_MODEL), eq(modelHasRoles.modelId, id))).orderBy(asc(modelHasRoles.roleId));

  return rows.map((row) => String(row.roleId));
}

/** The role checkboxes: every role, by name. */
export async function roleOptions() {
  const rows = await db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.name));

  return rows.map((row) => ({ value: String(row.id), label: row.name }));
}

export type StaffFormData = { name: string; email: string; phone: string | null; branchId: number | null; password: string | null; isActive: boolean; roleIds: number[] };

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));

/**
 * StaffForm's rules: the email is free among every account, deleted ones too; a password
 * (8 characters, typed twice) is needed for a new account and, when editing, only
 * changes the old one if filled in.
 */
export async function validateStaffForm(body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null): Promise<{ data: StaffFormData; errors: null } | { data: null; errors: ValidationErrors }> {
  const t = (label: string) => lcfirst(translate(locale, label));
  const creating = ignoreId === null;
  const result = validate<Record<string, unknown>>(
    { ...body, password: text(body.password) === "" ? null : body.password, password_confirmation: text(body.password_confirmation) === "" ? null : body.password_confirmation },
    {
      name: ["required", "max:255"],
      email: ["required", "max:255", "email"],
      phone: ["nullable", "max:30"],
      password: [creating ? "required" : "nullable", "string", "min:8", "confirmed"],
      password_confirmation: [creating ? "required" : "nullable"],
    },
    {},
    { name: t("Nama"), email: t("Email"), phone: t("Telepon"), branch_id: t("Cabang"), password: t("Kata Sandi"), password_confirmation: t("Konfirmasi Kata Sandi") },
    locale,
  );
  let errors = result.errors;

  if (!errors?.email) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, text(body.email)), ignoreId ? ne(users.id, ignoreId) : undefined))
      .limit(1);

    if (taken) {
      errors = addError(errors, "email", uniqueMessage("field", { field: t("Email") }));
    }
  }

  const branchId = text(body.branch_id);

  if (branchId !== "" && !(await branchOptions()).some((option) => option.value === branchId)) {
    errors = addError(errors, "branch_id", locale === "en" ? `The selected ${t("Cabang")} is invalid.` : `Kolom ${t("Cabang")} yang dipilih tidak valid.`);
  }

  if (errors) {
    return { data: null, errors };
  }

  const known = new Set((await db.select({ id: roles.id }).from(roles)).map((row) => row.id));
  const roleIds = (Array.isArray(body.roles) ? body.roles : []).map(Number).filter((id) => known.has(id));

  return {
    data: {
      name: text(body.name),
      email: text(body.email),
      phone: text(body.phone) === "" ? null : text(body.phone),
      branchId: branchId === "" ? null : Number(branchId),
      password: text(body.password) === "" ? null : text(body.password),
      isActive: text(body.is_active) === "1",
      roleIds: [...new Set(roleIds)],
    },
    errors: null,
  };
}

async function syncRoles(executor: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: number, roleIds: number[]) {
  const current = (await executor.select({ roleId: modelHasRoles.roleId }).from(modelHasRoles).where(and(eq(modelHasRoles.modelType, STAFF_MODEL), eq(modelHasRoles.modelId, userId)))).map((row) => row.roleId);
  const detach = current.filter((id) => !roleIds.includes(id));
  const attach = roleIds.filter((id) => !current.includes(id));

  if (detach.length) {
    await executor.delete(modelHasRoles).where(and(eq(modelHasRoles.modelType, STAFF_MODEL), eq(modelHasRoles.modelId, userId), inArray(modelHasRoles.roleId, detach)));
  }

  if (attach.length) {
    await executor.insert(modelHasRoles).values(attach.map((roleId) => ({ roleId, modelType: STAFF_MODEL, modelId: userId })));
  }
}

/** The account's role names for the audit entry (`roles()->pluck('name')`). */
async function roleNamesOf(userId: number): Promise<string[]> {
  return (await rolesOf([userId])).get(userId) ?? [];
}

/** CreateStaff, then its "staff_created" audit entry. */
export async function createStaffAccount(data: StaffFormData, actor: Staff): Promise<StaffAccount> {
  const now = new Date();
  const password = await hashLaravelPassword(data.password ?? "");
  const account = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ name: data.name, email: data.email, phone: data.phone, branchId: data.branchId, isActive: data.isActive, password, createdAt: now, updatedAt: now })
      .returning();

    await syncRoles(tx, created.id, data.roleIds);

    return created;
  });

  await auditLog({ action: "staff_created", auditable: { type: STAFF_MODEL, id: account.id }, newValues: { email: account.email, roles: await roleNamesOf(account.id) }, userId: actor.id, branchId: actor.branchId });

  return account;
}

/** EditStaff: the account (a new password only when one was typed), its roles, and a "staff_updated" entry every time. */
export async function updateStaffAccount(account: StaffAccount, data: StaffFormData, actor: Staff): Promise<void> {
  const next = { name: data.name, email: data.email, phone: data.phone, branchId: data.branchId, isActive: data.isActive };
  const changed = Object.entries(next).some(([key, value]) => account[key as keyof StaffAccount] !== value) || data.password !== null;

  await db.transaction(async (tx) => {
    if (changed) {
      await tx
        .update(users)
        .set({ ...next, ...(data.password !== null ? { password: await hashLaravelPassword(data.password) } : {}), updatedAt: new Date() })
        .where(eq(users.id, account.id));
    }

    await syncRoles(tx, account.id, data.roleIds);
  });

  await auditLog({ action: "staff_updated", auditable: { type: STAFF_MODEL, id: account.id }, newValues: { email: data.email, roles: await roleNamesOf(account.id) }, userId: actor.id, branchId: actor.branchId });
}

export async function softDeleteStaff(id: number): Promise<boolean> {
  await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, id), isNull(users.deletedAt)));

  return true;
}

export async function restoreStaff(id: number): Promise<boolean> {
  await db.update(users).set({ deletedAt: null, updatedAt: new Date() }).where(eq(users.id, id));

  return true;
}

/** Fails (false) while records (orders handled, audit entries…) still point at the account. */
export async function forceDeleteStaff(id: number): Promise<boolean> {
  try {
    await db.delete(users).where(eq(users.id, id));

    return true;
  } catch {
    return false;
  }
}

export async function existingStaffIds(ids: number[]): Promise<number[]> {
  if (!ids.length) {
    return [];
  }

  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids)).orderBy(asc(users.id));

  return rows.map((row) => row.id);
}
