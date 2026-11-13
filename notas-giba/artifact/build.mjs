// Junta o site num único arquivo HTML para publicar como Artifact no claude.ai.
// Uso: node artifact/build.mjs  ->  artifact/notas-giba.html
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');
const semModulo = (js) => js.replace(/^import .*$/gm, '').replace(/^export (const|function|class|let)/gm, '$1').replace(/^export \{[^}]*\};?$/gm, '');

let css = ler('public/style.css');
// Tema: modo escuro do sistema só quando o visualizador não escolheu "claro", e também quando escolheu "escuro".
const escuro = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}\n\}/);
if (!escuro) throw new Error('bloco escuro não encontrado em style.css');
const tokensEscuros = escuro[1];
css = css.replace(escuro[0], `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {${tokensEscuros}\n  }\n}\n:root[data-theme="dark"] {${tokensEscuros}\n}`);
// tokens extras (bolha do WhatsApp na prévia)
css = css.replace(':root {', ':root {\n  --wa-bolha: #e7ffdb;\n  --wa-bolha-texto: #111b21;');
css = css.replace(/(:root:not\(\[data-theme="light"\]\) \{)/, '$1\n    --wa-bolha: #144d37;\n    --wa-bolha-texto: #e9edef;');
css = css.replace(/(:root\[data-theme="dark"\] \{)/, '$1\n    --wa-bolha: #144d37;\n    --wa-bolha-texto: #e9edef;');
// margens laterais seguras (celular com barra lateral)
css = css.replace('.main { margin-left: var(--sidebar); padding: 28px 32px 48px; }', '.main { margin-left: var(--sidebar); padding-block: 28px 48px; padding-left: max(32px, env(safe-area-inset-left, 0px)); padding-right: max(32px, env(safe-area-inset-right, 0px)); }');
css = css.replace(/\.main \{ margin-left: 0; padding: 12px 16px calc\(var\(--bottom\) \+ 28px \+ env\(safe-area-inset-bottom\)\); \}/, '.main { margin-left: 0; padding-block: 12px calc(var(--bottom) + 28px + env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }');
css = css.replace('position: sticky; top: 0; z-index: 15;', 'position: sticky; top: env(safe-area-inset-top, 0px); z-index: 15;');
css = css.replace('padding: 10px 16px; padding-top: calc(10px + env(safe-area-inset-top));', 'padding-block: 10px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));');
css = css.replace('.hidden { display: none !important; }', '');
css += '\n' + ler('artifact/extra.css');

const js = [semModulo(ler('public/calc.js')), semModulo(ler('public/combinar.js')), semModulo(ler('src/nfe-xml.js')), ler('artifact/app.js')].join('\n;\n');

const html = `<title>Notas do Giba</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0f7a5c">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${css}
</style>
<div id="raiz"><div class="carregando"><div class="spinner"></div></div></div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<script>
(() => {
${js}
})();
</script>
`;
writeFileSync(join(aqui, 'notas-giba.html'), html);
console.log(`artifact/notas-giba.html: ${(html.length / 1024).toFixed(0)} KB`);

// ---------- versão de link aberto (GitHub Pages): ../docs ----------
const docs = join(raiz, '..', 'docs');
mkdirSync(join(docs, 'vendor', 'pdfjs'), { recursive: true });
// kit de sincronização (Firebase + QR Code), carregado só quando a sincronização está ligada
execFileSync(join(raiz, 'node_modules', '.bin', 'esbuild'), [join(raiz, 'web', 'sync-entrada.js'), '--bundle', '--minify', '--format=iife', '--platform=browser', '--target=es2020', '--log-level=warning', `--outfile=${join(docs, 'vendor', 'sync.js')}`], { stdio: 'inherit' });
for (const f of ['pdf.min.js', 'pdf.worker.min.js']) copyFileSync(join(raiz, 'node_modules', 'pdfjs-dist', 'build', f), join(docs, 'vendor', 'pdfjs', f));
copyFileSync(join(raiz, 'public', 'icone.svg'), join(docs, 'icone.svg'));
writeFileSync(join(docs, '.nojekyll'), '');
writeFileSync(
  join(docs, 'manifest.webmanifest'),
  JSON.stringify({ name: 'Notas do Giba', short_name: 'Notas Giba', start_url: './', display: 'standalone', background_color: '#f4f6f5', theme_color: '#0f7a5c', lang: 'pt-BR', icons: [{ src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] }, null, 2),
);
const corte = html.indexOf('<div id="raiz">');
const cabeca = html.slice(0, corte).replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '').replace('<meta name="theme-color" content="#0f7a5c">\n', '').replace(/<link rel="preconnect"[^>]*>\n/g, '').replace(/<link href="https:\/\/fonts\.googleapis[^>]*>\n/, '');
const corpo = html.slice(corte).replace('<script>', `<script>window.__PDFJS_BASE = "vendor/pdfjs/"; window.__FIREBASE_CONFIG = ${existsSync(join(raiz, 'web', 'firebase-config.json')) ? ler('web/firebase-config.json').trim() : 'null'};</script>\n<script>\n${ler('web/local.js')}\n</script>\n<script>`);
const web = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Notas fiscais, preço de venda e encomendas dos clientes, com aviso pronto no WhatsApp.">
<meta name="theme-color" content="#0f7a5c">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Notas do Giba">
<meta name="robots" content="noindex">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icone.svg">
${cabeca}<style>html{padding-top:env(safe-area-inset-top,0px)}body{margin:0}</style>
</head>
<body>
${corpo}</body>
</html>
`;
const versao = createHash('sha1').update(web).digest('hex').slice(0, 10);
const comSW = web.replace('</body>', `<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>\n</body>`);
writeFileSync(join(docs, 'index.html'), comSW);
// service worker: guarda o site no aparelho (abre na hora, até sem internet) e busca a versão nova quando há conexão
writeFileSync(
  join(docs, 'sw.js'),
  `const CACHE = 'notas-${versao}';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icone.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')) {
    // página: tenta a internet primeiro (versão nova); sem conexão, usa a guardada
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./'))));
    return;
  }
  // demais arquivos (leitor de PDF, ícone): usa o guardado e atualiza em segundo plano
  e.respondWith(caches.match(e.request).then((r) => { const rede = fetch(e.request).then((n) => { const c = n.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, c)); return n; }); return r || rede; }));
});
`,
);
console.log(`docs/index.html: ${(web.length / 1024).toFixed(0)} KB`);
