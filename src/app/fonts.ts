import { Barlow, Figtree, Lato } from "next/font/google";

// Same families and weights the Laravel app loaded from fonts.bunny.net.
// Lato has no 600 on Google Fonts, so browsers already rendered it as 700.
const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** Class names that define the font CSS variables; put them on <html>. */
export const fontVariables = `${lato.variable} ${figtree.variable} ${barlow.variable}`;
