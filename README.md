# Recall Partners — website

Static marketing site. Plain HTML, CSS and vanilla JS — no build step, no framework,
no runtime dependencies. Open `index.html` in a browser and it works.

The section structure and layout are modeled on [eaglerev.io](https://eaglerev.io) (that
site is a Next.js app with hashed class names, so nothing was copied verbatim — it was
rebuilt from scratch). All copy, colors and typography are Recall Partners' own.

```
index.html                      # homepage — every section, top to bottom
calculator/index.html           # /calculator — gated dormant-revenue calculator
audit/index.html                # /audit — intake for the hand-built one-page audit
privacy.html                    # privacy policy (incl. SMS/opt-out disclosures)
terms.html                      # terms of service
site.webmanifest                # PWA/home-screen icon manifest
assets/styles.css               # design tokens at the top, then section-by-section styles
assets/script.js                # mobile nav, scroll reveal, FAQ accordion, table tabs
assets/calculator.js            # calculator only — validation, math, states, lead POST
assets/audit.js                 # audit only — validation, states, lead POST, error path
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
  have a permissioned campaign to publish. The `#whatyouget` preview on `/audit` reuses
  the same components under the same rule.
- **"Built for" pills.** Lists practice types, not clients and not procedures, and is
  labelled so it reads as who the offer suits rather than a client logo bar. Swap in real
  client names — and rename the label back to "Who we work with" — once you have written
  permission.
- **Analytics.** GA4 is loaded on every page via `assets/analytics.js`. Every CTA carries
  a `data-cta` attribute for an event handler to hook onto: `booking` and `booking-sticky`
  on the homepage, `calculator-submit` / `calculator-booking*` / `calculator-audit` on
  `/calculator`, and `audit-start*` / `audit-submit` / `audit-booking` / `audit-calculator*`
  on `/audit`. The two tools also fire `calculator_submit` and `audit_submit` events.

## The calculator (`/calculator`)

A qualification tool, not a lead magnet. Three questions about the practice — people on
file, how many have gone quiet, average visit value — plus first name, practice name and
email, all required. It shows a five-second loading screen, then the results.

It lives in a **directory**, not as `calculator.html`, so the URL is exactly
`domain.com/calculator` on every static host without needing clean-URL rewrites.
Because of that, all its asset and nav links are `../`-relative.

### Write it the way an owner talks

The audience is a med spa or clinic owner, usually the injector or the physician who
started the business — not a marketer. The page deliberately avoids the vocabulary the
rest of the industry uses. **Keep it that way if you edit the copy:**

| Don't say | Say |
| --- | --- |
| database, contacts | clients and leads, people on your list |
| dormant, lapsed | haven't been in for a year, stopped coming in |
| average ticket | what a client spends in a typical visit |
| reactivation rate of 5% | 5 out of every 100 come back |
| 5-day reactivation window | the five days we run the campaign |

The percentage-to-frequency swap in the last row matters most. "5 out of every 100" is a
picture an owner can hold; "a 5% reactivation rate" is an abstraction they have to decode.

### Say that results are immediate

An earlier draft headed the gate with "Where should we send it", which read as *check your
inbox in a few days* — the opposite of what happens. The hero, the gate and the button note
now all say plainly that the number appears on the screen. **Don't reintroduce any wording
that implies a report gets emailed** — nothing is emailed, and Formspree only notifies us.

### Three tiers, and why the headline is the middle one

The results panel shows the same list value at three rates, held in
`assets/calculator.js`:

| | Rate | Shown as |
| --- | --- | --- |
| `RATE_WORST` | 5 in every 100 | "Worst case" |
| `RATE_TARGET` | 15 in every 100 | **The headline figure** |
| `RATE_MAX` | 100 in every 100 | "Won't happen" |

**Leading with the ceiling was the mistake in the first version.** Quiet clients ×
average visit is a huge figure, but it assumes every last person walks back through the
door. An owner who does that arithmetic in her head discounts the entire page. So the
ceiling still appears — named in step 2 of the worked sum and labelled "Won't happen" in
the range — while the headline is the figure we would actually go after. Naming the
ceiling as unreachable defuses it; leading with it does the opposite.

Each tier is the ceiling scaled by its rate, so the three figures can't drift out of
proportion. Change a constant and every figure, and every rate quoted in the visible copy,
moves with it — the page reads the rates from the same constants and can't end up quoting
one it isn't using.

⚠️ **`RATE_TARGET` and the homepage disagree.** The homepage hero aims at 30 appointments
on a 2,000-contact database. If ~1,200 of those are dormant, that's about 2.5% — where the
calculator headline assumes 15%. Both numbers are targets rather than published results,
but they are six times apart, and a reader who visits both pages can see it. Reconcile them
before this gets real traffic: either lower `RATE_TARGET` or revisit the hero's figure.

### The math, spelled out

The worked sum runs as four numbered steps rather than a paragraph, because the whole
point is that the reader can follow it:

1. how many have gone quiet (and what share of the list that is)
2. quiet × visit value = the ceiling, immediately named as unreachable
3. quiet × 15 in 100 = the appointments we would aim for
4. those appointments × visit value = the headline figure

Rates are always written as natural frequencies — "15 out of every 100 come back", never
"a 15% reactivation rate". A frequency is a picture; a rate is something the reader has to
decode first.

### Getting from the number to a booking

This is a qualification tool, so the path from *number* to *call* is the whole job:

- The primary CTA sits **inside the results hero, directly under the figure** — not below
  the caveat paragraph, where it started life. Someone already sold by the number should
  never have to scroll to act on it.
- A "So how do you actually get that $72,000?" block sits between the caveat and the
  second CTA, spelling out the three steps (call → five days → bookings land). Without it
  the page ends on a hedge and asks for a meeting anyway.
- Both CTAs and the bridge are personalised from the form input at render time.

**Don't demote the hero CTA back below the fold of the panel.** That was the single
biggest structural problem with the earlier version.

### Loading sequence

`HOLD_MS` × `MESSAGES.length` at the top of `assets/calculator.js` — currently 1700ms × 3
subtitles, so about five seconds. The heading stays fixed at "Results loading…" while the
subtitle underneath rotates one at a time, with a progress bar so the wait reads as finite.
Add or remove subtitles and the bar re-divides itself; there is nothing else to update.
Under `prefers-reduced-motion` the whole sequence drops to 300ms a step.

The panel scrolls itself into view when loading starts. Without that, swapping the tall
form for the short loading panel collapses the page and leaves the visitor parked on the
footer for the entire wait.

### Lead capture

Posts JSON to Formspree (`https://formspree.io/f/xkjwkzor`, set as `FORMSPREE` at the top
of `assets/calculator.js`) the moment the button is pressed, in parallel with the loading
sequence. A failed POST is swallowed on purpose: someone who asked for a number gets the
number regardless. There's a honeypot field (`_gotcha`) that Formspree also recognises.
The email subject line carries the practice name and the headline figure, so the inbox
sorts by deal size on its own.

**Results are never persisted.** No storage of any kind. "Start over" wipes every rendered
figure out of the DOM and resets the form, and a `pagehide` handler does the same so a
back-forward cache restore can't put the last visitor's numbers back on screen.

A GA4 `calculator_submit` event fires with the quiet-client count and the headline figure.
The submit button carries `data-cta="calculator-submit"` and the results CTA
`data-cta="calculator-booking"`, matching the homepage's booking-CTA convention.

## The audit (`/audit`)

The second lead magnet, and the deliberate opposite of the calculator. She sends her
numbers; **a person reads them and emails back a one-page breakdown within two business
days.** Nothing is computed on the page and nothing appears on screen. It doesn't scale
and it isn't meant to — it exists to start the first twenty conversations, and the intake
form is the discovery call.

Like the calculator it lives in a **directory**, so the URL is exactly `domain.com/audit`
on any static host with no rewrite rules, and all its asset and nav links are
`../`-relative.

### The one thing this page must never do

**Never imply an instant result.** A visitor who has already used the calculator arrives
expecting a number on the screen, and the whole page is built to correct that expectation
before she fills anything in. The turnaround is stated in four places — the hero lede, the
hero stats row, the note at the top of the form, and the submit button itself — and again
on the confirmation panel. If you edit any of them, edit all of them, and keep
`LABEL_SEND` / `LABEL_RETRY` / `TURNAROUND` in `assets/audit.js` in step with the HTML.

The turnaround (**two business days**) and the capacity (**five a week**) are real
commitments, not copy. Change the copy if the reality changes.

### It's a confirmation, not a results page

State three is `#auditDoneState`, and every value in it is one she typed herself, read back
to her so the send feels received rather than swallowed. **No figure on that panel is
worked out by this page.** If you ever find yourself adding one, you are rebuilding the
calculator.

It does four things, in this order: confirms what she sent, says what happens next and
when, says who is doing it (a person, by hand), and offers the call *now* rather than
after the audit lands. There's a link to `/calculator` underneath for anyone who wants a
rough figure in the meantime.

### Capacity, stated plainly

"Five a week, because one person builds each one" is true, so it's on the page. There is
**no countdown, no seat counter and no fake queue position**, and card 02 in the `#how`
section explicitly says we won't use one. Manufacturing scarcity on a page whose entire
pitch is "a human is doing this honestly" would undo the page.

### Showing the deliverable

`#whatyouget` shows the structure of the one-pager with every figure rendered as a
labelled blank, reusing the `.repdoc` / `.repline` components from the homepage's
`#report`. The same non-negotiable rule applies: **do not fill those blanks in with
example figures.** A reader takes sample numbers for real ones. It demonstrates the shape
of the deliverable; it never invents a result.

It sits **above** the form rather than below it, unlike the calculator's tool-first
layout. The form is long and bespoke, so the deliverable has to earn the two minutes
before she's asked for them.

### The intake

Eleven fields in three labelled groups, so it never reads as one wall. Nine required, two
optional, and the optional ones say so on the label (`.field__opt`):

| Group | Fields |
| --- | --- |
| 1 · Your practice | practice name, practice type, what you mostly treat |
| 2 · Your list | people on file, how many have gone quiet, typical visit value, what software the list lives in, when it was last messaged, *what happened* (optional) |
| 3 · Where to send it | first name, email, *phone* (optional) |

**"What do you mostly treat" is an open text field on purpose.** A checkbox list would be
faster to fill, but it would put named procedures on the page, which the site avoids
everywhere (see "Notes on copy" below). Her own words are better input for a bespoke
deliverable anyway, and they're read straight back to her on the confirmation.

**Phone is optional on purpose.** A required phone number is the most common abandon point
on a form this long, and the two optional fields are what keep completion up.

### Lead capture, and why a failure is loud here

Posts JSON to the same Formspree endpoint as the calculator
(`https://formspree.io/f/xkjwkzor`, set as `FORMSPREE` at the top of `assets/audit.js`),
with the same `_gotcha` honeypot.

**Unlike the calculator, a failed POST is surfaced.** The calculator swallows one because
the visitor already has what she came for; here the POST *is* the product, and a lost
submission means she waits for an email that is never coming. On a network error, timeout
or non-2xx status the panel returns to the form with everything she typed still in it, a
red banner saying plainly that nothing reached us, a relabelled retry button, and an email
address and phone number to fall back on. **Don't "simplify" that away.**

It uses `XMLHttpRequest` rather than `fetch` for the same reason: it has to work
everywhere and it has to report a status code back.

If the POST is still in flight when the sending sequence ends, the panel holds on
`LATE_MSG` ("Still sending…") until it settles. Showing a confirmation for a send that
hasn't landed is the one thing this panel must never do.

The subject line is `Audit request: {practice} — {value} quiet list ({n} people)`, so the
inbox sorts by opportunity size the way the calculator's does. **That figure is the raw
ceiling — quiet clients × one visit — not the calculator's target rate**, deliberately: a
second copy of `RATE_TARGET` living in `audit.js` would silently drift from the one in
`calculator.js`, and since the rate is a constant the sort order is identical either way.
It is an internal sorting key and is never shown to her.

A GA4 `audit_submit` event fires with the quiet-client count and that same list value.

**Nothing is persisted**, same rule as the calculator. A `pagehide` handler clears the
echoed answers, resets the form and returns to state one, so a back-forward cache restore
can't put the last visitor's numbers back on a front-desk screen.

### Loading sequence

`HOLD_MS` × `MESSAGES.length` at the top of `assets/audit.js` — 1400ms × 3 subtitles, so
about four seconds. The heading stays fixed at "Sending your numbers…" while the subtitle
rotates, with a progress bar that re-divides itself if you add or remove a subtitle. Under
`prefers-reduced-motion` each step drops to 300ms.

The panel scrolls itself into view when sending starts. **Keep that.** This form is very
tall and the sending panel is short, so swapping them collapses the page and leaves the
visitor parked on the footer for the whole wait.

### "Quiet Client Audit", not "Dormant Client Audit"

The deliverable was specced as a *Dormant* Client Audit, but the vocabulary table above
rules out "dormant" in anything a visitor reads, so the page calls it the **Quiet Client
Audit** throughout. Call it whatever you like internally — just don't put "dormant" back
in the visible copy, or the calculator and the audit will be speaking two different
languages to the same owner.

The confirmation panel names **Joe** as the person who builds it, taken from the site's
contact address. If someone else starts building them, change that line.

## Shared styling between the two tools

Both tools are the same machine: one panel, three states, swapped by JS. So the shell is
factored out rather than copy-pasted. `assets/styles.css` has three relevant blocks:

| Block | Holds |
| --- | --- |
| **Lead-tool shell** (`.tool-*`, `.toolpanel`, `.toolform`, `.field`, `.toolload`, `.toolnext`, `.toolcross`, `.btn--onplum`) | everything both pages use |
| **Calculator** (`.calcres__*`, `.calcstep*`, `.scen*`, `.calchow`) | the results panel only |
| **Audit** (`.auditdone__*`, `.auditecho*`, `.auditerr`, `.auditintro`) | the confirmation panel and this page's own copy blocks |

**Edit anything in the shell block and check both pages.** If a change only suits one
tool, it belongs in that tool's block, not the shell.

The two tools cross-link from their result panels in both directions, using the shared
`.toolcross` component: the calculator offers the audit as the deeper read, the audit
offers the calculator to anyone who won't wait two days.

One fix worth knowing about, because it is easy to reintroduce: `.toolnext__item span`
also matches the numbered circle (`.toolnext__n` is a span) and beats it on specificity,
which painted the 1/2/3 in `--ink-2` on a plum disc and made them near-invisible. The
description selectors are scoped as `.toolnext__item > div > span` for that reason. **Don't
loosen them back.**

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
- **No named procedures anywhere on the page**, and that holds on `/audit` too — it is why
  "what do you mostly treat" is an open text field rather than a checkbox list. The copy
  says "treatment" and "what they came in for", never a brand or procedure name. Keep it that way: naming one narrows the
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
