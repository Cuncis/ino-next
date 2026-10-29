import { Link } from '@/lib/inertia';
import DesktopLayout from '@/layouts/DesktopLayout';
import BenefitsGrid from './BenefitsGrid';
import BrandStrip from './BrandStrip';
import Carousel from './Carousel';
import CategoryShortcuts from './CategoryShortcuts';
import DesktopHeader from './DesktopHeader';
import HeroCarousel from './HeroCarousel';
import HomeInfo from './HomeInfo';
import NearestPharmacies from './NearestPharmacies';
import ProductGrid from './ProductGrid';
import TestimonialSlider from './TestimonialSlider';
import { useShopCatalog } from './data';

function ProductSection({ title, products }: { title: string, products: ProductTile[] }) {
    return (
        <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-[13px] text-brand">{title}</h2>

                <Link href="/shop" className="text-[11px] font-bold text-success">
                    Lihat semua
                </Link>
            </div>

            <ProductGrid products={products} />
        </section>
    );
}

/**
 * Desktop version of the storefront home: full-width header, single centred
 * column, no bottom tab bar. Gets the same `content` as the mobile page so
 * both layouts always show the same campaigns.
 */
export default function DesktopHome({ content, pharmacies }: { content: HomeContent; pharmacies: BranchCard[] }) {
    const { recommended, newArrivals, trendingProducts } = useShopCatalog();

    return (
        <DesktopLayout title="Beranda" header={<DesktopHeader />}>
            <HeroCarousel slides={content.hero} className="mt-6" />

            <CategoryShortcuts allProductsIcon={content.allProductsIcon} className="mt-6" />

            <Carousel slides={content.promo} aspect="aspect-1740/396" className="mt-10" />

            <ProductSection title={content.headings.recommended} products={recommended} />
            <ProductSection title={content.headings.newArrivals} products={newArrivals} />
            <ProductSection title={content.headings.trending} products={trendingProducts} />

            <Carousel slides={content.bottom} aspect="aspect-1920/601" className="mt-12" />

            {content.brands.length > 0 ? (
                <section className="mt-10">
                    <h2 className="mb-4 font-display text-[19px] text-brand">{content.headings.brands}</h2>
                    <BrandStrip brands={content.brands} className="px-0" spread />
                </section>
            ) : null}

            {content.benefits.length > 0 ? (
                <section className="mt-10">
                    <h2 className="mb-4 font-display text-[19px] text-brand">{content.headings.benefits}</h2>
                    <BenefitsGrid benefits={content.benefits} className="grid-cols-9" />
                </section>
            ) : null}

            {pharmacies.length > 0 ? (
                <section className="mt-10">
                    <h2 className="mb-4 font-display text-[19px] text-brand">{content.headings.nearest}</h2>
                    <NearestPharmacies pharmacies={pharmacies} className="px-0" desktop />
                </section>
            ) : null}

            {content.testimonials.length > 0 ? (
                <section className="mt-10">
                    <h2 className="mb-4 font-display text-[19px] text-brand">{content.headings.testimonials}</h2>
                    <TestimonialSlider testimonials={content.testimonials} className="px-0" />
                </section>
            ) : null}

            <HomeInfo content={content} className="px-0" />
        </DesktopLayout>
    );
}
