import Rating from './Rating';

/**
 * @typedef {object} Review
 * @property {string} author
 * @property {string} avatar
 * @property {number} score
 * @property {string} age
 * @property {string} body
 */

export default function ReviewCard({ review }: { review: Review }) {
    return (
        <div className="mb-2 rounded-[2px] border border-line bg-white p-[13px]">
            <div className="mb-2 flex items-start gap-2.5">
                <img
                    src={review.avatar}
                    alt={review.author}
                    className="h-[38px] w-[38px] shrink-0 rounded-full object-cover"
                />

                <div className="flex-1">
                    <div className="mb-0.5 text-[13px] font-bold text-ink">
                        {review.author}
                    </div>
                    <Rating score={review.score} />
                </div>

                <span className="whitespace-nowrap text-[11px] text-faint">
                    {review.age}
                </span>
            </div>

            <p className="text-xs leading-relaxed text-muted">{review.body}</p>
        </div>
    );
}
