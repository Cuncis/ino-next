import { and, eq } from "drizzle-orm";
import {
  db,
  modelHasPermissions,
  modelHasRoles,
  permissions,
  roleHasPermissions,
  roles,
  type DbExecutor,
} from "@/db";

/**
 * Staff roles and permissions, read from the spatie/laravel-permission tables the
 * Laravel app writes (`roles`, `permissions`, `model_has_roles`, `role_has_permissions`,
 * `model_has_permissions`). Ported from App\Support\PermissionCatalog,
 * App\Support\Auth\SuperAdmin and App\Support\Auth\AuthorizesByPermission.
 *
 * Staff only: customers have no roles or permissions.
 */

/**
 * The single list of permissions the admin's Peran/Hak Akses screens render: one
 * flat "Module:Ability" string per permission.
 */
export const PERMISSION_GROUPS = {
  Produk: ["Lihat", "Tambah", "Ubah", "Hapus"],
  Pesanan: ["Lihat", "Proses", "Batalkan", "Refund"],
  Pelanggan: ["Lihat", "Tambah", "Ubah", "Hapus"],
  Inventaris: ["Lihat", "Sesuaikan Stok", "Terima Barang"],
  Cabang: ["Lihat", "Tambah", "Ubah", "Hapus"],
  Inbox: ["Lihat", "Balas"],
  Media: ["Lihat", "Unggah", "Hapus"],
  Konten: ["Lihat", "Ubah"],
  Laporan: ["Lihat", "Ekspor"],
  Pengaturan: ["Lihat", "Ubah"],
  Peran: ["Lihat", "Ubah"],
} as const;

export function allPermissions(): string[] {
  return Object.entries(PERMISSION_GROUPS).flatMap(([module, abilities]) => abilities.map((ability) => `${module}:${ability}`));
}

/** Reserved for this role itself; no permission in Hak Akses can grant it to another role. */
export const SUPER_ADMIN_ROLE = "Super Admin";

/** An SVG can carry a script that runs when its URL is opened on this domain. */
export const SVG_TYPE = "image/svg+xml";

/** How spatie/laravel-permission identifies a staff member in its pivot tables. */
const STAFF_MODEL_TYPE = "App\\Models\\User";

/** Laravel's `web` guard, which every staff role and permission belongs to. */
const STAFF_GUARD = "web";

export type StaffAccess = {
  roles: string[];
  permissions: Set<string>;
};

/** One staff member's roles and every permission they hold, through a role or granted directly. */
export async function loadStaffAccess(userId: number, executor: DbExecutor = db): Promise<StaffAccess> {
  // One after another, not Promise.all: a transaction runs on a single connection
  const roleRows = await executor
    .select({ name: roles.name })
    .from(modelHasRoles)
    .innerJoin(roles, eq(roles.id, modelHasRoles.roleId))
    .where(and(eq(modelHasRoles.modelType, STAFF_MODEL_TYPE), eq(modelHasRoles.modelId, userId), eq(roles.guardName, STAFF_GUARD)));
  const rolePermissionRows = await executor
    .select({ name: permissions.name })
    .from(modelHasRoles)
    .innerJoin(roleHasPermissions, eq(roleHasPermissions.roleId, modelHasRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, roleHasPermissions.permissionId))
    .where(and(eq(modelHasRoles.modelType, STAFF_MODEL_TYPE), eq(modelHasRoles.modelId, userId), eq(permissions.guardName, STAFF_GUARD)));
  const directPermissionRows = await executor
    .select({ name: permissions.name })
    .from(modelHasPermissions)
    .innerJoin(permissions, eq(permissions.id, modelHasPermissions.permissionId))
    .where(
      and(eq(modelHasPermissions.modelType, STAFF_MODEL_TYPE), eq(modelHasPermissions.modelId, userId), eq(permissions.guardName, STAFF_GUARD)),
    );

  return {
    roles: roleRows.map((row) => row.name),
    permissions: new Set([...rolePermissionRows, ...directPermissionRows].map((row) => row.name)),
  };
}

export function isSuperAdmin(access: StaffAccess): boolean {
  return access.roles.includes(SUPER_ADMIN_ROLE);
}

/** `$user->can('Module:Ability')`: Super Admin passes every check (Laravel's Gate::before). */
export function can(access: StaffAccess, permission: string): boolean {
  return isSuperAdmin(access) || access.permissions.has(permission);
}

/**
 * The upload types this staff member may use: SVG is dropped for everyone but
 * Super Admin. SVGs already uploaded stay where they are.
 */
export function uploadTypes(access: StaffAccess, types: string[]): string[] {
  return isSuperAdmin(access) ? types : types.filter((type) => type !== SVG_TYPE);
}

/**
 * The permission each admin screen action needs, per resource. `viewAny` also gates
 * `view`; `create`, `update` and `delete` cover their bulk, force and restore variants.
 * An action missing from the map is denied. An action mapped to SUPER_ADMIN_ROLE is
 * for that role alone, whatever Hak Akses grants.
 */
export type ResourcePermissions = {
  viewAny: string;
  create?: string;
  update?: string;
  delete?: string;
};

export type ResourceAction =
  | "viewAny"
  | "view"
  | "create"
  | "replicate"
  | "update"
  | "reorder"
  | "delete"
  | "deleteAny"
  | "forceDelete"
  | "forceDeleteAny"
  | "restore"
  | "restoreAny";

export function permissionFor(map: ResourcePermissions, action: ResourceAction): string | null {
  switch (action) {
    case "viewAny":
    case "view":
      return map.viewAny;
    case "create":
    case "replicate":
      return map.create ?? null;
    case "update":
    case "reorder":
      return map.update ?? null;
    default:
      return map.delete ?? null;
  }
}

/** Whether a staff member may take an action on a resource. Ported from AuthorizesByPermission. */
export function authorizes(access: StaffAccess, map: ResourcePermissions, action: ResourceAction): boolean {
  const permission = permissionFor(map, action);

  if (permission === null) {
    return false;
  }

  if (permission === SUPER_ADMIN_ROLE) {
    return isSuperAdmin(access);
  }

  return can(access, permission);
}
