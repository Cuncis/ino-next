import Icon from './Icon';

/**
 * The home header's search row — a static-looking search field (not a real
 * text input) that opens the same full-screen `SearchOverlay` every other
 * search entry point in the shop already uses, rather than a second,
 * parallel live-search implementation.
 */
export default function SearchBarTrigger({ onOpen }: { onOpen: () => void }) {
    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label="Cari produk kesehatan di Inofarma"
            className="flex h-10 w-full items-stretch overflow-hidden bg-white text-left"
        >
            <span className="flex flex-1 items-center px-3.5 text-[11px] text-muted">
                Cari produk kesehatan di Inofarma
            </span>

            <span className="flex w-11 shrink-0 items-center justify-center bg-success text-cream">
                <Icon name="search" size={17} />
            </span>
        </button>
    );
}
