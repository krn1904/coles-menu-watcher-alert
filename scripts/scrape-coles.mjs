#!/usr/bin/env node
// Automated Coles half-price scraper (CI or local).
//
// Coles' specials pages are Incapsula-protected and return blocks to datacenter
// IPs. Set SCRAPER_PROXY_URL to an AU-geolocated proxy (ScraperAPI, ScrapingBee,
// etc.) and run from GitHub Actions or locally.
//
// Usage:
//   node scripts/scrape-coles.mjs
// Env (read from supabase/.env.local, or the real environment):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
//   SCRAPER_PROXY_URL                         (required)
//   COLES_MAX_PAGES                           (optional, default 35)
//   COLES_PAGE_DELAY_MS                       (optional, default 250)
//   MIN_COLES_DEALS                           (optional, default 40)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { scrapeColesHalfPrice } from "./lib/coles-scrape.mjs";
import {
  applyCategoryOverrides,
  loadProductCategoryOverrides,
} from "./lib/category-overrides.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function getWeekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = (d.getUTCDay() - 3 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split("T")[0];
}

async function upsertDeals(supabase, deals, weekStart) {
  let inserted = 0;
  let updated = 0;
  const errors = [];
  for (const deal of deals) {
    try {
      const { data: existing } = await supabase
        .from("deals")
        .select("id")
        .eq("store", deal.store)
        .eq("product_id", deal.product_id)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("deals")
          .update({ ...deal, week_start: weekStart, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) {
          errors.push(`${deal.name}: ${error.message}`);
          continue;
        }
        updated++;
      } else {
        const { error } = await supabase.from("deals").insert([
          {
            ...deal,
            week_start: weekStart,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        if (error) {
          errors.push(`${deal.name}: ${error.message}`);
          continue;
        }
        inserted++;
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "upsert error");
    }
  }
  return { inserted, updated, errors };
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in supabase/.env.local).");
    process.exit(1);
  }

  const maxPages = Number(env.COLES_MAX_PAGES || "45");
  const pageDelayMs = Number(env.COLES_PAGE_DELAY_MS || "350");
  const minDeals = Number(env.MIN_COLES_DEALS || "40");
  const supabase = createClient(url, key);
  const weekStart = getWeekStart();

  let result;
  try {
    const { deals, pagesFetched, reportedTotal, truncated } = await scrapeColesHalfPrice(env, {
      maxPages,
      pageDelayMs,
      onPage: (page, count, total, expected) => {
        const totalLabel = expected != null ? expected : "?";
        process.stdout.write(`  page ${page}: +${count} (total ${total}/${totalLabel})\n`);
      },
    });

    if (truncated) {
      console.warn(
        `Coles: stopped at ${deals.length} deals before reported total ${reportedTotal} (raise COLES_MAX_PAGES, currently ${maxPages}).`,
      );
    }

    if (deals.length < minDeals) {
      throw new Error(
        `Coles fetched too few deals (${deals.length} from ${pagesFetched} pages < ${minDeals}).`,
      );
    }

    const overrideMap = await loadProductCategoryOverrides(supabase, "coles");
    const dealsToSave = applyCategoryOverrides(deals, overrideMap);
    if (overrideMap.size > 0) {
      console.log(`Applied ${overrideMap.size} saved category override(s) for Coles SKUs.`);
    }

    const { inserted, updated, errors } = await upsertDeals(supabase, dealsToSave, weekStart);
    const message = `Coles: fetched ${deals.length} (${pagesFetched} pages), inserted ${inserted}, updated ${updated}, failed ${errors.length}`;
    console.log(message);
    result = {
      success: errors.length === 0,
      fetched: deals.length,
      inserted,
      updated,
      pages_fetched: pagesFetched,
      reported_total: reportedTotal,
      errors,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("ERROR:", msg);
    result = {
      success: false,
      fetched: 0,
      inserted: 0,
      updated: 0,
      pages_fetched: 0,
      errors: [msg],
    };
  }

  await supabase.from("fetch_logs").insert([
    {
      store: "coles",
      success: result.success,
      message: result.errors.length ? result.errors[0] : `inserted ${result.inserted}, updated ${result.updated}`,
      data: { ...result, week_start: weekStart, min_expected: minDeals },
      created_at: new Date().toISOString(),
    },
  ]);

  process.exit(result.success ? 0 : 1);
}

main();
