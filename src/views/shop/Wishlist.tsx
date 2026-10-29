'use client';

import { useState } from 'react';
import { router } from '@/lib/inertia';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import IconLink from '@/components/shop/IconLink';
import ProductCard from '@/components/shop/ProductCard';
import TabBar from '@/components/shop/TabBar';
import { useShopCatalog } from '@/components/shop/data';

export default function Wishlist() {
    const { wishlistProducts } = useShopCatalog();
    const [products, setProducts] = useState(wishlistProducts);

    /**
     * Un-hearting the last product hands over to the empty-wishlist screen.
     */
    const remove = (name: string) => {
        const next = products.filter((product) => product.name !== name);

        if (next.length === 0) {
            router.visit('/wishlist-empty');

            return;
        }

        setProducts(next);
    };

    return (
        <MobileLayout
            wide
            title="Favorit"
            header={
                <AppBar
                    title="Favorit"
                    tone="brand"
                    actions={<IconLink name="history" href="/order-history" label="Riwayat transaksi" />}
                />
            }
            footer={<TabBar active="wishlist" />}
        >
            <div className="flex-1 overflow-y-auto px-3.5 pb-[70px] pt-3.5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {products.map((product) => (
                        <ProductCard
                            key={product.name}
                            product={product}
                            wishlisted
                            onRemove={() => remove(product.name)}
                        />
                    ))}
                </div>
            </div>
        </MobileLayout>
    );
}
