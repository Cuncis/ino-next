import type { ReactNode } from "react";
import { FiIcon } from "./Icon";

/**
 * Filament's table (`fi-ta`) as a widget or a page renders it: heading, optional filters
 * above the content, header cells, rows, and the empty state. Column class names follow
 * Filament's (`fi-ta-header-cell-{column name in kebab case}`).
 */
export type FiColumn<Row> = {
  name: string;
  label: string;
  alignRight?: boolean;
  render: (row: Row) => ReactNode;
};

/** Filament's column class suffix: `jumlah_pesanan` → `jumlah-pesanan`, `productName` → `product-name`. */
export function columnClass(name: string): string {
  return name
    .replace(/[_\s]+(.)/g, (_, character: string) => character.toUpperCase())
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

export function FiTextCell({ children }: { children: ReactNode }) {
  return <div className="fi-ta-text fi-ta-text-item fi-size-sm">{children}</div>;
}

export function FiTable<Row>({
  heading,
  description,
  filters,
  columns,
  rows,
  rowKey,
  emptyHeading,
}: {
  heading?: string;
  description?: ReactNode;
  filters?: ReactNode;
  columns: FiColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  emptyHeading: string;
}) {
  return (
    <div className="fi-ta">
      <div className={`fi-ta-ctn${filters ? " fi-ta-ctn-with-footer" : ""}${heading ? " fi-ta-ctn-with-header" : ""}`}>
        <div className="fi-ta-main">
          <div className="fi-ta-header-ctn">
            {heading ? (
              <div className="fi-ta-header">
                <div>
                  <h2 className="fi-ta-header-heading">{heading}</h2>
                  {description ? <p className="fi-ta-header-description">{description}</p> : null}
                </div>
              </div>
            ) : null}
            {filters ? <div className="fi-ta-filters-above-content-ctn">{filters}</div> : null}
          </div>
          <div className="fi-ta-content-ctn fi-fixed-positioning-context">
            <div role="status" aria-live="polite" aria-atomic="true" className="fi-sr-only">
              {rows.length ? `${rows.length} results` : "No results"}
            </div>
            <table aria-label={heading} className="fi-ta-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.name} scope="col" className={`fi-ta-header-cell fi-ta-header-cell-${columnClass(column.name)}${column.alignRight ? " fi-align-right" : ""}`}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              {rows.length ? (
                <tbody className="fi-ta-records">
                  {rows.map((row, index) => (
                    <tr key={rowKey(row, index)} className="fi-ta-row">
                      {columns.map((column) => (
                        <td key={column.name} className={`fi-ta-cell fi-ta-cell-${columnClass(column.name)}${column.alignRight ? " fi-align-right" : ""}`}>
                          <div className="fi-ta-col">{column.render(row)}</div>
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
  );
}
