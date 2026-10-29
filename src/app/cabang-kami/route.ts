/** The old "Cabang Kami" list was removed on purpose; its address now leads to the homepage's apotek cards. */
export async function GET(request: Request) {
  return Response.redirect(new URL("/", request.url), 301);
}
