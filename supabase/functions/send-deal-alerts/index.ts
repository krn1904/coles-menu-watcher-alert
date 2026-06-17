import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  jsonResponse,
  getServiceClient,
  getWeekStart,
  logFetch,
} from "../_shared/deals.ts";

type Subscription = {
  id: string;
  email: string;
  categories: string[] | null;
  min_discount: number | null;
};

type Deal = {
  id: string;
  name: string;
  category: string | null;
  original_price: number;
  sale_price: number;
  discount_percentage: number | null;
  image_url: string | null;
  store: string;
  created_at: string | null;
  week_start: string | null;
};

function dealMatchesSubscription(deal: Deal, sub: Subscription): boolean {
  const minDiscount = sub.min_discount ?? 25;
  const discount = deal.discount_percentage ?? 50;
  if (discount < minDiscount) return false;

  if (!sub.categories || sub.categories.length === 0) return true;

  const dealCategory = (deal.category || "groceries").toLowerCase();
  return sub.categories.some((c) => {
    const normalized = c.toLowerCase();
    return dealCategory.includes(normalized) || normalized.includes(dealCategory);
  });
}

function buildEmailHtml(deals: Deal[]): string {
  const rows = deals
    .slice(0, 30)
    .map(
      (d) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          ${d.image_url ? `<img src="${d.image_url}" alt="" width="48" height="48" style="object-fit:contain"/>` : ""}
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <strong>${d.name}</strong><br/>
          <small>${d.store} · ${d.discount_percentage ?? 50}% off</small>
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">
          <s>$${d.original_price.toFixed(2)}</s><br/>
          <strong style="color:#e10000;">$${d.sale_price.toFixed(2)}</strong>
        </td>
      </tr>`,
    )
    .join("");

  return `
    <h2>New half-price deals</h2>
    <p>Here are ${deals.length} new deal${deals.length === 1 ? "" : "s"} matching your preferences:</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    ${deals.length > 30 ? `<p><em>…and ${deals.length - 30} more on the site.</em></p>` : ""}
  `;
}

async function sendBrevoEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "Half-Price Watcher";

  if (!apiKey || !senderEmail) {
    throw new Error("Missing BREVO_API_KEY or BREVO_SENDER_EMAIL");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = getServiceClient();

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const testEmail = typeof body.testEmail === "string" ? body.testEmail : null;
    const activeWeekStart = getWeekStart();

    // Deals first seen since the last successful alert run (created_at is preserved on re-scrape).
    const { data: lastAlert } = await supabase
      .from("fetch_logs")
      .select("created_at")
      .eq("store", "alerts")
      .eq("success", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = testEmail
      ? new Date(0).toISOString()
      : lastAlert?.created_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("id,name,category,original_price,sale_price,discount_percentage,image_url,store,created_at,week_start")
      .gte("created_at", since)
      .eq("week_start", activeWeekStart)
      .order("created_at", { ascending: false });

    if (dealsError) throw new Error(`Failed to load deals: ${dealsError.message}`);

    const newDeals = (deals || []) as Deal[];
    if (newDeals.length === 0) {
      const msg = "No new deals since last alert run.";
      await logFetch(supabase, "alerts", true, msg, { sent: 0, skipped: 0, week_start: activeWeekStart });
      return jsonResponse({ success: true, sent: 0, skipped: 0, message: msg });
    }

    if (testEmail) {
      await sendBrevoEmail(
        testEmail,
        `Test: ${newDeals.length} half-price deals`,
        buildEmailHtml(newDeals.slice(0, 10)),
      );
      await logFetch(supabase, "alerts", true, `Test email sent to ${testEmail}`, {
        sent: 1,
        deals: newDeals.length,
        week_start: activeWeekStart,
      });
      return jsonResponse({ success: true, sent: 1, testEmail, deals: newDeals.length });
    }

    const apiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
    if (!apiKey || !senderEmail) {
      const msg = "BREVO_API_KEY / BREVO_SENDER_EMAIL not configured — skipping subscriber emails.";
      await logFetch(supabase, "alerts", true, msg, {
        sent: 0,
        skipped: 0,
        deals: newDeals.length,
        week_start: activeWeekStart,
      });
      return jsonResponse({ success: true, sent: 0, skipped: 0, message: msg, deals: newDeals.length });
    }

    const { data: subs, error: subsError } = await supabase
      .from("subscriptions")
      .select("id,email,categories,min_discount");

    if (subsError) throw new Error(`Failed to load subscriptions: ${subsError.message}`);

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const sub of (subs || []) as Subscription[]) {
      const matched = newDeals.filter((d) => dealMatchesSubscription(d, sub));
      if (matched.length === 0) {
        skipped++;
        continue;
      }
      try {
        await sendBrevoEmail(
          sub.email,
          `${matched.length} new half-price deal${matched.length === 1 ? "" : "s"}`,
          buildEmailHtml(matched),
        );
        sent++;
      } catch (e) {
        errors.push(`${sub.email}: ${e instanceof Error ? e.message : "send failed"}`);
      }
    }

    const message = `Alerts: sent ${sent}, skipped ${skipped}, errors ${errors.length}`;
    await logFetch(supabase, "alerts", errors.length === 0, message, {
      sent,
      skipped,
      errors,
      deals: newDeals.length,
      week_start: activeWeekStart,
    });

    return jsonResponse(
      { success: errors.length === 0, sent, skipped, errors, deals: newDeals.length },
      errors.length === 0 ? 200 : 207,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown alert error";
    await logFetch(supabase, "alerts", false, msg, { sent: 0, errors: [msg] });
    return jsonResponse({ success: false, sent: 0, errors: [msg] }, 500);
  }
});
