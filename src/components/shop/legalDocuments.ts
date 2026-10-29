/**
 * Syarat & Ketentuan, shown as a popup (`LegalModal`). Its text is edited in
 * the admin under Konten Website and loaded from `/konten/dokumen/{key}` when
 * the popup opens; only the key and the title shown while it loads live here.
 * Kebijakan Privasi used to be a popup too but is now its own page at `/pp`.
 */
export type LegalDocumentKey = 'terms';

export const legalDocumentTitles: Record<LegalDocumentKey, string> = {
    terms: 'Syarat & Ketentuan',
};
