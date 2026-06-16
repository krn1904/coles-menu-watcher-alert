type JsonResponder = {
  status: (code: number) => {
    json: (body: Record<string, unknown>) => void;
  };
};

export default function handler(_request: unknown, response: JsonResponder) {
  response.status(410).json({
      success: false,
      store: 'coles',
      fetched: 0,
      inserted: 0,
      updated: 0,
      errors: ['Vercel scraper route is disabled. Use the Supabase Edge Function coles-scraper.'],
  });
}
