import type { CSSProperties, ReactNode } from "react";
import { FiIcon } from "./Icon";

/**
 * A table widget (Filament's TableWidget) on a page: its heading and description, an
 * optional filter form above the table, every row (no paging), and its empty state.
 */
export type WidgetColumn = { name: string; className: string; label: string; alignRight?: boolean };

export function FiWidgetTable({
  heading,
  description,
  filters,
  columns,
  rows,
  emptyHeading,
}: {
  heading: string;
  description?: string;
  filters?: ReactNode;
  columns: WidgetColumn[];
  rows: { key: string; cells: Record<string, ReactNode> }[];
  emptyHeading: string;
}) {
  return (
    <div style={{ "--col-span-lg": "1 / -1" } as CSSProperties} className="fi-wi-widget fi-grid-col lg:fi-grid-col-span fi-wi-table">
      <div className="fi-ta">
        <div className="fi-ta-ctn fi-ta-ctn-with-header">
          <div className="fi-ta-main">
            <div className="fi-ta-header-ctn">
              <div className="fi-ta-header">
                <div>
                  <h2 className="fi-ta-header-heading">{heading}</h2>
                  {description ? <p className="fi-ta-header-description">{description}</p> : null}
                </div>
              </div>
              {filters ? <div className="fi-ta-filters-above-content-ctn">{filters}</div> : null}
            </div>
            <div className="fi-ta-content-ctn fi-fixed-positioning-context">
              <div role="status" aria-live="polite" aria-atomic="true" className="fi-sr-only">
                {rows.length ? `${rows.length} ${rows.length === 1 ? "result" : "results"}` : "No results"}
              </div>
              <table aria-label={heading} className="fi-ta-table">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column.name} scope="col" className={`fi-ta-header-cell fi-ta-header-cell-${column.className}${column.alignRight ? " fi-align-right" : ""}`}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                {rows.length ? (
                  <tbody className="fi-ta-records">
                    {rows.map((row) => (
                      <tr key={row.key} className="fi-ta-row">
                        {columns.map((column) => (
                          <td key={column.name} className={`fi-ta-cell fi-ta-cell-${column.className}${column.alignRight ? " fi-align-right" : ""}`}>
                            <div className="fi-ta-col">{row.cells[column.name]}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ) : null}
              </table>
            </div>
            {rows.length ? null : (
              <div className="fi-ta-empty-state" role="status">
                <div className="fi-ta-empty-state-content">
                  <div className="fi-ta-empty-state-icon-bg">
                    <FiIcon name="o-x-mark" size="lg" />
                  </div>
                  <h3 className="fi-ta-empty-state-heading">{emptyHeading}</h3>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The grids a page puts its header widgets in. */
export function FiWidgets({ children }: { children: ReactNode }) {
  return (
    <div className="fi-grid fi-sc fi-sc-has-gap" style={{ "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}>
      <div className="fi-sc-liberated" />
      <div className="fi-grid-col" style={{ "--col-span-default": "span 1 / span 1" } as CSSProperties}>
        <div className="fi-sc-component">
          <div>
            <div className="fi-grid lg:fi-grid-cols fi-sc fi-sc-has-gap" style={{ "--cols-lg": "repeat(2, minmax(0, 1fr))", "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}>
              <div className="fi-sc-liberated">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A plain text cell. */
export const textCell = (text: string, alignRight = false, weight?: "bold") => (
  <div className={weight ? `fi-ta-text-item  fi-size-sm fi-font-${weight} fi-ta-text${alignRight ? " fi-align-right" : ""}` : `fi-ta-text fi-ta-text-item fi-size-sm${alignRight ? " fi-align-right" : ""}`}>{text}</div>
);
