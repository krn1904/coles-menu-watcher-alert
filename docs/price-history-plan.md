# Price history — technical plan (backend first)

Branch: `cursor/price-history-tracking-3e39`

## Goal

Keep a **time series of prices per product per store**. Current week UI stays fast; history grows week by week for your own analysis.

---

## How we track “the same product” across Coles vs Woolworths

**We do not use one shared ID today.** Each store has its own SKU:

| Store       | Example product              | `product_id` (stable per store) |
|------------|------------------------------|----------------------------------|
| Coles      | Cadbury Dairy Milk 180g      | `1234567`                        |
| Woolworths | Cadbury Dairy Milk Block 180g| `987654`                         |

**History rule (v1):** one timeline per `(store, product_id)`.

```
product_price_history
  coles     + 1234567  →  [Jun $3.50, Jul $4.00, Aug not scraped…]
  woolworths + 987654  →  [Jun $4.00, Jul $3.50, …]
```

**Cross-store “same product”** stays what the app already does: fuzzy match in `product-match.ts` at **read time** (compare view). History tables do **not** merge stores.

**Example — compare two histories in UI (later phase):**

```
Week 2026-06-17
  Coles SKU 1234567     sale $3.50
  Woolies SKU 987654    sale $4.00   ← matched pair in UI, separate rows in DB
```

Optional **phase 2+:** `product_match_links(coles_product_id, woolworths_product_id, confidence)` — not needed for backend v1.

---

## Current vs target

| Today | After v1 |
|-------|----------|
| `deals` row = one store + SKU + **week** | Same — **current week only** in main UI |
| Re-scrape same week → **update** row | Same |
| Old weeks left in `deals` but unused | **`product_price_history`** keeps every week forever |
| No timeline API | Query history by `store` + `product_id` |

**Important:** We are **not** changing the `deals` unique key `(store, product_id, week_start)`. We **add** append/upsert to a second table.

---

## Database (Phase 1 — backend only)

**New migration:** `supabase/migrations/…_product_price_history.sql`

```sql
CREATE TABLE product_price_history (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store                TEXT NOT NULL,
  product_id           TEXT NOT NULL,
  week_start           DATE NOT NULL,
  name                 TEXT NOT NULL,
  original_price       NUMERIC NOT NULL,
  sale_price           NUMERIC NOT NULL,
  discount_percentage  INT,
  image_url            TEXT,
  scraped_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store, product_id, week_start)
);

CREATE INDEX idx_pph_store_product_week
  ON product_price_history (store, product_id, week_start DESC);
```

- **RLS:** public `SELECT`; inserts/updates via service role (scrapers only).
- **Backfill once:** `INSERT INTO product_price_history … SELECT … FROM deals` (copy existing weeks).

---

## Code changes

### 1. New shared module

`scripts/lib/price-history.mjs`

```js
// After each scrape batch:
await upsertPriceHistory(supabase, deals, weekStart);
// → insert new week, or update if same week re-scraped
```

Mirror in `supabase/functions/_shared/price-history.ts` if edge scrapers stay.

### 2. Scrapers (hook after existing `upsertDeals`)

| File | Change |
|------|--------|
| `scripts/scrape-coles.mjs` | Call `upsertPriceHistory` after `upsertDeals` |
| `scripts/scrape-woolworths.mjs` | Same |
| `supabase/functions/_shared/deals.ts` | Optional: call from edge upsert path |

**Log line example:**

```
Coles: deals inserted 12, updated 800 | history inserted 45, updated 767
```

### 3. Types

- `src/integrations/supabase/types.ts` — add `product_price_history` table types.

### 4. What we do **not** change (v1)

- `SampleDeals` week filter (still current week).
- Comparison matcher.
- `product_category_overrides`.
- Workflow schedule.

---

## Minimal UI (Phase 1b — verify data)

One small addition on **Browse** mode only:

- **“History”** link on `DealCard` → modal with a table:

| Week       | Was   | Sale  | Discount |
|------------|-------|-------|----------|
| 17 Jun 26  | $7.00 | $3.50 | 50%      |
| 10 Jun 26  | $7.00 | $4.00 | 43%      |

**Query:**

```ts
supabase.from("product_price_history")
  .select("week_start, original_price, sale_price, discount_percentage")
  .eq("store", deal.store)
  .eq("product_id", deal.product_id)
  .order("week_start", { ascending: false })
  .limit(26); // ~6 months
```

No charts yet. Enough to confirm backend works.

---

## Scraper flow (after change)

```
scrape half-price pages
  → normalize deals
  → apply category overrides
  → upsertDeals()           // current week live table
  → upsertPriceHistory()    // NEW — permanent timeline
  → fetch_logs
```

---

## Re-scrape / edge cases

| Case | Behaviour |
|------|-----------|
| Same week, scraper runs twice | History row **updated** (same `week_start`) |
| New week Wednesday | History **inserts** new row; `deals` gets new row |
| Product off special (not in scrape) | No row that week — gap in timeline (correct) |
| Product renamed | Same `product_id`, new `name` on latest snapshot |
| Coles vs Woolies “same item” | Two history streams; compare in UI via existing matcher |

---

## Implementation order

1. Migration + RLS + backfill script `scripts/backfill-price-history.mjs`
2. `price-history.mjs` + wire into both Node scrapers
3. Run backfill on prod; run one manual scrape; check row counts in Supabase
4. Minimal `ProductHistoryModal` on deal cards
5. (Later) charts, week picker, cross-store trend on matched pairs

---

## Verify backend (no UI)

```sql
-- One product, multiple weeks
SELECT week_start, sale_price, original_price
FROM product_price_history
WHERE store = 'coles' AND product_id = '1234567'
ORDER BY week_start DESC;
```

Expect one row per week the product appeared in half-price scrape.

---

## Cost

Supabase free tier only. ~2k products × 2 stores × 52 weeks ≈ **200k rows/year** — acceptable for personal use.
