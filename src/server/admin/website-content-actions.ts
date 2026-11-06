import { can, uploadTypes } from "@/lib/permissions";
import { validateEditor } from "@/lib/content-editor";
import { withSniffedTypes } from "@/lib/sniff-mime";
import { validationErrorResponse } from "@/lib/validation";
import { adminActionContext, toastJson } from "./action-response";
import { formBody } from "./form-body";
import { editorMessages, editorSchema, editorState, editorTitle, findEditor, IMAGE_TYPES, invalidUploads, saveEditor, storeUploads } from "./website-content";

/**
 * POST /admin/konten-website/{slug}/simpan: ContentEditorPage::save(), Konten:Ubah only.
 * The answer carries the saved state, which the page shows again (`$this->mount()`).
 */
export async function saveContentAction(request: Request, slug: string): Promise<Response> {
  const editor = findEditor(slug);
  const { staff, access, locale, response } = await adminActionContext(request, (current) => can(current, "Konten:Lihat"));

  if (response) {
    return response;
  }

  if (!editor) {
    return Response.json({ message: "Not Found" }, { status: 404 });
  }

  if (!can(access, "Konten:Ubah")) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await formBody(request);
  const { data } = body;
  // checked and named by what each file is, as Livewire's finfo does, not by the browser's word
  const files = await withSniffedTypes(body.files);
  const state = (typeof data.state === "object" && data.state !== null ? data.state : {}) as Record<string, unknown>;
  const schema = await editorSchema(editor, locale, access);
  const errors = { ...validateEditor(schema, state, editorMessages(locale)), ...invalidUploads(state, files, uploadTypes(access, IMAGE_TYPES)) };

  if (Object.keys(errors).length) {
    return validationErrorResponse(Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]])));
  }

  await saveEditor(editor, (await storeUploads(state, files)) as Record<string, unknown>, staff);

  return toastJson(locale, { status: "success", title: ":page disimpan.", replace: { page: editorTitle(editor, locale) } }, { state: await editorState(editor) });
}
