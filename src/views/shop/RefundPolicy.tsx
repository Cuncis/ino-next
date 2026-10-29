'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';

/**
 * "Kebijakan Pengembalian Dana" (ROADMAP.md Fase 9.1) — proses uang kembali,
 * bukan proses tukar barang (itu ada di Syarat & Ketentuan §7, kebijakan
 * retur obat). Mengikuti mekanisme sungguhan Fase 6: refund dicatat manual
 * oleh admin cabang setelah dana benar-benar ditransfer kembali, karena
 * endpoint refund DOKU sendiri cuma mencakup pembayaran kartu.
 *
 * The text is edited in the admin under Konten Website and arrives as `document`.
 */
export default function RefundPolicy({ document }: { document: ContentDocument }) {
    return (
        <MobileLayout
            title={document.title}
            header={<AppBar title="Pengembalian Dana" back="/profile" tone="brand" />}
        >
            <div className="flex-1 overflow-y-auto p-4">
                {document.sections.map((section, index) => (
                    <div key={`${index}-${section.title}`} className="mb-5">
                        <div className="mb-2.5 border-b border-line pb-2 font-display text-[15px]">
                            {section.title}
                        </div>

                        <div className="space-y-2 text-xs leading-[1.7] text-muted">
                            {section.paragraphs.map((paragraph, paragraphIndex) => (
                                <p key={paragraphIndex}>{paragraph}</p>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </MobileLayout>
    );
}
