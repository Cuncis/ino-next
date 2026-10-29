import Icon from './Icon';

/**
 * Storefront search field.
 *
 * Controlled input with a leading glyph and a clear button that appears once
 * there is something to clear.
 */
export default function SearchBar({
    value,
    onChange,
    placeholder = 'Cari obat, vitamin, alat kesehatan...',
    ariaLabel = 'Cari produk',
    autoFocus = false,
}: {
  value: string,
  onChange: (value: string) => void,
  placeholder?: string,
  ariaLabel?: string,
  autoFocus?: boolean,
}) {
    return (
        <div className="relative">
            <Icon
                name="search"
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />

            <input
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={ariaLabel}
                autoFocus={autoFocus}
                className="h-11 w-full border border-line bg-white pl-10 pr-10 text-xs text-muted placeholder:text-[#bbbbbb] focus:border-brand focus:outline-hidden focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
            />

            {value ? (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label="Hapus pencarian"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-faint"
                >
                    <Icon name="close" size={15} />
                </button>
            ) : null}
        </div>
    );
}
