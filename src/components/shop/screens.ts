/**
 * The 37 storefront screens in presentation order.
 *
 * This is the single source of truth for the screen index page, the prev/next
 * pager in the layout, and the route table in `routes/web.php`.
 */
export const screenGroups = [
    {
        group: 'Autentikasi',
        screens: [
            { number: 1, name: 'Masuk', slug: 'signin' },
            { number: 2, name: 'Daftar', slug: 'signup' },
            { number: 3, name: 'Lupa Kata Sandi', slug: 'forgot-password' },
            { number: 4, name: 'Verifikasi Nomor HP', slug: 'verify-phone' },
            { number: 5, name: 'Kode OTP', slug: 'otp-code' },
        ],
    },
    {
        group: 'Pendaftaran',
        screens: [
            { number: 6, name: 'Akun Berhasil Dibuat', slug: 'account-created' },
            { number: 7, name: 'Email Terkirim', slug: 'email-sent' },
            { number: 8, name: 'Kata Sandi Baru', slug: 'new-password' },
        ],
    },
    {
        group: 'Menu Utama',
        screens: [
            { number: 9, name: 'Beranda', slug: 'home' },
            { number: 10, name: 'Keranjang / Pesanan', slug: 'cart' },
            { number: 11, name: 'Favorit', slug: 'wishlist' },
            { number: 12, name: 'Profil', slug: 'profile' },
        ],
    },
    {
        group: 'Belanja & Produk',
        screens: [
            { number: 13, name: 'Kategori', slug: 'categories' },
            { number: 14, name: 'Belanja', slug: 'shop' },
            { number: 15, name: 'Detail Produk', slug: 'product-detail' },
            { number: 16, name: 'Filter', slug: 'filter' },
        ],
    },
    {
        group: 'Alur Pembayaran',
        screens: [
            { number: 17, name: 'Checkout', slug: 'checkout' },
            { number: 18, name: 'Detail Pengiriman', slug: 'shipping-details' },
            { number: 20, name: 'Pesanan Berhasil', slug: 'order-successful' },
            { number: 21, name: 'Pesanan Gagal', slug: 'order-failed' },
        ],
    },
    {
        group: 'Kondisi Kosong',
        screens: [
            { number: 22, name: 'Keranjang Kosong', slug: 'cart-empty' },
            { number: 23, name: 'Favorit Kosong', slug: 'wishlist-empty' },
            { number: 24, name: 'Kode Promo Kosong', slug: 'promocodes-empty' },
            { number: 25, name: 'Riwayat Pesanan Kosong', slug: 'order-history-empty' },
        ],
    },
    {
        group: 'Halaman Profil',
        screens: [
            { number: 26, name: 'Ubah Profil', slug: 'edit-profile' },
            { number: 29, name: 'Alamat Saya', slug: 'my-address' },
            { number: 30, name: 'Tambah Alamat Baru', slug: 'add-new-address' },
            { number: 31, name: 'Kode Promo Saya', slug: 'my-promocodes' },
            { number: 32, name: 'Riwayat Pesanan', slug: 'order-history' },
        ],
    },
    {
        group: 'Info & Ulasan',
        screens: [
            { number: 33, name: 'Lacak Pesanan', slug: 'track-order' },
            { number: 34, name: 'Info Pengiriman', slug: 'shipping-info' },
            { number: 35, name: 'FAQ', slug: 'faq' },
            { number: 36, name: 'Ulasan', slug: 'reviews' },
            { number: 37, name: 'Beri Ulasan', slug: 'leave-a-review' },
        ],
    },
];

/** Flat list of all 37 screens, ordered by screen number. */
export const allScreens = screenGroups.flatMap((group) =>
    group.screens.map((screen) => ({ ...screen, group: group.group })),
);

/**
 * Resolve the screens that sit either side of the given slug, for the pager.
 */
export function findNeighbours(slug: string): { previous: object|null, next: object|null, current: object|null } {
    const index = allScreens.findIndex((screen) => screen.slug === slug);

    if (index === -1) {
        return { previous: null, next: null, current: null };
    }

    return {
        previous: allScreens[index - 1] ?? null,
        current: allScreens[index],
        next: allScreens[index + 1] ?? null,
    };
}
