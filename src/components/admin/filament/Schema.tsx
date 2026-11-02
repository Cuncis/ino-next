import type { CSSProperties, ReactNode } from "react";
import { FiBadge, type FiColor } from "./ui";

/**
 * Filament's schema layout (`fi-grid`, `fi-sc-section`) and infolist entries (`fi-in-entry`),
 * for a resource's view page and the frame of its forms. Markup and classes are Filament's.
 */
const style = (vars: Record<string, string>) => vars as CSSProperties;

const repeat = (columns: number) => `repeat(${columns}, minmax(0, 1fr))`;

/** A schema grid: one column on phones, `lg` columns from the lg breakpoint. */
export function FiGrid({ lg, children, className = "", id }: { lg?: number; children: ReactNode; className?: string; id?: string }) {
  return (
    <div
      id={id}
      className={`${className ? `${className} ` : ""}fi-grid${lg ? " lg:fi-grid-cols" : ""} fi-sc fi-sc-has-gap`}
      style={style(lg ? { "--cols-lg": repeat(lg), "--cols-default": repeat(1) } : { "--cols-default": repeat(1) })}
    >
      {children}
    </div>
  );
}

/** One cell of a schema grid; `span` columns wide from lg, or the whole row with "full". */
export function FiGridCol({ span, children }: { span?: number | "full"; children: ReactNode }) {
  if (span === "full") {
    return (
      <div className="fi-grid-col" style={style({ "--col-span-default": "1 / -1" })}>
        <div className="fi-sc-component">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`fi-grid-col${span ? "  lg:fi-grid-col-span" : ""}`}
      style={style(span ? { "--col-span-default": "span 1 / span 1", "--col-span-lg": `span ${span} / span ${span}` } : { "--col-span-default": "span 1 / span 1" })}
    >
      <div className="fi-sc-component">{children}</div>
    </div>
  );
}

/** `Section::make($heading)`, its content laid out in `columns` columns. */
export function FiSection({ id, heading, columns, children }: { id: string; heading: string; columns?: number; children: ReactNode }) {
  return (
    <div id={`${id}::section`} className="fi-sc-section">
      <section className="fi-section fi-section-has-header">
        <header className="fi-section-header">
          <div className="fi-section-header-content fi-section-header-content-has-heading">
            <div className="fi-section-header-text-ctn">
              <h2 id={`${id}::section-heading`} className="fi-section-header-heading">
                {heading}
              </h2>
            </div>
          </div>
        </header>
        <div id={`${id}::section-content`} className="fi-section-content-ctn">
          <div
            className={`fi-section-content fi-grid${columns ? " lg:fi-grid-cols" : ""} fi-sc fi-sc-has-gap`}
            style={style(columns ? { "--cols-lg": repeat(columns), "--cols-default": repeat(1) } : { "--cols-default": repeat(1) })}
          >
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}

function Entry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fi-in-entry">
      <div className="fi-in-entry-label-col">
        <div className="fi-in-entry-label-ctn">
          <div className="fi-in-entry-label" role="term">
            {label}
          </div>
        </div>
      </div>
      <div className="fi-in-entry-content-col">
        <div className="fi-in-entry-content-ctn" role="definition">
          <div className="fi-in-entry-content">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** `TextEntry`: the value, or its placeholder (grey) when empty. */
export function FiTextEntry({ label, value, placeholder, weight }: { label: string; value: ReactNode; placeholder?: string; weight?: "bold" | "semibold" }) {
  const empty = value === null || value === undefined || value === "";

  return (
    <Entry label={label}>
      {empty ? (
        <div className="fi-in-text">
          <p className="fi-in-placeholder">{placeholder ?? ""}</p>
        </div>
      ) : (
        <div className={`fi-in-text-item  fi-size-sm ${weight ? `fi-font-${weight} ` : ""} fi-in-text fi-wrapped`}>{value}</div>
      )}
    </Entry>
  );
}

/** A `TextEntry` shown as a coloured badge. */
export function FiBadgeEntry({ label, value, color, placeholder }: { label: string; value: string | null; color: FiColor; placeholder?: string }) {
  if (value === null || value === "") {
    return <FiTextEntry label={label} value={null} placeholder={placeholder} />;
  }

  return (
    <Entry label={label}>
      <div className="fi-in-text-item  fi-in-text fi-in-text-has-badges fi-wrapped">
        <FiBadge color={color}>{value}</FiBadge>
      </div>
    </Entry>
  );
}

/** `RepeatableEntry`: one contained card per item, each a grid of entries. */
export function FiRepeatableEntry({ label, columns, items }: { label: string; columns: number; items: ReactNode[] }) {
  return (
    <Entry label={label}>
      <ul className="fi-in-repeatable fi-contained fi-grid" style={style({ "--cols-default": repeat(1) })}>
        {items.map((item, index) => (
          <li key={index} className="fi-in-repeatable-item">
            <FiGrid lg={columns}>{item}</FiGrid>
          </li>
        ))}
      </ul>
    </Entry>
  );
}
