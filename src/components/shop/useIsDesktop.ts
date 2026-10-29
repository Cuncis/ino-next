import { createContext, useContext, useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * The server's guess from the request headers (see `src/server/shop/device.ts`), so the
 * server-rendered HTML and the browser's first render agree. The Laravel app rendered
 * only in the browser and could read the screen straight away.
 */
export const DesktopHintContext = createContext(false);

/**
 * True at Tailwind's `lg` breakpoint and up. Home uses it to mount either the
 * phone shell or the desktop page, rather than rendering both and hiding one
 * (which would run two carousels and double every request for banner art).
 */
export default function useIsDesktop(): boolean {
    const [isDesktop, setIsDesktop] = useState(useContext(DesktopHintContext));

    useEffect(() => {
        const query = window.matchMedia(DESKTOP_QUERY);
        const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);

        // the real screen wins over the server's guess once the page is running
        setIsDesktop(query.matches);
        query.addEventListener('change', onChange);

        return () => query.removeEventListener('change', onChange);
    }, []);

    return isDesktop;
}
