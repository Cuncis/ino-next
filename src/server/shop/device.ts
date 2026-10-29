import { headers } from "next/headers";

/**
 * A guess at whether the browser shows the desktop layout (1024px and wider), for the
 * first server render. Chromium browsers say so in `Sec-CH-UA-Mobile`; others are read
 * from the user agent. The page corrects itself from the real screen once it runs.
 */
export async function guessDesktop(): Promise<boolean> {
  const list = await headers();
  const mobileHint = list.get("sec-ch-ua-mobile");

  if (mobileHint === "?1") {
    return false;
  }

  if (mobileHint === "?0") {
    return true;
  }

  return !/Mobi|Android|iPhone|iPad|iPod/i.test(list.get("user-agent") ?? "");
}
