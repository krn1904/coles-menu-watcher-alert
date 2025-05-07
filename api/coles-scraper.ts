// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error: No types for deno_dom WASM in Deno
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { createClient } from "@supabase/supabase-js";
import nodemailer from 'nodemailer'; // For sending emails

console.log("Hello from Functions!")

// Function to send email notifications
async function sendEmailNotification(newDeals) {
    const transporter = nodemailer.createTransport({
        // Configure your email service
        service: 'gmail', // Example: Gmail
        auth: {
            user: 'your-email@gmail.com',
            pass: 'your-email-password',
        },
    });

    const mailOptions = {
        from: 'your-email@gmail.com',
        to: 'subscriber-email@example.com', // List of subscribers
        subject: 'New Deals Available!',
        text: `New deals have been added: ${JSON.stringify(newDeals)}`,
    };

    await transporter.sendMail(mailOptions);
}

// Function to scrape data from Coles
async function scrapeColesData() {
    const response = await fetch("https://www.coles.com.au/on-special?filter_Special=halfprice&page=1");
    const html = await response.text();
    const document = new DOMParser().parseFromString(html, "text/html");

    // Extract product data
    const products = Array.from(document.querySelectorAll('section[data-testid="product-tile"]')).map(product => {
        const title = product.querySelector('.product__title')?.textContent;
        const price = product.querySelector('[data-testid="product-pricing"]')?.textContent;
        const imageUrl = product.querySelector('img[data-testid="product-image"]')?.getAttribute('src');

        return { title, price, imageUrl };
    });

    return products;
}

// Main handler function
export default async function handler(req, res) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Scrape new data
    const newDeals = await scrapeColesData();

    // Check for existing deals in Supabase
    const { data: existingDeals, error } = await supabase
        .from('deals')
        .select('*');

    if (error) {
        console.error('Error fetching existing deals:', error);
        return res.status(500).json({ error: 'Error fetching existing deals' });
    }

    // Compare new deals with existing deals
    const hasNewDeals = newDeals.some(newDeal => 
        !existingDeals.some(existingDeal => existingDeal.title === newDeal.title)
    );

    if (hasNewDeals) {
        // Insert new deals into Supabase
        await supabase.from('deals').insert(newDeals);
        console.log('New deals added:', newDeals);
        return res.status(200).json({ message: 'New deals added', deals: newDeals });
    } else {
        console.log('No new deals found.');
        return res.status(200).json({ message: 'No new deals found' });
    }
}

serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch Coles half-price page
  const res = await fetch("https://www.coles.com.au/on-special?filter_Special=halfprice&page=1&pid=homepage_herotile_halfprice");
  const html = await res.text();

  // Parse HTML
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return new Response("Failed to parse HTML", { status: 500 });

  // Select all product tiles
  const products = doc.querySelectorAll('section[data-testid="product-tile"]');

  let inserted = 0;
  for (const el of products) {
    const name = el.querySelector('.product__title')?.textContent.trim() ?? "";

    let imageUrl = el.querySelector('img[data-testid="product-image"]')?.getAttribute('src') ?? "";
    if (imageUrl && imageUrl.startsWith("/")) {
      imageUrl = "https://www.coles.com.au" + imageUrl;
    }

    const salePriceText = el.querySelector('span.price__value[data-testid="product-pricing"]')?.textContent ?? "";
    const salePrice = parseFloat(salePriceText.replace(/[^0-9.]/g, "")) || 0;

    const wasText = el.querySelector('.price__was')?.textContent ?? "";
    const originalPriceMatch = wasText.match(/\$([0-9.]+)/);
    const originalPrice = originalPriceMatch ? parseFloat(originalPriceMatch[1]) : 0;

    const discountPercentage = originalPrice && salePrice
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : 50;

    if (!name || !salePrice) continue;

    const { error } = await supabase.from("deals").upsert([
      {
        name,
        original_price: originalPrice,
        sale_price: salePrice,
        image_url: imageUrl,
        category: "", // Enhance if you find a category field
        discount_percentage: discountPercentage
      }
    ]);
    if (!error) inserted++;
  }

  // Check for new deals in Supabase
  const { data: existingDeals, error: existingDealsError } = await supabase
    .from('deals')
    .select('*');

  if (existingDealsError) {
    console.error('Error fetching existing deals:', existingDealsError);
    return new Response(`Scraping complete! Inserted/updated: ${inserted}`, { status: 500 });
  }

  // Compare newDeals with existingDeals
  const hasNewDeals = inserted > 0 && existingDeals.length > 0 && existingDeals.some(existingDeal => existingDeal.name === name);

  if (hasNewDeals) {
    // Send email notification
    await sendEmailNotification([{ name, original_price: originalPrice, sale_price: salePrice, image_url: imageUrl, category: "", discount_percentage: discountPercentage }]);
  }

  return new Response(`Scraping complete! Inserted/updated: ${inserted}`);
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/coles-scraper' \
    --header 'Authorization: Bearer <your-key>' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
