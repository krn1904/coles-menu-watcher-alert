#!/usr/bin/env node
// Local Woolworths half-price scraper.
//
// Why local? Woolworths' browse API (Akamai-protected) returns HTTP 403 to
// datacenter IPs (Supabase Edge / GitHub Actions) and won't clear the challenge
// even through free-tier proxies. It works flawlessly from an Australian
// residential IP — i.e. this machine. So we scrape here and push straight to
// Supabase using the service role key. Coles still runs in the cloud function.
//
// Usage:
//   node scripts/scrape-woolworths.mjs
// Env (read from supabase/.env.local, or the real environment):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
//   WOW_MAX_PAGES                             (optional, default 15)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ORIGIN = "https://www.woolworths.com.au";
const HALF_PRICE_URL = "/shop/browse/specials/half-price";
const FALLBACK_CATEGORY_ID = "specialsgroup.3676";
const PAGE_SIZE = 36;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-AU,en;q=0.9",
};

// --- env loading -----------------------------------------------------------
function loadEnv() {
  const env = { ...process.env };
  try {
    const file = resolve(__dirname, "../supabase/.env.local");
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* fall back to process.env only */
  }
  return env;
}

// --- helpers ---------------------------------------------------------------
function getWeekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = (d.getUTCDay() - 3 + 7) % 7; // days since last Wednesday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split("T")[0];
}

function discountPct(original, sale) {
  if (!original || original <= sale) return 50;
  return Math.round(((original - sale) / original) * 100);
}

function setCookieToHeader(res) {
  const jar = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  return jar.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

async function primeCookies() {
  const res = await fetch(`${ORIGIN}/`, { headers: { ...BROWSER_HEADERS, Accept: "text/html" } });
  await res.text();
  return setCookieToHeader(res);
}

async function resolveCategoryId(cookie) {
  try {
    const res = await fetch(`${ORIGIN}/apis/ui/PiesCategoriesWithSpecials`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json, text/plain, */*",
        Referer: `${ORIGIN}/shop/browse/specials`,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    if (!res.ok) return FALLBACK_CATEGORY_ID;
    const data = await res.json();
    let found = null;
    const walk = (node) => {
      if (found || !node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (node.UrlFriendlyName === "half-price" && typeof node.NodeId === "string" &&
          node.NodeId.startsWith("specialsgroup")) {
        found = node.NodeId;
        return;
      }
      Object.values(node).forEach(walk);
    };
    walk(data);
    return found || FALLBACK_CATEGORY_ID;
  } catch {
    return FALLBACK_CATEGORY_ID;
  }
}

async function fetchPage(categoryId, pageNumber, cookie) {
  const res = await fetch(`${ORIGIN}/apis/ui/browse/category`, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Origin: ORIGIN,
      Referer: `${ORIGIN}${HALF_PRICE_URL}`,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      categoryId,
      pageNumber,
      pageSize: PAGE_SIZE,
      sortType: "TraderRelevance",
      url: HALF_PRICE_URL,
      location: HALF_PRICE_URL,
      formatObject: '{"name":"Half Price"}',
      isSpecial: true,
      isBundle: false,
      isMobile: false,
      filters: [],
      token: "",
    }),
  });
  if (!res.ok) throw new Error(`Woolworths browse HTTP ${res.status} (page ${pageNumber})`);
  return res.json();
}

// --- upsert (mirrors supabase/functions/_shared/deals.ts) ------------------
async function upsertDeals(supabase, deals, weekStart) {
  let inserted = 0, updated = 0;
  const errors = [];
  for (const deal of deals) {
    try {
      const { data: existing } = await supabase
        .from("deals").select("id")
        .eq("store", deal.store).eq("product_id", deal.product_id).eq("week_start", weekStart)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase.from("deals")
          .update({ ...deal, week_start: weekStart, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) { errors.push(`${deal.name}: ${error.message}`); continue; }
        updated++;
      } else {
        const { error } = await supabase.from("deals").insert([{
          ...deal, week_start: weekStart,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]);
        if (error) { errors.push(`${deal.name}: ${error.message}`); continue; }
        inserted++;
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "upsert error");
    }
  }
  return { inserted, updated, errors };
}

// --- main ------------------------------------------------------------------
async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in supabase/.env.local).");
    process.exit(1);
  }
  const maxPages = Number(env.WOW_MAX_PAGES || "15");
  const supabase = createClient(url, key);
  const weekStart = getWeekStart();

  let result;
  try {
    const cookie = await primeCookies();
    const categoryId = await resolveCategoryId(cookie);
    console.log(`Half-price category: ${categoryId}`);

    const raw = [];
    let total = Infinity;
    for (let page = 1; page <= maxPages; page++) {
      const data = await fetchPage(categoryId, page, cookie);
      if (typeof data.TotalRecordCount === "number") total = data.TotalRecordCount;
      const products = (data.Bundles || []).flatMap((b) => b.Products || []);
      if (products.length === 0) break;
      raw.push(...products);
      process.stdout.write(`  page ${page}: +${products.length} (total ${raw.length}/${total})\n`);
      if (raw.length >= total) break;
    }

    const seen = new Set();
    const deals = [];
    for (const p of raw) {
      const sale = Number(p.Price || 0);
      const was = Number(p.WasPrice || 0);
      if (!sale || p.IsOnSpecial === false) continue;
      if (!was || was <= sale) continue;
      const name = (p.Name || "").trim();
      if (!name) continue;
      const productId = String(p.Stockcode || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      if (seen.has(productId)) continue;
      seen.add(productId);
      const brand = (p.Brand || "").trim();
      const fullName = brand && !name.toLowerCase().startsWith(brand.toLowerCase())
        ? `${brand} ${name}` : name;
      deals.push({
        name: fullName,
        category: "Groceries",
        original_price: was,
        sale_price: sale,
        discount_percentage: discountPct(was, sale),
        image_url: p.LargeImageFile || p.MediumImageFile || p.SmallImageFile || "",
        store: "woolworths",
        product_id: productId,
      });
    }

    if (deals.length === 0) throw new Error("No half-price specials parsed (page shape changed or blocked).");

    const { inserted, updated, errors } = await upsertDeals(supabase, deals, weekStart);
    const message = `Woolworths(local): fetched ${deals.length}, inserted ${inserted}, updated ${updated}, failed ${errors.length}`;
    console.log(message);
    result = { success: errors.length === 0, fetched: deals.length, inserted, updated, errors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("ERROR:", msg);
    result = { success: false, fetched: 0, inserted: 0, updated: 0, errors: [msg] };
  }

  // Mirror the cloud functions' fetch_logs history.
  await supabase.from("fetch_logs").insert([{
    store: "woolworths",
    success: result.success,
    message: result.errors.length ? result.errors[0] : `inserted ${result.inserted}, updated ${result.updated}`,
    data: result,
    created_at: new Date().toISOString(),
  }]);

  process.exit(result.success ? 0 : 1);
}

main();
