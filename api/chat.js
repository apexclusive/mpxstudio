import { callBedrock } from '../lib/bedrock-provider.mjs';

const allowedOrigins = new Set(['https://mpxstudio.nl', 'https://www.mpxstudio.nl', 'http://localhost:4173']);
const fallback = 'Wij helpen bedrijven met premium maatwerkwebsites, branding en slimme digitale touchpoints. Laat gerust je doel, doelgroep en projectidee weten, dan geven we direct een duidelijke vervolgstap.';

function setCors(req, res) {
  const origin = allowedOrigins.has(req.headers.origin) ? req.headers.origin : 'https://www.mpxstudio.nl';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeMessages(input) {
  return (Array.isArray(input) ? input : [])
    .filter(message => ['user', 'assistant'].includes(message?.role))
    .map(message => ({ role: message.role, content: String(message.content || '').trim().slice(0, 4000) }))
    .filter(message => message.content)
    .slice(-12);
}

async function callOpenAi(messages) {
  if (!process.env.OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'Je bent de digitale adviseur van MPX Studio. Spreek Nederlands, wees kort, warm en professioneel. MPX Studio levert premium maatwerkwebsites, branding, development en AI-automatisering. Geef geen ongefundeerde claims en vraag bij serieuze interesse naar doel, doelgroep en contactgegevens.' },
        ...messages],
      max_tokens: 400,
      temperature: 0.5
    })
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST toegestaan' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { return res.status(400).json({ error: 'Ongeldige JSON in body' }); }
  }
  const messages = normalizeMessages(body?.messages);
  if (!messages.length || messages.at(-1)?.role !== 'user') return res.status(400).json({ error: 'Geen geldige berichten' });

  try {
    const reply = await callBedrock(messages, 'mpx') || await callOpenAi(messages) || fallback;
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat provider error:', error.message);
    return res.status(200).json({ reply: fallback });
  }
}
