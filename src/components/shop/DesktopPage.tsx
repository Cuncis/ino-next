import { Link } from '@/lib/inertia';
import type { ReactNode } from 'react';
import DesktopLayout from '@/layouts/DesktopLayout';
import DesktopHeader from './DesktopHeader';
import FlashBanner from './FlashBanner';

/**
 * Frame for the custom desktop pages: site header, breadcrumb, a page title
 * with optional actions on the right, then the content at full width.
 */
export default function DesktopPage({ title, heading, breadcrumb, actions, children }: {
    title: string;
    heading: ReactNode;
    breadcrumb: { label: string; href?: string }[];
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <DesktopLayout title={title} header={<DesktopHeader />}>
            <nav aria-label="Breadcrumb" className="py-5 text-[11px] text-muted">
                <Link href="/">Beranda</Link>
                {breadcrumb.map((crumb) => (
                    <span key={crumb.label}>
                        <span className="mx-2">&rsaquo;</span>
                        {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                    </span>
                ))}
            </nav>

            <div className="mb-6 flex items-end justify-between gap-4">
                <h1 className="font-display text-[26px] text-brand">{heading}</h1>
                {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
            </div>

            <FlashBanner />

            {children}
        </DesktopLayout>
    );
}

export const statusTone = (status: string): string => {
    if (status === 'Selesai') {
        return 'bg-success text-white';
    }

    if (status === 'Dibatalkan' || status === 'Kedaluwarsa') {
        return 'bg-line text-muted';
    }

    return 'bg-warning text-ink';
};
