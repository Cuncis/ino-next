import { Link } from '@/lib/inertia';
import Icon, { type IconName } from './Icon';

/**
 * Tappable header action, with an optional small count badge pinned to its
 * top-right corner (the cart icon's item count). Red rather than the brand
 * blue on purpose — this sits on headers that are themselves blue now
 * (`AppBar` tone="brand"), so a blue badge would disappear into it.
 */
export default function IconLink({ name, href, label, size = 19, badge, id }: { name: IconName, href: string, label: string, size?: number, badge?: number, id?: string }) {
    return (
        <Link id={id} href={href} aria-label={label} className="relative flex items-center">
            <Icon name={name} size={size} />

            {badge !== undefined ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-danger px-[3px] text-[8px] font-bold text-white">
                    {badge}
                </span>
            ) : null}
        </Link>
    );
}
