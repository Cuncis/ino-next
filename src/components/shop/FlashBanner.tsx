import { usePage } from '@/lib/inertia';

/**
 * A one-line banner for the flash message a write action leaves behind
 * (`session()->with('success', …)` / `->with('error', …)`) — shared from
 * `HandleInertiaRequests` on every request, but only rendered by the
 * screens that actually do writes (cart, checkout, addresses, orders).
 */
export default function FlashBanner() {
    const { flash } = usePage().props;
    const message = flash?.error || flash?.success;

    if (! message) {
        return null;
    }

    return (
        <div
            className={`px-3.5 py-2 text-center text-[11px] font-semibold ${
                flash.error ? 'bg-danger/10 text-danger-deep' : 'bg-success/10 text-success-deep'
            }`}
        >
            {message}
        </div>
    );
}
