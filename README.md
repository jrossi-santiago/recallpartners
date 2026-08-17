# Recall Partners — website

Static marketing site. Plain HTML, CSS and vanilla JS — no build step, no framework,
no dependencies. Open `index.html` in a browser and it works.

The section structure and layout are modeled on [eaglerev.io](https://eaglerev.io) (that
site is a Next.js app with hashed class names, so nothing was copied verbatim — it was
rebuilt from scratch). All copy, colors and typography are Recall Partners' own.

```
index.html          # every section, top to bottom
assets/styles.css   # design tokens at the top, then section-by-section styles
assets/script.js    # mobile nav, scroll reveal, FAQ accordion, table tabs
```

## Run it locally

```bash
npx http-server . -p 8080     # or: python3 -m http.server 8080
```

## Before you launch — the TODO list

Search the files for `PLACEHOLDER` and `TODO`. In order of importance:

1. **Booking link.** Every CTA points at `#book`. In `index.html`, find the
   `BOOKING EMBED GOES HERE` block near the bottom and paste your Calendly / Cal.com /
   GoHighLevel embed. If you'd rather send people straight out to the scheduler, replace
   every `href="#book"` with the scheduler URL instead.
2. **Proof section** (`id="proof"`). Three placeholder cards with `—` instead of numbers.
   Replace with real campaign screenshots and real figures, or delete the whole
   `<section id="proof">` until you have one campaign done. Do not ship invented numbers.
3. **Testimonials** (`id="stories"`). Two empty quote cards. Same rule — real quotes with
   written permission, or delete the section.
4. **Social proof marquee.** Currently lists treatment categories, not client names.
   Swap in real client names once you can use them.
5. **Contact details.** `hello@recallpartners.com` in the footer is a placeholder.
6. **Domain.** Update the `canonical` and `og:url` meta tags in `<head>`.
7. **Legal pages.** The footer links to `/privacy` and `/terms`, which don't exist yet.
   You need both before running SMS campaigns.

## Deploy

Any static host. Netlify, Vercel, Cloudflare Pages and GitHub Pages all take this repo
as-is with no configuration — point them at the repo root.

## Notes on copy

- No pricing figures appear anywhere on the site by design. The FAQ and the "deal"
  section say pricing is given on the call, in writing.
- The FAQ answer on compliance describes how campaigns are run and explicitly says it
  isn't legal advice. Have your own counsel review anything you claim about TCPA/SMS
  consent before launch.

## Editing the design

All colors, fonts and spacing live in the `:root` block at the top of
`assets/styles.css`. Change `--plum` and `--rose` to re-skin the whole site.
