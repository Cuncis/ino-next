'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Icon from '@/components/shop/Icon';
import IconLink from '@/components/shop/IconLink';
import ProductCard from '@/components/shop/ProductCard';
import SearchBar from '@/components/shop/SearchBar';
import DesktopShop from '@/components/shop/DesktopShop';
import TabBar from '@/components/shop/TabBar';
import useIsDesktop from '@/components/shop/useIsDesktop';
import useCartCount from '@/components/shop/useCartCount';
import useDragScroll from '@/components/shop/useDragScroll';
import { useShopCatalog } from '@/components/shop/data';

/**
 * Seed the field from `?q=` so a search can be linked to and survives a reload.
 */
function initialQuery(url: string): string {
    const query = url.split('?')[1];

    return query ? (new URLSearchParams(query).get('q') ?? '') : '';
}

/**
 * Seed the active category from `?category=`, so the homepage/"Kategori"
 * shortcuts can link straight to a filtered shop. Falls back to "Semua" when
 * absent, or when the value doesn't match a real category.
 */
function initialCategory(url: string,filterCategories: string[]): string {
    const query = url.split('?')[1];
    const requested = query ? new URLSearchParams(query).get('category') : null;

    return requested && filterCategories.includes(requested) ? requested : 'Semua';
}

export default function Shop() {
    const { filterCategories, shopProducts } = useShopCatalog();
    const { url } = usePage();
    const cartCount = useCartCount();
    const [query, setQuery] = useState(() => initialQuery(url));
    const [category, setCategory] = useState(() => initialCategory(url, filterCategories));
    const categoryDrag = useDragScroll();
    const activePillRef = useRef<HTMLButtonElement>(null);
    const isDesktop = useIsDesktop();

    // Keep the chosen pill in view: a category picked from the homepage/
    // "Kategori" shortcuts can land here scrolled far down the strip (or the
    // shopper picks one that's currently off-screen), so re-center it
    // whenever the active category changes instead of leaving the strip
    // wherever it happened to be.
    useEffect(() => {
        activePillRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [category]);

    const results = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return shopProducts.filter((product) => {
            const matchesCategory = category === 'Semua' || product.category === category;
            const matchesQuery =
                ! needle ||
                product.name.toLowerCase().includes(needle) ||
                product.category.toLowerCase().includes(needle);

            return matchesCategory && matchesQuery;
        });
    }, [query, category, shopProducts]);

    if (isDesktop) {
        return <DesktopShop />;
    }

    const searching = query.trim().length > 0 || category !== 'Semua';

    return (
        <MobileLayout
            title="Belanja"
            header={
                <AppBar
                    brand
                    tone="brand"
                    actions={
                        <>
                            <IconLink name="tag" href="/filter" label="Filter" />
                            <IconLink name="cart" href="/cart" label="Keranjang" badge={cartCount} />
                        </>
                    }
                />
            }
            footer={<TabBar active="home" />}
        >
            <div className="flex-1 overflow-y-auto pb-[70px]">
                <div className="sticky top-0 z-10 border-b border-line bg-white px-3 pb-2.5 pt-3">
                    <SearchBar value={query} onChange={setQuery} />

                    <div
                        {...categoryDrag}
                        className={`mt-2.5 flex gap-1.5 overflow-x-auto scrollbar-none ${categoryDrag.className}`}
                    >
                        {['Semua', ...filterCategories].map((name) => (
                            <button
                                key={name}
                                ref={category === name ? activePillRef : null}
                                type="button"
                                onClick={() => setCategory(name)}
                                className={`shrink-0 px-3 py-1.5 text-[11px] ${
                                    category === name
                                        ? 'border border-brand bg-brand text-white'
                                        : 'border border-line text-muted'
                                }`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-3 pt-3">
                    {searching ? (
                        <p className="mb-2.5 text-[11px] text-faint">
                            {results.length} produk ditemukan
                            {query.trim() ? ` untuk "${query.trim()}"` : ''}
                        </p>
                    ) : null}

                    {results.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-14 text-center">
                            <Icon name="search" size={54} className="mb-4 text-brand opacity-20" />

                            <p className="mb-1.5 font-display text-[17px]">Produk tidak ditemukan</p>

                            <p className="mb-5 text-xs leading-relaxed text-muted">
                                Coba kata kunci lain atau ubah kategori yang dipilih.
                            </p>

                            <Button
                                onClick={() => {
                                    setQuery('');
                                    setCategory('Semua');
                                }}
                                variant="outline"
                            >
                                Atur Ulang Pencarian
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                            {results.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MobileLayout>
    );
}
