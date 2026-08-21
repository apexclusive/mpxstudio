const products = {
  audit: {
    name: 'MPX Website Performance Scan',
    description: 'Een concrete analyse van uitstraling, structuur, vertrouwen, conversie en mobiele ervaring.',
    amount: 9900
  },
  concept: {
    name: 'MPX Website Concept',
    description: 'Een scherpe nieuwe richting voor je homepage of belangrijkste pagina.',
    amount: 9900
  }
};

function originFor(req) {
  const origin = req.headers.origin;
  return origin === 'http://localhost:4173' || origin === 'https://mpxstudio.nl' ? origin : 'https://mpxstudio.nl';
}

export default async function handler(req, res) {
  const origin = originFor(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST toegestaan' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Betaling is nog niet geconfigureerd.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const product = products[body.product];
  if (!product) return res.status(400).json({ error: 'Onbekend product.' });

  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${origin}/?payment=success&product=${encodeURIComponent(body.product)}`,
    cancel_url: `${origin}/#direct-starten`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(product.amount),
    'line_items[0][price_data][product_data][name]': product.name,
    'line_items[0][price_data][product_data][description]': product.description,
    'billing_address_collection': 'auto',
    'custom_text[submit][message]': 'Na betaling ontvang je de intake en plannen we de volgende stap.'
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!response.ok) return res.status(502).json({ error: 'Betaling kon niet worden gestart.' });
  const session = await response.json();
  return res.status(200).json({ url: session.url });
}
