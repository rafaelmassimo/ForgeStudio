# FORGE Strength Studio — UX audit

**Date:** 2026-09-22
**Commit audited:** `c8d433e` (origin/main)
**Pages:** `index`, `who-we-are`, `our-space`, `services-and-plans`, `contact`, `faq`

## Method

Static review of all HTML, CSS and JS, plus rendering every page in headless
Chrome at 320/390/768/1024/1440 px to measure real geometry (element rects,
overflow, tap-target sizes, font sizes). Colour contrast computed from
`css/tokens.css` against the WCAG 2.1 formula. Numbers quoted below are
measured, not estimated.

Note on method: headless Chrome clamps its window to a 500 px minimum, so
`--window-size=390` renders at 500 px and crops the image. Every measurement
below was taken inside an iframe sized to the real target width, which is not
subject to that clamp; screenshots for narrow widths use the same iframe
harness.

Not covered: real-device testing, screen-reader passes with NVDA/VoiceOver,
analytics, or user testing. Those would be the natural next step.

---

## Summary

The site is well built. The markup is semantic, the CSS is organised into
layers with real design tokens, `prefers-reduced-motion` is respected almost
everywhere, the carousel manages `inert`/`aria-hidden` correctly, and the
hero images already use `<picture>` with mobile sources. That foundation is
better than most sites at this stage.

The problems are not craft problems. They fall into three groups:

1. **Nothing converts.** Every "Book Now" / "Book Your Sessions" CTA on the
   site points at `#`. There is no booking destination anywhere.
2. **Two pages have no mobile layout.** Contact and FAQ keep their desktop
   padding on a phone, and because the page shell clips overflow, the content
   that falls outside is unreachable — it cannot even be scrolled to.
3. **Placeholder content is still live.** Two different fake phone numbers,
   `[Month DD, YYYY]` throughout the legal modals, "X days" in the FAQ, three
   FAQ answers that answer a different question, and a home page that repeats
   two testimonials ten times.

Ranked by cost of leaving it as-is:

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | All 14 conversion CTAs link to `#` | Blocker | open |
| 2 | Contact page unusable on mobile (form clipped 328 px off-screen) | Blocker | **fixed** |
| 3 | 14 of 18 FAQ questions clipped off-screen on mobile | Blocker | **fixed** |
| 4 | Two different placeholder phone numbers published | Blocker | **fixed** (placeholder unified) |
| 5 | Three FAQ answers don't match their question | High | open |
| 6 | Legal modals full of `[bracketed]` placeholders | High | open |
| 7 | Primary button fails colour contrast (4.01:1) | High | open |
| 8 | Home page repeats 2 testimonials 10× while 21 real ones sit unused | High | open |
| 9 | Hotel pricing contradicts itself (10% vs 20%, `/mO` on a drop-in) | High | open |
| 10 | No Book CTA anywhere in the mobile menu | Medium | open |
| 11 | Pricing hidden behind modals (2–3 taps to see a number) | Medium | open |
| 12 | 11 MB of images, no WebP, desktop hero served to phones | Medium | open |
| 13 | Missing `<main>` on 4 of 6 pages, no skip link | Medium | open |
| 14 | Contact form is `mailto:` only — no success state, silent failures | Medium | open |
| 15 | Copy errors and inconsistencies throughout | Medium | partly |
| 16 | No favicon, no Open Graph tags | Low | **fixed** |

"Fixed" reflects work landed on the `UX-audit` branch. Items 2, 3, 4 and the
FAQ pricing answer (§3.8) were done in this pass; item 16 was done separately.

---

## 1. Conversion path

### 1.1 Every CTA is a dead link — **Blocker**

33 `href="#"` links across the site. Excluding the footer's address and
Facebook placeholders, **14 are content CTAs** and 6 more are the navbar's
"Book Now":

| Page | Dead CTAs |
|---|---|
| `index.html` | Book Your Sessions, Learn About Our Services, Rent The Studio, Get To Know Us, Be A Part Of The Community |
| `services-and-plans.html` | Book Now, Schedule Your group class, book your personal training program, claim your drop-in slot, Rent your gym space, book your exclusive spot |
| `our-space.html` | Rent The Studio, Book Your Sessions |
| `who-we-are.html` | Explore Our Classes |
| all 6 | navbar "Book Now" |

Two of these already have obvious destinations in the repo:
`index.html:118` "Learn About Our Services" → `services-and-plans.html`, and
`index.html:277` "Get To Know Us" → `who-we-are.html`. Those are a one-line
fix each.

The rest need a real booking destination. The FAQ already promises one
("You can manage everything through our seamless online booking calendar…
Existing clients simply log in"), so the copy is writing cheques the site
can't cash. Until a booking platform is chosen, the honest interim is to
point every booking CTA at `contact.html` and reword the FAQ to match.

### 1.2 Mobile has no Book CTA at all — **Medium**

`css/responsive.css:102` hides `.navbar__group` below 767 px, which takes the
"Book Now" pill with it. The slide-in menu (`#mobile-menu`) contains five page
links and nothing else — no Book button, no FAQ, no phone, no email.

On a phone the studio's primary action is invisible except where a section
happens to include one. Add a "Book Now" primary button to the bottom of the
mobile menu, plus tap-to-call and FAQ links.

### 1.3 Pricing is two to three taps deep — **Medium**

Services & Plans shows cards with a "Learn More" button; the button opens a
`<dialog>`; on mobile the dialog opens on the *story* page and the prices are
on page 2 behind "See Packages & Price".

So a phone visitor who wants to know what a session costs must: land → tap
Learn More → read → tap See Packages & Price. Price transparency is the
single thing boutique-gym shoppers look for first, and it's the one thing the
page never shows in the open.

Consider surfacing a "from $X" line on each card face, so the modal deepens
the story rather than gating the number.

### 1.4 Focus is lost when the plan modal changes page — **Low**

`initModalPaging` (`js/main.js:337`) toggles `.is-page-2`, and
`css/responsive.css:1310` swaps the two panels with `display: none`. The
button that was just pressed is inside the panel being hidden, so focus falls
back to `<body>` — a keyboard or screen-reader user loses their place inside
the dialog. Move focus to the new panel's heading after the swap.

---

## 2. Mobile

### 2.1 Contact page is unusable on a phone — **Blocker** · *fixed*

`css/contact.css:30` sets `padding-inline: 138px` with no mobile override.
`css/contact.css:183` sets the form to a fixed `width: 568px; flex: none`.

Measured at a 390 px viewport:

```
.body-content   x=12   w=366  right=378
.contact-form   x=150  w=568  right=718   ← 328px past the viewport
```

`.body-content` uses `overflow: clip` (`css/styles.css:47`, deliberate — it
rounds the corners and keeps the sticky navbar sticking to the viewport). The
side effect is that there is **no horizontal scroll**: the clipped 328 px is
simply gone. In the rendered page that means:

- the Last Name field is entirely off-screen;
- every input is cut mid-field;
- the Submit button has no visible label;
- the email address and both social handles are cut mid-string.

The contact form is the only working conversion mechanism on the site, and on
mobile it cannot be completed.

### 2.2 14 of 18 FAQ questions are clipped off-screen — **Blocker** · *fixed*

Same root cause. `css/faq.css:23` sets `.faq { padding: 100px }` with no
mobile override, so inside a 366 px shell the question column is
**166 px wide**. `.faq-item__question` is `white-space: nowrap` with an
ellipsis (`css/faq.css:128`), but the ellipsis never fires because the row
expands instead of the text truncating — and then the page clips it.

Measured at 390 px, question rows extending past the viewport edge:

```
item2  "Will it be crowded like a commercial gym?"        right=477
item4  "I'm new to lifting weights. Will I be supported"  right=551
item14 "I am an independent personal trainer. Can I…"     right=693
item15 "As a personal trainer renting the studio…"        right=854  (+464px)
… 14 rows in total
```

One row (`item15`) still overflows by 98 px at 768 px, so this is not
phone-only.

Visitors cannot read most of the questions, which makes the page useless for
its actual job.

**Root cause for both:** `css/responsive.css` says so in its own header —
"The other pages keep their desktop sections until their frames are built."
Home, Our Space, Who We Are and Services & Plans all have mobile sections;
Contact and FAQ never got theirs. They are also the two most task-oriented
pages on the site.

**Resolved.** `css/responsive.css` now carries CONTACT and FAQ sections in
the existing `@media (max-width: 767px)` block: 24 px gutters, a single
stacked column, First/Last name stacked, and questions that wrap instead of
truncating. Both are marked in the source as built to the site's spacing
language rather than transcribed from a frame, since neither has one yet.

Separately, `.faq-item` now declares `grid-template-columns: minmax(0, 1fr)`
(`css/faq.css`). A grid item's automatic minimum size is its min-content
width, so the `nowrap` question sized the column to the full question text —
which is why the designed ellipsis never fired at any width. That was also
clipping one question at 768 px, above the mobile breakpoint. Measured after:
zero overflow on both pages at 320/390/768/1024/1440 px, and the ellipsis now
does its job on the two longest questions at 768–900 px.

### 2.3 Tap targets in the footer are 20 px tall — **Low**

Measured at 390 px: every footer nav link and contact row renders at 20 px
high (`Home` 41×20, `(678) 888-8888` 108×20, the email 211×20). They clear
WCAG 2.5.8's 24 px minimum only via the 16 px spacing exception, but they are
well under the 44 px both Apple and Google recommend. The carousel arrows on
Who We Are are 37×37, and the navbar wordmark link is 64×31.

---

## 3. Content integrity

### 3.1 Two different fake phone numbers are live — **Blocker** · *fixed*

- `contact.html:73` — `(000) 000-0000`, and it is plain text, not a
  `tel:` link, so it can't be tapped.
- Every page footer — `(678) 888-8888`. 678 is a Georgia, USA area code; the
  studio is in Chilliwack, BC (604/778).

Both also appear inside the Privacy Policy and Terms modals. A visitor who
notices the same business listing two different unreachable numbers will
assume the site is abandoned.

**Resolved, as a placeholder.** All 19 instances across the six pages are now
the same `(000) 000-0000`, and all 19 are `tel:` links (the Contact page's was
plain text). The href is `tel:+10000000000` so swapping in the real number is
one find-and-replace. It is still an obviously fake number — this removes the
contradiction and the wrong-region signal, it does not make the studio
reachable by phone.

### 3.2 Three FAQ answers answer a different question — **High**

These three questions all carry the same boilerplate ("We are a boutique
strength training studio located in Chilliwack, BC. Our Boutique Wellness
Center is designed to…"):

- "What exactly is Forge Strength Studio?" — correct here.
- "Will it be crowded like a commercial gym?" — **wrong answer**.
- "I am an independent personal trainer. Can I bring my clients to Forge?" —
  **wrong answer**.

The second one is especially costly: "will it be crowded" is the core
objection this studio exists to answer, and the page changes the subject.

Also in the FAQ: "Classes can be booked up to **X days** in advance" — a
literal unfilled placeholder.

### 3.3 Legal modals are an unfilled template — **High**

The Privacy Policy and Terms & Conditions render on every page and contain
roughly 20 visible placeholders: `[Month DD, YYYY]`, `[payment provider
name]`, `[platform name]`, `[X years]`, `[X months]`, `[16/18]`,
`[X days/months]`, `[X weeks]`, `[30 days]`, `[24 hours]`, `[booking
platform]`, `[e.g. Google Analytics]`.

The source comment already flags this ("the copy is a TEMPLATE… should be
reviewed by a lawyer before launch") — worth repeating here because these are
visible to any visitor today, and the cancellation window in particular is
referenced by the FAQ as if it were defined.

### 3.4 The home page repeats two testimonials ten times — **High**

`index.html` hardcodes 10 sticky notes on desktop and 4 on mobile, drawn from
exactly **two** quotes (David Veltman-Robert, Jennifer Miller) pasted
repeatedly. Meanwhile `data/testimonials.json` holds **21 genuine
testimonials**, used only by the Who We Are carousel.

The section is headed "Community stories — what previous mentees have to say".
Ten notes that are visibly the same two quotes reads as padding, and undercuts
exactly the trust the section exists to build.

Two fixes that pair well:
- Have the home board read from `data/testimonials.json` like the carousel
  does, so it shows ten different voices.
- Add names (or initials) to `testimonials.json` — the carousel's 21 quotes
  are currently all anonymous, while the home page's two have names. Anonymous
  praise is weaker than attributed praise.

Also worth a look: entries 18–21 in the JSON are survey fragments ("…to be the
strongest version of myself", "Continued… your classes are not superficial")
and read oddly as standalone quotes.

### 3.5 Hotel pricing contradicts itself — **High**

On `services-and-plans.html`:

- The section copy says guests "get a **10% off** discount".
- The modal then lists "single drop-in — **20% off**, regularly $50/hr → $40"
  and "traveler's pass — **15% off**".
- "small group drop-in — for up to 4 guests sharing a session — **$380/mO**".
  A monthly rate on a hotel-guest drop-in is wrong, and against the standard
  group rate of $150/hr it isn't a discount at all.
- "How to book: show your room key at our **front desk** or use your exclusive
  hotel promo code on our **booking app**" — neither exists.

### 3.6 Price presentation is ambiguous — **Medium**

- "Private Session — $130~ $150/Session" and "Trio training — $65~ $75/Person"
  show two numbers with a tilde and no label. Is $130 a member rate, a
  founding-member rate, an old price? Label them ("Founding member $130 ·
  Regular $150").
- No currency marker. Chilliwack is a border town; "$" is ambiguous. The Terms
  say "All prices are in Canadian dollars", but that's buried. Use "CAD $".
- Units are inconsistent — `/MO` and `/HR` render uppercase (via
  `text-transform: capitalize` on `.price`) next to `/Person` and `/Session`.
- "Founding Member offer — Discounted rate available for your first 2 launch
  classes" appears on all five plan modals with no actual discount and no
  expiry date.

### 3.7 Copy errors — **Medium**

Grammar and typos, by page:

| Page | Text | Should be |
|---|---|---|
| `index` | "Choose an Personal Training" | "a Personal Training" |
| `index` | "now has became a Certified Personal Trainer" | "has become" |
| `who-we-are` | "becoming renown for her expertise" | "renowned" |
| `services-and-plans` | "based on ur current lifestyle" | "your" |
| `services-and-plans` | "to make sure you stay maintain your quality of life" | garbled |
| `services-and-plans` | "improves your quality of life, so you can build your quality of life" | repeats itself |
| `services-and-plans` | "see the transformation unfolds" | "unfold" |
| `services-and-plans` | "full capacity of our equipments" | "equipment" (fixed in one variant, not the other) |
| `services-and-plans` | "Guest from the Holiday Inn" | "Guests" |
| `services-and-plans` | "your short stay does not to be full of" | "does not need to be" |
| `services-and-plans` | "a drop-in exclusive space rentals for you to workout" | "rental… to work out" |
| `our-space` | "Less distractions" | "Fewer distractions" |
| `our-space` | "Hand selected, Professional-grade equipment" | stray capital |
| `faq` | "Our group class are limited" | "classes are" |
| `faq` | "depending your goals" | "depending on your goals" |

Consistency:

- **Spelling variety is mixed**: "humour" (`index`) vs "humor" (`who-we-are`);
  "centre" and "anonymise" (British/Canadian) alongside "Center" in the FAQ.
  Pick Canadian and hold it.
- **Brand name varies**: "FORGE Studios" (plural, hotel section) vs "FORGE
  Strength Studio" vs "Forge Strength Studio".
- **Credentials conflict**: home says Gabriela has "spent over a decade
  teaching Yoga"; Who We Are says "Yoga Alliance Certified since 2020". Both
  can be true, but as written they read as inconsistent.

### 3.8 The FAQ quotes competitor pricing against itself — **Medium** · *fixed*

"How much does a personal trainer cost in Chilliwack? Personal training in
Chilliwack typically ranges from $60-$100 per session." FORGE's own private
session is $130–$150. The answer reads as written for search engines, and it
anchors the visitor below FORGE's price without ever justifying the gap. If
it stays, follow it with why a 4-person cap and continuous coaching cost more.

---

## 4. Accessibility

### 4.1 The primary button fails contrast — **High**

White text on `--highlight-colour` `#588a65` measures **4.01:1**. Button text
is 18 px Poppins Medium, which is *normal* text under WCAG (large starts at
24 px, or 18.7 px bold), so the threshold is 4.5:1.

This affects every primary CTA on the site — Book Now, Book Your Sessions, Be
A Part Of The Community, the back-to-top button. Oddly the **hover** state
(`#42624a`, 6.82:1) passes; only the resting state fails.

Darkening the resting fill to roughly `#4d7a58` clears 4.5:1 while staying in
the same family.

Other measured pairs:

| Pair | Ratio | Verdict |
|---|---|---|
| `#fff` on `#588a65` (primary btn) | 4.01 | **Fails AA** at 18 px |
| `#935424` on `#e1d3c3` (nav current page, 18 px / 14 px) | 4.05 | **Fails AA** at that size |
| `#8a6b4f` on `#d9c8b7` (legal modal meta, 16 px) | 3.00 | **Fails AA** |
| `#935424` on `#e1d3c3` (56 px headings) | 4.05 | Passes (large text) |
| `#fff` on `#935424` (secondary btn) | 5.94 | Passes AA |
| `#c4ae99` on `#121212` (footer links) | 8.80 | Passes AAA |
| `#1e1e1e` on `#e1d3c3` (body copy) | 11.36 | Passes AAA |

The current-page nav state is also **colour-only**. `aria-current="page"` is
correctly set for assistive tech, but sighted users get a rust tint at
4.05:1 and nothing else. Add weight or an underline.

### 4.2 No `<main>` on four of six pages — **Medium**

`contact.html` and `faq.html` have `<main>`. `index.html`,
`who-we-are.html`, `our-space.html` and `services-and-plans.html` do not.
There is also no skip link anywhere, so keyboard and screen-reader users tab
through the full navbar on every page with no way past it.

### 4.3 Focus indicators are inconsistent — **Medium**

Explicit `:focus-visible` rings exist for the back-to-top button, the mobile
menu, the legal modals, the navbar wordmark and the hamburger. They do **not**
exist for `.btn` (every CTA on the site), the contact form inputs, the FAQ
accordion toggles, or the carousel arrows and dots — those fall back to the
browser default, which varies by browser and sits on dark green and black
fills where it reads poorly.

Add one `.btn:focus-visible` / form-control rule using the same 2 px
`--secondary-colour` outline the rest of the site uses.

### 4.4 Line height is below the WCAG text-spacing threshold — **Low**

`--body-leading: 21px` on `--body-size: 18px` is **1.17**; the 16 px ramp is
1.25. WCAG 1.4.12 expects content to survive a user bumping line height to
1.5×. It's also simply tight for multi-paragraph reading. These come straight
from Figma, so it's a design conversation rather than a bug — but worth
having.

### 4.5 Carousel controls go inert without announcement — **Low**

`initCarousels` (`js/main.js:196`) fetches `data/testimonials.json`; on
failure it logs a warning and keeps the three static cards. Good fallback —
but the prev/next arrows and the dots container stay in the DOM, visible and
focusable, doing nothing. If the fetch fails (offline, or the page opened via
`file://`, where the fetch is blocked), the visitor gets controls that don't
respond. Hide the arrows when the carousel can't paginate.

There's also no `aria-live` region, so a screen-reader user who presses "next"
hears no confirmation that the page changed.

### 4.6 A script error hides the whole page — **Low**

`css/styles.css:535` sets `.js [data-reveal] { opacity: 0 }`, and the `.js`
class is added in `<head>` before first paint. `initReveal()` runs **last** of
nine initialisers in `js/main.js:469-477`. If anything above it throws — or
`main.js` fails to load at all after the `.js` class is set — every revealed
section stays permanently invisible.

Cheap insurance: run `initReveal()` first, or wrap the initialiser block in
`try/catch` with a `showAll()` fallback.

---

## 5. Performance

Performance is a UX problem here, not just an engineering one: this is a local
business whose visitors will mostly arrive from Instagram on a phone.

- **11 MB of images** in `assets/img`, all JPG/PNG. No WebP or AVIF.
- **Photographs saved as PNG**: `os-breathe.png` (977 KB),
  `sp-single-use.png` (777 KB), `sp-gym-rentals.png` (585 KB),
  `sp-personal-training.png` (461 KB). Converting these alone saves ~2 MB.
- **The home hero is desktop-only.** `index.html:21` preloads
  `home-hero.jpg` (839 KB, 1392×600) with `fetchpriority="high"` and no
  `<picture>` or `srcset`. Our Space, Services & Plans and Who We Are all do
  have mobile hero sources — the highest-traffic page doesn't. A phone
  downloads the full-size hero as its LCP element.
- **Two images download where one is shown.** `who-we-are.html:290-293` uses
  `class="desktop-only"` / `class="mobile-only"` on sibling `<img>` tags.
  `display: none` does not prevent the download, so every visitor fetches both
  `wwa-next-chapter-1.jpg` (581 KB) **and** `wwa-next-chapter-1-mobile.jpg`
  (434 KB) — ~1 MB, half of it wasted. Same pattern at lines 258-261. The
  `<picture>`/`<source media>` approach already used for the heroes fixes it.
- CSS totals 148 KB across six files, all render-blocking on every page.
  Modest, but `responsive.css` (1,407 lines) loads in full on desktop.

---

## 6. Navigation & IA

- **FAQ is not in the primary nav** — desktop or mobile. It exists only in the
  footer and via one button on the Contact page. For a studio whose FAQ
  answers the actual buying objections, that's buried. It's also the one page
  where nothing in the navbar shows `aria-current`, so visitors get no "you
  are here".
- **The footer address links to `#`.** `District 1881, Chilliwack, BC` looks
  clickable on all six pages and does nothing. Point it at Google Maps — the
  Contact page already embeds the right coordinates.
- **The footer Facebook icon links to `#`** with `target="_blank"` on all six
  pages, plus once more on the Contact page. If there's no Facebook presence,
  remove it; an empty social icon reads as neglect.
- Nav order, labels and `aria-current` are otherwise consistent across all six
  pages — that part is solid.

---

## 7. The contact form

`js/main.js:224` builds a `mailto:` link on submit. The comment explains why
(no backend), and browser validation runs first — but as a conversion
mechanism it has real costs:

- On a device with no configured mail client — common on desktop for webmail
  users — the click does nothing visible. The visitor believes they sent it.
- It opens a draft the visitor must then *remember to send*. Drop-off between
  draft and send is substantial.
- The studio gets no record, no timestamp, no spam filtering.
- There is **no success state**. Nothing confirms the message went anywhere.
- The form has no `action`, so with JS disabled, submitting reloads the page
  and silently discards everything typed.

A form-to-email service (Formspree, Netlify Forms, Basin) is a ~15-minute
change and removes all five problems.

Smaller form points:

- **No required/optional marking.** Three of four fields are `required`; Last
  Name isn't. Nothing tells the visitor which is which until validation fires.
- **No phone field**, though the Privacy Policy says phone numbers are
  collected via the contact form.
- **No enquiry type.** Group class, personal training, studio rental and hotel
  partnership are very different conversations — a select would route them and
  cut a round-trip.
- **No privacy notice at the point of collection.** The Privacy Policy is a
  modal two screens down in the footer. A one-line link next to Submit is
  standard practice and, under PIPA, the right place to say what the data is
  used for.
- The Contact page's phone number is plain text, so it can't be tapped to
  call.

---

## 8. Head / metadata

Present and correct across all six pages: `lang="en"`, unique `<title>`,
unique `<meta name="description">`, viewport, font preconnects.

Missing everywhere:

- **No favicon** — tabs and bookmarks get a generic globe.
- **No Open Graph or Twitter card tags.** For a business that will be shared
  mainly as an Instagram bio link and in DMs, every shared link currently
  previews as a bare URL with no image, title or description. This is
  probably the highest-value item in this section.
- No `theme-color`, no `canonical`, no `robots.txt`, no `sitemap.xml`.
- No `LocalBusiness` structured data — relevant for a business whose customers
  search "gym in Chilliwack", and the FAQ page is a natural `FAQPage` candidate.

---

## Suggested order of work

**Before this goes anywhere near a real visitor**

1. Give Contact and FAQ a mobile layout (§2.1, §2.2).
2. Replace both placeholder phone numbers with the real one; make them
   `tel:` links (§3.1).
3. Point the 14 content CTAs somewhere real — `contact.html` as an interim
   (§1.1). Two of them already have obvious in-repo destinations.
4. Fix the three mismatched FAQ answers and the "X days" placeholder (§3.2).
5. Fill in or remove the legal modal placeholders (§3.3).

**Before launch**

6. Darken the primary button to clear 4.5:1 (§4.1).
7. Add a Book CTA and FAQ link to the mobile menu (§1.2).
8. Pull the home testimonials from `data/testimonials.json`; add names (§3.4).
9. Fix the hotel pricing contradictions (§3.5).
10. Add Open Graph tags and a favicon (§8).
11. Move the contact form off `mailto:` and add a success state (§7).
12. Copy pass for the errors in §3.7.

**Worth doing soon after**

13. Convert the photo PNGs, add WebP, give the home hero a mobile source, and
    fix the two double-downloading image pairs (§5).
14. Add `<main>` to the four pages missing it, plus a skip link (§4.2).
15. Add `.btn:focus-visible` and form-control focus rings (§4.3).
16. Add FAQ to the primary nav; link the footer address to Maps (§6).
17. Surface a "from $X" on the plan cards (§1.3).
