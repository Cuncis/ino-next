import { DISABLED_ACTION_CLASSES, OVER_LIMIT_MESSAGE, isOverLimit } from '@/lib/purchaseLimit';
import { useEffect, useRef, useState } from 'react';
import { Link, useForm } from '@/lib/inertia';
import DesktopLayout from '@/layouts/DesktopLayout';
import DesktopHeader from './DesktopHeader';
import ProductGrid from './ProductGrid';
import RecentlyViewed from './RecentlyViewed';
import flyToCart from './flyToCart';
import ProductFulfilment from './ProductFulfilment';
import useProductBranches, { originBranch } from './useProductBranches';
import { money, useShopCatalog } from './data';

function Gallery({ product }: { product: CatalogProduct }) {
    const images = product.images?.length ? product.images : [{ path: product.image, alt: product.name }];
    const [active, setActive] = useState(0);
    const current = images[active] ?? images[0];

    return (
        <div className="flex gap-4 border border-line bg-white p-5">
            {images.length > 1 ? (
                <div className="flex w-16 shrink-0 flex-col gap-2">
                    {images.map((image, index) => (
                        <button
                            key={image.path}
                            type="button"
                            onClick={() => setActive(index)}
                            aria-label={`Foto ${index + 1}`}
                            className={`border p-0.5 ${index === active ? 'border-2 border-success' : 'border-line'}`}
                        >
                            <img src={image.path} alt={image.alt} className="aspect-square w-full object-contain" />
                        </button>
                    ))}
                </div>
            ) : null}

            <div className="relative flex min-h-[420px] flex-1 items-center justify-center">
                <ZoomImage src={current.path} alt={current.alt} />
            </div>
        </div>
    );
}

const LENS_SIZE = 130;
const PANEL_SIZE = 380;
const PANEL_GAP = 16;

/**
 * Product photo with a square lens that follows the cursor and a popup panel
 * beside the photo showing that lens area magnified. The lens only appears
 * over the photo itself, not the blank letterbox around it.
 */
function ZoomImage({ src, alt }: { src: string; alt: string }) {
    const imageRef = useRef<HTMLImageElement>(null);
    const [hover, setHover] = useState<{ rect: DOMRect; x: number; y: number } | null>(null);

    const onMouseMove = (event: React.MouseEvent<HTMLImageElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();

        setHover({ rect, x: event.clientX - rect.left, y: event.clientY - rect.top });
    };

    useEffect(() => {
        if (! hover) {
            return;
        }

        const close = () => setHover(null);

        window.addEventListener('scroll', close, { passive: true });

        return () => window.removeEventListener('scroll', close);
    }, [hover === null]);

    // `object-contain` letterboxes the photo inside the <img> box, so the lens and
    // the magnified background must use the photo's real fitted size.
    const element = imageRef.current;
    const ratio = element && element.naturalWidth ? element.naturalWidth / element.naturalHeight : 1;
    let zoom: React.ReactNode = null;

    if (hover && element) {
        // Under the storefront's CSS `zoom`, the browser reports the photo's rect,
        // the cursor and the window width in screen pixels, but `left`/`top`/
        // `width` are laid out in unzoomed pixels. Convert before positioning.
        const factor = element.offsetWidth ? hover.rect.width / element.offsetWidth : 1;
        const rect = {
            left: hover.rect.left / factor,
            right: hover.rect.right / factor,
            top: hover.rect.top / factor,
            width: hover.rect.width / factor,
            height: hover.rect.height / factor,
        };
        const x = hover.x / factor;
        const y = hover.y / factor;
        const viewportWidth = window.innerWidth / factor;
        const viewportHeight = window.innerHeight / factor;
        const width = Math.min(rect.width, rect.height * ratio);
        const height = width / ratio;
        const offsetX = (rect.width - width) / 2;
        const offsetY = (rect.height - height) / 2;
        const lensSize = Math.min(LENS_SIZE, width, height);
        const lensLeft = Math.min(Math.max(x - lensSize / 2, offsetX), offsetX + width - lensSize);
        const lensTop = Math.min(Math.max(y - lensSize / 2, offsetY), offsetY + height - lensSize);
        const scale = PANEL_SIZE / lensSize;
        const inside = x >= offsetX && x <= offsetX + width && y >= offsetY && y <= offsetY + height;
        const panelLeft = viewportWidth - rect.right >= PANEL_SIZE + PANEL_GAP
            ? rect.right + PANEL_GAP
            : Math.max(8, rect.left - PANEL_GAP - PANEL_SIZE);

        zoom = inside ? (
            <>
                <div
                    className="pointer-events-none absolute z-30 border-2 border-brand bg-brand/10"
                    style={{ left: lensLeft, top: lensTop, width: lensSize, height: lensSize }}
                />
                <div
                    className="pointer-events-none fixed z-50 overflow-hidden rounded-[2px] border border-line bg-white shadow-pop"
                    style={{
                        top: Math.max(8, Math.min(rect.top, viewportHeight - PANEL_SIZE - 8)),
                        left: panelLeft,
                        width: PANEL_SIZE,
                        height: PANEL_SIZE,
                        backgroundImage: `url(${src})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: `${width * scale}px ${height * scale}px`,
                        backgroundPosition: `-${(lensLeft - offsetX) * scale}px -${(lensTop - offsetY) * scale}px`,
                    }}
                />
            </>
        ) : null;
    }

    return (
        <div className="relative w-full">
            <img
                ref={imageRef}
                src={src}
                alt={alt}
                onMouseMove={onMouseMove}
                onMouseLeave={() => setHover(null)}
                className="max-h-[420px] w-full cursor-crosshair object-contain"
            />

            {zoom}
        </div>
    );
}

/**
 * Branch + quantity + add-to-cart panel. Same endpoint and branch-conflict
 * handling as the phone `BranchPicker`, just laid out as the desktop buy box.
 * There is no branch dropdown: every product is added from the one delivering
 * branch ("Dikirim dari"), and the pickup location is chosen at checkout.
 */
function BuyBox({ product }: { product: CatalogProduct }) {
    const { branches, error: loadError } = useProductBranches(product.id);
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const { transform, post, processing, errors: formErrors } = useForm({});

    const errors = formErrors as Record<string, string | undefined>;
    const origin = branches ? originBranch(branches) : null;
    const selected = origin?.selectable ? origin : null;
    const maxQuantity = selected?.available ?? Infinity;
    const overLimit = isOverLimit(quantity, product);

    const addToCart = (switchBranch = false) => {
        if (! selected) {
            return;
        }

        transform(() => ({ productId: product.id, branchId: selected.id, quantity, switchBranch }));

        post('/keranjang', {
            preserveScroll: true,
            onSuccess: () => {
                setAdded(true);
                flyToCart(buttonRef.current);
                window.setTimeout(() => setAdded(false), 1800);
            },
        });
    };

    return (
        <div className="border border-line bg-white p-6">
            <h1 className="font-display text-2xl text-brand">{product.name}</h1>
            <p className="mt-1 text-[11px] text-faint">{product.category}</p>

            <div className="mt-4">
                {loadError ? (
                    <p className="text-[12px] text-danger">{loadError}</p>
                ) : ! branches ? (
                    <div className="h-4 w-48 animate-pulse bg-[#f5f5f5]" aria-hidden="true" />
                ) : branches.length === 0 ? (
                    <p className="text-[12px] text-muted">Belum ada cabang yang menjual produk ini.</p>
                ) : (
                    <ProductFulfilment origin={origin} />
                )}
            </div>

            <dl className="mt-5 space-y-4 border-t border-line pt-5 text-[13px]">
                <div className="flex items-center gap-6">
                    <dt className="w-20 shrink-0 text-[11px] font-bold text-brand">Harga:</dt>
                    <dd className="flex items-baseline gap-3">
                        <span className="text-xl text-success">{money(product.price)}</span>
                        {product.oldPrice ? (
                            <span className="text-[11px] text-faint line-through">{money(product.oldPrice)}</span>
                        ) : null}
                    </dd>
                </div>

                <div className="flex items-center gap-6">
                    <dt className="w-20 shrink-0 text-[11px] font-bold text-brand">Stok:</dt>
                    <dd className="text-muted">
                        {selected ? `Tersedia ${selected.available}` : branches ? 'Stok kosong' : '...'}
                    </dd>
                </div>

                <div className="flex items-center gap-6">
                    <dt className="w-20 shrink-0 text-[11px] font-bold text-brand">Kuantitas:</dt>
                    <dd className="flex items-center border border-line">
                        <button
                            type="button"
                            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                            aria-label={`Kurangi jumlah ${product.name}`}
                            className="flex h-9 w-9 items-center justify-center text-muted hover:text-brand"
                        >
                            &minus;
                        </button>
                        <span className="flex h-9 w-12 items-center justify-center border-x border-line text-[13px] text-brand">
                            {quantity}
                        </span>
                        <button
                            type="button"
                            onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                            aria-label={`Tambah jumlah ${product.name}`}
                            className="flex h-9 w-9 items-center justify-center text-muted hover:text-brand"
                        >
                            +
                        </button>
                    </dd>
                </div>
            </dl>

            {overLimit ? (
                <p role="alert" className="mt-2 max-w-sm text-[13px] font-semibold leading-snug text-danger">
                    {OVER_LIMIT_MESSAGE}
                </p>
            ) : null}

            {errors.quantity ? <p className="mt-2 text-[11px] text-danger">{errors.quantity}</p> : null}

            {errors.branch ? (
                <div className="mt-4 max-w-sm border border-danger bg-danger/5 p-2.5 text-[11px] text-danger-deep">
                    <p className="mb-1.5">{errors.branch}</p>
                    <button
                        type="button"
                        onClick={() => addToCart(true)}
                        disabled={processing}
                        className="font-bold underline"
                    >
                        Ya, kosongkan &amp; pindah
                    </button>
                </div>
            ) : (
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => addToCart(false)}
                    disabled={! selected || processing || overLimit}
                    className={`mt-5 flex h-11 w-full max-w-sm items-center justify-center text-xs font-bold text-white ${
                        overLimit ? DISABLED_ACTION_CLASSES : 'bg-success disabled:opacity-60'
                    }`}
                >
                    {added ? 'Ditambahkan ✓' : 'Tambahkan ke keranjang'}
                </button>
            )}
        </div>
    );
}

function Description({ product }: { product: CatalogProduct }) {
    const rows: [string, string | null | undefined][] = [
        ['Nama Produk & Sediaan', product.name],
        ['Indikasi', product.indication],
        ['Komposisi & Kekuatan', product.composition],
        ['Golongan Produk', product.drugClass],
        ['Kemasan', product.variants?.join(', ')],
        ['Nomor Izin Edar', product.nie],
        ['Tanggal Kadaluarsa', product.expiresAt],
    ].filter(([, value]) => Boolean(value)) as [string, string][];

    return (
        <div className="border border-line bg-white p-8">
            <h2 className="mb-6 font-display text-xl text-brand">Deskripsi</h2>

            {product.needsWarningLabel && product.warning ? (
                <div className="mb-6 border-2 border-ink bg-[#eaf2fc] px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-ink">
                    {product.warning}
                </div>
            ) : null}

            <dl>
                {rows.map(([label, value]) => (
                    <div key={label} className="border-b border-line py-4 last:border-b-0">
                        <dt className="mb-1.5 text-[13px] font-bold text-ink">{label}:</dt>
                        <dd className="text-[13px] leading-7 text-muted">{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

/**
 * Desktop product page: breadcrumb, photo gallery beside a buy box, the full
 * description underneath, then other products from the same category.
 */
export default function DesktopProductDetail({ product }: { product: CatalogProduct }) {
    const { shopProducts } = useShopCatalog();

    // The buy box sticks just below the sticky header, whatever its height
    // (the notice in it wraps to a second line on narrower windows).
    const [stickyTop, setStickyTop] = useState(150);

    useEffect(() => {
        const header = document.querySelector<HTMLElement>('header .sticky');

        if (! header) {
            return;
        }

        const measure = () => setStickyTop(header.offsetHeight + 12);
        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(header);

        return () => observer.disconnect();
    }, []);

    const related = shopProducts
        .filter((tile) => tile.category === product.category && tile.id !== product.id)
        .slice(0, 6);

    return (
        <DesktopLayout title={product.name} header={<DesktopHeader />}>
            <nav aria-label="Breadcrumb" className="py-5 text-[11px] text-muted">
                <Link href="/">Beranda</Link>
                <span className="mx-2">&rsaquo;</span>
                <Link href="/shop">Semua produk</Link>
                <span className="mx-2">&rsaquo;</span>
                <span>{product.name}</span>
            </nav>

            <div className="grid grid-cols-[1fr_1fr] items-start gap-6">
                <div className="space-y-6">
                    <Gallery product={product} />
                    <Description product={product} />
                </div>

                {/* Stays in view beside the long description; the grid ends before
                    "Produk Lainnya", so it stops sticking there. */}
                <div
                    className="sticky overflow-y-auto"
                    style={{ top: stickyTop, maxHeight: `calc(100vh / var(--shop-zoom, 1) - ${stickyTop + 20}px)` }}
                >
                    <BuyBox product={product} />
                </div>
            </div>

            {related.length ? (
                <section className="mt-12">
                    <h2 className="mb-4 font-display text-xl text-brand">Produk Lainnya yang Mungkin Anda Suka</h2>
                    <ProductGrid products={related} />
                </section>
            ) : null}

            <RecentlyViewed excludeId={product.id} />
        </DesktopLayout>
    );
}
