import { redirectResponse } from "@/lib/http";

/** The old "Cabang Kami" list was removed on purpose; its address now leads to the homepage's apotek cards. */
export async function GET() {
  return redirectResponse("/", 301);
}
