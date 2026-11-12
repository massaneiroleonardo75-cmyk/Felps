// Junta o site num único arquivo HTML para publicar como Artifact no claude.ai.
// Uso: node artifact/build.mjs  ->  artifact/notas-giba.html
import { readFileSync, writeFileSync } from 'node:fs';
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
