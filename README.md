# Recall Partners — website

Static marketing site. Plain HTML, CSS and vanilla JS — no build step, no framework,
no runtime dependencies. Open `index.html` in a browser and it works.

The section structure and layout are modeled on [eaglerev.io](https://eaglerev.io) (that
site is a Next.js app with hashed class names, so nothing was copied verbatim — it was
rebuilt from scratch). All copy, colors and typography are Recall Partners' own.

```
index.html                      # homepage — every section, top to bottom
privacy.html                    # privacy policy (incl. SMS/opt-out disclosures)
terms.html                      # terms of service
site.webmanifest                # PWA/home-screen icon manifest
assets/styles.css               # design tokens at the top, then section-by-section styles
assets/script.js                # mobile nav, scroll reveal, FAQ accordion, table tabs
assets/analytics.js             # Google Analytics 4 global tag — loaded by every page
assets/brand/                   # logos, favicons, og:image — see assets/brand/README.md
tools/render-brand-images.js    # regenerates favicons + og:image
```

## Run it locally

```bash
npx http-server . -p 8080     # or: python3 -m http.server 8080
```

## Before you launch

Everything in the original launch checklist is done except the two items below.
Search the files for `TODO` to confirm nothing new has crept in.

1. **Confirm the governing-law state in `terms.html`.** Section 16 currently says
   **Pennsylvania**, inferred from the 570 area code. If the business is registered
   elsewhere, change it — it's a single paragraph.
2. **Have counsel review `privacy.html` and `terms.html` before running SMS campaigns.**
   They are written to be complete and specific to this business, not filled with
   blanks, but they are not a substitute for legal review. See the note below on why
   the privacy policy's wording matters for carrier approval.

### Still worth doing, not blocking

- **Proof and testimonials.** The `#proof` and `#stories` sections were removed because
  they contained placeholder cards with `—` instead of numbers and fake quotes.
  Rebuild them from git history (`git log -- index.html`) once you have one real
  campaign and one quote in writing. Do not ship invented numbers.
- **Social proof marquee.** Now labelled "Who we work with" and lists treatment
  categories, which is honest. Swap in real client names — and rename the label — once
  you have written permission to use them.
- **Analytics.** Nothing is installed. The booking CTA already carries
  `data-cta="booking"` so an event handler has something to hook onto.

## SMS compliance note

`privacy.html` section 4 contains this sentence, close to verbatim:

> We do not share mobile information with third parties or affiliates for marketing or
> promotional purposes.

That wording is not decorative. Carriers and The Campaign Registry look for it during
10DLC brand and campaign vetting, and its absence is a common rejection reason. The
same section documents STOP/HELP keywords, message frequency, and "message and data
rates may apply" — all of which are also checked. **If you rewrite that section, keep
those disclosures intact** or your campaigns may fail registration.

`terms.html` section 5 puts the consent warranty on the client — they confirm every
contact has an existing relationship with their practice. Keep that too.

## Regenerating brand images

The favicons and the `og:image` link-preview card are generated, not hand-drawn.
`assets/brand/favicon.svg` is the source for all favicon PNGs; `tools/og-card.html`
is the source for the og:image and uses the site's real Google Fonts so the card
matches homepage typography.

```bash
npm install playwright-core
node tools/render-brand-images.js
# or, to reuse an existing Chromium:
CHROME_PATH=/path/to/chrome node tools/render-brand-images.js
```

Run it after changing the brand mark or the og:image headline. Output is
deterministic — re-running with no source change produces byte-identical files.

## Deploy

Any static host. Netlify, Vercel, Cloudflare Pages and GitHub Pages all take this repo
as-is with no configuration — point them at the repo root.

The site is configured for **recallpartnershq.com**. That domain appears in the
`canonical` and `og:` tags in each page's `<head>`, in `site.webmanifest`, and in the
JSON-LD block. If the domain ever changes, update all four.

Absolute URLs are used for `og:image` (link-preview scrapers require them); everything
else is relative, so the site also works from a subdirectory or straight off the
filesystem.

## Notes on copy

- No pricing figures appear anywhere on the site by design. The FAQ and the "deal"
  section say pricing is given on the call, in writing.
- The FAQ answer on compliance describes how campaigns are run and explicitly says it
  isn't legal advice.
- The JSON-LD `FAQPage` block in `index.html` mirrors the visible FAQ **verbatim**.
  Google flags mismatches between schema and on-page content, so if you edit a question
  or answer on the page, update the matching entry in the `<head>` block too.

## Editing the design

All colors, fonts and spacing live in the `:root` block at the top of
`assets/styles.css`. Change `--plum` and `--rose` to re-skin the whole site. The legal
pages use the same tokens, so they follow along automatically.
