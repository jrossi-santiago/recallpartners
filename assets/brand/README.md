# Brand assets

The website does **not** load the JPG files in this folder. The nav and footer
draw the logo live from inline SVG + CSS (`.brand` in `assets/styles.css`), so
it stays crisp at any size, recolours with the theme, and has no baked-in
background. The JPGs are kept as **source files for use off the website**.

| File | Size | Use it for |
|---|---|---|
| `recall-partners-logo.jpg` | 3200×960 | Full wordmark on light backgrounds — invoices, proposals, decks, letterhead |
| `recall-partners-logo-dark.jpg` | 3200×960 | Full wordmark on plum/dark backgrounds |
| `recall-partners-mark.jpg` | 2048×2048 | Square mark — Google Business Profile, social avatars, email signature |

## Generated files — do not hand-edit

These are produced by a script and referenced by every page:

| File | Used by |
|---|---|
| `favicon.svg` | Primary browser tab icon (modern browsers) |
| `favicon-32.png` | Legacy tab icon fallback |
| `favicon-180.png` | `apple-touch-icon` — iOS home screen |
| `favicon-192.png`, `favicon-512.png` | `site.webmanifest` — Android home screen |
| `og-image.png` (1200×630) | `og:image` / `twitter:image` — link previews |

`favicon.svg` is the source for all four favicon PNGs. `og-image.png` is
rendered from an HTML card using the site's real fonts, so it matches the
homepage typography exactly.

To regenerate them after a brand change, see **Regenerating brand images** in
the root `README.md`.
