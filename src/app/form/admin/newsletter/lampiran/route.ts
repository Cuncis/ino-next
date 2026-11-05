import { uploadAttachmentAction } from "@/server/admin/newsletter-actions";

/** POST /admin/newsletter/lampiran: an image for the editor. */
export async function POST(request: Request) {
  return uploadAttachmentAction(request);
}
