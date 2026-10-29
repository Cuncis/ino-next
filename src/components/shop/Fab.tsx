import { Link } from '@/lib/inertia';
import Icon from './Icon';

/**
 * Floating "add" action pinned to the bottom-right of the screen frame.
 */
export default function Fab({ href = '#', label }: { href?: string, label: string }) {
    return (
        <Link
            href={href}
            aria-label={label}
            className="absolute bottom-[18px] right-[18px] z-20 flex h-control w-control items-center justify-center rounded-full bg-brand text-white shadow-[0_4px_14px_rgba(9,0,170,.35)]"
        >
            <Icon name="plus" size={24} />
        </Link>
    );
}
