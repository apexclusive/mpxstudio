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
  const imageTags = html.match(/<img\b[^>]*>/gi) || [];
  const imagesWithoutAlt = imageTags.filter(tag => !/\balt\s*=\s*["'][^"']*["']/i.test(tag)).length;
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasHttps = url.protocol === 'https:';
  const checks = [
    { key: 'https', label: 'Veilige HTTPS-verbinding', pass: hasHttps, detail: hasHttps ? 'Je website gebruikt HTTPS.' : 'Gebruik HTTPS voor vertrouwen en veiligheid.' },
    { key: 'title', label: 'Duidelijke paginatitel', pass: title.length >= 20 && title.length <= 65, detail: title ? `Titel gevonden: “${title.slice(0, 80)}”` : 'Voeg een unieke title-tag toe.' },
    { key: 'description', label: 'Meta description', pass: description.length >= 80 && description.length <= 170, detail: description ? 'Een meta description is aanwezig.' : 'Voeg een overtuigende meta description toe.' },
    { key: 'h1', label: 'Heldere hoofdkop', pass: h1Count === 1, detail: `${h1Count} H1-tag${h1Count === 1 ? '' : 's'} gevonden.` },
    { key: 'viewport', label: 'Mobiele basis', pass: hasViewport, detail: hasViewport ? 'Viewport-instelling is aanwezig.' : 'Voeg een mobiele viewport toe.' },
    { key: 'images', label: 'Toegankelijke afbeeldingen', pass: imageTags.length === 0 || imagesWithoutAlt === 0, detail: imagesWithoutAlt ? `${imagesWithoutAlt} afbeelding${imagesWithoutAlt === 1 ? '' : 'en'} zonder alt-tekst.` : 'Afbeeldingen hebben alt-teksten.' }
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