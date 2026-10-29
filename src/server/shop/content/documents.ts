import { lines, paragraphs, readContent } from "@/lib/content-store";
import privacyDefaults from "./defaults/document-privacy.json";
import refundDefaults from "./defaults/document-refund.json";
import shippingDefaults from "./defaults/document-shipping.json";
import termsDefaults from "./defaults/document-terms.json";
import privacyPolicy from "./defaults/privacy-policy.json";
import { company } from "./footer";

/**
 * The storefront's document pages, edited under Konten Website: Info Pengiriman and
 * Kebijakan Pengembalian Dana (pages of titled sections), and Syarat & Ketentuan and
 * Kebijakan Privasi (popups of numbered sections and clauses). Until saved, each shows
 * its shipped default. Ported from App\Support\DocumentPageContent.
 *
 * These are compliance texts: when how the shop works changes, update the matching section.
 */
export const DOCUMENTS = ["shipping", "refund", "terms", "privacy"] as const;

/** Documents made of numbered sections and clauses, shown as a popup. */
export const LEGAL_DOCUMENTS = ["terms", "privacy"] as const;

export type DocumentKey = (typeof DOCUMENTS)[number];

type PageDocument = { title: string; sections: { title: string; body: string }[] };
type SavedLegalDocument = {
  title: string;
  contactHeading: string;
  updatedAt: string;
  sections: { title: string; clauses: { text: string; items: string }[] }[];
};

const DEFAULTS: Record<DocumentKey, PageDocument | SavedLegalDocument> = {
  shipping: shippingDefaults,
  refund: refundDefaults,
  terms: termsDefaults,
  privacy: privacyDefaults,
};

export function isDocument(value: string): value is DocumentKey {
  return (DOCUMENTS as readonly string[]).includes(value);
}

export function isLegal(document: string): boolean {
  return (LEGAL_DOCUMENTS as readonly string[]).includes(document);
}

function documentKey(document: DocumentKey): string {
  return `content.document.${document}`;
}

/** Saved content over the defaults, in the shape the admin form edits. */
export async function documentContent(document: DocumentKey): Promise<PageDocument | SavedLegalDocument> {
  const defaults = DEFAULTS[document];
  const read = await readContent(documentKey(document));
  const saved = Object.fromEntries(Object.entries(read).filter(([key]) => key in defaults));

  return { ...defaults, ...saved } as PageDocument | SavedLegalDocument;
}

/** Info Pengiriman or Kebijakan Pengembalian Dana as the storefront renders them: sections split into paragraphs. */
export async function pageDocumentForStorefront(document: "shipping" | "refund"): Promise<ContentDocument> {
  const page = (await documentContent(document)) as PageDocument;

  return {
    title: page.title,
    sections: page.sections.map((section) => ({ title: section.title, paragraphs: paragraphs(section.body) })),
  };
}

/** Syarat & Ketentuan or Kebijakan Privasi: sections and clauses numbered here, plus the company block. */
export async function legalDocumentForStorefront(document: "terms" | "privacy"): Promise<LegalDocument> {
  const legal = (await documentContent(document)) as SavedLegalDocument;

  return {
    title: legal.title,
    sections: legal.sections.map((section, index) => ({
      title: `${index + 1}. ${section.title}`,
      clauses: section.clauses.map((clause, clauseIndex) => ({
        number: `${index + 1}.${clauseIndex + 1}`,
        text: clause.text,
        items: lines(clause.items),
      })),
    })),
    contactHeading: legal.contactHeading,
    updatedAt: legal.updatedAt,
    company: await company(),
  };
}

/**
 * The Kebijakan Privasi page at `/pp`: fixed legal text with its own "Terakhir
 * diperbarui" date, not editable in the admin. Ported from App\Support\PrivacyPolicyContent.
 */
export function privacyPolicyForStorefront(): PrivacyPolicyDocument {
  // the JSON was exported from Laravel's PrivacyPolicyContent, whose blocks are exactly these two kinds
  return privacyPolicy as PrivacyPolicyDocument;
}
