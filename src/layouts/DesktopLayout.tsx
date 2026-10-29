import { Head, Link, usePage } from '@/lib/inertia';
import ChatWidget from '@/components/shop/ChatWidget';
import NewsletterSignup from '@/components/shop/NewsletterSignup';

/**
 * Desktop page shell: a normal scrolling document (unlike `MobileLayout`'s
 * fixed-height phone frame) with a full-bleed header and a centred content
 * column and the site footer. There is deliberately no bottom tab bar here.
 * It also owns the chat bubble, because the desktop home, shop, cart and product
 * pages render this layout directly rather than through `MobileLayout`.
 */
export default function DesktopLayout({ title, children, header = null, narrow = false }: {
  title: string,
  children: import('react').ReactNode,
  header?: import('react').ReactNode,
  narrow?: boolean,
}) {
    // Edited in the admin under Konten Website > Footer & Perusahaan.
    const footer = usePage().props.siteFooter;

    return (
        <>
            <Head title={title} />

            <div className="min-h-screen bg-canvas font-shop text-ink">
                {header}
                <main className={`mx-auto w-full px-6 pb-12 ${narrow ? 'max-w-2xl pt-8' : 'max-w-6xl'}`}>{children}</main>

                <footer className="bg-brand text-white">
                    <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_auto] gap-16 px-6 py-12">
                        <div>
                            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[1.5px]">
                                {footer?.aboutTitle}
                            </h3>
                            <p className="max-w-sm text-[11px] leading-relaxed text-white/75">
                                {footer?.aboutText}
                            </p>
                        </div>

                        <nav aria-label={footer?.menuTitle}>
                            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[1.5px]">{footer?.menuTitle}</h3>
                            <ul className="space-y-3 text-[11px] text-white/75">
                                {(footer?.links ?? []).map((link, index) => (
                                    <li key={`${index}-${link.href}`}>
                                        {link.external ? (
                                            <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                                        ) : (
                                            <Link href={link.href}>{link.label}</Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </nav>

                        <NewsletterSignup />
                    </div>

                    <div className="border-t border-white/15 py-4 text-center text-[10px] text-white/60">
                        &copy; {new Date().getFullYear()} {footer?.copyright}
                    </div>
                </footer>
            </div>

            <ChatWidget placement="viewport" />
        </>
    );
}
