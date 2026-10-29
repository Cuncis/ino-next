import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, router } from '@/lib/inertia';
import Icon from './Icon';
import { money, productMatchesSearch, useShopCatalog } from './data';

const PAGES: { label: string; href: string }[] = [
    { label: 'Info Pengiriman', href: '/shipping-info' },
    { label: 'Pertanyaan Umum (FAQ)', href: '/faq' },
    { label: 'Kebijakan Pengembalian Dana', href: '/kebijakan-pengembalian-dana' },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits `text` around the first place `query` occurs, marking that part with
 * `wrap`. Used to show which letters of a suggestion or product matched.
 */
function highlight(text: string, query: string, wrap: (match: string) => ReactNode): ReactNode {
    const match = new RegExp(escapeRegExp(query), 'i').exec(text);

    if (! match) {
        return text;
    }

    return (
        <>
            {text.slice(0, match.index)}
            {wrap(match[0])}
            {text.slice(match.index + match[0].length)}
        </>
    );
}

function SectionHeading({ children }: { children: ReactNode }) {
    return (
        <div className="border-y border-line bg-canvas px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted first:border-t-0">
            {children}
        </div>
    );
}

/**
 * The desktop header's search box. Results appear as you type, entirely from
 * the catalogue already on the page, so there is no request per keystroke:
 * word suggestions, matching products, collections (categories) and site
 * pages. Enter or "Lihat semua hasil" opens the full result list.
 */
export default function HeaderSearch() {
    const { products, categories } = useShopCatalog();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const wrapper = useRef<HTMLDivElement>(null);

    const needle = query.trim().toLowerCase();

    const results = useMemo(() => {
        if (! needle) {
            return null;
        }

        const startsWord = (text: string) => text.toLowerCase().split(/[\s/()-]+/).some((word) => word.startsWith(needle));

        // Word-start matches are what people mean first; a match buried in the
        // middle of a name still counts, just lower down.
        // Products matched only through their description rank after name matches.
        const inName = (product: CatalogProduct) => product.name.toLowerCase().includes(needle);
        const matched = products
            .filter((product) => productMatchesSearch(product, needle))
            .sort(
                (a, b) =>
                    Number(inName(b)) - Number(inName(a)) || Number(startsWord(b.name)) - Number(startsWord(a.name)),
            );

        const suggestions: string[] = [];
        const add = (term: string) => {
            const clean = term.trim().toLowerCase();

            if (clean.includes(needle) && ! suggestions.includes(clean) && suggestions.length < 3) {
                suggestions.push(clean);
            }
        };

        for (const product of matched) {
            const words = product.name.toLowerCase().split(/\s+/);

            words.forEach((word, index) => {
                if (word.startsWith(needle)) {
                    add(word);
                    add(`${words[index - 1] ?? ''} ${word}`);
                    add(`${word} ${words[index + 1] ?? ''}`);
                }
            });
        }

        return {
            suggestions,
            products: matched.slice(0, 4),
            collections: categories.filter((category) => category.name.toLowerCase().includes(needle)).slice(0, 3),
            pages: PAGES.filter((page) => page.label.toLowerCase().includes(needle)).slice(0, 3),
        };
    }, [needle, products, categories]);

    useEffect(() => {
        if (! open) {
            return;
        }

        const onPointerDown = (event: MouseEvent) => {
            if (wrapper.current && ! wrapper.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    useEffect(() => router.on('navigate', () => setOpen(false)), []);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setOpen(false);

        router.visit(needle ? `/shop?q=${encodeURIComponent(query.trim())}` : '/shop');
    };

    const hasResults = results
        && (results.suggestions.length || results.products.length || results.collections.length || results.pages.length);

    return (
        <div ref={wrapper} className="relative flex-1">
            <form onSubmit={submit} role="search" className="flex h-10 overflow-hidden bg-white">
                <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder="Cari produk kesehatan di Inofarma"
                    aria-label="Cari produk kesehatan di Inofarma"
                    autoComplete="off"
                    className="min-w-0 flex-1 border-0 px-4 text-[13px] text-ink placeholder:text-faint focus:outline-hidden focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
                />

                <button
                    type="submit"
                    aria-label="Cari"
                    className="flex w-11 shrink-0 items-center justify-center bg-success text-cream"
                >
                    <Icon name="search" size={18} />
                </button>
            </form>

            {open && results ? (
                <div className="absolute inset-x-0 top-full z-50 max-h-[80vh] overflow-y-auto bg-white text-ink shadow-pop">
                    {! hasResults ? (
                        <p className="px-4 py-6 text-[13px] text-muted">
                            Tidak ada hasil untuk &ldquo;{query.trim()}&rdquo;.
                        </p>
                    ) : null}

                    {results.suggestions.length ? (
                        <>
                            <SectionHeading>Saran</SectionHeading>
                            {results.suggestions.map((term) => (
                                <Link
                                    key={term}
                                    href={`/shop?q=${encodeURIComponent(term)}`}
                                    className="block px-4 py-3 text-[13px] text-muted hover:bg-lilac"
                                >
                                    {highlight(term, needle, (match) => (
                                        <mark className="bg-[#fff200] text-ink">{match}</mark>
                                    ))}
                                </Link>
                            ))}
                        </>
                    ) : null}

                    {results.products.length ? (
                        <>
                            <SectionHeading>Produk</SectionHeading>
                            {results.products.map((product) => (
                                <Link
                                    key={product.id}
                                    href={`/product-detail?id=${product.id}`}
                                    className="flex items-center gap-4 px-4 py-3 hover:bg-lilac"
                                >
                                    <img src={product.image} alt="" className="h-12 w-12 shrink-0 object-contain" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-[13px] text-muted">
                                            {highlight(product.name, needle, (match) => (
                                                <strong className="font-bold text-brand">{match}</strong>
                                            ))}
                                        </span>
                                        <span className="block text-[13px] text-success">{money(product.price)}</span>
                                    </span>
                                </Link>
                            ))}
                        </>
                    ) : null}

                    {results.collections.length ? (
                        <>
                            <SectionHeading>Koleksi</SectionHeading>
                            {results.collections.map((category) => (
                                <Link
                                    key={category.name}
                                    href={`/shop?category=${encodeURIComponent(category.name)}`}
                                    className="block px-4 py-3 text-[13px] text-muted hover:bg-lilac"
                                >
                                    {category.name}
                                </Link>
                            ))}
                        </>
                    ) : null}

                    {results.pages.length ? (
                        <>
                            <SectionHeading>Halaman</SectionHeading>
                            {results.pages.map((page) => (
                                <Link
                                    key={page.href}
                                    href={page.href}
                                    className="block px-4 py-3 text-[13px] text-muted hover:bg-lilac"
                                >
                                    {page.label}
                                </Link>
                            ))}
                        </>
                    ) : null}

                    {hasResults ? (
                        <Link
                            href={`/shop?q=${encodeURIComponent(query.trim())}`}
                            className="flex items-center justify-center gap-1 border-t border-line px-4 py-4 text-[13px] font-bold text-success"
                        >
                            Lihat semua hasil
                            <Icon name="chevronRight" size={14} />
                        </Link>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
