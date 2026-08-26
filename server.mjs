import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callBedrock } from './lib/bedrock-provider.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4173);
const HOST = '0.0.0.0';
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function safeText(input) {
  return String(input || '').trim();
}

function isPrivateHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  if (['localhost', 'localhost.localdomain', '127.0.0.1', '0.0.0.0', '::1'].includes(normalized)) return true;
  if (/^(10|127)\./.test(normalized) || /^192\.168\./.test(normalized) || /^169\.254\./.test(normalized)) return true;
  const private172 = normalized.match(/^172\.(\d+)\./);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}

function normalizeMessages(input) {
  const allowedRoles = new Set(['user', 'assistant']);
  return (Array.isArray(input) ? input : [])
    .filter(message => allowedRoles.has(message?.role))
    .map(message => ({ role: message.role, content: safeText(message.content).slice(0, 4000) }))
    .filter(message => message.content)
    .slice(-12);
}

function fallbackReply(message) {
  const value = safeText(message).toLowerCase();
  if (value.includes('website') || value.includes('site') || value.includes('webshop') || value.includes('design')) {
    return 'Perfect. MPX Studio bouwt premium maatwerk websites voor bedrijven die vertrouwen en nieuwe klanten willen winnen. We kunnen starten met een helder gesprek over jouw doelgroep, doelen en uitstraling.';
  }
  if (value.includes('prijs') || value.includes('kosten') || value.includes('budget')) {
    return 'De investering hangt af van scope, functionaliteit en snelheid. We bespreken graag wat je wilt bereiken en geven daarna heldere, op maat gemaakte input.';
  }
  if (value.includes('ai') || value.includes('chatbot') || value.includes('automatis')) {
    return 'Ja, we ondersteunen AI en slimme automations zoals chatbots, lead-kwalificatie en gepersonaliseerde klantcontacten die aansluiten op je merk.';
  }
  if (value.includes('brand') || value.includes('identiteit') || value.includes('logo')) {
    return 'Een sterke digitale uitstraling begint met een heldere merkpositionering. We helpen je met visuele richting, websiteconcept en de juiste tone of voice.';
  }
  return 'Wij helpen bedrijven met premium webdesign, branding en slimme digital touchpoints. Laat gerust je doel, doelgroep en projectidee weten, dan geven we direct een duidelijke vervolgstap.';
}

function buildSystemPrompt(brand) {
  if (brand === 'mpx') {
    return `Je bent de digitale adviseur van MPX Studio, een premium digital agency in Nederland die bedrijven helpt sterker te overkomen online.

DOEL VAN MPX STUDIO:
- Premium maatwerk websites bouwen voor bedrijven die serieus willen groeien
- Design, branding en development in één duidelijke, hoogwaardige aanpak
- Websites die vertrouwen creëren en meer conversie opleveren
- Voor bedrijven zoals tandartspraktijken, klinieken, automotive, wellness, lokale dienstverleners en premium servicebedrijven

WAARONDER WE WERKEN:
- Webdesign & UX
- Brand identity & visuele richting
- Development & moderne techniek
- AI & automatisering voor leadqualificatie en klantcontact

MERKWAARDIGHEID:
- Geen standaard templates
- Geen goedkope marketingtoon
- Wel premium, helder, prestigieus en commercieel sterk

CONTACT:
- Email: info@mpxstudio.nl
- WhatsApp: +31 6 24 73 59 39
- Locatie: Nederland

COMMUNICATIESTYLE:
- Spreek ALTIJD Nederlands
- Wees warm, professioneel en overtuigend
- Toon vertrouwen, kwaliteit en een premium uitstraling
- Antwoorden moeten helder, kort, commercieel relevant en overtuigend zijn
- Gebruik nooit een goedkope of te algemene tone-of-voice
- Gebruik vetgedrukt voor belangrijke termen

LEAD-GESTUURDE RICHTLIJNEN:
- Als een bezoeker interesse toont in een website, reageer met een positieve, professionele uitdaging
- Vraag dan slim door naar doel, doelgroep, huidige situatie en gewenste uitstraling
- Als de bezoeker serieus is, vraag vriendelijk naar naam, bedrijf, e-mailadres of telefoonnummer
- Beredeneer altijd vanuit vertrouwen, conversie en kwaliteit
- Geef geen algemene marketingtaal zonder richting
- Toon dat MPX Studio maatwerk levert, niet een standaard package

EXAMPLE RESPONSE STYLE:
- 'Dat klinkt als een goed project. Bij MPX Studio helpen we bedrijven met premium webdesign dat vertrouwen opbouwt en meer kwalitatieve leads oplevert.'
- 'Perfect. We kunnen dit op maat ontwikkelen voor jouw doelgroep, merk en conversiedoelen.'
- 'Laten we eerst helder krijgen wat je wilt bereiken, voor wie je het bouwt en welke indruk je wilt achterlaten.'`;
  }

  return `Je bent de digitale adviseur van APEXclusive, een premium automotive advisory bedrijf gevestigd in Maastricht, Nederland.

OVER APEXCLUSIVE:
- Oprichter: Martijn Puts, professioneel piloot en autofanaat
- Specialiteit: Import van exclusieve auto's uit heel Europa
- Zoekgebied: Duitsland, België, Italië, Spanje, Zweden, Luxemburg, Frankrijk
- Werkwijze: volledig A tot Z, van eerste gesprek tot sleuteloverdracht aan huis
- USP: 100% onafhankelijk, geen dealerbelang

CONTACT:
- Email: info@apexclusive.nl
- WhatsApp: +31 6 24 73 59 39
- Locatie: Maastricht

INSTRUCTIES:
- Spreek ALTIJD Nederlands
- Wees professioneel, warm en behulpzaam
- Houd antwoorden kort en helder
- Vraag bij interesse vriendelijk naar naam, telefoonnummer of email`;
}

async function callOpenAi(messages, brand) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: buildSystemPrompt(brand) }, ...messages],
      max_tokens: 350,
      temperature: 0.7,
      presence_penalty: 0.1,
      stream: false
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || 'OpenAI API fout');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || data.reply || data.text || '';
}

async function handleApiChat(req, res, body) {
  try {
    const messages = normalizeMessages(body?.messages);
    if (!messages.length || messages.at(-1)?.role !== 'user') {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Geen geldige berichten' }));
      return;
    }

    const brand = body?.brand || 'mpx';
    let reply = null;

    try {
      reply = await callBedrock(messages, brand === 'apex' ? 'apex' : 'mpx');
    } catch (error) {
      console.error('Bedrock error:', error.message);
    }

    if (!reply) {
      try {
        reply = await callOpenAi(messages, brand);
      } catch (error) {
        console.error('OpenAI error:', error.message);
        reply = null;
      }
    }

    if (!reply) {
      const userMessage = safeText(messages[messages.length - 1]?.content || '');
      reply = fallbackReply(userMessage);
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ reply }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Chat server fout.' }));
  }
}

function auditHtml(html, url) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || '';
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const images = html.match(/<img\b[^>]*>/gi) || [];
  const missingAlt = images.filter(tag => !/\balt\s*=\s*["'][^"']*["']/i.test(tag)).length;
  const visibleText = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' ').replace(/\s+/g, ' ').trim();
  const hasCallToAction = /(?:contact|contact opnemen|offerte|aanvragen|plan|boek|start|whatsapp|mailto:)/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
  const hasSocialPreview = /<meta[^>]+property=["']og:(?:title|description|image)["']/i.test(html);
  const language = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || '';
  const checks = [
    { label: 'Veilige HTTPS-verbinding', pass: url.protocol === 'https:', detail: url.protocol === 'https:' ? 'Je website gebruikt HTTPS.' : 'Gebruik HTTPS voor vertrouwen en veiligheid.' },
    { label: 'Duidelijke paginatitel', pass: title.length >= 20 && title.length <= 65, detail: title ? `Titel gevonden: “${title.slice(0, 80)}”` : 'Voeg een unieke title-tag toe.' },
    { label: 'Meta description', pass: description.length >= 80 && description.length <= 170, detail: description ? 'Een meta description is aanwezig.' : 'Voeg een overtuigende meta description toe.' },
    { label: 'Heldere hoofdkop', pass: h1Count === 1, detail: `${h1Count} H1-tag${h1Count === 1 ? '' : 's'} gevonden.` },
    { label: 'Mobiele basis', pass: /<meta[^>]+name=["']viewport["']/i.test(html), detail: /<meta[^>]+name=["']viewport["']/i.test(html) ? 'Viewport-instelling is aanwezig.' : 'Voeg een mobiele viewport toe.' },
    { label: 'Toegankelijke afbeeldingen', pass: !missingAlt, detail: missingAlt ? `${missingAlt} afbeelding${missingAlt === 1 ? '' : 'en'} zonder alt-tekst.` : 'Afbeeldingen hebben alt-teksten.' },
    { label: 'Duidelijke vervolgstap', pass: hasCallToAction, detail: hasCallToAction ? 'Er is een zichtbare route naar contact of aanvraag.' : 'Voeg een duidelijke actie toe, zoals contact opnemen of een offerte aanvragen.' },
    { label: 'Deelbaar op social media', pass: hasSocialPreview, detail: hasSocialPreview ? 'Open Graph-informatie is aanwezig.' : 'Voeg een social preview toe voor delen via WhatsApp en social media.' },
    { label: 'Juiste taal ingesteld', pass: language.length >= 2, detail: language ? `Taal ingesteld als “${language}”.` : 'Stel de taal in op het html-element.' },
    { label: 'Vindbare hoofdroute', pass: hasCanonical && visibleText.length >= 250, detail: hasCanonical && visibleText.length >= 250 ? 'Canonical en voldoende inhoud zijn aanwezig.' : 'Controleer canonical URL en inhoudelijke diepte van de pagina.' }
  ];
  return { url: url.href, score: Math.round((checks.filter(check => check.pass).length / checks.length) * 100), checks };
}

async function handleApiAudit(req, res, body) {
  let target;
  try {
    target = new URL(safeText(body?.url).slice(0, 500));
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || isPrivateHostname(target.hostname)) throw new Error('Ongeldige URL');
    const response = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'MPX-Studio-Website-Review/1.0' } });
    if (!response.ok) throw new Error('Website niet bereikbaar');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(auditHtml((await response.text()).slice(0, 1000000), target)));
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'De website kon nu niet worden opgehaald. Controleer de URL of vraag een handmatige review aan.' }));
  }
}

function cleanContactValue(input, maxLength) {
  return String(input || '').trim().slice(0, maxLength);
}

async function handleApiContact(req, res, body) {
  try {
    const payload = typeof body === 'string' ? JSON.parse(body || '{}') : (body || {});
    const website = cleanContactValue(payload.website, 120);
    if (website) {
      res.writeHead(204, { 'Access-Control-Allow-Origin': req.headers.origin === 'http://localhost:4173' ? 'http://localhost:4173' : 'https://mpxstudio.nl' });
      res.end();
      return;
    }

    const proposal = {
      name: cleanContactValue(payload.name, 120),
      company: cleanContactValue(payload.company, 160),
      email: cleanContactValue(payload.email, 240),
      project: cleanContactValue(payload.project, 4000)
    };

    if (!proposal.name || !proposal.email || !proposal.project) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Vul naam, e-mailadres en projectomschrijving in.' }));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(proposal.email)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Vul een geldig e-mailadres in.' }));
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, localFallback: true }));
      return;
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || 'MPX Studio <onboarding@resend.dev>',
        to: [process.env.CONTACT_TO || 'info@mpxstudio.nl'],
        reply_to: proposal.email,
        subject: `Nieuwe projectaanvraag${proposal.company ? ` · ${proposal.company}` : ''}`,
        text: `Naam: ${proposal.name}\nBedrijf: ${proposal.company || '-'}\nE-mail: ${proposal.email}\n\nProject:\n${proposal.project}`
      })
    });

    if (!emailResponse.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Verzenden is tijdelijk niet gelukt.' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Ongeldige JSON in body' }));
  }
}

async function handleApiCheckout(req, res, body) {
  const products = {
    audit: { name: 'MPX Website Performance Scan', description: 'Een concrete analyse van uitstraling, structuur, vertrouwen, conversie en mobiele ervaring.', amount: 9900 },
    concept: { name: 'MPX Website Concept', description: 'Een scherpe nieuwe richting voor je homepage of belangrijkste pagina.', amount: 9900 }
  };
  const product = products[body?.product];
  if (!product) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Onbekend product.' }));
    return;
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Betaling is nog niet geconfigureerd.' }));
    return;
  }
  const origin = req.headers.origin === 'http://localhost:4173' ? req.headers.origin : 'https://mpxstudio.nl';
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${origin}/?payment=success&product=${encodeURIComponent(body.product)}`,
    cancel_url: `${origin}/#direct-starten`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(product.amount),
    'line_items[0][price_data][product_data][name]': product.name,
    'line_items[0][price_data][product_data][description]': product.description,
    billing_address_collection: 'auto'
  });
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
    if (!response.ok) throw new Error('Stripe checkout error');
    const session = await response.json();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ url: session.url }));
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Betaling kon niet worden gestart.' }));
  }
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  const requestOrigin = req.headers.origin;
  const allowedOrigin = requestOrigin === 'https://mpxstudio.nl' || requestOrigin === 'http://localhost:4173' ? requestOrigin : 'https://mpxstudio.nl';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });
    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        await handleApiChat(req, res, parsed);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Ongeldige JSON in body' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/audit') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      try {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        const parsed = body ? JSON.parse(body) : {};
        await handleApiAudit(req, res, parsed);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Ongeldige JSON in body' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/contact') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 20000) req.destroy(); });
    req.on('end', async () => {
      try {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        const parsed = body ? JSON.parse(body) : {};
        await handleApiContact(req, res, parsed);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Ongeldige JSON in body' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', async () => {
      try {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        const parsed = body ? JSON.parse(body) : {};
        await handleApiCheckout(req, res, parsed);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Ongeldige JSON in body' }));
      }
    });
    return;
  }

  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath === '/') {
    requestPath = '/index.html';
  }

  const filePath = path.join(__dirname, requestPath);
  const safeFilePath = path.normalize(filePath);
  const rootPath = path.normalize(__dirname);
  if (!safeFilePath.startsWith(rootPath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const fileBuffer = await readFileIfExists(safeFilePath);
  if (!fileBuffer) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const extension = path.extname(safeFilePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(fileBuffer);
});

server.listen(PORT, HOST, () => {
  console.log(`MPX Studio chat server running at http://localhost:${PORT}`);
});
