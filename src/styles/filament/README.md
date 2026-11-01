Filament 4.16 CSS sources (https://filamentphp.com, MIT licence, Copyright (c) Dan Harrin),
copied from the Laravel app's `vendor/filament/*/resources/css` so the Next.js admin panel
renders Filament's own markup classes (`fi-*`) with Filament's own styles.

Imported by `src/app/(admin)/admin.css`. Update by copying the same folders from a newer
Filament release.
- `forms/compiled` and `support/compiled` are Filament's `dist/index.css`, renamed: the CSS resolver skips folders named `dist`.
