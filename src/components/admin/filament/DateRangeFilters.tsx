"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiButton, FiLinkAction } from "./ui";

/**
 * A table's filters above its content with two date fields ("Dari", "Sampai"): applied
 * with "Terapkan filter", back to the defaults with "Atur ulang filter". The chosen dates
 * live in the page's address as `?dari=&sampai=`.
 */
export function DateRangeFilters({
  value,
  defaults,
  labels,
}: {
  value: { dari: string; sampai: string };
  defaults: { dari: string; sampai: string };
  labels: { heading: string; reset: string; apply: string; dari: string; sampai: string };
}) {
  const router = useRouter();
  const [dari, setDari] = useState(value.dari);
  const [sampai, setSampai] = useState(value.sampai);

  const go = (range: { dari: string; sampai: string }) => {
    const query = new URLSearchParams(window.location.search);

    query.set("dari", range.dari);
    query.set("sampai", range.sampai);
    router.push(`?${query}`, { scroll: false });
  };

  const field = (id: "dari" | "sampai", label: string, current: string, set: (value: string) => void) => (
    <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as React.CSSProperties}>
      <div className="fi-sc-component">
        <div data-field-wrapper="" className="fi-fo-field">
          <div className="fi-fo-field-label-col">
            <div className="fi-fo-field-label-ctn">
              <label htmlFor={`tableFiltersForm.range.${id}`} className="fi-fo-field-label">
                <span className="fi-fo-field-label-content">{label}</span>
              </label>
            </div>
          </div>
          <div className="fi-fo-field-content-col">
            <div className="fi-fo-date-time-picker fi-input-wrp">
              <div className="fi-input-wrp-content-ctn">
                <input id={`tableFiltersForm.range.${id}`} type="date" className="fi-input" value={current} onChange={(event) => set(event.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fi-ta-filters">
      <div className="fi-ta-filters-header">
        <h3 className="fi-ta-filters-heading">{labels.heading}</h3>
        <div>
          <FiLinkAction
            color="danger"
            data-table-filter-action="reset"
            onClick={() => {
              setDari(defaults.dari);
              setSampai(defaults.sampai);
              go(defaults);
            }}
          >
            {labels.reset}
          </FiLinkAction>
        </div>
      </div>
      <div
        className="fi-grid sm:fi-grid-cols lg:fi-grid-cols xl:fi-grid-cols 2xl:fi-grid-cols fi-sc fi-sc-has-gap"
        style={{ "--cols-sm": "repeat(2, minmax(0, 1fr))", "--cols-lg": "repeat(3, minmax(0, 1fr))", "--cols-xl": "repeat(4, minmax(0, 1fr))", "--cols-2xl": "repeat(5, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" } as React.CSSProperties}
      >
        <div className="fi-grid-col lg:fi-grid-col-span" style={{ "--col-span-default": "span 1 / span 1", "--col-span-lg": "span 2 / span 2" } as React.CSSProperties}>
          <div className="fi-sc-component">
            <div>
              <div className="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style={{ "--cols-lg": "repeat(2, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" } as React.CSSProperties}>
                {field("dari", labels.dari, dari, setDari)}
                {field("sampai", labels.sampai, sampai, setSampai)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="fi-ta-filters-actions-ctn">
        <FiButton data-table-filter-action="apply" onClick={() => go({ dari, sampai })}>
          {labels.apply}
        </FiButton>
      </div>
    </div>
  );
}
