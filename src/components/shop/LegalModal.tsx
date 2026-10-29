import { useEffect, useRef, useState } from 'react';
import { legalDocumentTitles, type LegalDocumentKey } from './legalDocuments';

/**
 * Kebijakan Privasi and Syarat & Ketentuan as a popup, so a shopper in the
 * middle of checkout can read them without leaving the form. The text is
 * edited in the admin (Konten Website) and fetched when the popup opens, so
 * pages don't carry it until someone asks to read it.
 */
export default function LegalModal({ document: key, onClose }: {
    document: LegalDocumentKey;
    onClose: () => void;
}) {
    const [legal, setLegal] = useState<LegalDocument | null>(null);
    const [failed, setFailed] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;

        fetch(`/konten/dokumen/${key}`, { headers: { Accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : Promise.reject(response)))
            .then((document: LegalDocument) => ! cancelled && setLegal(document))
            .catch(() => ! cancelled && setFailed(true));

        return () => {
            cancelled = true;
        };
    }, [key]);

    useEffect(() => {
        dialogRef.current?.focus();

        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-shop"
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="legal-modal-title"
                tabIndex={-1}
                className="flex max-h-[85vh] w-full max-w-[640px] flex-col rounded-2xl bg-white shadow-xl focus:outline-none"
            >
                <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-5 py-4">
                    <h2 id="legal-modal-title" className="text-[17px] font-bold">{legal?.title ?? legalDocumentTitles[key]}</h2>
                    <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#707070] hover:bg-[#f5f5f5]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 text-[13.5px] leading-6 text-[#333]">
                    {! legal ? (
                        <p role="status" className="py-8 text-center text-[#707070]">
                            {failed ? 'Dokumen gagal dimuat. Tutup lalu coba buka lagi.' : 'Memuat…'}
                        </p>
                    ) : null}

                    {legal?.sections.map((section) => (
                        <section key={section.title} className="mb-5">
                            <h3 className="mb-2 text-[15px] font-bold text-[#232323]">{section.title}</h3>
                            {section.clauses.map((clause) => (
                                <div key={clause.number} className="mb-2.5">
                                    <p>
                                        <span className="mr-1.5 font-semibold">{clause.number}</span>
                                        {clause.text}
                                    </p>
                                    {clause.items.length > 0 ? (
                                        <ul className="mt-1.5 list-disc space-y-1 pl-9">
                                            {clause.items.map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                    ) : null}
                                </div>
                            ))}
                        </section>
                    ))}

                    {legal ? (
                        <>
                            <p className="mb-2">{legal.contactHeading}</p>
                            <address className="not-italic">
                                <p>{legal.company.email}</p>
                                <p>{legal.company.phone}</p>
                                <p className="mt-3 font-semibold">{legal.company.name}</p>
                                <p>{legal.company.address}</p>
                            </address>

                            <p className="mt-5 text-[12px] text-[#707070]">Terakhir diperbarui: {legal.updatedAt}</p>
                        </>
                    ) : null}
                </div>

                <div className="border-t border-[#e5e5e5] px-5 py-3">
                    <button type="button" onClick={onClose} className="w-full rounded-[10px] bg-[#1773b0] py-3 text-[14px] font-semibold text-white">
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
