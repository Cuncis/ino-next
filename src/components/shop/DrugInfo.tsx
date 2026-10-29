/**
 * The regulatory info block shown on a product's detail page — NIE, composition,
 * dosage, side effects, and the P1–P6 warning that is mandatory for
 * "Bebas Terbatas" products (Fase 4.2 / 9.3).
 */
export function DrugInfoSection({ product }: { product: CatalogProduct }) {
    const rows = [
        ['Komposisi', product.composition],
        ['Indikasi', product.indication],
        ['Aturan Pakai', product.dosage],
        ['Efek Samping', product.sideEffects],
        ['Produsen', product.manufacturer],
        ['Nomor Izin Edar (NIE)', product.nie],
        ['Kondisi Penyimpanan', product.storage],
        ['Batas Pembelian', `${product.purchaseLimit ?? 2} per transaksi`],
    ].filter(([, value]) => Boolean(value));

    if (! rows.length && ! product.needsWarningLabel) {
        return null;
    }

    return (
        <div className="mb-3.5 space-y-3 rounded-[2px] border border-line bg-white p-3.5">
            <span className="text-[13px] font-bold">Informasi Obat</span>

            {product.needsWarningLabel && product.warning ? (
                <div className="border-2 border-ink bg-[#eaf2fc] px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-ink">
                    {product.warning}
                </div>
            ) : null}

            {rows.length ? (
                <dl className="space-y-1.5">
                    {rows.map(([label, value]) => (
                        <div key={label} className="flex gap-2 text-[11px] leading-relaxed">
                            <dt className="w-[38%] shrink-0 text-faint">{label}</dt>
                            <dd className="text-muted">{value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}

            <p className="text-[10px] italic text-faint">
                Informasi ini bukan pengganti nasihat medis. Hubungi apoteker cabang untuk
                pertanyaan lebih lanjut.
            </p>
        </div>
    );
}
