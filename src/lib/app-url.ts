/** Laravel's `url($path)`: an absolute link on this site (APP_URL), for emails and outside services. */
export function appUrl(path = "/"): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
