/**
 * A little "toss into the cart" flourish for the moment "Masukkan ke
 * Keranjang" succeeds — a small dot arcs from the button up to the header's
 * cart icon (`#cart-icon-target`, see `ProductDetail.jsx`) and the icon
 * pulses once it lands, so the eye has somewhere obvious to go right after
 * the tap.
 *
 * Plain DOM + the Web Animations API rather than React state: it's a
 * one-shot, fire-and-forget effect with nothing to re-render for, and it
 * needs to survive the calling component unmounting mid-flight (the button
 * it started from can disappear — e.g. a branch switch resets the form —
 * without cutting the animation short).
 */
export default function flyToCart(fromElement: HTMLElement | null) {
    if (typeof window === 'undefined' || ! fromElement) {
        return;
    }

    const target = document.getElementById('cart-icon-target');

    if (! target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const from = fromElement.getBoundingClientRect();
    const to = target.getBoundingClientRect();

    const size = 16;
    const startX = from.left + from.width / 2 - size / 2;
    const startY = from.top + from.height / 2 - size / 2;
    const endX = to.left + to.width / 2 - size / 2;
    const endY = to.top + to.height / 2 - size / 2;

    // A gentle upward bow through the midpoint reads as a physical toss
    // rather than a robotic straight-line slide — but it has to stay a bow
    // *between* the two points, not a peak above the (usually much higher)
    // cart icon itself, or the dot visibly overshoots past the header
    // before dropping back down to it instead of arriving there directly.
    const midX = (startX + endX) / 2;
    const lift = Math.min(70, Math.max(24, Math.abs(endX - startX) * 0.3));
    const midY = (startY + endY) / 2 - lift;

    const duration = 1100;

    const dot = document.createElement('div');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.cssText = `
        position: fixed;
        left: 0;
        top: 0;
        width: ${size}px;
        height: ${size}px;
        border-radius: 9999px;
        background: #0900AA;
        box-shadow: 0 2px 6px rgba(9, 0, 170, .4);
        pointer-events: none;
        z-index: 9999;
        will-change: transform, opacity;
    `;
    document.body.appendChild(dot);

    // The dot arrives at the icon still fully visible (offset .82) and only
    // shrinks/fades in place after that — so there's a clear, unhurried
    // moment of "it's exactly here" instead of dissolving mid-flight right
    // as it's supposed to be landing.
    const animation = dot.animate(
        [
            { transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 1, offset: 0 },
            { transform: `translate(${midX}px, ${midY}px) scale(0.9)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${endX}px, ${endY}px) scale(0.6)`, opacity: 1, offset: 0.82 },
            { transform: `translate(${endX}px, ${endY}px) scale(0.15)`, opacity: 0, offset: 1 },
        ],
        { duration, easing: 'cubic-bezier(.35, 0, .25, 1)' },
    );

    const cleanup = () => dot.remove();
    animation.finished.then(cleanup).catch(cleanup);

    window.setTimeout(() => {
        target.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
            { duration: 320, easing: 'ease-out' },
        );
    }, duration * 0.82);
}
