"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postAction } from "@/components/admin/filament/ActionForm";
import { useFiToast } from "@/components/admin/filament/Modal";
import { FiButton, FiPage, FiPageHeader } from "@/components/admin/filament/ui";

/**
 * Hak Akses (PermissionMatrix): every role against every permission of the catalogue,
 * ticked here and saved together with "Simpan Perubahan". The table is the Laravel
 * page's own Blade markup.
 */
export function PermissionMatrix({
  roles,
  groups,
  labels,
}: {
  roles: { name: string; granted: string[] }[];
  groups: { module: string; label: string; abilities: { ability: string; label: string }[] }[];
  labels: { heading: string; save: string; column: string };
}) {
  const router = useRouter();
  const toast = useFiToast();
  const [grants, setGrants] = useState<Record<string, string[]>>(() => Object.fromEntries(roles.map((role) => [role.name, role.granted])));
  const [busy, setBusy] = useState(false);

  const toggle = (role: string, permission: string, on: boolean) =>
    setGrants((current) => ({ ...current, [role]: on ? [...(current[role] ?? []), permission] : (current[role] ?? []).filter((item) => item !== permission) }));

  const save = async () => {
    setBusy(true);

    try {
      const result = await postAction("/admin/hak-akses/simpan", { grants });

      if (result.toast) {
        toast(result.toast);
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FiPage
      header={
        <FiPageHeader
          heading={labels.heading}
          actions={
            <FiButton loading={busy} onClick={() => void save()}>
              {labels.save}
            </FiButton>
          }
        />
      }
    >
      <div className="fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10">
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{labels.column}</th>
                {roles.map((role) => (
                  <th key={role.name} className="whitespace-nowrap px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((group) => [
                <tr key={group.module} className="bg-gray-50 dark:bg-white/5">
                  <td colSpan={roles.length + 1} className="px-5 py-2 text-xs font-bold text-gray-950 dark:text-white">
                    {group.label}
                  </td>
                </tr>,
                ...group.abilities.map((item) => {
                  const permission = `${group.module}:${item.ability}`;

                  return (
                    <tr key={permission} className="border-b border-gray-200 last:border-0 dark:border-white/10">
                      <td className="px-5 py-2.5 text-sm text-gray-700 dark:text-gray-300">{item.label}</td>
                      {roles.map((role) => (
                        <td key={role.name} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${role.name} — ${group.label} ${item.label}`}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-white/20"
                            checked={(grants[role.name] ?? []).includes(permission)}
                            onChange={(event) => toggle(role.name, permission, event.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
      </div>
    </FiPage>
  );
}
