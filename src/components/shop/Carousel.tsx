import {
    useEffect,
    useRef,
    useState,
    type MouseEvent as ReactMouseEvent,
    type TouchEvent,
} from 'react';
import { Link } from '@/lib/inertia';

const AUTO_ADVANCE_MS = 5000;

/**
 * Reusable auto-advancing image carousel — swipe on touch, drag on desktop,
 * dot navigation, both taking over the timer immediately so it never fights
 * a shopper actively looking at one slide. Shared by `HeroCarousel` and the
 * promo-banner slot on Home; single-slide callers just render one static
 * slide with no dots.
 */
export default function Carousel({ slides, aspect = 'aspect-video', className = '' }: {
  slides: { image: string, href: string, alt: string }[],
  aspect?: string,
  className?: string,
}) {
    const [index, setIndex] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const drag = useRef({ active: false, startX: 0, moved: false });
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    const restartTimer = () => {
        clearInterval(timerRef.current);

        if (slides.length < 2) {
            return;
        }

        timerRef.current = setInterval(() => {
            setIndex((current) => (current + 1) % slides.length);
        }, AUTO_ADVANCE_MS);
    };

    useEffect(() => {
        restartTimer();

        return () => clearInterval(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const goTo = (next: number) => {
        setIndex(next);
        restartTimer();
    };

    const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
        touchStartX.current = event.touches[0].clientX;
    };

    const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
        if (touchStartX.current === null) {
            return;
        }

        const delta = event.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;

        if (Math.abs(delta) < 40) {
            return;
        }

        goTo(delta < 0
            ? (index + 1) % slides.length
            : (index - 1 + slides.length) % slides.length);
    };

    // Touch already swipes natively through onTouchStart/onTouchEnd above —
    // this is the desktop counterpart, a held mouse cursor dragged sideways.
    // Tracked with window-level mousemove/mouseup (not pointer capture) so a
    // release outside the carousel still ends the drag cleanly instead of
    // leaving the "just dragged" flag stuck and silently blocking every
    // click afterwards.
    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (! drag.current.active) {
                return;
            }

            // Below this, a plain click's natural mousedown-to-mouseup drift
            // (a trackpad especially) would otherwise register as a drag and
            // swallow the click that opens the slide's link.
            if (Math.abs(event.clientX - drag.current.startX) > 8) {
                drag.current.moved = true;
            }
        };

        const onMouseUp = (event: MouseEvent) => {
            if (! drag.current.active) {
                return;
            }

            const delta = event.clientX - drag.current.startX;
            drag.current.active = false;

            if (Math.abs(delta) >= 40) {
                goTo(delta < 0
                    ? (index + 1) % slides.length
                    : (index - 1 + slides.length) % slides.length);
            }

            // See useDragScroll.js for why this is deferred a tick: it lets
            // the click that immediately follows (when the drag ended back
            // over the carousel) still see `moved` true and get suppressed,
            // while still clearing it for the next interaction either way.
            setTimeout(() => {
                drag.current.moved = false;
            }, 0);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index]);

    const onMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }

        drag.current = { active: true, startX: event.clientX, moved: false };
    };

    // A mouse drag ends with the cursor over a slide, so the browser follows
    // it with a click — swallow that click when it was really a drag, or the
    // Link underneath would navigate away instead of just changing slides.
    const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (drag.current.moved) {
            event.preventDefault();
            event.stopPropagation();
            drag.current.moved = false;
        }
    };

    // A carousel emptied in the admin (Konten Website) is simply left out.
    if (slides.length === 0) {
        return null;
    }

    return (
        <div className={`relative overflow-hidden rounded-[2px] border border-line ${className}`}>
            <div
                className="flex cursor-grab select-none transition-transform duration-500 ease-out active:cursor-grabbing"
                style={{ transform: `translateX(-${index * 100}%)` }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown}
                onClickCapture={onClickCapture}
            >
                {slides.map((slide, slideIndex) => {
                    const image = <img src={slide.image} alt={slide.alt} className="h-full w-full object-cover" />;

                    // A full https:// link leaves the shop, so it is a plain anchor rather than an Inertia visit.
                    return /^https?:\/\//.test(slide.href) ? (
                        <a key={`${slideIndex}-${slide.image}`} href={slide.href} target="_blank" rel="noopener noreferrer" className={`${aspect} w-full shrink-0`}>
                            {image}
                        </a>
                    ) : (
                        <Link key={`${slideIndex}-${slide.image}`} href={slide.href} className={`${aspect} w-full shrink-0`}>
                            {image}
                        </Link>
                    );
                })}
            </div>

            {slides.length > 1 ? (
                <div className="absolute bottom-2.5 left-0 flex w-full justify-center gap-1.5">
                    {slides.map((slide, slideIndex) => (
                        <button
                            key={`${slideIndex}-${slide.image}`}
                            type="button"
                            onClick={() => goTo(slideIndex)}
                            aria-label={`Slide ${slideIndex + 1}`}
                            className={`h-1.5 rounded-full transition-all ${
                                slideIndex === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60'
                            }`}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
