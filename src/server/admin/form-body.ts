import { jsonBody } from "@/lib/http";

/**
 * An admin form's body: JSON, or multipart with the fields as JSON in `data` and the
 * files under their field names (ResourceForm and ActionForm send it this way).
 */
export async function formBody(request: Request): Promise<{ data: Record<string, unknown>; files: Record<string, File[]> }> {
  if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return { data: await jsonBody(request), files: {} };
  }

  const form = await request.formData();
  const files: Record<string, File[]> = {};
  let data: Record<string, unknown> = {};

  for (const [name, value] of form.entries()) {
    if (name === "data" && typeof value === "string") {
      try {
        const parsed: unknown = JSON.parse(value);

        data = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
      } catch {
        data = {};
      }
    } else if (typeof value !== "string") {
      (files[name] ??= []).push(value);
    }
  }

  return { data, files };
}

export async function fileBuffers(files: File[] | undefined): Promise<Buffer[]> {
  return Promise.all((files ?? []).map(async (file) => Buffer.from(await file.arrayBuffer())));
}
