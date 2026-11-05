import type { ButtonHTMLAttributes, ReactNode } from "react";
import { FiIcon, FiLoadingIndicator } from "./Icon";

/**
 * Filament's own markup for buttons, links and badges (`fi-btn`, `fi-link`, `fi-badge`),
 * styled by Filament's CSS. The colour class strings are spelled out in full so Tailwind
 * finds them: Filament's colour utilities only exist where they appear in the source.
 */
export type FiColor = "primary" | "danger" | "gray" | "success" | "warning" | "info";

const BUTTON_COLORS: Record<FiColor, string> = {
  primary:
    "fi-color fi-color-primary fi-bg-color-400 hover:fi-bg-color-300 dark:fi-bg-color-600 dark:hover:fi-bg-color-700 fi-text-color-950 hover:fi-text-color-800 dark:fi-text-color-0 dark:hover:fi-text-color-0",
  danger:
    "fi-color fi-color-danger fi-bg-color-600 hover:fi-bg-color-500 dark:fi-bg-color-600 dark:hover:fi-bg-color-500 fi-text-color-0 hover:fi-text-color-0 dark:fi-text-color-0 dark:hover:fi-text-color-0",
  success:
    "fi-color fi-color-success fi-bg-color-600 hover:fi-bg-color-500 dark:fi-bg-color-600 dark:hover:fi-bg-color-500 fi-text-color-0 hover:fi-text-color-0 dark:fi-text-color-0 dark:hover:fi-text-color-0",
  warning:
    "fi-color fi-color-warning fi-bg-color-400 hover:fi-bg-color-300 dark:fi-bg-color-600 dark:hover:fi-bg-color-500 fi-text-color-950 hover:fi-text-color-800 dark:fi-text-color-0 dark:hover:fi-text-color-0",
  info: "fi-color fi-color-info fi-bg-color-600 hover:fi-bg-color-500 dark:fi-bg-color-600 dark:hover:fi-bg-color-500 fi-text-color-0 hover:fi-text-color-0 dark:fi-text-color-0 dark:hover:fi-text-color-0",
  gray: "",
};

const LINK_COLORS: Record<FiColor, string> = {
  primary: "fi-color fi-color-primary fi-text-color-700 dark:fi-text-color-400",
  danger: "fi-color fi-color-danger fi-text-color-600 dark:fi-text-color-300",
  success: "fi-color fi-color-success fi-text-color-700 dark:fi-text-color-400",
  warning: "fi-color fi-color-warning fi-text-color-700 dark:fi-text-color-400",
  info: "fi-color fi-color-info fi-text-color-700 dark:fi-text-color-400",
  gray: "",
};

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  color?: FiColor;
  icon?: string;
  loading?: boolean;
  /** wrap the label in a <span>, as modal footer buttons do */
  wrapLabel?: boolean;
  size?: "sm" | "md";
};

/** `<x-filament::button>` as an action renders it (`fi-ac-btn-action fi-btn`). */
export function FiButton({ color = "primary", icon, loading = false, wrapLabel = false, size = "md", children, className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={`fi-ac-btn-action fi-btn fi-size-${size} ${BUTTON_COLORS[color]} ${loading ? "fi-processing" : ""} ${className}`.trim()} disabled={loading || rest.disabled} {...rest}>
      {loading ? <FiLoadingIndicator /> : icon ? <FiIcon name={icon} /> : null}
      {wrapLabel ? <span>{children}</span> : children}
    </button>
  );
}

/** A link-style action (`fi-ac-link-action fi-link`), as a button or an <a>. */
export function FiLinkAction({
  color = "primary",
  size = "md",
  href,
  children,
  ...rest
}: { color?: FiColor; size?: "sm" | "md"; href?: string; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">) {
  const className = `fi-ac-link-action fi-link fi-size-${size} ${LINK_COLORS[color]}`;
  const label = <span className="fi-link-label">{children}</span>;

  return href ? (
    <a href={href} className={className}>
      {label}
    </a>
  ) : (
    <button type="button" className={className} {...rest}>
      {label}
    </button>
  );
}

const BADGE_COLORS: Record<FiColor, string> = {
  primary: "fi-color fi-color-primary fi-text-color-700 dark:fi-text-color-300",
  danger: "fi-color fi-color-danger fi-text-color-700 dark:fi-text-color-300",
  success: "fi-color fi-color-success fi-text-color-700 dark:fi-text-color-300",
  warning: "fi-color fi-color-warning fi-text-color-700 dark:fi-text-color-300",
  info: "fi-color fi-color-info fi-text-color-700 dark:fi-text-color-300",
  gray: "",
};

export function FiBadge({ color = "gray", size = "sm", children }: { color?: FiColor; size?: "xs" | "sm" | "md"; children: ReactNode }) {
  return <span className={`${BADGE_COLORS[color]} fi-badge fi-size-${size}`.trim()}>{children}</span>;
}

/** A page's heading row with its header actions (`fi-header`). */
export function FiPageHeader({ heading, subheading, actions, breadcrumbs }: { heading: string; subheading?: string; actions?: ReactNode; breadcrumbs?: { label: string; url?: string }[] }) {
  return (
    <header className={`fi-header${breadcrumbs?.length ? " fi-header-has-breadcrumbs" : ""}${subheading ? " fi-header-has-subheading" : ""}`}>
      <div>
        {breadcrumbs?.length ? (
          <nav className="fi-breadcrumbs">
            <ol className="fi-breadcrumbs-list">
              {breadcrumbs.map((crumb, index) => (
                <li key={crumb.label} className="fi-breadcrumbs-item">
                  {index > 0 ? <FiIcon name="m-chevron-right" className="fi-breadcrumbs-item-separator fi-ltr" /> : null}
                  {crumb.url ? (
                    <a href={crumb.url} className="fi-breadcrumbs-item-label">
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="fi-breadcrumbs-item-label">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1 className="fi-header-heading">{heading}</h1>
        {subheading ? <p className="fi-header-subheading">{subheading}</p> : null}
      </div>
      {actions ? (
        <div className="fi-header-actions-ctn">
          <div className="fi-ac fi-align-start">{actions}</div>
        </div>
      ) : null}
    </header>
  );
}

/** The body of a Filament page (`<x-filament-panels::page>`). */
export function FiPage({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="fi-page">
      <div className="fi-page-header-main-ctn">
        {header}
        <div className="fi-page-main">
          <div className="fi-page-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
