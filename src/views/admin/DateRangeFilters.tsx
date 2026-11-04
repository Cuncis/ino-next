"use client";

import { useState, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FiDateInput } from "@/components/admin/filament/Fields";
import { FiButton, FiLinkAction } from "@/components/admin/filament/ui";

/**
 * A widget's filters above its table (FiltersLayout::AboveContent): a date range applied
 * with "Terapkan filter", reset to its defaults with "Atur ulang filter". The range lives
 * in the address (`?dari=&sampai=`), so the server renders the rows.
 */
export function DateRangeFilters({
  from,
  to,
  defaults,
  labels,
}: {
  from: string;
  to: string;
  defaults: { from: string; to: string };
  labels: { filters: string; reset: string; apply: string; from: string; to: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState({ from, to });
  const go = (range: { from: string; to: string }) => {
    const query = new URLSearchParams(searchParams.toString());

    for (const [key, value] of [
      ["dari", range.from === defaults.from ? "" : range.from],
      ["sampai", range.to === defaults.to ? "" : range.to],
    ]) {
      if (value) query.set(key, value);
      else query.delete(key);
    }

    router.push(query.size ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="fi-ta-filters">
      <div className="fi-ta-filters-header">
        <h3 className="fi-ta-filters-heading">{labels.filters}</h3>
        <div>
          <FiLinkAction
            color="danger"
            data-table-filter-action="reset"
            onClick={() => {
              setDraft(defaults);
              go(defaults);
            }}
          >
            {labels.reset}
          </FiLinkAction>
        </div>
      </div>
      <div
        className="fi-grid sm:fi-grid-cols lg:fi-grid-cols xl:fi-grid-cols 2xl:fi-grid-cols fi-sc fi-sc-has-gap"
        style={{ "--cols-sm": "repeat(2, minmax(0, 1fr))", "--cols-lg": "repeat(3, minmax(0, 1fr))", "--cols-xl": "repeat(4, minmax(0, 1fr))", "--cols-2xl": "repeat(5, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}
      >
        <div className="fi-grid-col lg:fi-grid-col-span" style={{ "--col-span-default": "span 1 / span 1", "--col-span-lg": "span 2 / span 2" } as CSSProperties}>
          <div className="fi-sc-component">
            <div id="tableFiltersForm.range">
              <div className="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style={{ "--cols-lg": "repeat(2, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}>
                <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
                  <div className="fi-sc-component">
                    <FiDateInput id="tableFiltersForm.range.dari" label={labels.from} value={draft.from} onChange={(value) => setDraft({ ...draft, from: value })} />
                  </div>
                </div>
                <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
                  <div className="fi-sc-component">
                    <FiDateInput id="tableFiltersForm.range.sampai" label={labels.to} value={draft.to} onChange={(value) => setDraft({ ...draft, to: value })} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="fi-ta-filters-actions-ctn">
        <FiButton data-table-filter-action="apply" onClick={() => go(draft)}>
          {labels.apply}
        </FiButton>
      </div>
    </div>
  );
}
