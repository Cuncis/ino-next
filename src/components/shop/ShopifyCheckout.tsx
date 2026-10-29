import { Head, Link } from '@/lib/inertia';
import { useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { asset, money } from './data';
import Icon from './Icon';

/**
 * Building blocks for the checkout page, drawn to match Shopify's default
 * checkout: system font, 5px corners, #d9d9d9 hairlines, floating-label
 * inputs, radio rows grouped in one rounded box, a grey summary column and a
 * full-width blue pay button. Colours are literal on purpose: this screen is
 * meant to look like that checkout, not like the rest of the storefront.
 */
const ACCENT = '#1773b0';
const BORDER = 'border-[#d9d9d9]';

export function CheckoutFrame({ title, summary, itemCount, total, children }: {
    title: string;
    summary: ReactNode;
    itemCount: number;
    total: number;
    children: ReactNode;
}) {
    const [summaryOpen, setSummaryOpen] = useState(false);

    return (
        <>
            <Head title={title} />

            <div className="shopify-checkout min-h-screen bg-white text-[14px] leading-[1.5] text-[#333]">
                <header className="border-b border-[#e1e1e1] lg:hidden">
                    <div className="flex h-[64px] items-center justify-between px-5">
                        <span className="w-6" />
                        <Link href="/" aria-label="Inofarma">
                            <img src={asset.logo('white')} alt="Inofarma" className="h-8 w-auto" />
                        </Link>
                        <Link href="/cart" aria-label="Kembali ke keranjang" style={{ color: ACCENT }}>
                            <Icon name="bagSimple" size={22} />
                        </Link>
                    </div>
                </header>

                <div className="border-b border-[#e1e1e1] bg-[#fafafa] lg:hidden">
                    <button
                        type="button"
                        onClick={() => setSummaryOpen((open) => ! open)}
                        aria-expanded={summaryOpen}
                        className="flex w-full items-center justify-between px-5 py-4 text-left"
                        style={{ color: ACCENT }}
                    >
                        <span className="flex items-center gap-2">
                            <Icon name="bagSimple" size={18} />
                            {summaryOpen ? 'Sembunyikan' : 'Tampilkan'} ringkasan pesanan
                            <span className={`inline-block transition-transform ${summaryOpen ? 'rotate-180' : ''}`}>&#9662;</span>
                        </span>
                        <span className="text-[18px] font-semibold text-[#333]">{money(total)}</span>
                    </button>
                    {summaryOpen ? <div className="border-t border-[#e1e1e1] px-5 py-5">{summary}</div> : null}
                </div>

                <div className="lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                    <main className="px-5 pb-10 pt-6 lg:flex lg:justify-end lg:px-[5%] lg:pt-10">
                        <div className="w-full lg:max-w-[600px] lg:pr-10">
                            <Link href="/" aria-label="Inofarma" className="mb-8 hidden lg:block">
                                <img src={asset.logo('white')} alt="Inofarma" className="h-10 w-auto" />
                            </Link>
                            {children}
                        </div>
                    </main>

                    <aside className="hidden border-l border-[#e1e1e1] bg-[#fafafa] px-[5%] pt-12 lg:block">
                        <div className="sticky top-10 max-w-[420px] pl-10">
                            {summary}
                            <span className="sr-only">{itemCount} item</span>
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
}

export function OrderSummary({ items, subtotal, discount, couponCode, shippingLabel, total }: {
    items: Pick<CartLine, 'sku' | 'name' | 'image' | 'quantity' | 'lineTotal'>[];
    subtotal: number;
    discount: number;
    couponCode?: string | null;
    shippingLabel: string;
    total: number;
}) {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div>
            <ul className="space-y-3">
                {items.map((item) => (
                    <li key={item.sku} className="flex items-center gap-4">
                        <div className="relative h-16 w-16 shrink-0">
                            <div className="h-full w-full overflow-hidden rounded-lg border border-[#e1e1e1] bg-white p-1">
                                <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                            </div>
                            <span className="absolute -right-2 -top-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#727272]/90 px-1 text-[12px] font-medium text-white">
                                {item.quantity}
                            </span>
                        </div>
                        <span className="min-w-0 flex-1 text-[14px] font-medium leading-5">{item.name}</span>
                        <span className="text-[14px]">{money(item.lineTotal)}</span>
                    </li>
                ))}
            </ul>

            <dl className="mt-6 space-y-2 text-[14px]">
                <div className="flex justify-between">
                    <dt>Subtotal &middot; {itemCount} item</dt>
                    <dd>{money(subtotal)}</dd>
                </div>

                {discount > 0 ? (
                    <div className="flex justify-between">
                        <dt>Diskon{couponCode ? ` (${couponCode})` : ''}</dt>
                        <dd>-{money(discount)}</dd>
                    </div>
                ) : null}

                <div className="flex justify-between">
                    <dt>Pengiriman</dt>
                    <dd className="text-[#707070]">{shippingLabel}</dd>
                </div>

                <div className="flex items-baseline justify-between pt-3">
                    <dt className="text-[16px] font-semibold">Total</dt>
                    <dd>
                        <span className="mr-2 text-[12px] text-[#707070]">IDR</span>
                        <span className="text-[24px] font-semibold">{money(total).replace(/^Rp\s?/, '')}</span>
                    </dd>
                </div>
            </dl>
        </div>
    );
}

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
    return (
        <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[21px] font-semibold leading-7">{children}</h2>
            {aside}
        </div>
    );
}

const fieldBox = (error?: string) => `block w-full rounded-[10px] border bg-white px-3 text-[14px] text-[#333] outline-none transition-shadow focus:border-[#1773b0] focus:shadow-[0_0_0_1px_#1773b0] focus:ring-0 ${
    error ? 'border-[#e22120]' : BORDER
}`;

export function FieldError({ message }: { message?: string }) {
    return message ? <p className="mt-1.5 text-[13px] text-[#c5280c]">{message}</p> : null;
}

/** Floating-label input: the label sits inside, and shrinks to the top once there is a value. */
export function TextField({ id, label, error, className = '', ...rest }: {
    id: string;
    label: string;
    error?: string;
    className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className={className}>
            <div className="relative">
                <input
                    id={id}
                    name={id}
                    placeholder=" "
                    className={`peer h-[48px] pb-0 pt-[18px] placeholder-transparent ${fieldBox(error)}`}
                    {...rest}
                />
                <label
                    htmlFor={id}
                    className="pointer-events-none absolute left-3 top-[7px] text-[12px] leading-4 text-[#707070] transition-all peer-placeholder-shown:top-[14px] peer-placeholder-shown:text-[14px] peer-placeholder-shown:leading-5 peer-focus:top-[7px] peer-focus:text-[12px] peer-focus:leading-4"
                >
                    {label}
                </label>
            </div>
            <FieldError message={error} />
        </div>
    );
}

/** A select drawn like {@link TextField}: small label on top, the choice below. */
export function SelectField({ id, label, error, className = '', children, ...rest }: {
    id: string;
    label: string;
    error?: string;
    className?: string;
    children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className={className}>
            <div className="relative">
                <select
                    id={id}
                    className={`h-[48px] appearance-none truncate bg-none pb-0 pr-9 pt-[18px] ${fieldBox(error)}`}
                    {...rest}
                >
                    {children}
                </select>
                <label htmlFor={id} className="pointer-events-none absolute left-3 top-[7px] text-[12px] leading-4 text-[#707070]">
                    {label}
                </label>
                <Icon name="chevronRight" size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-[#1773b0]" />
            </div>
            <FieldError message={error} />
        </div>
    );
}

export function OptionGroup({ children }: { children: ReactNode }) {
    return <div className={`overflow-hidden rounded-[12px] border ${BORDER}`}>{children}</div>;
}

/** One radio row inside an {@link OptionGroup}; the chosen row gets the blue outline and tint. */
export function OptionRow({ selected, onSelect, disabled = false, title, detail, trailing, children }: {
    selected: boolean;
    onSelect?: () => void;
    disabled?: boolean;
    title: ReactNode;
    detail?: ReactNode;
    trailing?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className={`border-t first:rounded-t-[11px] first:border-t-0 last:rounded-b-[11px] ${BORDER} ${selected ? 'bg-[#f0f5fa] outline outline-2 -outline-offset-1 outline-[#1773b0]' : 'bg-white'}`}>
            <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={onSelect}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
            >
                <span
                    className={`h-[18px] w-[18px] shrink-0 rounded-full border bg-white ${selected ? 'border-[5px] border-[#1773b0]' : 'border-[#b5b5b5]'}`}
                />
                <span className="min-w-0 flex-1">
                    <span className="block text-[14px]">{title}</span>
                    {detail ? <span className="block text-[13px] text-[#707070]">{detail}</span> : null}
                </span>
                {trailing ? <span className="shrink-0 text-[14px]">{trailing}</span> : null}
            </button>
            {children ? <div className="px-4 pb-4 pl-[46px]">{children}</div> : null}
        </div>
    );
}

/** The grey two-way switch under "Pengantaran": the active tab is a white raised pill. */
export function SegmentedTabs<T extends string>({ value, onChange, tabs, label }: {
    value: T;
    onChange: (next: T) => void;
    tabs: { value: T; label: string; icon: ReactNode }[];
    label: string;
}) {
    return (
        <div role="tablist" aria-label={label} className="flex gap-1 rounded-[12px] bg-[#f5f5f5] p-1">
            {tabs.map((tab) => {
                const active = tab.value === value;

                return (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(tab.value)}
                        className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[9px] text-[14px] font-semibold ${
                            active ? 'cursor-default bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] ring-1 ring-black/5 hover:[filter:none]' : 'text-[#333]'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

export function PayButton({ children, disabled }: { children: ReactNode; disabled: boolean }) {
    return (
        <button
            type="submit"
            disabled={disabled}
            className="h-[54px] w-full rounded-[10px] bg-[#1773b0] text-[15px] font-semibold text-white transition-colors hover:bg-[#135f93] disabled:cursor-not-allowed disabled:opacity-60"
        >
            {children}
        </button>
    );
}

export function CheckoutCheckbox({ checked, onChange, children }: {
    checked: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    children: ReactNode;
}) {
    return (
        <label className="flex items-start gap-2.5 text-[14px] leading-5">
            <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 rounded-[3px] border-[#b5b5b5] text-[#1773b0] focus:ring-[#1773b0]" />
            <span>{children}</span>
        </label>
    );
}
