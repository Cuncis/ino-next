import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';

// A plain click still moves the cursor a few pixels between mousedown and
// mouseup — a trackpad especially. Below this threshold it's a click, not a
// drag: don't mark it as moved (which would swallow the click) and don't
// touch scrollLeft (which would nudge the strip on every tap).
const DRAG_THRESHOLD = 8;

/**
 * Lets a horizontally-scrolling strip be dragged with a held mouse cursor,
 * not just swiped with a finger — touch already scrolls a `overflow-x-auto`
 * strip natively (with momentum), so this only wires up mouse events;
 * reimplementing it for touch would fight that native scrolling.
 *
 * Tracks the drag with window-level `mousemove`/`mouseup` listeners rather
 * than `setPointerCapture` — capture ties the drag to the element, so a
 * release outside it (dragged past the strip's edge) never reaches this
 * component and the "just dragged" flag is left stuck, silently swallowing
 * every click afterwards. `setPointerCapture` has also historically had
 * cross-browser quirks around suppressing the click that follows it. Window
 * listeners sidestep both.
 *
 * Spread the returned props onto the scrollable element. A drag that moves
 * more than `DRAG_THRESHOLD` swallows the click that would otherwise follow
 * — so a `Link`/`button` inside the strip doesn't navigate when the shopper
 * was just dragging past it.
 */
export default function useDragScroll() {
    const ref = useRef<HTMLDivElement>(null);
    const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (! drag.current.active || ! ref.current) {
                return;
            }

            const delta = event.clientX - drag.current.startX;

            if (! drag.current.moved && Math.abs(delta) < DRAG_THRESHOLD) {
                return;
            }

            drag.current.moved = true;
            ref.current.scrollLeft = drag.current.startScroll - delta;
        };

        const onMouseUp = () => {
            drag.current.active = false;

            // The click that follows this mouseup (if any) lands on the
            // element under the cursor, which is only *this* strip's
            // onClickCapture when the drag ended back inside it — so that
            // handler resets `moved` itself in that case. Otherwise nothing
            // would ever clear it; do it here, one tick later so a same-strip
            // click still sees `moved` true first and gets suppressed.
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
    }, []);

    const onMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
        if (event.button !== 0 || ! ref.current) {
            return;
        }

        drag.current = { active: true, startX: event.clientX, startScroll: ref.current.scrollLeft, moved: false };
    };

    const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
        if (drag.current.moved) {
            event.preventDefault();
            event.stopPropagation();
            drag.current.moved = false;
        }
    };

    return {
        ref,
        onMouseDown,
        onClickCapture,
        className: 'cursor-grab select-none active:cursor-grabbing',
    };
}
