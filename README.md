# Coles & Woolworths Half-Price Watcher

Watches Coles and Woolworths for half-price specials, stores them in Supabase, shows
them on a React frontend, and emails subscribers (via Brevo) when new deals appear.

## Architecture

```
GitHub Actions (daily) ──► scrape-woolworths.mjs (Node + AU proxy) ─┐
                       ──► coles-scraper (Edge Function) ──────────┼─► Supabase `deals` ──► React frontend
                       ──► send-deal-alerts ───────────────────────┘                         └─► Brevo email
```

Supabase Edge Functions (in `supabase/functions/`):

- **coles-scraper** (cloud) — pulls Coles half-price specials by parsing the page's `__NEXT_DATA__`. Works from the datacenter edge IP without a proxy; falls back to `SCRAPER_PROXY_URL` if blocked.
- **woolworths-scraper** (cloud, optional) — same browse/category API logic as the Node script, but requires `SCRAPER_PROXY_URL` in Supabase secrets (Akamai blocks datacenter IPs).
- **`scripts/scrape-woolworths.mjs`** (automated via GitHub Actions) — **primary Woolworths path**. Runs daily in CI with `SCRAPER_PROXY_URL` + `SUPABASE_SERVICE_ROLE_KEY` secrets. No manual local runs needed.
- **send-deal-alerts** — emails subscribers about deals first seen since the last run, filtered by categories and minimum discount (Brevo).
- **_shared/deals.ts** — shared upsert/logging helpers. `created_at` is preserved across re-scrapes for new-deal detection.

## Setup

### 1. Frontend env (required)

Copy `.env.example` to `.env.local` and fill in your Supabase anon public key
(Dashboard → Project Settings → API → "anon public"). On Vercel, set the same
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars and redeploy.

### 2. Apply migrations & deploy functions

```sh
supabase db push                       # applies migrations (deals columns + unique index, fetch_logs)
supabase functions deploy woolworths-scraper
supabase functions deploy coles-scraper
supabase functions deploy send-deal-alerts
```

### 3. Function secrets (Supabase → Edge Functions → Secrets)

- `BREVO_API_KEY` — from Brevo → SMTP & API → API Keys (free tier: 300 emails/day).
- `BREVO_SENDER_EMAIL` — a sender address verified in Brevo (a personal Gmail works; **no domain required**).
- `BREVO_SENDER_NAME` — optional display name.
- `SCRAPER_PROXY_URL` — **needed for Woolworths** (its API returns HTTP 403 to datacenter IPs). A proxy template where `{url}` is replaced with the encoded target and, optionally, `{session}` with a sticky-session id (so cookie priming survives across requests). Examples:
  - ScraperAPI: `https://api.scraperapi.com/?api_key=YOUR_KEY&country_code=au&keep_headers=true&url={url}`
  - ScrapingBee: `https://app.scrapingbee.com/api/v1/?api_key=YOUR_KEY&forward_headers=true&country_code=au&url={url}`
  Use an AU-geolocated proxy. Coles does **not** need this today (it works from the edge IP), but will use the proxy automatically if set.
- `WOW_MAX_PAGES` — optional, caps Woolworths pagination (36 items/page). Default `15`.

Set them all at once from `supabase/.env.local`:

```sh
supabase secrets set --env-file supabase/.env.local
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

### 4. GitHub Actions secrets

Add these repo secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|--------|---------|
| `SUPABASE_ANON_KEY` | Auth header for edge function triggers |
| `SUPABASE_SERVICE_ROLE_KEY` | Lets the Node Woolworths scraper write to `deals` |
| `SCRAPER_PROXY_URL` | AU-geolocated proxy for Woolworths (required) |

The daily workflow (`.github/workflows/daily-scraper.yml`, 19:00 UTC) runs the Woolworths Node scraper (proxied), then Coles edge function, then email alerts. `workflow_dispatch` lets you trigger it manually.

### 5. Woolworths (automated — no local runs)

Woolworths blocks datacenter IPs, so the GitHub Action runs `npm run scrape:woolies` with `SCRAPER_PROXY_URL` and `SUPABASE_SERVICE_ROLE_KEY` from secrets. Configure a ScraperAPI or ScrapingBee AU proxy (see `.env.example`).

To test locally with the same setup:

```sh
# In supabase/.env.local set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRAPER_PROXY_URL
npm run scrape:woolies
```

AU supermarket specials run Wednesday→Tuesday; the daily cron still catches mid-week updates. Coles runs in the cloud edge function.

## Testing the flow

```sh
# Trigger scrapers manually
curl -X POST "https://cbexfvwjxvwcnorbpjkg.supabase.co/functions/v1/woolworths-scraper" \
  -H "Authorization: Bearer <anon-key>" -H "Content-Type: application/json" --data '{}'
curl -X POST "https://cbexfvwjxvwcnorbpjkg.supabase.co/functions/v1/coles-scraper" \
  -H "Authorization: Bearer <anon-key>" -H "Content-Type: application/json" --data '{}'

# Send yourself a test email (latest deals, ignores the "new since" window)
curl -X POST "https://cbexfvwjxvwcnorbpjkg.supabase.co/functions/v1/send-deal-alerts" \
  -H "Authorization: Bearer <anon-key>" -H "Content-Type: application/json" \
  --data '{"testEmail":"you@example.com"}'
```

Each function returns JSON: `success`, `store`, `fetched`, `inserted`, `updated`, `errors`.
Check the `fetch_logs` table for a history of every run.

## Known limitations

- **Woolworths requires an AU proxy** — Akamai blocks datacenter IPs. Set `SCRAPER_PROXY_URL` in GitHub secrets (for CI) and/or Supabase secrets (for the edge function). Free-tier proxies usually fail; ScraperAPI/ScrapingBee AU plans work.
- **Legacy data** — the `deals` table contains ~20k legacy `woolworths` rows (`product_id` like `legacy_%`, from the initial migration, dated 2025). Consider deleting them so the frontend only shows current specials: `delete from deals where product_id like 'legacy_%';`
- **No unsubscribe link yet** — would need an `unsubscribe` token + a small public route.

# Welcome to your Lovable project

## Project info

**URL**: [https://lovable.dev/projects/5cdc70cc-91d3-4265-bfe0-26cb3df60fdc](https://lovable.dev/projects/5cdc70cc-91d3-4265-bfe0-26cb3df60fdc)

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5cdc70cc-91d3-4265-bfe0-26cb3df60fdc) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5cdc70cc-91d3-4265-bfe0-26cb3df60fdc) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)