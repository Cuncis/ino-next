'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';

/**
 * "Kebijakan Pengiriman" (ROADMAP.md Fase 9.1) — replaces the original
 * click-through prototype's generic ecommerce placeholder (flat "free
 * shipping over Rp750rb", 30-day returns, Visa/Mastercard) with what this
 * app actually does: Biteship-quoted courier rates from the branch itself,
 * a real delivery radius, and DOKU's actual payment channels.
 *
 * The text is edited in the admin under Konten Website and arrives as `document`.
 */
export default function ShippingInfo({ document }: { document: ContentDocument }) {
    return (
        <MobileLayout
            title={document.title}
            header={<AppBar title="Kebijakan Pengiriman" back="/profile" tone="brand" />}
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
