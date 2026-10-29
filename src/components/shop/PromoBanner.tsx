import { Link } from '@/lib/inertia';
import Icon, { type IconName } from './Icon';

/**
 * Storefront promo panel.
 *
 * Replaces the template's photographic fashion banners — those advertised a
 * different shop entirely. Built from the brand palette so it needs no artwork
 * and stays correct if the catalogue changes.
 */
export default function PromoBanner({
    href,
    eyebrow,
    title,
    caption,
    cta,
    icon,
    tone = 'brand',
    className = '',
}: {
  href: string,
  eyebrow: string,
  title: string,
  caption: string,
  cta: string,
  icon: IconName,
  tone?: 'brand'|'success',
  className?: string,
}) {
    const tones = {
        brand: 'bg-brand text-white',
        success: 'bg-success text-ink',
    };

    return (
        <Link
            href={href}
            className={`relative flex items-center gap-4 overflow-hidden px-5 py-6 ${tones[tone]} ${className}`}
        >
            <span className="relative z-10 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[2px] opacity-80">
                    {eyebrow}
                </span>

                <span className="mt-1.5 block whitespace-pre-line font-display text-xl leading-tight">
                    {title}
                </span>

                <span className="mt-1 block text-[11px] opacity-90">{caption}</span>

                <span className="mt-3 inline-flex items-center gap-1 border-b border-current pb-0.5 text-[11px] font-bold uppercase tracking-wider">
                    {cta}
                </span>
            </span>

            <Icon name={icon} size={72} className="relative z-10 shrink-0 opacity-30" />

            <span
                aria-hidden="true"
                className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10"
            />
            <span
                aria-hidden="true"
                className="absolute -bottom-12 right-16 h-28 w-28 rounded-full bg-white/10"
            />
        </Link>
    );
}
