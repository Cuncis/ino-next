import { Link } from '@/lib/inertia';
import { asset } from './data';
import Icon from './Icon';
import useIsDesktop from './useIsDesktop';

/**
 * Fixed 48px screen header: optional back arrow or wordmark on the left, a
 * centred screen title, and up to two action icons on the right.
 *
 * `back` as a string navigates to that URL. `back={true}` instead replays the
 * browser's own back navigation (`history.back()`), landing on whichever
 * screen actually linked here rather than one hardcoded destination — needed
 * wherever this bar is reused from more than one caller (e.g. Terms/Privacy,
 * opened from sign-up, checkout, or the profile menu).
 */
export default function AppBar({ title, back, brand = false, actions, tone = 'blush' }: {
  title?: string,
  back?: string|boolean,
  brand?: boolean,
  actions?: import('react').ReactNode,
  tone?: 'blush'|'white'|'ink'|'brand',
}) {
    const tones = {
        blush: 'bg-blush text-ink',
        white: 'bg-white text-ink',
        ink: 'bg-ink text-white',
        brand: 'bg-brand text-white',
    };

    // The blue-background artwork only reads on a dark/blue bar — everything
    // else (blush, white) gets the dark-on-light variant. See `asset.logo()`.
    const logoTone = tone === 'ink' || tone === 'brand' ? 'blue' : 'white';

    const isDesktop = useIsDesktop();

    return (
        <header
            className={`flex shrink-0 items-center ${
                isDesktop ? 'h-14 border-b border-line bg-white px-6 text-brand' : `h-appbar px-3.5 ${tones[tone]}`
            }`}
        >
            <div className="flex min-w-[40px] items-center gap-3">
                {back ? (
                    typeof back === 'string' ? (
                        <Link href={back} aria-label="Kembali">
                            <Icon name="back" size={20} />
                        </Link>
                    ) : (
                        <button type="button" onClick={() => window.history.back()} aria-label="Kembali">
                            <Icon name="back" size={20} />
                        </button>
                    )
                ) : null}

                {brand && ! isDesktop ? (
                    <Link href="/" aria-label="Inofarma" className="flex items-center">
                        <img src={asset.logo(logoTone)} alt="Inofarma" className="h-6 w-auto" />
                    </Link>
                ) : null}
            </div>

            <div className={`flex-1 ${isDesktop ? 'text-left' : 'text-center'}`}>
                {title ? (
                    <span className={`font-display uppercase tracking-[0.5px] ${isDesktop ? 'text-base' : 'text-sm'}`}>
                        {title}
                    </span>
                ) : null}
            </div>

            <div className="flex min-w-[40px] items-center justify-end gap-3">
                {actions}
            </div>
        </header>
    );
}
