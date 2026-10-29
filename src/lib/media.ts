/**
 * Image paths.
 *
 * Everything lives under `public/media` because the storefront and the admin
 * show the same pictures. Product and category images now come back from the
 * server with the record they belong to; these helpers are for the fixtures
 * that are still local to the front end (avatars, brand marks).
 */
export const media = {
    product: (n: number | string) => `/media/images/product/p-${n}.png`,
    category: (n: number | string) => `/media/images/small/img-${n}.jpg`,
    user: (n: number | string) => `/media/images/users/avatar-${n}.jpg`,
    seller: (n: number | string) => `/media/images/seller/${n}.svg`,
    brand: (n: number | string) => `/media/images/brands/${n}.png`,
};
