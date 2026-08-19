# Recall Partners — website

Static marketing site. Plain HTML, CSS and vanilla JS — no build step, no framework,
no runtime dependencies. Open `index.html` in a browser and it works.

The section structure and layout are modeled on [eaglerev.io](https://eaglerev.io) (that
site is a Next.js app with hashed class names, so nothing was copied verbatim — it was
rebuilt from scratch). All copy, colors and typography are Recall Partners' own.

```
index.html                      # homepage — every section, top to bottom
calculator/index.html           # /calculator — gated dormant-revenue calculator
privacy.html                    # privacy policy (incl. SMS/opt-out disclosures)
terms.html                      # terms of service
site.webmanifest                # PWA/home-screen icon manifest
assets/styles.css               # design tokens at the top, then section-by-section styles
assets/script.js                # mobile nav, scroll reveal, FAQ accordion, table tabs
assets/calculator.js            # calculator only — validation, math, states, lead POST
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

  In their place, `#report` shows the *structure* of the wrap report with every figure
  rendered as a labelled blank ("your number"). That is deliberate — it demonstrates the
  deliverable without implying results. **Do not fill those blanks in with example
  figures**; a reader will take them for real ones. Replace the whole section when you
  have a permissioned campaign to publish.
- **"Built for" pills.** Lists practice types, not clients and not procedures, and is
  labelled so it reads as who the offer suits rather than a client logo bar. Swap in real
  client names — and rename the label back to "Who we work with" — once you have written
  permission.
- **Analytics.** Nothing is installed. The booking CTAs carry `data-cta="booking"` and
  `data-cta="booking-sticky"` so an event handler has something to hook onto.

## The calculator (`/calculator`)

A qualification tool, not a lead magnet. Three numbers in — total contacts, dormant
contacts, average ticket — plus first name, practice name and email, all required. It
shows a loading sequence, then a results panel with the dormant-revenue figure.

It lives in a **directory**, not as `calculator.html`, so the URL is exactly
`domain.com/calculator` on every static host without needing clean-URL rewrites.
Because of that, all its asset and nav links are `../`-relative.

**Where the numbers come from.** Everything is in `assets/calculator.js` and everything
is also stated on the page itself, in the "How we got there" note and the "No black box"
section below the tool:

- **Dormant revenue** = dormant contacts × average ticket. Pure arithmetic — the value of
  *one visit* from every dormant contact. Not lifetime value, not a projection.
- **Recovery range** = 5–10% of dormant contacts booking, the `RATE_LOW` / `RATE_HIGH`
  constants at the top of the file. This is the only assumption in the tool. Change those
  two numbers and every figure moves with them, including the rate quoted in the visible
  copy — the page reads it from the same constants, so it can never quote a band it isn't
  using.

**Keep the assumptions visible.** Same reasoning as the `#report` blanks on the homepage:
the recovery range is a planning estimate against a stranger's list, and a reader will take
an unqualified figure for a promise. The "This is an estimate, not a forecast" paragraph and
the three explainer cards are load-bearing — don't cut them for length.

**Lead capture** posts JSON to Formspree (`https://formspree.io/f/xkjwkzor`, set as
`FORMSPREE` at the top of `assets/calculator.js`) the moment the button is pressed, in
parallel with the loading sequence. A failed POST is swallowed on purpose: someone who
asked for a number gets the number regardless. There's a honeypot field (`_gotcha`) that
Formspree also recognises.

**Results are never persisted.** No storage of any kind. "Start over" wipes every rendered
figure out of the DOM and resets the form, and a `pagehide` handler does the same so a
back-forward cache restore can't put the last visitor's numbers back on screen.

A GA4 `calculator_submit` event fires with the dormant count and revenue figure. The submit
button carries `data-cta="calculator-submit"` and the results CTA `data-cta="calculator-booking"`,
matching the homepage's booking-CTA convention.

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
- **The hero's "30 appointments" is a target, not a result.** The `.hero__qualifier`
  paragraph directly under the headline names the list size it assumes (2,000 contacts)
  and says the real number comes from the call. Keep that line while the site has no
  published campaign data.
- **The illustrations are labelled as illustrations.** The SMS thread in `#system` and the
  before/after week in `#warm` both carry a caption saying the contents are invented.
  Those captions are load-bearing — don't drop them for design reasons.
- **No named procedures anywhere on the page.** The copy says "treatment" and "what they
  came in for", never a brand or procedure name. Keep it that way: naming one narrows the
  ICP, and a treatment name in a sample message reads as a claim about a real campaign.
- **"Next open slot: August"** in the booking section is hardcoded. Update the month as
  the calendar moves, or drop the sentence rather than let it go stale.
- The FAQ answer on compliance describes how campaigns are run and explicitly says it
  isn't legal advice.
- The JSON-LD `FAQPage` block in `index.html` mirrors the visible FAQ **verbatim**.
  Google flags mismatches between schema and on-page content, so if you edit a question
  or answer on the page, update the matching entry in the `<head>` block too.

## Editing the design

All colors, fonts and spacing live in the `:root` block at the top of
`assets/styles.css`. Change `--plum` and `--rose` to re-skin the whole site. The legal
pages use the same tokens, so they follow along automatically.

Headings are set in **Newsreader**, a variable font, chosen for legibility at display
sizes. The heading rule sets `font-variation-settings: "opsz" 60`; smaller serif elements
set a lower `opsz` to match their rendered size. If you change the font stack, drop those
lines too. The Google Fonts URL in each page's `<head>` requests the axis range those
values need; all three pages plus `tools/og-card.html` must stay in sync or the og:image
will render in a different face than the site.
