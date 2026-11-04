import type { CSSProperties } from "react";
import { FiListTable, type ListSpec } from "@/components/admin/filament/ListTable";

/** The product's photos (ImagesRelationManager), under its details or its form. */
export function ProductImagesTable({ spec }: { spec: ListSpec }) {
  const col = { "--col-span-default": "span 1 / span 1" } as CSSProperties;

  return (
    <div className="fi-resource-relation-manager">
      <div className="fi-grid fi-sc fi-sc-has-gap" style={{ "--cols-default": "repeat(1, minmax(0, 1fr))" } as CSSProperties}>
        <div className="fi-grid-col fi-hidden" style={col} />
        <div className="fi-sc-liberated" />
        <div className="fi-grid-col" style={col}>
          <div className="fi-sc-component">
            <FiListTable spec={spec} />
          </div>
        </div>
      </div>
    </div>
  );
}
