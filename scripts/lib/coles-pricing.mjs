// Resolve Coles sale/was/discount from pricing fields (many items omit was on the catalogue page).

export function isHalfPriceSpecial(product) {
  const sale = Number(product.pricing?.now || 0);
  if (!sale) return false;

  const was = Number(product.pricing?.was || 0);
  const desc = (product.pricing?.priceDescription || "").toLowerCase();
  const savePct = Number(product.pricing?.savePercent || 0);

  // Check half-price signals BEFORE requiring was — was is often missing on Coles JSON.
  if (desc.includes("1/2") || desc.includes("half")) return true;
  if (savePct >= 40) return true;
  if (was > sale) return true;

  const comparableWas = Number(product.pricing?.comparableWas || 0);
  if (comparableWas > sale) return true;

  // Page URL uses filter_Special=halfprice — include priced items even when was/savePercent are absent.
  return true;
}

export function resolveColesPricing(product) {
  const sale = Number(product.pricing?.now || 0);
  if (!sale) return null;

  let was = Number(product.pricing?.was || 0);
  const savePct = Number(product.pricing?.savePercent || 0);

  if (!was) was = Number(product.pricing?.comparableWas || 0);
  if (!was && savePct > 0 && savePct < 100) {
    was = Math.round((sale / (1 - savePct / 100)) * 100) / 100;
  }
  if (!was || was <= sale) was = sale * 2;

  let discount = savePct > 0 ? Math.round(savePct) : Math.round(((was - sale) / was) * 100);
  if (!discount || discount < 1) discount = 50;

  return { sale, was, discount };
}
