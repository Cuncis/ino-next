'use client';

import { useState } from 'react';
import { Link } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import DesktopPage from '@/components/shop/DesktopPage';
import Icon, { type IconName } from '@/components/shop/Icon';
import IconLink from '@/components/shop/IconLink';
import TabBar from '@/components/shop/TabBar';
import useIsDesktop from '@/components/shop/useIsDesktop';
import UserAvatar from '@/components/shop/UserAvatar';
import useShopUser from '@/components/shop/useShopUser';
import LegalModal from '@/components/shop/LegalModal';
import type { LegalDocumentKey } from '@/components/shop/legalDocuments';

/** An entry either links to a page (`href`) or opens a legal popup (`legal`). */
const menu: { label: string; icon: IconName; href?: string; legal?: LegalDocumentKey }[] = [
    { label: 'Ubah profil', icon: 'user', href: '/edit-profile' },
    { label: 'Alamat saya', icon: 'pin', href: '/my-address' },
    { label: 'Kode promo saya', icon: 'promo', href: '/my-promocodes' },
    { label: 'Riwayat pesanan', icon: 'file', href: '/order-history' },
    { label: 'Info pengiriman & pembayaran', icon: 'info', href: '/shipping-info' },
    { label: 'Kebijakan pengembalian dana', icon: 'info', href: '/kebijakan-pengembalian-dana' },
    { label: 'Syarat & ketentuan', icon: 'info', legal: 'terms' },
    { label: 'Kebijakan privasi', icon: 'info', href: '/pp' },
    { label: 'Privasi saya', icon: 'user', href: '/privasi-saya' },
    { label: 'Tentang kami', icon: 'info', href: 'http://info.inofarma.com/' },
    { label: 'FAQ', icon: 'help', href: '/faq' },
];

export default function Profile() {
    const user = useShopUser();
    const isDesktop = useIsDesktop();
    const [legalOpen, setLegalOpen] = useState<LegalDocumentKey | null>(null);
    const legalModal = legalOpen ? <LegalModal document={legalOpen} onClose={() => setLegalOpen(null)} /> : null;

    if (isDesktop) {
        return (
            <DesktopPage title="Profil" heading="Akun saya" breadcrumb={[{ label: 'Akun saya' }]}>
                <div className="grid grid-cols-[300px_1fr] items-start gap-8">
                    <section className="border border-line bg-white p-8 text-center">
                        <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full border-2 border-[#1773b0]">
                            <UserAvatar label={user.name} />
                        </div>

                        <div className="font-display text-[18px]">{user.name}</div>
                        <div className="mt-1 text-[12px] text-muted">{user.email}</div>

                        <Link
                            href="/signout"
                            method="post"
                            as="button"
                            className="mt-6 flex h-11 w-full items-center justify-center gap-2 border border-line text-[13px] font-bold text-brand"
                        >
                            <Icon name="logout" size={17} />
                            Keluar
                        </Link>
                    </section>

                    <div className="grid grid-cols-3 gap-4">
                        {menu.map((item) => {
                            const card = (
                                <>
                                    <span className="mb-3 flex h-10 w-10 items-center justify-center bg-blush text-brand">
                                        <Icon name={item.icon} size={20} />
                                    </span>
                                    <span className="text-[13px] font-bold text-ink">{item.label}</span>
                                </>
                            );
                            const cardClass = 'flex flex-col items-start border border-line bg-white p-5 hover:border-brand';

                            if (item.legal) {
                                const legal = item.legal;

                                return (
                                    <button key={item.label} type="button" onClick={() => setLegalOpen(legal)} className={`${cardClass} text-left`}>
                                        {card}
                                    </button>
                                );
                            }

                            return item.href?.startsWith('http') ? (
                                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={cardClass}>
                                    {card}
                                </a>
                            ) : (
                                <Link key={item.label} href={item.href ?? '#'} className={cardClass}>
                                    {card}
                                </Link>
                            );
                        })}
                    </div>
                </div>
                {legalModal}
            </DesktopPage>
        );
    }

    return (
        <MobileLayout
            title="Profil"
            header={
                <AppBar
                    title="Profil"
                    tone="brand"
                    actions={<IconLink name="history" href="/order-history" label="Riwayat transaksi" />}
                />
            }
            footer={<TabBar active="profile" />}
        >
            <div className="flex-1 overflow-y-auto p-4 pb-[70px]">
                <div className="flex flex-col items-center pb-[18px] pt-5">
                    <div className="mb-3 h-[88px] w-[88px] overflow-hidden rounded-full border-2 border-[#1773b0]">
                        <UserAvatar label={user.name} />
                    </div>

                    <div className="mb-[3px] font-display text-[17px]">{user.name}</div>
                    <div className="text-xs text-faint">{user.email}</div>
                </div>

                {menu.map((item) => {
                    const rowClass = 'mb-[7px] flex items-center gap-3 border border-line bg-white px-3.5 py-[13px]';
                    const row = (
                        <>
                            <span className="text-ink">
                                <Icon name={item.icon} size={19} />
                            </span>

                            <span className="flex-1 text-[13px] text-ink">{item.label}</span>

                            <Icon name="chevronRight" size={14} className="text-[#cccccc]" />
                        </>
                    );

                    if (item.legal) {
                        const legal = item.legal;

                        return (
                            <button key={item.label} type="button" onClick={() => setLegalOpen(legal)} className={`${rowClass} w-full text-left`}>
                                {row}
                            </button>
                        );
                    }

                    return item.href?.startsWith('http') ? (
                        <a
                            key={item.label}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={rowClass}
                        >
                            {row}
                        </a>
                    ) : (
                        <Link key={item.label} href={item.href ?? '#'} className={rowClass}>
                            {row}
                        </Link>
                    );
                })}

                <Link
                    href="/signout"
                    method="post"
                    as="button"
                    className="mb-[7px] flex w-full items-center gap-3 border border-line bg-white px-3.5 py-[13px] text-left"
                >
                    <span className="text-brand">
                        <Icon name="logout" size={19} />
                    </span>

                    <span className="flex-1 text-[13px] text-brand">Keluar</span>

                    <Icon name="chevronRight" size={14} className="text-[#cccccc]" />
                </Link>
            </div>
            {legalModal}
        </MobileLayout>
    );
}
