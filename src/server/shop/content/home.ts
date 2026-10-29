import { lines, paragraphs, readContent } from "@/lib/content-store";
import defaults from "./defaults/home.json";
import { filled, storefrontImage } from "./image-url";

/**
 * The storefront home page's editable content: carousels, the "Semua Produk" icon,
 * brand logos, benefits, testimonials and the closing texts. Edited in the admin under
 * Konten Website > Beranda. A section nobody has saved yet shows the defaults, the
 * content the page shipped with. Ported from App\Support\HomePageContent.
 *
 * The category icons are not here: each one is the `image_path` of its category.
 */
export const HOME_CONTENT_KEY = "content.home";

export const HOME_DEFAULTS = defaults;

export const HEADINGS: Record<string, string> = defaults.headings;

export const CONTACT_ICONS = ["phone", "email"];

type Linked = { image: string; href: string; alt: string };
type SavedHomeContent = typeof defaults;

/** Saved content over the defaults, section by section, in the shape the admin form edits. */
export async function homeContent(): Promise<SavedHomeContent> {
  const read = await readContent(HOME_CONTENT_KEY);
  const saved = Object.fromEntries(Object.entries(read).filter(([key]) => key in defaults)) as Partial<SavedHomeContent>;
  const savedHeadings = (typeof saved.headings === "object" && saved.headings !== null ? saved.headings : {}) as Record<string, string>;

  // Headings are merged one by one, so a heading added later still gets its default
  const headings = { ...HEADINGS, ...Object.fromEntries(Object.entries(savedHeadings).filter(([key]) => key in HEADINGS)) };

  return { ...defaults, ...saved, headings } as SavedHomeContent;
}

/** What the home page renders. Texts and contact lines are split here, so the page only has to loop. */
export async function homeContentForStorefront(): Promise<HomeContent> {
  const content = await homeContent();
  const withImage = <T extends { image?: string }>(items: T[]) =>
    items.filter((item) => filled(item.image)).map((item) => ({ ...item, image: storefrontImage(String(item.image)) }));

  return {
    headings: Object.fromEntries(
      Object.entries(content.headings as Record<string, string>).map(([key, heading]) => [key, heading !== "" ? heading : HEADINGS[key]]),
    ) as HomeContent["headings"],
    hero: withImage(content.hero as Linked[]),
    promo: withImage(content.promo as Linked[]),
    bottom: withImage(content.bottom as Linked[]),
    allProductsIcon: storefrontImage(content.allProductsIcon || defaults.allProductsIcon),
    brands: withImage(content.brands),
    benefits: withImage(content.benefits),
    testimonials: content.testimonials.map((testimonial) => ({
      ...testimonial,
      image: filled(testimonial.image) ? storefrontImage(testimonial.image) : testimonial.image,
    })),
    texts: content.texts.map((text) => ({ title: text.title, paragraphs: paragraphs(String(text.body)) })),
    contactTitle: content.contactTitle,
    contactIntro: content.contactIntro,
    contacts: content.contacts.map((contact) => ({
      icon: (CONTACT_ICONS.includes(contact.icon) ? contact.icon : "phone") as "phone" | "email",
      title: contact.title,
      lines: lines(String(contact.lines)),
    })),
  };
}
