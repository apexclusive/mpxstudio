const allowedOrigins = new Set(['https://mpxstudio.nl', 'https://www.mpxstudio.nl', 'http://localhost:4173']);

function setCors(req, res) {
  const origin = allowedOrigins.has(req.headers.origin) ? req.headers.origin : 'https://www.mpxstudio.nl';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST toegestaan' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      return res.status(400).json({ error: 'Ongeldige JSON in body' });
    }
  }
  body = body || {};
  if (clean(body.website, 120)) return res.status(204).end();

  const submission = {
    name: clean(body.name, 120),
    company: clean(body.company, 160),
    email: clean(body.email, 240),
    project: clean(body.project, 4000)
  };
  if (!submission.name || !submission.email || !submission.project) {
    return res.status(400).json({ error: 'Vul naam, e-mailadres en projectomschrijving in.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(submission.email)) {
    return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Online verzending is nog niet geconfigureerd.' });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || 'MPX Studio <onboarding@resend.dev>',
      to: [process.env.CONTACT_TO || 'info@mpxstudio.nl'],
      reply_to: submission.email,
      subject: `Nieuwe projectaanvraag${submission.company ? ` · ${submission.company}` : ''}`,
      text: `Naam: ${submission.name}\nBedrijf: ${submission.company || '-'}\nE-mail: ${submission.email}\n\nProject:\n${submission.project}`
    })
  });

  if (!response.ok) return res.status(502).json({ error: 'Verzenden is tijdelijk niet gelukt.' });
  return res.status(200).json({ ok: true });
}
