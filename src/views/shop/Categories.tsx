'use client';

import { useState } from 'react';
import { Link } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import IconButton from '@/components/shop/IconButton';
import IconLink from '@/components/shop/IconLink';
import SearchOverlay from '@/components/shop/SearchOverlay';
import TabBar from '@/components/shop/TabBar';
import useCartCount from '@/components/shop/useCartCount';
import { useShopCatalog } from '@/components/shop/data';

export default function Categories() {
    const { categories } = useShopCatalog();
    const cartCount = useCartCount();
    const [searching, setSearching] = useState(false);

    const tiles = [
        ...categories,
        { name: 'Semua Produk', image: '/media/images/categories/semua-produk.png' },
    ];

    return (
        <MobileLayout
            wide
            title="Kategori"
            header={
                <AppBar
                    brand
                    tone="brand"
                    actions={
                        <>
                            <IconButton
                                name="search"
                                onClick={() => setSearching(true)}
                                label="Cari"
                            />
                            <IconLink name="cart" href="/cart" label="Keranjang" badge={cartCount} />
                        </>
                    }
                />
            }
            footer={<TabBar active="home" />}
        >
            <div className="flex-1 overflow-y-auto px-3.5 pb-[70px] pt-3.5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {tiles.map((category) => (
                        <Link
                            key={category.name}
                            href={
                                category.name === 'Semua Produk'
                                    ? '/shop'
                                    : `/shop?category=${encodeURIComponent(category.name)}`
                            }
                            className="flex h-[130px] flex-col items-center justify-center gap-2.5 rounded-[2px] border border-line bg-white p-3 text-center"
                        >
                            <img
                                src={category.image}
                                alt={category.name}
                                className="h-16 w-16 object-contain"
                            />

                            <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-ink">
                                {category.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>

            <SearchOverlay open={searching} onClose={() => setSearching(false)} />
        </MobileLayout>
    );
}
