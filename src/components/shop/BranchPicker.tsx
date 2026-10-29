import { DISABLED_ACTION_CLASSES, OVER_LIMIT_MESSAGE, isOverLimit } from '@/lib/purchaseLimit';
import { useRef, useState } from 'react';
import { useForm } from '@/lib/inertia';
import Button from './Button';
import ProductFulfilment from './ProductFulfilment';
import flyToCart from './flyToCart';
import useProductBranches, { originBranch } from './useProductBranches';

/**
 * "Which apotek, and how do I get it" — the buy panel on the phone product page.
 *
 * Loads branches for this one product from the JSON locator API rather than a
 * prop, because distances have to appear the moment the shopper shares a
 * location, without a full Inertia page visit. There is no branch dropdown:
 * `ProductFulfilment` shows the one delivering branch ("Dikirim dari") every
 * product is added from; the pickup location is chosen at checkout.
 *
 * Adding to cart posts straight to `CartManager` (Fase 5.3). A cart is bound
 * to one branch (ROADMAP.md 3.3); if this cart already holds items from a
 * different branch, the server refuses with a `branch` error and this asks
 * whether to empty the cart and switch instead of failing silently.
 */
export default function BranchPicker({ productId, productName, purchaseLimit }: { productId: string, productName: string, purchaseLimit: number }) {
    const { branches, error } = useProductBranches(productId);
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);
    const addButtonRef = useRef<HTMLDivElement>(null);
    const overLimit = isOverLimit(quantity, { purchaseLimit });

    const { transform, post, processing, errors: formErrors, clearErrors } = useForm({});

    const origin = branches ? originBranch(branches) : null;
    const selected = origin?.selectable ? origin : null;

    const errors = formErrors as Record<string, string | undefined>;

    const addToCart = (switchBranch = false) => {
        if (! selected) {
            return;
        }

        transform(() => ({ productId, branchId: selected.id, quantity, switchBranch }));

        post('/keranjang', {
            preserveScroll: true,
            onSuccess: () => {
                setAdded(true);
                flyToCart(addButtonRef.current);
                window.setTimeout(() => setAdded(false), 1800);
            },
        });
    };

    if (error) {
        return <p className="mb-3.5 text-xs text-danger">{error}</p>;
    }

    if (! branches) {
        return (
            <div
                className="mb-3.5 h-16 animate-pulse rounded-[2px] border border-line bg-[#f5f5f5]"
                aria-hidden="true"
            />
        );
    }

    return (
        <div className="mb-3.5 rounded-[2px] border border-line bg-white p-3.5">
            {branches.length === 0 ? (
                <p className="text-xs text-muted">Belum ada cabang yang menjual produk ini.</p>
            ) : (
                <ProductFulfilment origin={origin} />
            )}

            {selected ? (
                <>
                    <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-[11px] text-muted">Jumlah</span>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => setQuantity((qty) => Math.max(1, qty - 1))}
                                aria-label={`Kurangi jumlah ${productName}`}
                                className="flex h-6 w-6 items-center justify-center border border-line text-sm leading-none hover:text-brand"
                            >
                                −
                            </button>
                            <span className="min-w-[16px] text-center text-xs text-brand">{quantity}</span>
                            <button
                                type="button"
                                onClick={() => setQuantity((qty) => Math.min(selected?.available ?? Infinity, qty + 1))}
                                aria-label={`Tambah jumlah ${productName}`}
                                className="flex h-6 w-6 items-center justify-center border border-line text-sm leading-none hover:text-brand"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {overLimit ? (
                        <p role="alert" className="mt-1.5 text-[12px] font-semibold leading-snug text-danger">
                            {OVER_LIMIT_MESSAGE}
                        </p>
                    ) : null}

                    {errors.quantity ? (
                        <p className="mt-1.5 text-[11px] text-danger">{errors.quantity}</p>
                    ) : null}

                    {errors.branch ? (
                        <div className="mt-1.5 border border-danger bg-danger/5 p-2.5 text-[11px] text-danger-deep">
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
                        <div ref={addButtonRef} className="mt-2.5">
                            <Button
                                type="button"
                                onClick={() => addToCart(false)}
                                disabled={processing || overLimit}
                                className={overLimit ? DISABLED_ACTION_CLASSES : ''}
                            >
                                {added ? 'Ditambahkan ✓' : 'Masukkan ke Keranjang'}
                            </Button>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
}
