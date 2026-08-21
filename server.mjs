import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    if (!messages.length) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Geen geldige berichten' }));
      return;
    }

    const brand = body?.brand || 'mpx';
    let reply = null;

    try {
      reply = await callOpenAi(messages, brand);
    } catch (error) {
      console.error('OpenAI error:', error.message);
      reply = null;
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
