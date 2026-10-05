# The Gluten-Free Beer Index

A field guide and test tracker for gluten-free, gluten-reduced and naturally low-ppm beer. Next.js (App Router), Tailwind, Drizzle ORM.

```bash
npm install
npm run db:setup   # scrape -> data/seed-beers.json (Zod-validated) -> seed DB
npm run dev
```

- **Storage:** `DATABASE_URL` set (e.g. Supabase) → Postgres via postgres-js. Unset → local SQLite `data/beers.db`. If neither is available (e.g. Vercel), the app reads the committed `data/seed-beers.json`.
- **Sources:** allbeernogluten.com (dedicated GF directory), lowgluten.org and smartgurlsolutions.com (home-kit test results; the latter via Playwright). Only objective facts are stored: name, brewery, ABV, ingredients, kit, result, source link. Sensory and safety text is generated locally from those facts.
- **Test data caveat:** the sources publish qualitative kit results (negative/positive at a 5–20 ppm threshold), not lab ppm values. The app shows them as such and never invents a ppm figure.
- `data/curated-beers.json` holds a few hand-entered, well-known beers (classification and grain base only, no test data).

Not medical advice. People with coeliac disease should confirm with their clinician and the brewer.
