'use client';

import { useState } from 'react';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import BenefitsGrid from '@/components/shop/BenefitsGrid';
import HomeInfo from '@/components/shop/HomeInfo';
import NearestPharmacies from '@/components/shop/NearestPharmacies';
import TestimonialSlider from '@/components/shop/TestimonialSlider';
import BrandStrip from '@/components/shop/BrandStrip';
import Carousel from '@/components/shop/Carousel';
import CategoryShortcuts from '@/components/shop/CategoryShortcuts';
import DesktopHome from '@/components/shop/DesktopHome';
import HeroCarousel from '@/components/shop/HeroCarousel';
import IconLink from '@/components/shop/IconLink';
import ProductStrip from '@/components/shop/ProductStrip';
import SearchBarTrigger from '@/components/shop/SearchBarTrigger';
import SectionHeading from '@/components/shop/SectionHeading';
import SearchOverlay from '@/components/shop/SearchOverlay';
import TabBar from '@/components/shop/TabBar';
import useCartCount from '@/components/shop/useCartCount';
import useIsDesktop from '@/components/shop/useIsDesktop';
import { useShopCatalog } from '@/components/shop/data';

/**
 * `content` is edited in the admin under Konten Website > Beranda; `pharmacies`
 * are the branches with a photo, from Cabang.
 */
export default function Home({ content, pharmacies }: { content: HomeContent; pharmacies: BranchCard[] }) {
    const { recommended, newArrivals, trendingProducts } = useShopCatalog();
    const cartCount = useCartCount();
    const [searching, setSearching] = useState(false);
    const isDesktop = useIsDesktop();

    if (isDesktop) {
        return <DesktopHome content={content} pharmacies={pharmacies} />;
    }

    return (
        <MobileLayout
            title="Beranda"
            header={
                <div className="bg-brand">
                    <AppBar
                        brand
                        tone="brand"
                        actions={
                            <IconLink id="cart-icon-target" name="cart" href="/cart" label="Keranjang" badge={cartCount} />
                        }
                    />

                    <div className="px-3.5 pb-3">
                        <SearchBarTrigger onOpen={() => setSearching(true)} />
                    </div>
                </div>
            }
            footer={<TabBar active="home" />}
        >
            <div className="flex-1 overflow-y-auto pb-5">
                <HeroCarousel slides={content.hero} />

                <CategoryShortcuts allProductsIcon={content.allProductsIcon} />

                <Carousel
                    slides={content.promo}
                    aspect="aspect-1740/396"
                    className="mx-3.5 mb-3.5 mt-1"
                />

                <div>
                    <SectionHeading
                        title={content.headings.recommended}
                        action="Lihat semua"
                        actionHref="/shop"
                        className="px-3.5"
                    />
                    <ProductStrip products={recommended} />
                </div>

                <div>
                    <SectionHeading
                        title={content.headings.newArrivals}
                        action="Lihat semua"
                        actionHref="/shop"
                        className="px-3.5"
                    />
                    <ProductStrip products={newArrivals} />
                </div>

                <div>
                    <SectionHeading
                        title={content.headings.trending}
                        action="Lihat semua"
                        actionHref="/shop"
                        className="px-3.5"
                    />
                    <ProductStrip products={trendingProducts} />
                </div>

                <Carousel
                    slides={content.bottom}
                    aspect="aspect-1920/601"
                    className="mx-3.5 mt-6"
                />

                {content.brands.length > 0 ? (
                    <div>
                        <SectionHeading title={content.headings.brands} className="px-3.5" />
                        <BrandStrip brands={content.brands} />
                    </div>
                ) : null}

                {content.benefits.length > 0 ? (
                    <div>
                        <SectionHeading title={content.headings.benefits} className="px-3.5" />
                        <BenefitsGrid benefits={content.benefits} />
                    </div>
                ) : null}

                {pharmacies.length > 0 ? (
                    <div>
                        <SectionHeading title={content.headings.nearest} className="px-3.5" />
                        <NearestPharmacies pharmacies={pharmacies} />
                    </div>
                ) : null}

                {content.testimonials.length > 0 ? (
                    <div>
                        <SectionHeading title={content.headings.testimonials} className="px-3.5" />
                        <TestimonialSlider testimonials={content.testimonials} />
                    </div>
                ) : null}

                <HomeInfo content={content} />
            </div>

            <SearchOverlay open={searching} onClose={() => setSearching(false)} />
        </MobileLayout>
    );
}
