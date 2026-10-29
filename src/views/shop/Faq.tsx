'use client';

import { useState } from 'react';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';

/** `faqs` is edited in the admin under Konten Website > FAQ. The first answer starts open. */
export default function Faq({ faqs }: { faqs: FaqItem[] }) {
    const [open, setOpen] = useState<number | null>(faqs.length > 0 ? 0 : null);

    return (
        <MobileLayout title="FAQ" header={<AppBar title="FAQ" back="/profile" tone="brand" />}>
            <div className="flex-1 overflow-y-auto p-3.5">
                {faqs.map((faq, index) => {
                    const expanded = open === index;

                    return (
                        <div key={`${index}-${faq.question}`} className="mb-2 border border-line bg-white">
                            <button
                                type="button"
                                onClick={() => setOpen(expanded ? null : index)}
                                aria-expanded={expanded}
                                className="flex w-full justify-between p-3.5 text-left text-[13px] font-bold"
                            >
                                <span>{faq.question}</span>
                                <span
                                    className={`text-brand transition-transform duration-300 ease-in-out ${
                                        expanded ? 'rotate-180' : ''
                                    }`}
                                >
                                    {expanded ? '−' : '+'}
                                </span>
                            </button>

                            {/*
                             * `grid-rows-[0fr]` → `[1fr]` animates height without
                             * measuring it in JS — the content is always mounted
                             * (never conditionally removed), so the transition has
                             * something to animate between.
                             */}
                            <div
                                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                }`}
                            >
                                <div className="overflow-hidden">
                                    <div className="space-y-2 px-3.5 pb-3.5 text-xs leading-relaxed text-muted">
                                        {faq.paragraphs.map((paragraph, paragraphIndex) => (
                                            <p key={paragraphIndex}>{paragraph}</p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </MobileLayout>
    );
}
