'use client';

import { useState } from 'react';
import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import Button from '@/components/shop/Button';
import Checkbox from '@/components/shop/Checkbox';
import { priceRanges, useShopCatalog } from '@/components/shop/data';

export default function Filter() {
    const { filterCategories } = useShopCatalog();
    const [selectedCategories, setSelectedCategories] = useState([filterCategories[0]]);
    const [range, setRange] = useState(priceRanges[0].label);
    const [labels, setLabels] = useState({ sale: true, inStock: true });

    const toggleCategory = (name: string) =>
        setSelectedCategories((current) =>
            current.includes(name)
                ? current.filter((existing) => existing !== name)
                : [...current, name],
        );

    return (
        <MobileLayout
            title="Filter"
            header={<AppBar title="Filter" back="/shop" tone="brand" />}
            footer={
                <div className="border-t border-line p-3.5">
                    <Button href="/shop">Terapkan Filter</Button>
                </div>
            }
        >
            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-2.5 font-display text-[15px]">Kategori</div>

                <div className="mb-[18px] flex flex-wrap gap-2">
                    {filterCategories.map((name) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => toggleCategory(name)}
                            className={`px-3.5 py-[7px] text-xs ${
                                selectedCategories.includes(name)
                                    ? 'border border-brand text-brand'
                                    : 'border border-line text-muted'
                            }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>

                <div className="mb-2.5 font-display text-[15px]">Rentang Harga</div>

                <div className="mb-[18px] space-y-2">
                    {priceRanges.map((option) => (
                        <button
                            key={option.label}
                            type="button"
                            onClick={() => setRange(option.label)}
                            className={`flex w-full items-center justify-between border px-3.5 py-2.5 text-left text-xs ${
                                range === option.label
                                    ? 'border-brand text-brand'
                                    : 'border-line text-muted'
                            }`}
                        >
                            {option.label}

                            <span
                                className={`h-3.5 w-3.5 rounded-full border-2 ${
                                    range === option.label
                                        ? 'border-4 border-brand'
                                        : 'border-line'
                                }`}
                            />
                        </button>
                    ))}
                </div>

                <div className="mb-2.5 font-display text-[15px]">Label</div>

                <div className="mb-2.5">
                    <Checkbox
                        checked={labels.sale}
                        onChange={() => setLabels((current) => ({ ...current, sale: ! current.sale }))}
                        size={17}
                        label={
                            <span className="bg-sale px-3 py-1 text-[11px] font-bold text-ink">
                                DISKON
                            </span>
                        }
                    />
                </div>

                <div className="mb-2.5">
                    <Checkbox
                        checked={labels.inStock}
                        onChange={() =>
                            setLabels((current) => ({ ...current, inStock: ! current.inStock }))
                        }
                        size={17}
                        label={<span className="text-xs text-muted">Hanya yang tersedia</span>}
                    />
                </div>

            </div>
        </MobileLayout>
    );
}
