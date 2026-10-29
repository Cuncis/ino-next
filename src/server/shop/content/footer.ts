import { readContent } from "@/lib/content-store";
import defaults from "./defaults/footer.json";

/**
 * The desktop site footer and the company details, edited under Konten Website >
 * Footer & Perusahaan. The company block also closes the Syarat & Ketentuan and
 * Kebijakan Privasi popups. Ported from App\Support\SiteFooterContent.
 */
export const FOOTER_CONTENT_KEY = "content.footer";

export const FOOTER_DEFAULTS = defaults;

type FooterContent = typeof defaults;

export type Company = FooterContent["company"];

/** Saved content over the defaults; the company details merge field by field. */
export async function footerContent(): Promise<FooterContent> {
  const read = await readContent(FOOTER_CONTENT_KEY);
  const saved = Object.fromEntries(Object.entries(read).filter(([key]) => key in defaults)) as Partial<FooterContent>;
  const savedCompany = (typeof saved.company === "object" && saved.company !== null ? saved.company : {}) as Record<string, string>;
  const company = {
    ...defaults.company,
    ...Object.fromEntries(Object.entries(savedCompany).filter(([key]) => key in defaults.company)),
  } as Company;

  return { ...defaults, ...saved, company };
}

/** The footer as every desktop page renders it. A full http(s) link opens outside the shop. */
export async function footerForStorefront(): Promise<SiteFooter> {
  const content = await footerContent();

  return {
    aboutTitle: content.aboutTitle,
    aboutText: content.aboutText,
    menuTitle: content.menuTitle,
    links: content.links.map((link) => ({
      ...link,
      external: link.href.startsWith("http://") || link.href.startsWith("https://"),
    })),
    copyright: content.copyright,
  };
}

export async function company(): Promise<Company> {
  return (await footerContent()).company;
}
