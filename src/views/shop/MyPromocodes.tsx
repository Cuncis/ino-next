'use client';

import { useState } from 'react';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Fab from '@/components/shop/Fab';
import Icon from '@/components/shop/Icon';
import { promocodes } from '@/components/shop/data';

const tabs = [
    { key: 'current', label: 'Aktif' },
    { key: 'used', label: 'Terpakai' },
];

export default function MyPromocodes() {
    const [tab, setTab] = useState('current');

    const [copied, setCopied] = useState<string | null>(null);

    const copyCode = (code: string) => {
        navigator.clipboard?.writeText(code);

        setCopied(code);
        window.setTimeout(() => setCopied(null), 1500);
    };

    return (
        <MobileLayout
            title="Kode Promo Saya"
            header={<AppBar title="Kode Promo Saya" back="/profile" tone="brand" />}
        >
            <div className="flex-1 overflow-y-auto px-3.5 pb-[90px] pt-3.5">
                <div className="mb-3.5 flex border-b border-line">
                    {tabs.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => setTab(option.key)}
                            className={`flex-1 p-[11px] text-center text-[13px] font-bold ${
                                tab === option.key
                                    ? 'border-b-2 border-ink'
                                    : 'text-[#aaaaaa]'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {tab === 'current' ? (
                    promocodes.map((promo) => (
                        <div key={promo.code} className="mb-2.5 rounded-[2px] border border-line bg-white p-3.5">
                            <div className="mb-1.5 flex items-center gap-2">
                                <Icon name="tag" size={18} className="text-ink" />
                                <span className="flex-1 font-display text-sm">
                                    {promo.name}
                                </span>
                                <span className={`font-bold ${promo.tone}`}>
                                    {promo.discount}
                                </span>
                            </div>

                            <div className="mb-2 text-[11px] text-[#aaaaaa]">
                                {promo.expires}
                            </div>

                            <button
                                type="button"
                                onClick={() => copyCode(promo.code)}
                                className="flex w-full items-center justify-between border border-dashed border-[#dddddd] bg-lilac px-3 py-2 text-xs font-bold tracking-[1px]"
                            >
                                {copied === promo.code ? 'Tersalin!' : promo.code}
                                <Icon name="copy" size={15} className="text-[#aaaaaa]" />
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="mt-10 text-center text-[13px] text-muted">
                        Anda belum pernah memakai kode promo.
                    </p>
                )}
            </div>

            <Fab href="/promocodes-empty" label="Tambah kode promo" />
        </MobileLayout>
    );
}
