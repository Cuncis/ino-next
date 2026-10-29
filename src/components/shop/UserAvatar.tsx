/**
 * Default profile picture: a gray person silhouette that fills its parent.
 * The parent sets the size and the round, overflow-hidden frame.
 */
export default function UserAvatar({ label }: { label: string }) {
    return (
        <svg
            viewBox="0 0 96 96"
            role="img"
            aria-label={label}
            className="h-full w-full bg-[#e5e7eb] text-[#9ca3af]"
        >
            <circle cx="48" cy="36" r="17" fill="currentColor" />
            <path d="M12 96c0-20 16-34 36-34s36 14 36 34z" fill="currentColor" />
        </svg>
    );
}
