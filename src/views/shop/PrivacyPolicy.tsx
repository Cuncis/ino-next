'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';

/**
 * "Kebijakan Privasi" as its own page at /pp (the canonical privacy policy,
 * replacing the old popup). The text is fixed legal copy from
 * `App\Support\PrivacyPolicyContent` and arrives as `document`; each section
 * is a list of blocks so running paragraphs and bullet lists can be mixed.
 */
function Blocks({ blocks }: { blocks: PolicyBlock[] }) {
    return (
        <div className="space-y-2 text-xs leading-[1.7] text-muted">
            {blocks.map((block, index) =>
                block.type === 'list' ? (
                    <ul key={index} className="list-disc space-y-1 pl-5">
                        {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                    </ul>
                ) : (
                    <p key={index}>{block.text}</p>
                ),
            )}
        </div>
    );
}

export default function PrivacyPolicy({ document }: { document: PrivacyPolicyDocument }) {
    return (
        <MobileLayout
            title={document.title}
            header={<AppBar title="Kebijakan Privasi" back="/profile" tone="brand" />}
        >
            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-5">
                    <Blocks blocks={document.intro} />
                </div>

                {document.sections.map((section, index) => (
                    <div key={`${index}-${section.title}`} className="mb-5">
                        <div className="mb-2.5 border-b border-line pb-2 font-display text-[15px]">
                            {index + 1}. {section.title}
                        </div>

                        <Blocks blocks={section.blocks} />
                    </div>
                ))}

                <p className="mt-6 text-[11px] text-muted">Terakhir diperbarui: {document.updatedAt}</p>
            </div>
        </MobileLayout>
    );
}
