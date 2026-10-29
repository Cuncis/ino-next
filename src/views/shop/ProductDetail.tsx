'use client';

import { useState } from 'react';
import { Link, usePage } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Icon from '@/components/shop/Icon';
import BranchPicker from '@/components/shop/BranchPicker';
import FlashBanner from '@/components/shop/FlashBanner';
import { DrugInfoSection } from '@/components/shop/DrugInfo';
import IconLink from '@/components/shop/IconLink';
import ProductGallery from '@/components/shop/ProductGallery';
import Rating from '@/components/shop/Rating';
import ReviewCard from '@/components/shop/ReviewCard';
import DesktopProductDetail from '@/components/shop/DesktopProductDetail';
import useCartCount from '@/components/shop/useCartCount';
import useIsDesktop from '@/components/shop/useIsDesktop';
import { useTrackProductView } from '@/components/shop/useRecentlyViewed';
import { findProduct, money, reviews, useShopCatalog } from '@/components/shop/data';

export default function ProductDetail() {
    const { products } = useShopCatalog();
    const { url } = usePage();

    // Which product to show comes from `?id=`, so a tile anywhere in the shop
    // can link straight here. Falls back to the first product when absent.
    const requested = new URLSearchParams(url.split('?')[1] ?? '').get('id');
    const product = findProduct(products, requested ?? undefined);

    const [variant, setVariant] = useState(product?.variants[0]);
    const [liked, setLiked] = useState(false);
    const cartCount = useCartCount();
    const isDesktop = useIsDesktop();

    useTrackProductView(product?.id);

    if (! product) {
        return (
            <MobileLayout title="Detail Produk">
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted">
                    Produk tidak ditemukan.
                </div>
            </MobileLayout>
        );
    }

    if (isDesktop) {
        return <DesktopProductDetail product={product} />;
    }

    return (
        <MobileLayout
            title="Detail Produk"
            header={
                <AppBar
                    title="Detail Produk"
                    back="/shop"
                    tone="brand"
                    actions={
                        <>
                            <button
                                type="button"
                                onClick={() => setLiked((current) => ! current)}
                                aria-label={liked ? 'Hapus dari favorit' : 'Tambahkan ke favorit'}
                                className={liked ? 'text-danger' : 'text-white'}
                            >
                                <Icon name={liked ? 'heartFilled' : 'heart'} size={20} />
                            </button>

                            <IconLink
                                id="cart-icon-target"
                                name="cart"
                                href="/cart"
                                label="Keranjang"
                                badge={cartCount}
                            />
                        </>
                    }
                />
            }
        >
            <ProductGallery
                images={product.images ?? [{ path: product.image, alt: product.name }]}
            />

            <FlashBanner />

            <div className="flex-1 overflow-y-auto p-3.5">
                <div className="mb-3.5 rounded-[2px] border border-line bg-white p-3.5">
                    <div className="mb-2 flex justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="font-display text-lg leading-tight">{product.name}</h2>
                            <p className="mt-0.5 text-[11px] text-faint">{product.category}</p>
                        </div>

                        <div className="shrink-0 text-right">
                            {product.oldPrice ? (
                                <span className="block text-[10px] text-faint line-through">
                                    {money(product.oldPrice)}
                                </span>
                            ) : null}
                            <span className="text-xl font-bold text-brand">{money(product.price)}</span>
                        </div>
                    </div>

                    <Link href="/reviews" className="mb-3 flex items-center gap-[5px]">
                        <Rating score={Math.round(Number(product.rating))} />
                        <span className="text-xs text-muted">
                            {product.rating} ({product.sold} terjual)
                        </span>
                    </Link>

                    <p className="whitespace-pre-line text-xs leading-relaxed text-muted">{product.blurb}</p>
                </div>

                <div className="mb-3.5 rounded-[2px] border border-line bg-white p-3.5">
                    <div className="mb-[7px] text-[13px] font-bold">Kemasan</div>

                    <div className="flex flex-wrap gap-[7px]">
                        {product.variants.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setVariant(option)}
                                className={`flex h-9 items-center justify-center px-3 text-[11px] ${
                                    variant === option
                                        ? 'border-2 border-brand font-bold text-brand'
                                        : 'border border-line text-muted'
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <DrugInfoSection product={product} />

                <BranchPicker
                    productId={product.id}
                    productName={product.name}
                    purchaseLimit={product.purchaseLimit ?? 2}
                />

                <div className="mb-2.5 mt-4 flex justify-between border-t border-line pt-2.5">
                    <span className="font-display text-sm">Ulasan</span>
                    <Link href="/reviews" className="text-xs text-brand">
                        Lihat semua
                    </Link>
                </div>

                <ReviewCard review={reviews[0]} />
            </div>
        </MobileLayout>
    );
}
