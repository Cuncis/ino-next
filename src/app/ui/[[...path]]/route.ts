/**
 * The storefront used to live under /ui. Old bookmarks, emails and search results still
 * point there, so send them to the same page without the prefix (301, query kept).
 */
export async function GET(request: Request, { params }: RouteContext<"/ui/[[...path]]">) {
  const { path = [] } = await params;
  const url = new URL(request.url);
  const target = new URL(`/${path.join("/")}${url.search}`, url);

  return Response.redirect(target, 301);
}
