/**
 * Five-star rating rendered with text glyphs, matching the reference design.
 */
export default function Rating({ score, size = 'text-xs' }: { score: number, size?: string }) {
    return (
        <div className={size}>
            {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={star <= score ? 'text-star' : 'text-[#dddddd]'}>
                    &#9733;
                </span>
            ))}
        </div>
    );
}
