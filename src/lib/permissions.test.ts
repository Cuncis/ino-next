import { afterAll, describe, expect, it } from "vitest";
import { db, modelHasRoles, roles, users } from "@/db";
import { withRollback } from "@/test/db";
import { allPermissions, authorizes, can, loadStaffAccess, uploadTypes, type StaffAccess } from "./permissions";

afterAll(() => db.$client.end());

const kasir: StaffAccess = { roles: ["Kasir"], permissions: new Set(["Pesanan:Lihat", "Produk:Lihat"]) };
const superAdmin: StaffAccess = { roles: ["Super Admin"], permissions: new Set() };

describe("permission checks", () => {
  it("lists the 32 Module:Ability permissions", () => {
    expect(allPermissions()).toHaveLength(32);
    expect(allPermissions()).toContain("Inventaris:Sesuaikan Stok");
  });

  it("lets Super Admin through every check", () => {
    expect(can(superAdmin, "Peran:Ubah")).toBe(true);
    expect(can(kasir, "Peran:Ubah")).toBe(false);
    expect(can(kasir, "Pesanan:Lihat")).toBe(true);
  });

  it("denies an action missing from a resource's map, and reserves SUPER_ADMIN_ROLE actions", () => {
    const coupons = { viewAny: "Super Admin", create: "Super Admin", update: "Super Admin", delete: "Super Admin" };
    const orders = { viewAny: "Pesanan:Lihat", create: "Pesanan:Proses", update: "Pesanan:Proses", delete: "Super Admin" };
    const readOnly = { viewAny: "Produk:Lihat" };

    expect(authorizes(kasir, coupons, "viewAny")).toBe(false);
    expect(authorizes(superAdmin, coupons, "create")).toBe(true);
    expect(authorizes(kasir, orders, "view")).toBe(true);
    expect(authorizes(kasir, orders, "update")).toBe(false);
    expect(authorizes(kasir, orders, "forceDelete")).toBe(false);
    expect(authorizes(kasir, readOnly, "restoreAny")).toBe(false);
    expect(authorizes(superAdmin, readOnly, "delete")).toBe(false);
  });

  it("keeps SVG uploads for Super Admin only", () => {
    const types = ["image/png", "image/svg+xml"];

    expect(uploadTypes(kasir, types)).toEqual(["image/png"]);
    expect(uploadTypes(superAdmin, types)).toEqual(types);
  });
});

describe("loadStaffAccess", () => {
  it("reads a staff member's roles and their permissions from the spatie tables", async () => {
    await withRollback(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: "Tes Kasir", email: "zz-test-kasir@example.com", password: "x" })
        .returning({ id: users.id });
      const [role] = await tx.select({ id: roles.id }).from(roles).where((await import("drizzle-orm")).eq(roles.name, "Kasir"));

      await tx.insert(modelHasRoles).values({ roleId: role.id, modelType: "App\\Models\\User", modelId: user.id });

      const access = await loadStaffAccess(user.id, tx);

      expect(access.roles).toEqual(["Kasir"]);
      expect(access.permissions.size).toBe(5);
      expect(access.permissions.has("Peran:Ubah")).toBe(false);
    });
  });

  it("gives a staff member with no role nothing", async () => {
    expect(await loadStaffAccess(999_999_999)).toEqual({ roles: [], permissions: new Set() });
  });
});
