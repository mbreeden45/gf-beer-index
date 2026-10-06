# The Gluten-Free Beer Index

A field guide and test tracker for gluten-free, gluten-reduced and naturally low-ppm beer. About 240 beers, each sorted into one of four classes and linked to the public home-kit test results found for it.

**Live:** https://gf-beer-index.vercel.app

> Not medical advice. Home test kits are qualitative screens with limited sensitivity. People with coeliac disease should confirm with their clinician and the brewer.

## The four classes

| Class | Meaning |
|---|---|
| **100% NGCI** | Brewed from naturally gluten-free grains (millet, rice, buckwheat, sorghum…), no barley. |
| **Crafted to Remove** | Barley beer treated with an enzyme such as Brewer's Clarex. Kits can misread it; many coeliac organisations advise caution. |
| **Naturally Low ppm** | Barley beer that read negative on home kits, often thanks to adjuncts or filtration. Unverified, not a safety guarantee. |
| **Standard Gluten** | Conventional barley/wheat beer. Not for coeliac disease. |

Classification of tested beers is derived from the kit results on file: any positive reading (or an estimate of 20 ppm or more) makes a beer Standard Gluten; all-negative makes it Naturally Low.

## Features

- **Directory:** filter tabs (All, 100% Dedicated GF, Gluten-Reduced, Naturally Low ppm, Standard Gluten), instant search by beer, brewery or style, and responsive cards styled as printed spec sheets (classification stamps, monospaced ABV/IBU readouts, lab-assay-style test tags, grain tags).
- **Test provenance:** each card expands to show every test on file: kit, reading, date, and a link to the exact source post (or the source table when no post exists).
- **Field notes:** brewery origin, grain base (with a dashed style when it is the brewery's typical base rather than a confirmed recipe), style-typical flavor notes, and reference links.
- **Compare tray:** pin up to three beers and compare grain base, process notes, latest test and realistic ppm risk side by side.
- **Sommelier chat:** a Gemini-powered assistant that recommends only beers from the catalog, quotes the test evidence and never calls a beer "safe".
- **Reader notes:** anyone can leave a note on a beer, with no account (optional display name, blank posts as "Anonymous").
- **Submit a Beer:** a modal form for community submissions, reviewed by an admin before anything appears in the index.
- **Admin panel (`/admin`):** passcode-gated review of pending submissions (approve inserts the beer into the directory; reject asks for confirmation) and comment moderation (delete with confirmation).
- **Email alerts:** new submissions send an email (via Resend) with a link to `/admin`.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, postgres-js, better-sqlite3, Zod 4, Cheerio, Playwright, `@google/genai`, Resend, Lucide icons. Fonts: Fraunces, Work Sans, JetBrains Mono. Hosted on Vercel with Supabase Postgres.

## Getting started

```bash
npm install
npx playwright install chromium   # only needed for the smartgurlsolutions scrape
npm run db:setup                  # scrape -> data/seed-beers.json (Zod-validated) -> seed DB
npm run dev
```

With no `DATABASE_URL` set, everything runs locally on SQLite (`data/beers.db`).

### Scripts

| Script | What it does |
|---|---|
| `npm run ingest` | Scrapes the sources, merges curated/enrichment data, validates with Zod, writes `data/seed-beers.json`. Pages are cached in `.cache/ingest`. |
| `npm run seed` | Loads `data/seed-beers.json` into Postgres (if `DATABASE_URL` is set) or SQLite. Recreates the beer tables; community tables are never dropped. |
| `npm run db:setup` | `ingest` then `seed`. |
| `npm run build` / `npm run lint` | Production build / ESLint. |

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. For serverless hosts use a pooled (IPv4) connection such as Supabase's transaction pooler; percent-encode special characters in the password. Unset means SQLite locally, or the bundled JSON on Vercel. |
| `GEMINI_API_KEY` | Enables the Sommelier chat. `GEMINI_MODEL` optionally overrides the primary model. |
| `ADMIN_SECRET_KEY` | Admin passcode. There is deliberately no default in code; if unset, admin is locked. |
| `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL` | Enable submission alert emails. Optional `RESEND_FROM` sets the sender (defaults to Resend's test sender, which only delivers to the Resend account owner). |
| `NEXT_PUBLIC_SITE_URL` | Optional; used for the `/admin` link in alert emails. |

Put local values in `.env.local` (gitignored). Never commit secrets.

## How it works

### Data pipeline (`scripts/ingest.ts`)

1. **allbeernogluten.com** (dedicated gluten-free directory): beer data is read from the structured JSON embedded in the page.
2. **lowgluten.org**: per-beer test posts (brewery, ABV, ingredients, kit, result) are parsed with Cheerio, plus its summary results table, which adds Imutest spot-intensity estimates. Where a beer has its own post, the table only enriches it; it is never shown as a duplicate source.
3. **smartgurlsolutions.com**: its results table is read with Playwright (plain HTTP is blocked); each row links to the beer's own post when one exists, otherwise to the table.
4. **Merge and enrich:** `data/curated-beers.json` (hand-entered well-known beers), `data/enrichment.json` (brewery origin and grain bases researched from public sources, commercial-beer styles and origins, duplicate merges) and `data/ibu-untappd.json` (IBUs found via Untappd search, each with a link).
5. **Generated copy:** the sensory profile and celiac assessment for each beer are written by templates from its ingredients, class and test results. No LLM is involved, and no review text or photos are copied from sources.

Only objective facts are stored: name, brewery, ABV, ingredients, kit, result, date and a source link.

**Test data caveat:** the sources publish qualitative kit results (negative or positive at a 5–20 ppm threshold), plus a few visual ppm estimates. The app labels these accurately and never invents a ppm value.

### Storage

`src/lib/data.ts` reads from Postgres when `DATABASE_URL` is set, otherwise from local SQLite, and finally from the committed `data/seed-beers.json` (so a database-less Vercel deploy still renders). Community tables (`beer_submissions`, `beer_comments`) are created automatically on first use; Postgres tables have row-level security enabled so Supabase's public API cannot expose them, while the app connects as the owner role. The home page is statically generated and revalidated hourly, and approving a submission triggers an immediate revalidation.

### Sommelier chat (`src/app/api/chat/route.ts`)

Each question sends the full compacted catalog (about 6.6k tokens) plus rules to Gemini and streams the answer. It tries `gemini-3.5-flash` first with fallbacks on temporary (5xx) errors, filters out model "thought" output, and is limited to 12 requests per minute per IP. A quota error (429) is never retried, because retrying only burns free-tier quota; the UI shows "Taproom Sommelier is catching its breath. Please try again in a minute."

### Community features

| Route | Behavior |
|---|---|
| `POST /api/submissions` | Zod-validated; hidden honeypot field `website`; 5 per 10 minutes per IP; saved as `pending`; emails the admin if Resend is configured (email failure never loses the submission). |
| `GET/POST/DELETE /api/comments` | Public read and post (honeypot, 6 per minute per IP, length caps, plain-text rendering). Delete is a soft delete and requires the admin key. |
| `POST /api/admin/auth` | Checks the passcode (timing-safe compare, 8 attempts per 10 minutes per IP). |
| `GET/POST /api/admin/submissions` | List pending submissions; approve or reject. Requires the `x-admin-key` header. |

Approving a submission inserts the beer with generated copy and a "Community submitted" note. If a proof URL and reported ppm were given, a "Community-reported, not independently verified" test is attached.

## Project layout

```
src/app/            pages (/, /admin) and API routes
src/components/     Directory, Stamps, Sommelier, BeerComments, SubmitBeer
src/lib/            types (Zod), data access, store, profile/flavor copy, guards
src/db/             Drizzle schemas and idempotent DDL
scripts/            ingest.ts, seed.ts
data/               seed-beers.json, curated-beers.json, enrichment.json, ibu-untappd.json
```

## Known limitations

- There are no automated tests; verification so far has been manual.
- Data comes from a manual, one-time scrape and does not refresh on its own.
- Test results are informal home-kit screens, not lab assays.
- Commercial-beer styles, origins and some grain bills come from general reference knowledge rather than fetched pages; the dedicated gluten-free breweries' data is sourced and linked.
- The Sommelier depends on a free-tier Gemini key and rate-limits under bursts.
- Rate limiting is in-memory per server instance, a speed bump rather than strong abuse protection.
- Admin access is a single shared passcode.
