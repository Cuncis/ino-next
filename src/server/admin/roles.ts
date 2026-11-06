import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import { db, modelHasRoles, permissions, roleHasPermissions, roles, users } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { allPermissions } from "@/lib/permissions";
import { addError, uniqueMessage, validate, type ValidationErrors } from "@/lib/validation";
import { auditLog } from "@/server/audit";
import { searchWords } from "./list-query";
import type { Staff } from "./staff-auth";

/**
 * Peran (RoleResource) and the Hak Akses grid (PermissionMatrix). Peran:Lihat to see
 * them, Peran:Ubah for everything else. A role still held by staff isn't deleted.
 */
const STAFF_MODEL = "App\\Models\\User";

export type Role = typeof roles.$inferSelect;

/** The staff holding the role: `users()`, which leaves deleted accounts out. */
const holders = (roleId: ReturnType<typeof sql>) =>
  sql<string>`(select count(*) from ${modelHasRoles} join ${users} on ${users.id} = ${modelHasRoles.modelId} and ${users.deletedAt} is null where ${modelHasRoles.roleId} = ${roleId} and ${modelHasRoles.modelType} = ${STAFF_MODEL})`;

export async function listRoles(query: { search?: string; page: number; perPage: number }) {
  const where = searchWords(query.search, [sql`${roles.name}`]);
  const [{ total }] = await db.select({ total: count() }).from(roles).where(where);
  const rows = await db
    .select({
      role: roles,
      users: holders(sql`${roles.id}`),
      permissions: sql<string>`(select count(*) from ${roleHasPermissions} where ${roleHasPermissions.roleId} = ${roles.id})`,
    })
    .from(roles)
    .where(where)
    .orderBy(asc(roles.name), asc(roles.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.role, usersCount: Number(row.users), permissionsCount: Number(row.permissions) })) };
}

export async function findRole(id: number): Promise<Role | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);

  return row ?? null;
}

export async function roleHolderCount(id: number): Promise<number> {
  const [row] = await db.select({ total: holders(sql`${id}`) }).from(roles).where(eq(roles.id, id));

  return Number(row?.total ?? 0);
}

/** The checkboxes of the role form: every permission, by name. */
export async function permissionOptions() {
  const rows = await db.select({ id: permissions.id, name: permissions.name }).from(permissions).orderBy(asc(permissions.name));

  return rows.map((row) => ({ value: String(row.id), label: row.name }));
}

export async function rolePermissionIds(id: number): Promise<string[]> {
  const rows = await db.select({ id: roleHasPermissions.permissionId }).from(roleHasPermissions).where(eq(roleHasPermissions.roleId, id)).orderBy(asc(roleHasPermissions.permissionId));

  return rows.map((row) => String(row.id));
}

export type RoleFormData = { name: string; description: string | null; permissionIds: number[] };

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));

/** RoleForm's rules; the name must be free among the roles. */
export async function validateRoleForm(body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null): Promise<{ data: RoleFormData; errors: null } | { data: null; errors: ValidationErrors }> {
  const t = (label: string) => lcfirst(translate(locale, label));
  let errors = validate<Record<string, unknown>>(body, { name: ["required", "max:100"], description: ["nullable", "max:255"] }, {}, { name: t("Nama"), description: t("Deskripsi") }, locale).errors;

  if (!errors?.name) {
    const [taken] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.name, text(body.name)), ignoreId ? ne(roles.id, ignoreId) : undefined))
      .limit(1);

    if (taken) {
      errors = addError(errors, "name", uniqueMessage("field", { field: t("Nama") }));
    }
  }

  if (errors) {
    return { data: null, errors };
  }

  const known = new Set((await db.select({ id: permissions.id }).from(permissions)).map((row) => row.id));
  const permissionIds = (Array.isArray(body.permissions) ? body.permissions : []).map(Number).filter((id) => known.has(id));

  return { data: { name: text(body.name), description: text(body.description) === "" ? null : text(body.description), permissionIds: [...new Set(permissionIds)] }, errors: null };
}

type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** BelongsToMany::sync(): only the permissions that changed are detached or attached. */
async function syncPermissionIds(executor: Executor, roleId: number, permissionIds: number[]) {
  const current = (await executor.select({ id: roleHasPermissions.permissionId }).from(roleHasPermissions).where(eq(roleHasPermissions.roleId, roleId))).map((row) => row.id);
  const detach = current.filter((id) => !permissionIds.includes(id));
  const attach = permissionIds.filter((id) => !current.includes(id));

  if (detach.length) {
    await executor.delete(roleHasPermissions).where(and(eq(roleHasPermissions.roleId, roleId), inArray(roleHasPermissions.permissionId, detach)));
  }

  if (attach.length) {
    await executor.insert(roleHasPermissions).values(attach.map((permissionId) => ({ roleId, permissionId })));
  }
}

/** The role's permission names for the audit entry (`permissions()->pluck('name')`). */
async function permissionNamesOf(roleId: number): Promise<string[]> {
  const rows = await db
    .select({ name: permissions.name })
    .from(roleHasPermissions)
    .innerJoin(permissions, eq(permissions.id, roleHasPermissions.permissionId))
    .where(eq(roleHasPermissions.roleId, roleId))
    .orderBy(asc(permissions.id));

  return rows.map((row) => row.name);
}

/** CreateRole (always on the `web` guard), then "role_created". */
export async function createRole(data: RoleFormData, actor: Staff): Promise<Role> {
  const now = new Date();
  const role = await db.transaction(async (tx) => {
    const [created] = await tx.insert(roles).values({ name: data.name, description: data.description, guardName: "web", createdAt: now, updatedAt: now }).returning();

    await syncPermissionIds(tx, created.id, data.permissionIds);

    return created;
  });

  await auditLog({ action: "role_created", auditable: { type: "App\\Models\\Role", id: role.id }, newValues: { name: role.name, permissions: await permissionNamesOf(role.id) }, userId: actor.id, branchId: actor.branchId });

  return role;
}

/** EditRole, then "role_updated" every time. */
export async function updateRole(role: Role, data: RoleFormData, actor: Staff): Promise<void> {
  await db.transaction(async (tx) => {
    if (role.name !== data.name || role.description !== data.description) {
      await tx.update(roles).set({ name: data.name, description: data.description, updatedAt: new Date() }).where(eq(roles.id, role.id));
    }

    await syncPermissionIds(tx, role.id, data.permissionIds);
  });

  await auditLog({ action: "role_updated", auditable: { type: "App\\Models\\Role", id: role.id }, newValues: { name: data.name, permissions: await permissionNamesOf(role.id) }, userId: actor.id, branchId: actor.branchId });
}

/** DeleteAction, then "role_deleted" (the auditable falls back to the actor, as AuditLogger does). */
export async function deleteRole(role: Role, actor: Staff): Promise<void> {
  await db.delete(roles).where(eq(roles.id, role.id));
  await auditLog({ action: "role_deleted", auditable: { type: STAFF_MODEL, id: actor.id }, oldValues: { name: role.name }, userId: actor.id, branchId: actor.branchId });
}

/* ---------------- Hak Akses ---------------- */

/** Every role (by name) with the catalogue permissions it holds. */
export async function permissionMatrix(): Promise<{ id: number; name: string; granted: string[] }[]> {
  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.name));
  const grants = await db
    .select({ roleId: roleHasPermissions.roleId, name: permissions.name })
    .from(roleHasPermissions)
    .innerJoin(permissions, eq(permissions.id, roleHasPermissions.permissionId));
  const catalog = new Set(allPermissions());

  return allRoles.map((role) => ({ ...role, granted: grants.filter((grant) => grant.roleId === role.id && catalog.has(grant.name)).map((grant) => grant.name) }));
}

/**
 * PermissionMatrix::save(): every role's permissions replaced by its ticked boxes
 * (`syncPermissions()`, which only knows the catalogue's permissions), in one transaction.
 */
export async function savePermissionMatrix(grants: Record<string, string[]>, actor: Staff): Promise<void> {
  const catalog = new Map((await db.select({ id: permissions.id, name: permissions.name }).from(permissions).where(eq(permissions.guardName, "web"))).map((row) => [row.name, row.id]));
  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.name));

  await db.transaction(async (tx) => {
    for (const role of allRoles) {
      const wanted = (grants[role.name] ?? []).filter((name) => allPermissions().includes(name)).map((name) => catalog.get(name)).filter((id): id is number => id !== undefined);

      await syncPermissionIds(tx, role.id, wanted);
    }
  });

  await auditLog({ action: "permissions_matrix_updated", auditable: { type: STAFF_MODEL, id: actor.id }, userId: actor.id, branchId: actor.branchId });
}
