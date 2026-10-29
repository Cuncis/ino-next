import { Head, Link } from '@/lib/inertia';
import type { ReactNode } from 'react';
import { asset, money } from './data';
import Icon from './Icon';

interface SummaryProps {
    items: Pick<CartLine, 'sku' | 'name' | 'image' | 'quantity' | 'lineTotal'>[];
    subtotal: number;
    discount?: number;
    couponCode?: string | null;
    /** Right-hand text of the "Pengiriman" row, e.g. "Gratis" or a price. */
    shippingLabel: string;
    total: number;
}

/**
 * The order summary column: one row per product with a quantity badge on its
 * photo, then subtotal, delivery and the bold grand total.
 */
export function CheckoutSummary({ items, subtotal, discount = 0, couponCode, shippingLabel, total }: SummaryProps) {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div>
            <ul className="space-y-4">
                {items.map((item) => (
                    <li key={item.sku} className="flex items-center gap-4">
                        <div className="relative h-16 w-16 shrink-0">
                            <div className="h-full w-full overflow-hidden rounded-[2px] border border-line bg-white p-1">
                                <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                            </div>
                            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">
                                {item.quantity}
                            </span>
                        </div>

                        <span className="min-w-0 flex-1 text-[13px] leading-5 text-ink">{item.name}</span>
                        <span className="text-[13px] text-ink">{money(item.lineTotal)}</span>
                    </li>
                ))}
            </ul>

            <dl className="mt-6 space-y-2 text-[13px]">
                <div className="flex justify-between">
                    <dt>Subtotal &bull; {itemCount} item</dt>
                    <dd>{money(subtotal)}</dd>
                </div>

                {discount > 0 ? (
                    <div className="flex justify-between text-brand">
                        <dt>Diskon{couponCode ? ` (${couponCode})` : ''}</dt>
                        <dd>-{money(discount)}</dd>
                    </div>
                ) : null}

                <div className="flex justify-between">
                    <dt>Pengiriman</dt>
                    <dd className="text-muted">{shippingLabel}</dd>
                </div>

                <div className="flex items-baseline justify-between pt-3 text-[18px] font-bold">
                    <dt>Total</dt>
                    <dd>
                        <span className="mr-2 text-[11px] font-normal text-muted">IDR</span>
                        {money(total)}
                    </dd>
                </div>
            </dl>
        </div>
    );
}

/**
 * Shopify-style checkout frame: a slim white header with the logo and a bag
 * link, a white form column on the left and a grey order-summary column on
 * the right. No site navigation or footer, so nothing pulls the shopper away.
 */
export default function DesktopCheckoutShell({ title, summary, children }: {
    title: string;
    summary: ReactNode;
    children: ReactNode;
}) {
    return (
        <>
            <Head title={title} />

            <div className="min-h-screen bg-white font-shop text-ink">
                <header className="border-b border-line">
                    <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6">
                        <Link href="/" aria-label="Inofarma">
                            <img src={asset.logo('white')} alt="Inofarma" className="h-9 w-auto" />
                        </Link>

                        <Link href="/cart" aria-label="Kembali ke keranjang" className="text-brand">
                            <Icon name="bagSimple" size={24} />
                        </Link>
                    </div>
                </header>

                <div className="grid min-h-[calc(100vh-73px)] grid-cols-2">
                    <main className="flex justify-end px-10 py-10">
                        <div className="w-full max-w-[560px]">{children}</div>
                    </main>

                    <aside className="border-l border-line bg-[#f5f5f5] px-10 py-10">
                        <div className="max-w-[460px]">{summary}</div>
                    </aside>
                </div>
            </div>
        </>
    );
}
