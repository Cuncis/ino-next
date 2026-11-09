import { authorizes, can, uploadTypes, type StaffAccess } from "@/lib/permissions";
import { withSniffedTypes } from "@/lib/sniff-mime";
import { validationErrorResponse } from "@/lib/validation";
import { adminActionContext, bulkOutcomeJson, eachRecord, idsFrom, toastJson } from "./action-response";
import {
  BRANCH_PERMISSIONS,
  branchInUse,
  createBranch,
  existingBranchIds,
  findBranch,
  forceDeleteBranch,
  restoreBranch,
  softDeleteBranch,
  updateBranch,
  validateBranchForm,
  validateBranchPhoto,
} from "./branches";
import { formBody } from "./form-body";
import { createRole, deleteRole, findRole, roleHolderCount, savePermissionMatrix, updateRole, validateRoleForm } from "./roles";
import {
  createStaffAccount,
  existingStaffIds,
  findStaffAccount,
  forceDeleteStaff,
  restoreStaff,
  softDeleteStaff,
  updateStaffAccount,
  validateStaffForm,
} from "./staff-accounts";

/**
 * Cabang, Staf, Peran and Hak Akses behind /admin/{cabang|staf|peran|hak-akses}/…. Staf
 * has no policy in Laravel: seeing it (Pengaturan:Ubah) allows every action on it.
 */
const notFound = () => Response.json({ message: "Not Found" }, { status: 404 });

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif"];

const RULES = {
  cabang: { view: (access: StaffAccess) => authorizes(access, BRANCH_PERMISSIONS, "viewAny"), create: (access: StaffAccess) => authorizes(access, BRANCH_PERMISSIONS, "create"), update: (access: StaffAccess) => authorizes(access, BRANCH_PERMISSIONS, "update"), delete: (access: StaffAccess) => authorizes(access, BRANCH_PERMISSIONS, "delete") },
  staf: { view: (access: StaffAccess) => can(access, "Pengaturan:Ubah"), create: (access: StaffAccess) => can(access, "Pengaturan:Ubah"), update: (access: StaffAccess) => can(access, "Pengaturan:Ubah"), delete: (access: StaffAccess) => can(access, "Pengaturan:Ubah") },
  peran: {
    view: (access: StaffAccess) => can(access, "Peran:Lihat"),
    create: (access: StaffAccess) => can(access, "Peran:Lihat") && can(access, "Peran:Ubah"),
    update: (access: StaffAccess) => can(access, "Peran:Lihat") && can(access, "Peran:Ubah"),
    delete: (access: StaffAccess) => can(access, "Peran:Lihat") && can(access, "Peran:Ubah"),
  },
};

export type AccessSlug = keyof typeof RULES;

/** POST /admin/{slug}/buat: then the new record's edit page. */
export async function createAccessAction(request: Request, slug: AccessSlug): Promise<Response> {
  const { staff, access, locale, response } = await adminActionContext(request, RULES[slug].create);

  if (response) {
    return response;
  }

  const body = await formBody(request);
  const { data } = body;
  // a photo is checked and named by what it is (finfo), not by the browser's word
  const files = await withSniffedTypes(body.files);
  let id: number;

  if (slug === "cabang") {
    const [photo] = files.photo_path ?? [];
    const result = validateBranchForm(data, locale);
    const photoError = validateBranchPhoto(photo, uploadTypes(access, IMAGE_TYPES), locale);
    const errors = { ...(result.errors ?? {}), ...(photoError ? { photo_path: [photoError] } : {}) };

    if (Object.keys(errors).length || !result.data) {
      return validationErrorResponse(errors);
    }

    id = (await createBranch(result.data, photo)).id;
  } else if (slug === "staf") {
    const result = await validateStaffForm(data, locale, null);

    if (result.errors) {
      return validationErrorResponse(result.errors);
    }

    id = (await createStaffAccount(result.data, staff)).id;
  } else {
    const result = await validateRoleForm(data, locale, null);

    if (result.errors) {
      return validationErrorResponse(result.errors);
    }

    id = (await createRole(result.data, staff)).id;
  }

  return toastJson(locale, { status: "success", title: "Data berhasil dibuat" }, { redirect: data.another ? `/admin/${slug}/create` : `/admin/${slug}/${id}/edit` });
}

/** POST /admin/{slug}/{id}/simpan. */
export async function updateAccessAction(request: Request, slug: AccessSlug, id: string): Promise<Response> {
  const { staff, access, locale, response } = await adminActionContext(request, RULES[slug].update);

  if (response) {
    return response;
  }

  const body = await formBody(request);
  const { data } = body;
  // a photo is checked and named by what it is (finfo), not by the browser's word
  const files = await withSniffedTypes(body.files);

  if (slug === "cabang") {
    const branch = await findBranch(Number(id));

    if (!branch) {
      return notFound();
    }

    const [photo] = files.photo_path ?? [];
    const result = validateBranchForm(data, locale);
    const photoError = validateBranchPhoto(photo, uploadTypes(access, IMAGE_TYPES), locale);
    const errors = { ...(result.errors ?? {}), ...(photoError ? { photo_path: [photoError] } : {}) };

    if (Object.keys(errors).length || !result.data) {
      return validationErrorResponse(errors);
    }

    await updateBranch(branch, result.data, { file: photo, removed: data.photo_path_removed === "1" });
  } else if (slug === "staf") {
    const account = await findStaffAccount(Number(id));

    if (!account) {
      return notFound();
    }

    const result = await validateStaffForm(data, locale, account.id);

    if (result.errors) {
      return validationErrorResponse(result.errors);
    }

    await updateStaffAccount(account, result.data, staff);
  } else {
    const role = await findRole(Number(id));

    if (!role) {
      return notFound();
    }

    const result = await validateRoleForm(data, locale, role.id);

    if (result.errors) {
      return validationErrorResponse(result.errors);
    }

    await updateRole(role, result.data, staff);
  }

  return toastJson(locale, { status: "success", title: "Data berhasil disimpan" });
}

/** POST /admin/{slug}/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function accessOperationAction(request: Request, slug: AccessSlug, id: string, operation: string): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, RULES[slug].delete);

  if (response) {
    return response;
  }

  const toList = (await formBody(request)).data.back === "list" ? { redirect: `/admin/${slug}` } : {};
  const done = () => toastJson(locale, { status: "success", title: "Data berhasil dihapus" }, toList);

  if (slug === "peran") {
    const role = await findRole(Number(id));

    if (!role || operation !== "hapus") {
      return notFound();
    }

    const holders = await roleHolderCount(role.id);

    if (holders > 0) {
      return toastJson(locale, { status: "danger", title: 'Peran ":name" masih dipakai :count staf dan tidak bisa dihapus.', replace: { name: role.name, count: holders } });
    }

    await deleteRole(role, staff);

    return done();
  }

  const record = slug === "cabang" ? await findBranch(Number(id)) : await findStaffAccount(Number(id));

  if (!record) {
    return notFound();
  }

  const store = slug === "cabang" ? { softDelete: softDeleteBranch, restore: restoreBranch, forceDelete: forceDeleteBranch } : { softDelete: softDeleteStaff, restore: restoreStaff, forceDelete: forceDeleteStaff };

  switch (operation) {
    case "hapus":
      if (slug === "cabang" && (await branchInUse(record.id, staff))) {
        return toastJson(locale, { status: "danger", title: '":name" masih punya stok atau riwayat pesanan dan tidak bisa dihapus.', body: "Ubah statusnya menjadi Tutup Permanen.", replace: { name: record.name } });
      }

      if (slug === "staf" && record.id === staff.id) {
        return toastJson(locale, { status: "danger", title: "Anda tidak bisa menghapus akun Anda sendiri." });
      }

      await store.softDelete(record.id);

      return done();
    case "hapus-permanen":
      return (await store.forceDelete(record.id)) ? done() : toastJson(locale, { status: "danger", title: "Gagal menghapus" });
    case "pulihkan":
      await store.restore(record.id);

      return toastJson(locale, { status: "success", title: "Data berhasil dipulihkan" });
    default:
      return notFound();
  }
}

/** POST /admin/{cabang|staf}/massal/{action}: the bulk deletions, with no guards (as in Laravel). */
export async function accessBulkAction(request: Request, slug: "cabang" | "staf", action: string): Promise<Response> {
  const { locale, response } = await adminActionContext(request, RULES[slug].delete);

  if (response) {
    return response;
  }

  const ids = await (slug === "cabang" ? existingBranchIds : existingStaffIds)(idsFrom((await formBody(request)).data));
  const store = slug === "cabang" ? { softDelete: softDeleteBranch, restore: restoreBranch, forceDelete: forceDeleteBranch } : { softDelete: softDeleteStaff, restore: restoreStaff, forceDelete: forceDeleteStaff };

  switch (action) {
    case "hapus":
      return bulkOutcomeJson(locale, "delete", await eachRecord(ids, store.softDelete));
    case "hapus-permanen":
      return bulkOutcomeJson(locale, "forceDelete", await eachRecord(ids, store.forceDelete));
    case "pulihkan":
      return bulkOutcomeJson(locale, "restore", await eachRecord(ids, store.restore));
    default:
      return notFound();
  }
}

/** POST /admin/hak-akses/simpan: "Simpan Perubahan", refused with a notification without Peran:Ubah. */
export async function saveMatrixAction(request: Request): Promise<Response> {
  const { staff, access, locale, response } = await adminActionContext(request, (current) => can(current, "Peran:Lihat"));

  if (response) {
    return response;
  }

  if (!can(access, "Peran:Ubah")) {
    return toastJson(locale, { status: "danger", title: "Anda tidak punya izin untuk mengubah hak akses." });
  }

  const { data } = await formBody(request);
  const grants = typeof data.grants === "object" && data.grants !== null ? (data.grants as Record<string, unknown>) : {};

  await savePermissionMatrix(Object.fromEntries(Object.entries(grants).map(([role, list]) => [role, Array.isArray(list) ? list.map(String) : []])), staff);

  return toastJson(locale, { status: "success", title: "Hak akses berhasil disimpan." });
}
