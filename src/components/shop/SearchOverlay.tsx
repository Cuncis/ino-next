import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@/lib/inertia';
import Icon from './Icon';
import { productMatchesSearch, useShopCatalog } from './data';

/**
 * Full-frame search.
 *
 * Takes over the screen when the header's search icon is tapped: the app bar's
 * actions are replaced by a single close button, and results update as you type.
 * Closing returns to whichever screen opened it.
 */
export default function SearchOverlay({ open, onClose }: { open: boolean, onClose: () => void }) {
    const { products, shopProducts } = useShopCatalog();
    const [query, setQuery] = useState('');
    const field = useRef<HTMLInputElement>(null);

    // Focus on open, and reset the field so the next open starts clean.
    useEffect(() => {
        if (open) {
            field.current?.focus();
        } else {
            setQuery('');
        }
    }, [open]);

    useEffect(() => {
        if (! open) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    const results = useMemo(() => {
        const needle = query.trim().toLowerCase();

        if (! needle) {
            return [];
        }

        // `shopProducts` is `products` mapped one to one, so the index lines them up.
        return shopProducts.filter((_, index) => productMatchesSearch(products[index], needle));
    }, [query, products, shopProducts]);

    if (! open) {
        return null;
    }

    const typed = query.trim().length > 0;

    const seeAll = () => {
        onClose();
        router.visit(`/shop?q=${encodeURIComponent(query.trim())}`);
    };

    const openProduct = () => {
        onClose();
        router.visit('/product-detail');
    };

    return (
        <div className="absolute inset-0 z-40 flex flex-col bg-white">
            <div className="flex h-appbar shrink-0 items-center gap-2 bg-brand px-3">
                <div className="relative flex-1">
                    <Icon
                        name="search"
                        size={16}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
                    />

                    <input
                        ref={field}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && typed) {
                                seeAll();
                            }
                        }}
                        placeholder="Cari obat, vitamin, alat kesehatan..."
                        aria-label="Cari produk"
                        className="h-9 w-full border-0 bg-white pl-8 pr-3 text-xs text-muted placeholder:text-[#bbbbbb] focus:outline-hidden focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
                    />
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Tutup pencarian"
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-white"
                >
                    <Icon name="close" size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {! typed ? (
                    <div className="px-4 py-6">
                        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-faint">
                            Pencarian populer
                        </p>

                        <div className="flex flex-wrap gap-2">
                            {['Paracetamol', 'Vitamin', 'Masker', 'Antiseptik', 'Suplemen'].map(
                                (term) => (
                                    <button
                                        key={term}
                                        type="button"
                                        onClick={() => setQuery(term)}
                                        className="border border-line px-3 py-1.5 text-[11px] text-muted"
                                    >
                                        {term}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>
                ) : results.length === 0 ? (
                    <div className="flex flex-col items-center px-8 py-16 text-center">
                        <Icon name="search" size={48} className="mb-4 text-brand opacity-20" />

                        <p className="mb-1.5 font-display text-base">Tidak ada hasil</p>
                        <p className="text-xs leading-relaxed text-muted">
                            Tidak ditemukan produk untuk &ldquo;{query.trim()}&rdquo;.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="px-4 pb-1 pt-3 text-[11px] text-faint">
                            {results.length} produk ditemukan
                        </p>

                        <ul>
                            {results.map((product) => (
                                <li key={product.id}>
                                    <button
                                        type="button"
                                        onClick={openProduct}
                                        className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left"
                                    >
                                        <img
                                            src={product.image}
                                            alt=""
                                            className="h-11 w-11 shrink-0 bg-lilac object-contain p-1"
                                        />

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] text-ink">
                                                {product.name}
                                            </span>
                                            <span className="block text-[11px] text-faint">
                                                {product.category}
                                            </span>
                                        </span>

                                        <span className="shrink-0 text-xs font-bold text-brand">
                                            {product.price}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="p-4">
                            <button
                                type="button"
                                onClick={seeAll}
                                className="flex h-11 w-full items-center justify-center border-2 border-ink text-xs font-bold uppercase tracking-wider text-ink"
                            >
                                Lihat semua hasil
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
