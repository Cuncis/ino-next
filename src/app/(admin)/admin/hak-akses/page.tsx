import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { can, PERMISSION_GROUPS } from "@/lib/permissions";
import { permissionMatrix } from "@/server/admin/roles";
import { PermissionMatrix } from "@/views/admin/PermissionMatrix";

export const metadata: Metadata = { title: "Hak Akses - Inofarma" };

/** GET /admin/hak-akses: the role × permission grid (Peran:Lihat; saving needs Peran:Ubah). */
export default async function Page() {
  const context = await adminContext((access) => can(access, "Peran:Lihat"));
  const { t } = context;

  return (
    <AdminShell context={context} pathname="/admin/hak-akses">
      <PermissionMatrix
        roles={(await permissionMatrix()).map((role) => ({ name: role.name, granted: role.granted }))}
        groups={Object.entries(PERMISSION_GROUPS).map(([module, abilities]) => ({ module, label: t(module), abilities: abilities.map((ability) => ({ ability, label: t(ability) })) }))}
        labels={{ heading: t("Hak Akses"), save: t("Simpan Perubahan"), column: t("Modul & Aksi") }}
      />
    </AdminShell>
  );
}
