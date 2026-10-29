import { Head, Link } from '@/lib/inertia';
import { isValidElement, type ReactNode } from 'react';
import AppBar from '@/components/shop/AppBar';
import ChatWidget from '@/components/shop/ChatWidget';
import DesktopHeader from '@/components/shop/DesktopHeader';
import TabBar from '@/components/shop/TabBar';
import useIsDesktop from '@/components/shop/useIsDesktop';
import DesktopLayout from './DesktopLayout';

/**
 * Storefront screen shell.
 *
 * Below the `lg` breakpoint it is the phone frame: capped at `max-w-app`
 * (430px) and centred, owning the viewport height, with each screen scrolling
 * inside it rather than the page scrolling.
 *
 * From `lg` up the same screen content is shown as a centred card under the
 * desktop header instead (see `DesktopLayout`). The bottom `TabBar` is
 * dropped there; any other footer (an action bar) stays at the card's bottom.
 */
export default function MobileLayout({
    title,
    children,
    header = null,
    footer = null,
    background = 'bg-canvas',
    wide = false,
}: {
  title: string,
  children: import('react').ReactNode,
  header?: import('react').ReactNode,
  footer?: import('react').ReactNode,
  background?: string,
  /** Desktop only: use the full 1152px content width instead of a 672px column. */
  wide?: boolean,
}) {
    const isDesktop = useIsDesktop();

    if (isDesktop) {
        // A screen built around an AppBar gets a page heading on desktop
        // (breadcrumb, title, the bar's actions) instead of a blue phone bar.
        const bar = isValidElement<{ title?: string; actions?: ReactNode }>(header) && header.type === AppBar
            ? header
            : null;
        const heading = bar ? (bar.props.title ?? title) : null;

        return (
            <DesktopLayout title={title} header={<DesktopHeader />} narrow={! wide}>
                {heading ? (
                    <>
                        <nav aria-label="Breadcrumb" className={`pb-4 text-[11px] text-muted ${wide ? "pt-5" : ""}`}>
                            <Link href="/">Beranda</Link>
                            <span className="mx-2">&rsaquo;</span>
                            <span>{heading}</span>
                        </nav>

                        <div className="mb-5 flex items-end justify-between gap-4">
                            <h1 className="font-display text-[24px] text-brand">{heading}</h1>
                            {bar?.props.actions ? (
                                <div className="flex items-center gap-3 text-brand">{bar.props.actions}</div>
                            ) : null}
                        </div>
                    </>
                ) : null}

                <div
                    className={`relative flex min-h-[40vh] flex-col overflow-hidden border border-line ${background}`}
                >
                    {bar ? null : header}
                    {children}
                    {isValidElement(footer) && footer.type === TabBar ? null : footer}
                </div>
            </DesktopLayout>
        );
    }

    // A screen with its own action bar (cart, checkout) keeps the corner free.
    const hasActionBar = footer !== null && ! (isValidElement(footer) && footer.type === TabBar);

    return (
        <>
            <Head title={title} />

            <div className="flex h-screen [height:100dvh] justify-center bg-shell">
                <div
                    className={`relative flex h-full w-full max-w-app flex-col overflow-hidden font-shop text-ink ${background}`}
                >
                    {header}
                    {children}
                    {footer}
                    <ChatWidget placement="frame" showLauncher={! hasActionBar} />
                </div>
            </div>
        </>
    );
}
