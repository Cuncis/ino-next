import { iconData } from './iconData';

/**
 * Admin icon.
 *
 * Renders one of the baked-in Solar/Iconamoon glyphs by its original Iconify
 * name, so markup carried over from the source template keeps the same icon
 * names it always used (`solar:eye-broken`, `iconamoon:file-light`, …).
 *
 * Bodies are trusted build-time constants generated from the Iconify API — never
 * pass user input as `name`.
 */
export default function Icon({ name, size = 20, className = '', title, ...rest }: {
  name: string,
  size?: number,
  className?: string,
  title?: string,
}) {
    const glyph = (iconData as Record<string, { w: number; h: number; body: string }>)[name];

    if (! glyph) {
        if (process.env.NODE_ENV !== "production") {
            console.warn(`[Admin/Icon] unknown icon "${name}"`);
        }

        return null;
    }

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${glyph.w} ${glyph.h}`}
            width={size}
            height={size}
            className={`inline-block shrink-0 ${className}`}
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : 'true'}
            focusable="false"
            dangerouslySetInnerHTML={{ __html: glyph.body }}
            {...rest}
        />
    );
}
