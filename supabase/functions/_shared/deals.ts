// Shared helpers for the scraper + email edge functions.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Browser-like headers shared by the scrapers. Coles/Woolworths reject requests
// that don't look like a real browser.
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-AU,en;q=0.9",
};

// Both retailers block datacenter IPs (Supabase Edge + GitHub Actions runners),
// so the scrapers route requests through an AU-geolocated proxy when one is set.
// SCRAPER_PROXY_URL is a template; it may contain {url} (target URL is inserted
// there, percent-encoded) and optionally {session} (a sticky-session token so a
// multi-request flow keeps the same upstream IP + cookie jar). If {url} is
// absent, the encoded target is appended to the template. Example (ScraperAPI):
//   https://api.scraperapi.com/?api_key=KEY&country_code=au&keep_headers=true&url={url}
export function proxyConfigured(): boolean {
  return Boolean(Deno.env.get("SCRAPER_PROXY_URL"));
}

export function buildProxyUrl(target: string, session?: string): string {
  const tpl = Deno.env.get("SCRAPER_PROXY_URL");
  if (!tpl) return target;
  let url = tpl.includes("{url}")
    ? tpl.replace("{url}", encodeURIComponent(target))
    : tpl + encodeURIComponent(target);
  if (session) {
    if (url.includes("{session}")) {
      url = url.replace("{session}", encodeURIComponent(session));
    } else if (/scraperapi\.com/i.test(url)) {
      url += `&session_number=${encodeURIComponent(session)}`;
    }
  }
  return url;
}

// Fetch a target URL, transparently routing through SCRAPER_PROXY_URL if set.
// `session` keeps a sticky upstream IP/cookie jar across calls for stateful flows.
export function proxiedFetch(
  target: string,
  init: RequestInit = {},
  session?: string,
): Promise<Response> {
  return fetch(buildProxyUrl(target, session), init);
}

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  }
  return createClient(url, key);
}

// AU supermarket specials run Wednesday -> Tuesday. Anchor each deal to the
// most recent Wednesday so re-scrapes within the same week update one row.
export function getWeekStart(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun .. 3=Wed
  const diff = (day - 3 + 7) % 7; // days since last Wednesday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split("T")[0];
}

export type NormalizedDeal = {
  name: string;
  category: string;
  original_price: number;
  sale_price: number;
  discount_percentage: number;
  image_url: string;
  store: string;
  product_id: string;
};

export type UpsertResult = { inserted: number; updated: number; errors: string[] };

// Upsert a batch of deals, preserving created_at on existing rows so that
// created_at stays a true "first seen" timestamp for new-deal email alerts.
export async function upsertDeals(
  supabase: SupabaseClient,
  deals: NormalizedDeal[],
  weekStart: string,
): Promise<UpsertResult> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const deal of deals) {
    try {
      if (!deal.name || !deal.sale_price || !deal.product_id) {
        errors.push(`Skipped invalid ${deal.store} product: ${deal.name || "(no name)"}`);
        continue;
      }

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
        const { error } = await supabase.from("deals").insert([{
          ...deal,
          week_start: weekStart,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
        if (error) {
          errors.push(`${deal.name}: ${error.message}`);
          continue;
        }
        inserted++;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Unknown upsert error");
    }
  }

  return { inserted, updated, errors };
}

export async function logFetch(
  supabase: SupabaseClient,
  store: string,
  success: boolean,
  message: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("fetch_logs").insert([{
    store,
    success,
    message,
    data,
    created_at: new Date().toISOString(),
  }]);
  if (error) console.error(`Failed to write fetch_logs for ${store}:`, error.message);
}

export function discountPct(original: number, sale: number): number {
  if (!original || original <= sale) return 50;
  return Math.round(((original - sale) / original) * 100);
}
