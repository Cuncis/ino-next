import Carousel from './Carousel';

/**
 * The storefront's hero banner. The slides are edited in the admin under
 * Konten Website > Beranda (`App\Support\HomePageContent`); the ones the
 * site shipped with are self-hosted under `public/media/images/hero/` (same
 * reasoning as utang teknis #3 in Fase 4: never depend on a third-party host
 * staying online for artwork the storefront needs).
 */
export default function HeroCarousel({ slides, className = 'mx-3.5 mt-3.5' }: { slides: HomeSlide[], className?: string }) {
    return <Carousel slides={slides} aspect="aspect-video" className={className} />;
}
