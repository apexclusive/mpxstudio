const allowedOrigins = new Set(['https://mpxstudio.nl', 'https://www.mpxstudio.nl', 'http://localhost:4173']);

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function setCors(req, res) {
  const origin = allowedOrigins.has(req.headers.origin) ? req.headers.origin : 'https://www.mpxstudio.nl';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function inspectHtml(html, url) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || '';
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;
  const imageTags = html.match(/<img\b[^>]*>/gi) || [];
  const imagesWithoutAlt = imageTags.filter(tag => !/\balt\s*=\s*["'][^"']*["']/i.test(tag)).length;
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasHttps = url.protocol === 'https:';
  const hasCallToAction = /(?:contact|contact opnemen|offerte|aanvragen|plan|boek|start|whatsapp|mailto:|tel:)/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
  const hasSocialPreview = /<meta[^>]+property=["']og:(?:title|description|image)["']/i.test(html);
  const language = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || '';

  const checks = [
    { key: 'https', label: 'Veilige HTTPS-verbinding', pass: hasHttps, detail: hasHttps ? 'Je website gebruikt een beveiligde HTTPS-verbinding.' : 'Gebruik HTTPS voor optimaal vertrouwen, veiligheid en ranking.' },
    { key: 'title', label: 'Duidelijke paginatitel (SEO)', pass: title.length >= 20 && title.length <= 70, detail: title ? `Paginatitel: “${title.slice(0, 75)}”` : 'Voeg een unieke, zoekwoordgerichte title-tag toe.' },
    { key: 'description', label: 'Overtuigende meta description', pass: description.length >= 70 && description.length <= 170, detail: description ? `Meta description aanwezig (${description.length} tekens).` : 'Voeg een conversiegerichte meta description toe (120–160 tekens).' },
    { key: 'h1', label: 'Heldere H1-hoofdkop', pass: h1Count === 1, detail: h1Count === 1 ? '1 unieke H1 hoofdkop gevonden.' : `${h1Count} H1-tags gevonden (ideaal is 1 H1 per pagina).` },
    { key: 'h2', label: 'Inhoudelijke structuur (H2 koppen)', pass: h2Count >= 2, detail: `${h2Count} H2 tussenkoppen gevonden voor logische scanbaarheid.` },
    { key: 'viewport', label: 'Mobiele responsive viewport', pass: hasViewport, detail: hasViewport ? 'Mobiele viewport correct geconfigureerd.' : 'Geen viewport-tag gevonden; mobiele ervaring is niet geoptimaliseerd.' },
    { key: 'images', label: 'Toegankelijke afbeeldingen (Alt-tags)', pass: imageTags.length === 0 || imagesWithoutAlt === 0, detail: imagesWithoutAlt === 0 ? 'Alle afbeeldingen bevatten een alt-beschrijving.' : `${imagesWithoutAlt} afbeelding${imagesWithoutAlt === 1 ? '' : 'en'} zonder alt-tekst gevonden.` },
    { key: 'cta', label: 'Duidelijke Call-To-Action (Conversie)', pass: hasCallToAction, detail: hasCallToAction ? 'Zichtbare conversieroute aanwezig (contact, offerte, WhatsApp of telefoon).' : 'Geen directe actieknop gevonden om bezoekers om te zetten in leads.' },
    { key: 'social', label: 'Deelbaar via WhatsApp & Social (OpenGraph)', pass: hasSocialPreview, detail: hasSocialPreview ? 'Social media preview tags (OpenGraph) zijn ingesteld.' : 'Voeg OpenGraph-tags toe voor professionele weergave in WhatsApp en LinkedIn.' },
    { key: 'lang', label: 'Juiste taalinstelling (HTML lang)', pass: language.length >= 2, detail: language ? `Pagina-taal ingesteld als “${language}”.` : 'Stel het lang-attribuut in op het html-element.' },
    { key: 'canonical', label: 'Vindbare hoofdroute (Canonical)', pass: hasCanonical, detail: hasCanonical ? 'Canonical URL correct ingesteld.' : 'Voeg een canonical link toe om dubbele content te voorkomen.' }
  ];
  const score = Math.round((checks.filter(check => check.pass).length / checks.length) * 100);
  return { url: url.href, score, checks, title: title || null };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Alleen POST toegestaan' });
  const rawUrl = clean(req.body?.url, 500);
  let url;
  try {
    url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Ongeldig protocol');
  } catch {
    return res.status(400).json({ error: 'Vul een volledige website-URL in, bijvoorbeeld https://jouwwebsite.nl.' });
  }
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return res.status(400).json({ error: 'Deze URL kan niet online worden gecontroleerd.' });
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'MPX-Studio-Website-Review/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = (await response.text()).slice(0, 1000000);
    return res.status(200).json(inspectHtml(html, url));
  } catch {
    return res.status(502).json({ error: 'De website kon nu niet worden opgehaald. Controleer de URL of vraag een handmatige review aan.' });
  }
}