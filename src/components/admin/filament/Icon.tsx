import { HEROICONS } from "./heroicons";

/**
 * A Heroicon as Filament renders it (`<x-filament::icon>`): `o-…` outline (24px grid),
 * `m-…` mini (20px). Bodies are build-time constants (see scripts/heroicons.py).
 */
export function FiIcon({ name, size = "md", className = "" }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const icon = HEROICONS[name];

  if (!icon) {
    return null;
  }

  return (
    <svg
      className={`fi-icon fi-size-${size} ${className}`.trim()}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={icon.viewBox}
      fill={icon.fill ?? "currentColor"}
      stroke={icon.stroke ?? undefined}
      strokeWidth={icon.strokeWidth ?? undefined}
      aria-hidden="true"
      data-slot="icon"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}

/** Filament's spinner, shown on a button while its action runs. */
export function FiLoadingIndicator({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={`fi-icon fi-loading-indicator fi-size-${size}`}>
      <path
        clipRule="evenodd"
        d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12C5 15.866 8.13401 19 12 19ZM12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        fillRule="evenodd"
        fill="currentColor"
        opacity="0.2"
      />
      <path d="M2 12C2 6.47715 6.47715 2 12 2V5C8.13401 5 5 8.13401 5 12H2Z" fill="currentColor" />
    </svg>
  );
}
