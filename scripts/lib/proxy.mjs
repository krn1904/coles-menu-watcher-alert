// Proxy helpers shared by local scraper scripts (mirrors supabase/functions/_shared/deals.ts).

export function proxyConfigured(env = process.env) {
  return Boolean(env.SCRAPER_PROXY_URL);
}

export function buildProxyUrl(target, env = process.env, session) {
  const tpl = env.SCRAPER_PROXY_URL;
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

export function proxiedFetch(target, init = {}, env = process.env, session) {
  return fetch(buildProxyUrl(target, env, session), init);
}
