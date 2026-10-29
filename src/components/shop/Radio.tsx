/**
 * Static radio indicator used by the address and payment pickers.
 */
export default function Radio({ checked = false }: { checked?: boolean }) {
    return (
        <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                checked ? 'border-brand' : 'border-[#bbbbbb]'
            }`}
        >
            {checked ? <div className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
        </div>
    );
}
