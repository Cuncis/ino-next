import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, usePage } from '@/lib/inertia';
import DesktopLayout from '@/layouts/DesktopLayout';
import Checkbox from './Checkbox';
import DesktopHeader from './DesktopHeader';
import ProductCell from './ProductCell';
import RecentlyViewed from './RecentlyViewed';
import { priceRanges, productMatchesSearch, useShopCatalog } from './data';

const PER_PAGE_OPTIONS = [12, 24, 48];

type ProductEntry = { raw: CatalogProduct; tile: ProductTile };

const SORTS: Record<string, { label: string; compare: (a: ProductEntry, b: ProductEntry) => number }> = {
    nameAsc: { label: 'Abjad, A-Z', compare: (a, b) => a.raw.name.localeCompare(b.raw.name, 'id') },
    nameDesc: { label: 'Abjad, Z-A', compare: (a, b) => b.raw.name.localeCompare(a.raw.name, 'id') },
    priceAsc: { label: 'Harga, termurah', compare: (a, b) => a.raw.price - b.raw.price },
    priceDesc: { label: 'Harga, termahal', compare: (a, b) => b.raw.price - a.raw.price },
};

function pageWindow(current: number,last: number): (number|'gap')[] {
    const pages = new Set([1, 2, 3, last, current - 1, current, current + 1]);
    const sorted = [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b);

    return sorted.flatMap((page, index) =>
        index > 0 && page - sorted[index - 1] > 1 ? ['gap', page] : [page],
    );
}

function FilterGroup({ title, children }: { title: string, children: import('react').ReactNode }) {
    return (
        <details open className="border-t border-line py-3 first:border-t-0">
            <summary className="cursor-pointer list-none text-[12px] font-bold text-brand">{title}</summary>
            <div className="mt-3 space-y-2.5 text-[12px] text-muted">{children}</div>
        </details>
    );
}

/**
 * Desktop "Semua produk" listing: a filter sidebar beside a four-column
 * product table with the per-page, sort and pagination controls above and
 * below it. `?q=` (header search) and `?category=` seed the filters.
 */
export default function DesktopShop() {
    const { products, shopProducts, filterCategories } = useShopCatalog();
    const { url } = usePage();

    const params = useMemo(() => new URLSearchParams(url.split('?')[1] ?? ''), [url]);
    const query = (params.get('q') ?? '').trim().toLowerCase();
    const requestedCategory = params.get('category');

    const [categories, setCategories] = useState<string[]>(() =>
        requestedCategory && filterCategories.includes(requestedCategory) ? [requestedCategory] : [],
    );
    const [availability, setAvailability] = useState<string[]>([]);
    const [rangeLabels, setRangeLabels] = useState<string[]>([]);
    const [perPage, setPerPage] = useState(24);
    const [sort, setSort] = useState('nameAsc');
    const [page, setPage] = useState(1);

    // A new header search or category link lands on this same page component,
    // so the filters have to follow the URL instead of only reading it once.
    useEffect(() => {
        setCategories(
            requestedCategory && filterCategories.includes(requestedCategory) ? [requestedCategory] : [],
        );
        setPage(1);
    }, [url]);

    const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (value: string) => {
        setter((current) =>
            current.includes(value) ? current.filter((existing) => existing !== value) : [...current, value],
        );
        setPage(1);
    };

    const matches = useMemo(() => {
        const activeRanges = priceRanges.filter((range) => rangeLabels.includes(range.label));

        return products
            .map((raw, index) => ({ raw, tile: shopProducts[index] }))
            .filter(({ raw, tile }) => {
                const matchesQuery =
                    ! query ||
                    productMatchesSearch(raw, query);
                const matchesCategory = ! categories.length || categories.includes(raw.category);
                const matchesAvailability =
                    ! availability.length || availability.includes(tile.soldOut ? 'habis' : 'tersedia');
                const matchesPrice =
                    ! activeRanges.length ||
                    activeRanges.some(
                        (range) => raw.price >= (range.min ?? 0) && raw.price < (range.max ?? Infinity),
                    );

                return matchesQuery && matchesCategory && matchesAvailability && matchesPrice;
            })
            .sort(SORTS[sort].compare);
    }, [products, shopProducts, query, categories, availability, rangeLabels, sort]);

    const lastPage = Math.max(1, Math.ceil(matches.length / perPage));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * perPage;
    const visible = matches.slice(start, start + perPage);

    const selectClass =
        'border-0 border-b border-line bg-transparent py-1 pl-0 pr-6 text-[11px] text-muted focus:border-brand focus:ring-0';

    return (
        <DesktopLayout title="Semua Produk" header={<DesktopHeader />}>
            <nav aria-label="Breadcrumb" className="py-5 text-[11px] text-muted">
                <Link href="/">Beranda</Link>
                <span className="mx-2">&rsaquo;</span>
                <span>Semua produk</span>
            </nav>

            <div className="grid grid-cols-[220px_1fr] items-start gap-6">
                <aside className="border border-line bg-white p-5">
                    <h2 className="mb-3 font-display text-[15px] text-brand">Filter</h2>

                    <FilterGroup title="Kategori">
                        {filterCategories.map((name) => (
                            <Checkbox
                                key={name}
                                checked={categories.includes(name)}
                                onChange={() => toggle(setCategories)(name)}
                                label={<span>{name}</span>}
                            />
                        ))}
                    </FilterGroup>

                    <FilterGroup title="Ketersediaan">
                        <Checkbox
                            checked={availability.includes('tersedia')}
                            onChange={() => toggle(setAvailability)('tersedia')}
                            label={<span>Tersedia</span>}
                        />
                        <Checkbox
                            checked={availability.includes('habis')}
                            onChange={() => toggle(setAvailability)('habis')}
                            label={<span>Terjual habis</span>}
                        />
                    </FilterGroup>

                    <FilterGroup title="Harga">
                        {priceRanges.map((range) => (
                            <Checkbox
                                key={range.label}
                                checked={rangeLabels.includes(range.label)}
                                onChange={() => toggle(setRangeLabels)(range.label)}
                                label={<span>{range.label}</span>}
                            />
                        ))}
                    </FilterGroup>
                </aside>

                <section className="border border-line bg-white">
                    <div className="flex flex-wrap items-end justify-between gap-4 p-6">
                        <div>
                            <h1 className="font-display text-2xl text-brand">Semua produk</h1>
                            <p className="mt-1 text-[11px] text-muted">
                                {matches.length
                                    ? `Menampilkan ${start + 1} - ${start + visible.length} dari ${matches.length} produk`
                                    : 'Tidak ada produk'}
                                {query ? ` untuk "${params.get('q')}"` : ''}
                            </p>
                        </div>

                        <div className="flex gap-6">
                            <label className="text-[11px] text-muted">
                                Per halaman:{' '}
                                <select
                                    value={perPage}
                                    onChange={(event) => {
                                        setPerPage(Number(event.target.value));
                                        setPage(1);
                                    }}
                                    className={selectClass}
                                >
                                    {PER_PAGE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="text-[11px] text-muted">
                                Urutkan:{' '}
                                <select
                                    value={sort}
                                    onChange={(event) => setSort(event.target.value)}
                                    className={selectClass}
                                >
                                    {Object.entries(SORTS).map(([key, option]) => (
                                        <option key={key} value={key}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    {visible.length ? (
                        <div className="grid grid-cols-4 border-t border-line">
                            {visible.map(({ tile }) => (
                                <ProductCell key={tile.id} product={tile} />
                            ))}
                        </div>
                    ) : (
                        <p className="border-t border-line px-6 py-16 text-center text-[13px] text-muted">
                            Produk tidak ditemukan. Coba kata kunci lain atau ubah filter.
                        </p>
                    )}

                    {lastPage > 1 ? (
                        <nav
                            aria-label="Halaman"
                            className="relative flex items-center justify-center gap-1.5 border-t border-line px-6 py-4 text-[11px]"
                        >
                            {currentPage > 1 ? (
                                <button
                                    type="button"
                                    onClick={() => setPage(currentPage - 1)}
                                    className="absolute left-6 text-muted"
                                >
                                    &lsaquo; Sebelumnya
                                </button>
                            ) : null}

                            {pageWindow(currentPage, lastPage).map((item, index) =>
                                item === 'gap' ? (
                                    <span key={`gap-${index}`} className="px-1 text-muted">...</span>
                                ) : (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => setPage(item)}
                                        aria-current={item === currentPage ? 'page' : undefined}
                                        className={`flex h-6 min-w-6 items-center justify-center px-1.5 ${
                                            item === currentPage ? 'bg-success font-bold text-white' : 'text-muted'
                                        }`}
                                    >
                                        {item}
                                    </button>
                                ),
                            )}

                            {currentPage < lastPage ? (
                                <button
                                    type="button"
                                    onClick={() => setPage(currentPage + 1)}
                                    className="absolute right-6 text-muted"
                                >
                                    Berikutnya &rsaquo;
                                </button>
                            ) : null}
                        </nav>
                    ) : null}
                </section>
            </div>

            <RecentlyViewed />
        </DesktopLayout>
    );
}
