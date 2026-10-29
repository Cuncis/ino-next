import { legalDocumentForStorefront } from "@/server/shop/content/documents";

/**
 * Syarat & Ketentuan and Kebijakan Privasi as JSON, loaded by the popup
 * (components/shop/LegalModal.tsx) when it opens. Only the two legal documents.
 */
export async function GET(_request: Request, { params }: RouteContext<"/konten/dokumen/[document]">) {
  const { document } = await params;

  if (document !== "terms" && document !== "privacy") {
    return Response.json({ message: "Not Found" }, { status: 404 });
  }

  return Response.json(await legalDocumentForStorefront(document));
}
