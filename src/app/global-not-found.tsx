import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import { NotFoundPage } from "./not-found-page";
import "./globals.css";

export const metadata: Metadata = {
  title: "Not Found",
};

/** A URL that matches no route: the storefront and admin have separate root layouts. */
export default function GlobalNotFound() {
  return (
    <html lang="id" className={fontVariables}>
      <body className="font-sans antialiased">
        <NotFoundPage />
      </body>
    </html>
  );
}
