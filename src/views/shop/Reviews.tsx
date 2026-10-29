'use client';

import MobileLayout from '@/layouts/MobileLayout';
import AppBar from '@/components/shop/AppBar';
import ReviewCard from '@/components/shop/ReviewCard';
import { reviews } from '@/components/shop/data';

export default function Reviews() {
    return (
        <MobileLayout
            title="Ulasan"
            header={<AppBar title="Ulasan" back="/product-detail" tone="brand" />}
        >
            <div className="flex-1 overflow-y-auto p-3.5">
                {reviews.map((review) => (
                    <ReviewCard key={review.author} review={review} />
                ))}
            </div>
        </MobileLayout>
    );
}
