/**
 * Ambient types shared across the storefront and admin screens.
 *
 * The catalogue shape mirrors `ShopCatalogPresenter::forStorefront()`, which
 * `HandleInertiaRequests` shares with every page as the `catalog` prop.
 */

interface CatalogImage {
    path: string;
    alt: string;
}

interface CatalogProduct {
    /** SKU, e.g. PRD-001. */
    id: string;
    slug: string;
    name: string;
    category: string;
    /** The primary photo, used by grids, strips and cards. */
    image: string;
    /** Every photo in display order, used by the product-detail gallery. */
    images: CatalogImage[];
    /** Current selling price, in rupiah. */
    price: number;
    /** Struck-through price when the item is discounted. */
    oldPrice?: number;
    /** Across every branch. */
    stock: number;
    sold: number;
    rating: string;
    /** Availability: Tersedia | Stok Menipis | Habis. */
    status: string;
    unit: string;
    variants: string[];
    prescription: boolean;
    blurb: string;
    /** Non-Obat | Bebas | Bebas Terbatas | Keras. */
    drugClass?: string;
    /** True for Bebas Terbatas, where the P1-P6 warning must show. */
    needsWarningLabel: boolean;
    /** NIE BPOM registration number. */
    nie?: string;
    composition?: string;
    indication?: string;
    dosage?: string;
    sideEffects?: string;
    /** P1-P6 warning text for Bebas Terbatas. */
    warning?: string;
    manufacturer?: string;
    maxQtyPerOrder?: number;
    /** The most of this product one order may hold (its own limit, 2 unless staff changed it). */
    purchaseLimit?: number;
    /** Suhu Ruang | Sejuk (15-25°C) | Dingin/Kulkas (2-8°C). */
    storage?: string;
    /** Soonest expiry among batches in stock, e.g. "12 Mar 2027". */
    expiresAt?: string | null;
}

interface HomeSlide {
    image: string;
    href: string;
    alt: string;
}

/** The home page's editable content (`App\Support\HomePageContent::forStorefront()`). */
interface HomeContent {
    headings: {
        recommended: string,
        newArrivals: string,
        trending: string,
        brands: string,
        benefits: string,
        nearest: string,
        testimonials: string,
    };
    hero: HomeSlide[];
    promo: HomeSlide[];
    bottom: HomeSlide[];
    allProductsIcon: string;
    brands: { name: string, image: string }[];
    benefits: { label: string, image: string }[];
    testimonials: { name: string, branch: string, image: string, quote: string }[];
    texts: { title: string, paragraphs: string[] }[];
    contactTitle: string;
    contactIntro: string;
    contacts: { icon: 'phone' | 'email', title: string, lines: string[] }[];
}

/** A content page made of titled sections (`App\Support\DocumentPageContent`). */
interface ContentDocument {
    title: string;
    sections: { title: string, paragraphs: string[] }[];
}

/** A block inside the standalone Kebijakan Privasi page: prose or a bullet list. */
type PolicyBlock = { type: 'paragraph'; text: string } | { type: 'list'; items: string[] };

/** The standalone Kebijakan Privasi page at `/pp` (`App\Support\PrivacyPolicyContent`). */
interface PrivacyPolicyDocument {
    title: string;
    intro: PolicyBlock[];
    sections: { title: string; blocks: PolicyBlock[] }[];
    updatedAt: string;
}

/** Syarat & Ketentuan or Kebijakan Privasi, numbered by the server. */
interface LegalDocument {
    title: string;
    sections: { title: string, clauses: { number: string, text: string, items: string[] }[] }[];
    contactHeading: string;
    updatedAt: string;
    company: { name: string, email: string, phone: string, address: string };
}

interface FaqItem {
    question: string;
    paragraphs: string[];
}

/** The desktop footer (`App\Support\SiteFooterContent::forStorefront()`). */
interface SiteFooter {
    aboutTitle: string;
    aboutText: string;
    menuTitle: string;
    links: { label: string, href: string, external: boolean }[];
    copyright: string;
}

interface CatalogCategory {
    name: string;
    slug: string;
    image: string;
    status: string;
    products: number;
}

interface Catalog {
    products: CatalogProduct[];
    categories: CatalogCategory[];
}

/** A product as the storefront grids show it, with the price already formatted. */
interface ProductTile {
    id: string;
    name: string;
    category: string;
    image: string;
    price: string;
    oldPrice?: string;
    rating: string;
    brand: string;
    soldOut: boolean;
}

interface ShopUser {
    name: string;
    email: string;
    phone: string;
}

interface Review {
    author: string;
    avatar: string;
    score: number;
    age: string;
    body: string;
}

/** A pharmacy branch as returned by `/api/cabang/untuk-produk/{product}`. */
interface ProductBranch {
    id: string;
    name: string;
    kota: string;
    distanceKm: number | null;
    fullAddress?: string;
    available: number;
    selectable: boolean;
    supportsDelivery: boolean;
    supportsPickup: boolean;
    isOpenNow: boolean;
}

/** The branch a cart or order is tied to, as `CartPresenter` returns it. */
interface CartBranch {
    id: string;
    name: string;
    kota: string;
    fullAddress: string;
    supportsDelivery: boolean;
    supportsPickup: boolean;
    apjName?: string | null;
    apjWhatsappUrl?: string | null;
}

interface SavedAddress {
    id: number | string;
    label: string;
    isDefault: boolean;
    fullAddress: string;
}

interface CartLine {
    sku: string;
    name: string;
    image: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    available: number;
    purchaseLimit?: number;
}

interface CartCoupon {
    code: string;
    freeShipping: boolean;
}

interface CourierOption {
    courierCompany: string;
    courierType: string;
    courierName: string;
    serviceName: string;
    duration: string | null;
    price: number;
}

interface OrderListItem {
    number: string;
    status: string;
    fulfilment: string;
    branchName: string;
    date: string;
    total: number;
}

interface OrderLine {
    sku: string;
    name: string;
    quantity: number;
    lineTotal: number;
}

/** An apotek card: the homepage's "Apotek Inofarma Terdekat" and "Apotek Terdekat Lainnya". */
interface BranchCard {
    slug: string;
    name: string;
    photoUrl: string;
    fullAddress: string;
    apjName: string | null;
}

/** One apotek's own page (`/apotek/{slug}`). */
interface BranchPage {
    slug: string;
    name: string;
    status: string;
    photoUrl: string | null;
    fullAddress: string;
    siaNumber: string | null;
    apjName: string | null;
    apjSipaNumber: string | null;
    practiceSchedule: string | null;
    storeSchedule: string | null;
    contactUrl: string | null;
    mapsUrl: string | null;
}

/** One line of the cart as `CartPresenter` returns it. */
interface CartPreviewItem extends CartLine {
    brand: string;
    maxQtyPerOrder: number | null;
}

/** The cart as the header dropdown fetches it from `ui.keranjang.ringkas`. */
interface CartPreview {
    items: CartPreviewItem[];
    itemCount: number;
    subtotal: number;
}

interface OrderStep {
    label: string;
    state: string;
    at: string | null;
}

interface OrderDetailData {
    number: string;
    status: string;
    fulfilment: string;
    isCancellable: boolean;
    canPay: boolean;
    total: number;
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    paymentMethod: string;
    note: string | null;
    date: string;
    branch: CartBranch | null;
    recipientName: string | null;
    recipientPhone: string | null;
    shippingAddress: string | null;
    items: (OrderLine & { image?: string | null; unitPrice?: number })[];
    steps: OrderStep[];
}

interface TrackOrderData {
    number: string;
    status: string;
    steps: OrderStep[];
    shipment: null | {
        courierName: string;
        serviceName: string;
        waybillId: string | null;
        trackingLink: string | null;
        statusLabel: string | null;
    };
    pickup: null | { code: string; qrSvg: string | null; expiresAt: string };
}
