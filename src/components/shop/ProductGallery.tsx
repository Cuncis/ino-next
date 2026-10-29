import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

const LENS_SIZE = 110;
const PANEL_SIZE = 340;
const PANEL_GAP = 16;

/**
 * A product's photos — a main image with a thumbnail strip to switch
 * between them (works everywhere), plus a magnifying-glass hover zoom on a
 * mouse-driven device only (`(hover: hover) and (pointer: fine)` — this
 * matters here specifically because `MobileLayout` renders the storefront
 * in a fixed ~430px column even on a wide desktop screen, so the zoomed
 * preview panel is a `position: fixed` overlay placed in the gutter beside
 * that column, not something that fits inline). Touch never fires a hover
 * event on its own, but iOS Safari is known to synthesize one after a tap —
 * gating on the media query, not just "did a mouse event fire," keeps a
 * touch tap from ever popping the zoom panel open.
 */
export default function ProductGallery({ images, badge }: {
  images: { path: string, alt: string }[],
  badge?: import('react').ReactNode,
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    const active = images[activeIndex] ?? images[0];

    const frameRef = useRef<HTMLDivElement>(null);
    const [canHover, setCanHover] = useState(false);
    const [hovering, setHovering] = useState(false);
    const [frameRect, setFrameRect] = useState<DOMRect | null>(null);
    const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
    const [lens, setLens] = useState({ left: 0, top: 0 });

    useEffect(() => {
        const query = window.matchMedia('(hover: hover) and (pointer: fine)');
        const update = () => setCanHover(query.matches);

        update();
        query.addEventListener('change', update);

        return () => query.removeEventListener('change', update);
    }, []);

    // `frameRect`/`panelPosition` are viewport coordinates captured once at
    // hover-start, not re-measured on every render — cheap, but it means a
    // scroll or resize mid-hover would leave the fixed panel pointing at the
    // wrong spot. Simplest correct fix: close the zoom rather than track it.
    useEffect(() => {
        if (! hovering) {
            return;
        }

        const close = () => setHovering(false);

        window.addEventListener('scroll', close, { passive: true, capture: true });
        window.addEventListener('resize', close);

        return () => {
            window.removeEventListener('scroll', close, { capture: true });
            window.removeEventListener('resize', close);
        };
    }, [hovering]);

    const onMouseEnter = () => {
        if (! canHover || ! frameRef.current) {
            return;
        }

        const rect = frameRef.current.getBoundingClientRect();
        setFrameRect(rect);

        // The zoom panel sits in whichever side of the viewport actually has
        // room for it — the storefront frame is centred with gutters on a
        // wide screen, but there's no guarantee either gutter is wide enough
        // (a narrower browser window, a smaller monitor).
        const spaceRight = window.innerWidth - rect.right;
        const spaceLeft = rect.left;

        setPanelPosition(
            spaceRight >= PANEL_SIZE + PANEL_GAP || spaceRight >= spaceLeft
                ? { top: rect.top, left: rect.right + PANEL_GAP }
                : { top: rect.top, left: Math.max(8, rect.left - PANEL_GAP - PANEL_SIZE) },
        );

        setHovering(true);
    };

    const onMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (! canHover || ! frameRect) {
            return;
        }

        const x = event.clientX - frameRect.left;
        const y = event.clientY - frameRect.top;

        setLens({
            left: Math.min(Math.max(x - LENS_SIZE / 2, 0), frameRect.width - LENS_SIZE),
            top: Math.min(Math.max(y - LENS_SIZE / 2, 0), frameRect.height - LENS_SIZE),
        });
    };

    const onMouseLeave = () => setHovering(false);

    const scale = PANEL_SIZE / LENS_SIZE;
    const showZoom = canHover && hovering && frameRect && panelPosition;

    return (
        <div>
            <div
                ref={frameRef}
                onMouseEnter={onMouseEnter}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                className="relative h-[285px] shrink-0 overflow-hidden bg-[#f0f0f0]"
            >
                <img
                    src={active.path}
                    alt={active.alt}
                    className="absolute inset-0 h-full w-full object-contain p-8"
                />

                {badge}

                {showZoom ? (
                    <div
                        className="pointer-events-none absolute border-2 border-brand bg-brand/10"
                        style={{ left: lens.left, top: lens.top, width: LENS_SIZE, height: LENS_SIZE }}
                    />
                ) : null}
            </div>

            {showZoom ? (
                <div
                    className="pointer-events-none fixed z-50 overflow-hidden rounded-[2px] border border-line bg-white shadow-pop"
                    style={{
                        top: panelPosition.top,
                        left: panelPosition.left,
                        width: PANEL_SIZE,
                        height: PANEL_SIZE,
                        backgroundImage: `url(${active.path})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: `${frameRect.width * scale}px ${frameRect.height * scale}px`,
                        backgroundPosition: `-${lens.left * scale}px -${lens.top * scale}px`,
                    }}
                />
            ) : null}

            {images.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto bg-white p-2.5 scrollbar-none">
                    {images.map((image, index) => (
                        <button
                            key={image.path}
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            aria-label={`Lihat foto ${index + 1}`}
                            aria-current={index === activeIndex}
                            className={`h-14 w-14 shrink-0 overflow-hidden rounded-[2px] border-2 bg-[#f6f6f6] ${
                                index === activeIndex ? 'border-brand' : 'border-transparent'
                            }`}
                        >
                            <img src={image.path} alt={image.alt} className="h-full w-full object-contain p-1" />
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
