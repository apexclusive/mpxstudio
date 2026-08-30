#!/usr/bin/env node
/**
 * Bundelt de losse mpx-studio-*.css bestanden tot één mpx-studio-bundle.css.
 *
 * Waarom: index.html laadde 34 losse stylesheets, allemaal render-blocking.
 * De bronbestanden blijven bestaan zodat je ze los kunt blijven aanpassen
 * (en omdat privacy.html en webdesign-maastricht.html mpx-studio.css los gebruiken).
 *
 * De volgorde hieronder is de originele <link>-volgorde uit index.html en
 * bepaalt de cascade. Wijzig de volgorde alleen als je weet wat je doet.
 *
 * Gebruik: node build-css.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ORDER = [
  'mpx-studio.css',
  'mpx-studio-contrast.css',
  'mpx-studio-demos.css',
  'mpx-studio-space.css',
  'mpx-studio-effects.css',
  'mpx-studio-intro.css',
  'mpx-studio-polish.css',
  'mpx-studio-moon-photo.css',
  'mpx-studio-moon-crop.css',
  'mpx-studio-catalog.css',
  'mpx-studio-demo-layout.css',
  'mpx-studio-brand.css',
  'mpx-studio-demo-luxury.css',
  'mpx-studio-minimal.css',
  'mpx-studio-combined.css',
  'mpx-studio-shooting-star.css',
  'mpx-studio-compact-intro.css',
  'mpx-studio-menu.css',
  'mpx-studio-filter-contrast.css',
  'mpx-studio-section-flow.css',
  'mpx-studio-scroll-luxury.css',
  'mpx-studio-header-cinematic.css',
  'mpx-studio-header-line.css',
  'mpx-studio-menu-two.css',
  'mpx-studio-neutral-luxe.css',
  'mpx-studio-contact-tight.css',
  'mpx-studio-services-form.css',
  'mpx-studio-intro-cinematic.css',
  'mpx-studio-portfolio-mobile.css',
  'mpx-studio-final-polish.css',
  'mpx-studio-hero-clear.css',
  'mpx-studio-audit-polish.css',
  'mpx-studio-mobile-polish.css',
  'mpx-studio-ux-hardening.css'
];

const OUT = 'mpx-studio-bundle.css';

const header =
  `/* MPX Studio — gebundelde stylesheet — GEGENEREERD, NIET MET DE HAND WIJZIGEN\n` +
  `   Samengevoegd uit ${ORDER.length} bronbestanden in exact de oude <link>-volgorde,\n` +
  `   zodat de cascade identiek blijft. Opnieuw bouwen: node build-css.mjs */\n\n`;

const body = ORDER.map((file) => {
  const css = readFileSync(file, 'utf8').replace(/\s+$/, '');
  return `/* ═══ ${file} ═══ */\n${css}\n`;
}).join('\n');

const bundle = header + body;
writeFileSync(OUT, bundle);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`${OUT} gebouwd uit ${ORDER.length} bestanden — ${kb(bundle.length)}`);
