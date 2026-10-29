const paths = {
    back: (
        <path
            d="M19 12H5M12 5l-7 7 7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    ),
    chevronRight: (
        <path
            d="M9 18l6-6-6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M21 21l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </>
    ),
    bag: (
        <>
            <path
                d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="1.5" />
        </>
    ),
    bagSimple: (
        <>
            <path
                d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5" />
        </>
    ),
    /** A real shopping-cart/trolley silhouette — `bag` reads as a tote, not a cart. */
    cart: (
        <>
            <circle cx="9" cy="21" r="1.4" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="18" cy="21" r="1.4" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M1.5 1.5h2.4l2.6 13.2a2 2 0 0 0 2 1.6h9.4a2 2 0 0 0 2-1.6L22 6H5.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </>
    ),
    user: (
        <>
            <path
                d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        </>
    ),
    home: (
        <>
            <path
                d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <polyline
                points="9,22 9,12 15,12 15,22"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
            />
        </>
    ),
    heart: (
        <path
            d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
            stroke="currentColor"
            strokeWidth="1.5"
        />
    ),
    /** Same silhouette as `heart`, filled solid — the "liked" state, not just a color change. */
    heartFilled: (
        <path
            d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
            fill="currentColor"
        />
    ),
    card: (
        <>
            <rect
                x="2"
                y="5"
                width="20"
                height="14"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path d="M2 9.5h20" stroke="currentColor" strokeWidth="1.5" />
            <rect
                x="5"
                y="12.5"
                width="4.5"
                height="3.5"
                rx="0.8"
                stroke="currentColor"
                strokeWidth="1.3"
            />
            <path
                d="M13 14.25h6"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
            />
        </>
    ),
    pin: (
        <>
            <path
                d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <polyline
                points="12 6 12 12 16.5 14.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </>
    ),
    /** Clock with a rewind arrow — transaction/order history, distinct from a plain `clock`. */
    history: (
        <>
            <path
                d="M3 12a9 9 0 1 0 3-6.7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <polyline
                points="3 4 3 9 8 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <polyline
                points="12 7 12 12 15.5 15.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </>
    ),
    phone: (
        <path
            d="M6.6 10.8c1.3 2.6 3.4 4.7 6 6l2-2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .5 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.9c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.1 2z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    ),
    navigation: (
        <path
            d="M3 11l18-8-8 18-2.5-7.5L3 11z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    ),
    promo: (
        <>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M15 9H9M15 12H9M12 15H9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </>
    ),
    file: (
        <>
            <path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" />
        </>
    ),
    help: (
        <>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" />
        </>
    ),
    logout: (
        <>
            <path
                d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.5" />
            <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" />
        </>
    ),
    edit: (
        <>
            <path
                d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path
                d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"
                stroke="currentColor"
                strokeWidth="1.5"
            />
        </>
    ),
    trash: (
        <>
            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                stroke="currentColor"
                strokeWidth="1.5"
            />
        </>
    ),
    copy: (
        <>
            <rect
                x="9"
                y="9"
                width="13"
                height="13"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path
                d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                stroke="currentColor"
                strokeWidth="1.5"
            />
        </>
    ),
    tag: (
        <>
            <path
                d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" />
        </>
    ),
    check: (
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" fill="none" />
    ),
    plus: (
        <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    ),
    close: (
        <path
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    ),
    eye: (
        <>
            <path
                d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                stroke="currentColor"
                strokeWidth="2"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        </>
    ),
    eyeOff: (
        <>
            <path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
                stroke="currentColor"
                strokeWidth="2"
            />
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />
        </>
    ),
    star: (
        <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="currentColor"
            stroke="none"
        />
    ),
    message: (
        <path
            d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
            stroke="currentColor"
            strokeWidth="1.5"
        />
    ),
    facebook: (
        <path
            d="M13.5 8.5H17l-.6 3.5h-2.9V22h-3.7V12H7.5V8.5h2.3V6.8c0-2.4 1.4-3.8 3.6-3.8H17v3.4h-1.9c-.9 0-1.6.4-1.6 1.5v.6z"
            fill="currentColor"
            stroke="none"
        />
    ),
    twitter: (
        <path
            d="M22 5.9a8.2 8.2 0 01-2.36.64A4.12 4.12 0 0021.45 4.8a8.3 8.3 0 01-2.61.98A4.1 4.1 0 0015.85 3.9c-2.27 0-4.11 1.81-4.11 4.03 0 .32.04.63.11.92A11.7 11.7 0 013.39 4.64a4 4 0 00-.55 2.02c0 1.4.72 2.63 1.81 3.36a4.1 4.1 0 01-1.86-.51v.05c0 1.96 1.41 3.6 3.28 3.97a4.2 4.2 0 01-1.85.07c.52 1.61 2.04 2.78 3.83 2.82A8.23 8.23 0 012 17.86a11.6 11.6 0 006.29 1.84c7.55 0 11.67-6.16 11.67-11.49 0-.18 0-.35-.01-.52A8.18 8.18 0 0022 5.9z"
            fill="currentColor"
            stroke="none"
        />
    ),
};

/**
 * Single-source SVG icon set for the storefront screens.
 *
 * Every glyph is drawn on a 24x24 grid and inherits `currentColor`, so colour is
 * controlled with a text utility on the element itself.
 */
export type IconName = keyof typeof paths;

export default function Icon({ name, size = 20, className = '' }: { name: keyof typeof paths, size?: number, className?: string }) {
    const glyph = paths[name];

    if (! glyph) {
        return null;
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className={`shrink-0 ${className}`}
            aria-hidden="true"
        >
            {glyph}
        </svg>
    );
}
