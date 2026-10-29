import { Link } from '@/lib/inertia';

/**
 * Serif section label with an optional trailing link. Carries its own
 * top/bottom margin so sections stay visually separated wherever it's
 * dropped in, without each caller having to remember its own spacing.
 */
export default function SectionHeading({ title, action, actionHref = '#', className = '' }: { title: string, action?: string, actionHref?: string, className?: string }) {
    return (
        <div className={`mb-3 mt-6 flex items-center justify-between ${className}`}>
            <span className="font-display text-[14px] text-brand">{title}</span>

            {action ? (
                <Link href={actionHref} className="text-[11px] text-brand">
                    {action}
                </Link>
            ) : null}
        </div>
    );
}
