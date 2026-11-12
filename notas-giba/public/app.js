import * as C from './calc.js';
import { semelhanca, LIMITE } from './combinar.js';

// ============================================================
// utilidades
// ============================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const R = C.reais;
const dataBR = (iso) => {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return d ? `${d}/${m}/${a}` : iso;
};
const dataHoraBR = (s) => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'));
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const pct = (v) => `${C.numeroBR(v, 1)}%`;
const campoNum = (v) => (v === null || v === undefined || v === '' ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ','));
const iniciais = (nome) =>
  String(nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

const P = {
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>',
  casa: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
  nota: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  caixa: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  seta: '<path d="m15 18-6-6 6-6"/>',
  setaDir: '<path d="m9 18 6-6-6-6"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  imagem: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  lapis: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  lixo: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  luz: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  quadro: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>',
  folhas: '<path d="M8 2h10a2 2 0 0 1 2 2v14M4 6h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4z"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  desfazer: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  grafico: '<path d="M3 3v18h18M7 16v-4M12 16V8M17 16v-7"/>',
  carteira: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  sacola: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  tendencia: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  xml: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  whats:
    '<path fill="currentColor" stroke="none" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2m5.8 14.01c-.24.68-1.43 1.32-1.97 1.37-.5.05-.98.24-3.3-.69-2.79-1.1-4.56-3.95-4.7-4.13-.13-.18-1.12-1.49-1.12-2.85s.71-2.02.97-2.3c.25-.27.55-.34.73-.34l.53.01c.17.01.4-.06.62.48.24.56.8 1.94.86 2.08.07.14.11.3.02.48-.09.18-.14.3-.27.46l-.41.48c-.14.13-.28.28-.12.55.16.27.71 1.17 1.52 1.89 1.05.93 1.93 1.22 2.2 1.36.27.13.43.11.59-.07.16-.18.68-.8.86-1.07.18-.27.36-.23.61-.14.25.09 1.6.75 1.87.89.27.14.45.2.52.32.07.11.07.66-.17 1.31"/>',
};
const ic = (nome, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[nome] || ''}</svg>`;

// ============================================================
// estado, API e avisos
// ============================================================
const estado = { sessao: null, ajustes: null, avisar: 0, flash: null };

async function api(metodo, url, corpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
    credentials: 'same-origin',
  });
  let dados = null;
  try {
    dados = await r.json();
  } catch {}
  if (r.status === 401 && !url.endsWith('/login')) {
    estado.sessao = { ...estado.sessao, logado: false };
    telaLogin();
    throw Object.assign(new Error('Sessão expirada. Entre de novo.'), { silencioso: true });
  }
  if (!r.ok) throw Object.assign(new Error(dados?.erro || 'Erro de conexão. Tente de novo.'), { status: r.status, dados });
  return dados;
}
const GET = (u) => api('GET', u);
const POST = (u, b = {}) => api('POST', u, b);
const PUT = (u, b = {}) => api('PUT', u, b);
const DEL = (u) => api('DELETE', u);

function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 5000 : 3000);
}
const falhou = (e) => !e?.silencioso && toast(e?.message || 'Algo deu errado.', 'erro');

function modal(titulo, corpo, { rodape = '', largo = false } = {}) {
  const fundo = document.createElement('div');
  fundo.className = 'fundo-modal';
  fundo.innerHTML = `
    <div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${titulo}</h2><button class="btn fantasma icone" data-fechar aria-label="Fechar">${ic('x')}</button></div>
      <div class="modal-body">${corpo}</div>
      ${rodape ? `<div class="modal-foot">${rodape}</div>` : ''}
    </div>`;
  const fechar = () => {
    fundo.remove();
    document.removeEventListener('keydown', teclaEsc);
  };
  const teclaEsc = (e) => e.key === 'Escape' && fechar();
  document.addEventListener('keydown', teclaEsc);
  fundo.addEventListener('mousedown', (e) => e.target === fundo && fechar());
  fundo.addEventListener('click', (e) => e.target.closest('[data-fechar]') && fechar());
  document.body.append(fundo);
  setTimeout(() => fundo.querySelector('[autofocus]')?.focus(), 50);
  return { el: fundo, fechar };
}

function confirmar(titulo, texto, { botao = 'Confirmar', perigo = false } = {}) {
  return new Promise((ok) => {
    const m = modal(titulo, `<p class="muted">${texto}</p>`, {
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn ${perigo ? 'perigo' : 'primario'}" data-sim>${botao}</button>`,
    });
    let resp = false;
    m.el.querySelector('[data-sim]').onclick = () => {
      resp = true;
      m.fechar();
    };
    new MutationObserver((_, o) => {
      if (!document.body.contains(m.el)) {
        o.disconnect();
        ok(resp);
      }
    }).observe(document.body, { childList: true });
  });
}

function verImagem(src) {
  const v = document.createElement('div');
  v.className = 'visualizador';
  v.innerHTML = `<img src="${esc(src)}" alt="Nota fiscal" />`;
  v.onclick = () => v.remove();
  document.body.append(v);
}

async function comBotao(btn, fn) {
  const txt = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner peq"></span>';
  try {
    return await fn();
  } catch (e) {
    falhou(e);
  } finally {
    if (document.body.contains(btn)) {
      btn.disabled = false;
      btn.innerHTML = txt;
    }
  }
}

// ============================================================
// saudação do Giba
// ============================================================
function saudacao() {
  const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }));
  const periodo = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const nomes = ['Giba', 'Gilberto', 'Beto'];
  const nome = nomes[Math.floor(Math.random() * nomes.length)];
  const formas = [`${periodo}, ${nome}!`, `Olá, ${nome}!`, `${periodo}, ${nome}!`, `E aí, ${nome}!`, `Fala, ${nome}!`];
  const frases = [
    'Bora fazer negócio hoje?',
    'Vamos ver como estão as encomendas.',
    'Pronto pra mais uma venda?',
    'Chegou mercadoria? Manda a foto da nota.',
    'Tudo organizado por aqui. É só conferir.',
    'Que hoje seja dia de lucro! 💰',
  ];
  return { titulo: `${formas[Math.floor(Math.random() * formas.length)]} 👋`, frase: frases[Math.floor(Math.random() * frases.length)] };
}

// ============================================================
// WhatsApp
// ============================================================
function agruparPorContato(encs) {
  const grupos = new Map();
  for (const e of encs) {
    if (!grupos.has(e.contato_id)) grupos.set(e.contato_id, { id: e.contato_id, nome: e.contato_nome, telefone: e.contato_telefone, encs: [] });
    grupos.get(e.contato_id).encs.push(e);
  }
  return [...grupos.values()];
}

function mensagemPara(nome, encs) {
  return C.montarMensagem(estado.ajustes?.mensagem, {
    nome,
    loja: estado.ajustes?.nome_loja,
    itens: encs.map((e) => ({ produto: e.produto, quantidade: e.quantidade, valorUnit: e.valor_unit })),
  });
}

// Botão verde: abre o WhatsApp com a mensagem pronta e marca como "avisado".
function botaoWhats(contato, encs, { rotulo = 'Enviar no WhatsApp', classe = '' } = {}) {
  if (!contato.telefone) {
    return `<button class="btn ${classe}" data-sem-telefone="${contato.id}">${ic('lapis', 'sm')} Adicionar telefone</button>`;
  }
  const texto = mensagemPara(contato.nome, encs);
  const ids = encs.filter((e) => e.status === 'chegou').map((e) => e.id);
  return `<a class="btn wa ${classe}" href="${esc(C.linkWhatsApp(contato.telefone, texto))}" target="_blank" rel="noopener" data-avisar="${ids.join(',')}">${ic('whats')} ${rotulo}</a>`;
}

function whatsMini(contato, encs) {
  if (!contato.telefone) return '';
  const ids = encs.filter((e) => e.status === 'chegou').map((e) => e.id);
  return `<a class="wa-mini" title="Avisar no WhatsApp" href="${esc(C.linkWhatsApp(contato.telefone, mensagemPara(contato.nome, encs)))}" target="_blank" rel="noopener" data-avisar="${ids.join(',')}">${ic('whats', 'sm')}</a>`;
}

document.addEventListener('click', async (e) => {
  const wa = e.target.closest('[data-avisar]');
  if (wa) {
    const ids = wa.dataset.avisar.split(',').filter(Boolean).map(Number);
    if (ids.length) {
      setTimeout(async () => {
        try {
          await POST('/api/encomendas/status', { ids, status: 'avisado' });
          toast('Marcado como avisado ✓');
          atualizarBadge();
          render();
        } catch (err) {
          falhou(err);
        }
      }, 400);
    }
    return;
  }
  const semTel = e.target.closest('[data-sem-telefone]');
  if (semTel) {
    const c = await GET(`/api/contatos/${semTel.dataset.semTelefone}`).catch(falhou);
    if (c) formContato(c, () => render());
  }
});

// ============================================================
// login e estrutura
// ============================================================
function telaLogin() {
  $('#raiz').innerHTML = `
    <div class="login">
      <form class="card" id="form-login">
        <div class="logo"><span class="marca">G</span> Notas do Giba</div>
        <p class="muted" style="text-align:center;margin-bottom:20px">Entre para ver suas notas e encomendas.</p>
        <label class="campo">Senha
          <input type="password" name="senha" autocomplete="current-password" required autofocus />
        </label>
        <button class="btn primario grande bloco" style="margin-top:16px">Entrar</button>
      </form>
    </div>`;
  const f = $('#form-login');
  f.senha.focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    await comBotao(f.querySelector('button'), async () => {
      await POST('/api/login', { senha: f.senha.value });
      await iniciar();
    });
  };
}

const MENU = [
  { rota: '/', nome: 'Início', icone: 'casa' },
  { rota: '/notas', nome: 'Notas fiscais', curto: 'Notas', icone: 'nota' },
  { rota: '/encomendas', nome: 'Encomendas', icone: 'caixa', badge: true },
  { rota: '/contatos', nome: 'Clientes', icone: 'pessoas' },
  { rota: '/ajustes', nome: 'Ajustes', icone: 'ajustes' },
];

function montarEstrutura() {
  $('#raiz').innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <a href="#/" class="logo" style="text-decoration:none"><span class="marca">G</span><span>Notas do Giba<small>Compras & encomendas</small></span></a>
        <a href="#/enviar" class="btn primario cta">${ic('camera')} Enviar nota fiscal</a>
        ${MENU.map((m) => `<a class="nav-link" href="#${m.rota}" data-rota="${m.rota}">${ic(m.icone)} ${m.nome}${m.badge ? '<span class="badge num-alerta hidden" data-badge></span>' : ''}</a>`).join('')}
        <div class="rodape tiny">${estado.sessao.ia ? '✓ Leitura automática ativa' : '⚠ Leitura de fotos desativada'}</div>
      </aside>
      <header class="topo-mobile">
        <a href="#/" class="logo" style="text-decoration:none"><span class="marca">G</span> Notas do Giba</a>
        <a href="#/ajustes" class="btn fantasma icone" aria-label="Ajustes">${ic('ajustes')}</a>
      </header>
      <main class="main"><div class="conteudo" id="pagina"></div></main>
      <nav class="bottom-nav">
        <a href="#/" data-rota="/">${ic('casa')}Início</a>
        <a href="#/notas" data-rota="/notas">${ic('nota')}Notas</a>
        <a href="#/enviar" data-rota="/enviar" aria-label="Fotografar nota"><span class="camera">${ic('camera')}</span></a>
        <a href="#/encomendas" data-rota="/encomendas">${ic('caixa')}Encomendas<span class="badge num-alerta hidden" data-badge></span></a>
        <a href="#/contatos" data-rota="/contatos">${ic('pessoas')}Clientes</a>
      </nav>
    </div>`;
  window.addEventListener('scroll', () => $('.topo-mobile')?.classList.toggle('sombra', scrollY > 4), { passive: true });
}

async function atualizarBadge() {
  try {
    const l = await GET('/api/encomendas?status=chegou');
    estado.avisar = l.length;
    $$('[data-badge]').forEach((b) => {
      b.textContent = l.length;
      b.classList.toggle('hidden', !l.length);
    });
  } catch {}
}

// ============================================================
// roteador
// ============================================================
const ROTAS = [
  [/^\/$/, paginaInicio],
  [/^\/enviar$/, paginaEnviar],
  [/^\/notas$/, paginaNotas],
  [/^\/notas\/nova$/, paginaNotaManual],
  [/^\/notas\/(\d+)$/, paginaNota],
  [/^\/encomendas$/, paginaEncomendas],
  [/^\/contatos$/, paginaContatos],
  [/^\/contatos\/(\d+)$/, paginaContato],
  [/^\/ajustes$/, paginaAjustes],
];
let rotaAtual = null;

async function render() {
  if (!estado.sessao?.logado) return;
  const caminho = (location.hash.slice(1) || '/').split('?')[0];
  const mudou = caminho !== rotaAtual;
  rotaAtual = caminho;
  $$('[data-rota]').forEach((a) => {
    const r = a.dataset.rota;
    a.classList.toggle('ativo', r === '/' ? caminho === '/' : caminho.startsWith(r));
  });
  const pag = $('#pagina');
  for (const [re, fn] of ROTAS) {
    const m = caminho.match(re);
    if (m) {
      if (mudou) {
        pag.innerHTML = '<div style="padding:60px;display:grid;place-items:center"><div class="spinner"></div></div>';
        scrollTo(0, 0);
      }
      try {
        await fn(pag, ...m.slice(1));
      } catch (e) {
        falhou(e);
        if (e.status === 404) pag.innerHTML = vazio('alerta', 'Não encontrado', 'Esse registro não existe mais.');
      }
      return;
    }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', render);

const vazio = (icone, titulo, texto, acao = '') =>
  `<div class="vazio">${ic(icone)}<h3>${titulo}</h3><p>${texto}</p>${acao ? `<div style="margin-top:16px">${acao}</div>` : ''}</div>`;

const badgeStatus = (s) => {
  const nomes = { aguardando: 'Aguardando chegar', chegou: 'Chegou · avisar', avisado: 'Avisado', entregue: 'Entregue', cancelada: 'Cancelada' };
  return `<span class="badge st-${s}">${nomes[s] || s}</span>`;
};

// ============================================================
// INÍCIO
// ============================================================
let periodoPainel = 'mes';
const PERIODOS = { mes: 'Este mês', mes_passado: 'Mês passado', '30d': '30 dias', ano: 'Este ano', tudo: 'Tudo' };

async function paginaInicio(pag) {
  const p = await GET(`/api/painel?periodo=${periodoPainel}`);
  const s = saudacao();
  const grupos = agruparPorContato(p.avisar);
  const max = Math.max(1, ...p.meses.map((m) => Math.max(m.investido, m.venda)));
  const nomeMes = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');

  pag.innerHTML = `
    <div class="saudacao">
      <div><h1>${esc(s.titulo)}</h1><p class="sub">${esc(s.frase)}</p></div>
      <a href="#/encomendas?nova=1" class="btn so-desktop">${ic('mais')} Nova encomenda</a>
    </div>

    <a href="#/enviar" class="cta-foto">
      <span class="ic">${ic('camera')}</span>
      <span class="cresce"><strong>Fotografar nota fiscal</strong><span>A gente lê os itens, calcula o preço e acha de quem é a encomenda.</span></span>
      ${ic('setaDir')}
    </a>

    ${
      grupos.length
        ? `<section class="secao">
        <div class="titulo"><h2>📣 Avisar clientes <span class="badge st-chegou">${p.avisar.length}</span></h2><span class="tiny">Encomendas que chegaram e ainda não foram avisadas</span></div>
        <div class="card lista">${grupos.map(cartaoAviso).join('')}</div>
      </section>`
        : ''
    }

    <section class="secao">
      <div class="titulo"><h2>Resumo</h2>
        <div class="chips rolagem">${Object.entries(PERIODOS).map(([k, v]) => `<button class="chip ${k === periodoPainel ? 'ativo' : ''}" data-periodo="${k}">${v}</button>`).join('')}</div>
      </div>
      <div class="grid kpis">
        <div class="card kpi"><div class="rotulo">${ic('carteira', 'sm')} Investido</div><div class="valor">${R(p.investido)}</div><div class="det">${p.notas} nota${p.notas === 1 ? '' : 's'} no período</div></div>
        <div class="card kpi"><div class="rotulo">${ic('sacola', 'sm')} Valor de venda</div><div class="valor">${R(p.venda_prevista)}</div><div class="det">com as suas porcentagens</div></div>
        <div class="card kpi destaque"><div class="rotulo">${ic('tendencia', 'sm')} Retorno previsto</div><div class="valor">${R(p.lucro_previsto)}</div><div class="det">${p.venda_prevista ? `margem de ${pct((p.lucro_previsto / p.venda_prevista) * 100)}` : 'sem vendas no período'}</div></div>
        <div class="card kpi"><div class="rotulo">${ic('check', 'sm')} Já vendido</div><div class="valor">${R(p.vendido)}</div><div class="det">lucro realizado ${R(p.lucro_realizado)}</div></div>
      </div>
    </section>

    <div class="grid duas secao">
      <div class="card">
        <div class="card-head"><h3>Encomendas em aberto</h3><a href="#/encomendas" class="small">Ver todas</a></div>
        <div class="card-body">
          <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:10px">
            ${[
              ['aguardando', 'Aguardando', p.encomendas.aguardando, 'relogio'],
              ['chegou', 'Avisar', p.encomendas.chegou, 'alerta'],
              ['avisado', 'P/ retirar', p.encomendas.avisado, 'caixa'],
            ]
              .map(
                ([st, n, q, i]) => `<a href="#/encomendas?status=${st}" class="card pad" style="text-decoration:none;color:inherit;text-align:center;padding:14px 8px;box-shadow:none">
                <div class="badge st-${st}" style="margin-bottom:6px">${ic(i, 'sm')}</div>
                <div style="font-size:24px;font-weight:750" class="num">${q}</div><div class="tiny">${n}</div></a>`,
              )
              .join('')}
          </div>
          ${
            p.retirar.length
              ? `<h3 style="margin:18px 0 8px">Avisados, esperando retirar</h3>
            <div class="pilha">${p.retirar
              .slice(0, 5)
              .map(
                (e) => `<div class="linha entre"><div class="cresce"><div class="ellipsis"><strong>${esc(e.contato_nome)}</strong> · ${esc(e.produto)}</div><div class="tiny">avisado ${dataHoraBR(e.avisado_em)}${e.valor_total != null ? ` · ${R(e.valor_total)}` : ''}</div></div>
                <button class="btn peq" data-entregar="${e.id}">${ic('check', 'sm')} Entregue</button></div>`,
              )
              .join('')}</div>`
              : ''
          }
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Últimos 6 meses</h3><div class="legenda"><span><i style="background:var(--border-strong)"></i>Investido</span><span><i style="background:var(--brand)"></i>Venda</span></div></div>
        <div class="card-body">
          <div class="grafico">
            ${p.meses
              .map(
                (m) => `<div class="col" title="${nomeMes(m.mes)}: investido ${R(m.investido)} · venda ${R(m.venda)} · retorno ${R(m.lucro)}">
                <div class="barras"><div class="b inv" style="height:${(m.investido / max) * 100}%"></div><div class="b ven" style="height:${(m.venda / max) * 100}%"></div></div>
                <div class="mes">${nomeMes(m.mes)}</div></div>`,
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>

    <section class="secao">
      <div class="titulo"><h2>Notas recentes</h2><a href="#/notas" class="small">Ver todas</a></div>
      ${p.recentes.length ? `<div class="card lista">${p.recentes.map(linhaNota).join('')}</div>` : `<div class="card">${vazio('nota', 'Nenhuma nota ainda', 'Envie a foto da primeira nota fiscal para começar.', `<a class="btn primario" href="#/enviar">${ic('camera')} Enviar nota</a>`)}</div>`}
    </section>`;

  $$('[data-periodo]', pag).forEach((b) => (b.onclick = () => ((periodoPainel = b.dataset.periodo), render())));
  $$('[data-entregar]', pag).forEach(
    (b) =>
      (b.onclick = () =>
        comBotao(b, async () => {
          await POST('/api/encomendas/status', { ids: [Number(b.dataset.entregar)], status: 'entregue' });
          toast('Encomenda entregue ✓');
          render();
        })),
  );
  atualizarBadge();
}

function cartaoAviso(g) {
  const total = g.encs.reduce((s, e) => s + (e.valor_total || 0), 0);
  return `<div class="aviso-cliente">
    <a href="#/contatos/${g.id}" class="avatar" style="text-decoration:none">${esc(iniciais(g.nome))}</a>
    <div class="cresce">
      <div class="linha entre"><strong>${esc(g.nome)}</strong><span class="tiny">${esc(C.formatarTelefone(g.telefone)) || 'sem telefone'}</span></div>
      <ul class="itens">${g.encs
        .map(
          (e) => `<li><span class="ellipsis">${C.numeroBR(e.quantidade, 3)}× ${esc(e.produto)}${e.nota_id ? ` <a class="tiny" href="#/notas/${e.nota_id}">(nota ${esc(e.nota_numero || '#' + e.nota_id)})</a>` : ''}</span><span class="num">${e.valor_total != null ? R(e.valor_total) : '—'}</span></li>`,
        )
        .join('')}</ul>
      ${g.encs.length > 1 ? `<div class="linha entre small" style="margin-top:4px"><span>Total</span><strong class="num">${R(total)}</strong></div>` : ''}
    </div>
    <div class="acoes">${botaoWhats(g, g.encs, { rotulo: 'Avisar' })}</div>
  </div>`;
}

function linhaNota(n) {
  return `<a class="lista-item" href="#/notas/${n.id}">
    <span class="avatar" style="border-radius:12px">${ic('nota')}</span>
    <span class="cresce">
      <span class="linha" style="gap:8px"><strong class="ellipsis">${esc(n.emitente_nome || 'Fornecedor não identificado')}</strong>${n.para_avisar ? `<span class="badge st-chegou">${n.para_avisar} p/ avisar</span>` : ''}</span>
      <span class="tiny ellipsis" style="display:block">${n.numero ? `Nº ${esc(n.numero)} · ` : ''}${dataBR(n.data_emissao) || dataHoraBR(n.criado_em)} · ${n.itens} ite${n.itens === 1 ? 'm' : 'ns'}${n.primeiro_item ? ` · ${esc(n.primeiro_item)}` : ''}</span>
    </span>
    <span style="text-align:right" class="num"><strong>${R(n.investido)}</strong><span class="tiny" style="display:block">venda ${R(n.venda)}</span></span>
  </a>`;
}

// ============================================================
// ENVIAR NOTA (foto / PDF / XML)
// ============================================================
let envio = [];

async function prepararArquivo(file) {
  const nome = file.name || 'arquivo';
  if (/xml/.test(file.type) || /\.xml$/i.test(nome)) {
    return { nome, tipo: 'text/xml', base64: await paraBase64(file), rotulo: 'XML' };
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(nome)) {
    if (file.size > 25 * 1024 * 1024) throw new Error('PDF grande demais (máx. 25 MB).');
    return { nome, tipo: 'application/pdf', base64: await paraBase64(file), rotulo: 'PDF' };
  }
  // Foto: reduz e comprime no próprio celular (envio rápido, mesmo com 4G fraco)
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await new Promise((ok, erro) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => erro(new Error(`Não consegui abrir "${nome}". Envie em JPG ou PNG.`));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width;
  const h = bmp.height;
  const escala = Math.min(1, 2400 / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * escala);
  cv.height = Math.round(h * escala);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  const dataUrl = cv.toDataURL('image/jpeg', 0.86);
  return { nome: nome.replace(/\.\w+$/, '') + '.jpg', tipo: 'image/jpeg', base64: dataUrl.split(',')[1], preview: dataUrl };
}

const paraBase64 = (file) =>
  new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => erro(new Error('Não consegui ler o arquivo.'));
    r.readAsDataURL(file);
  });

async function paginaEnviar(pag) {
  const semIA = !estado.sessao.ia;
  pag.innerHTML = `
    <div class="cabecalho"><div><h1>Enviar nota fiscal</h1><p class="sub">Tire uma foto da nota (ou mande o PDF/XML). Se a nota tiver mais de uma página, adicione todas.</p></div></div>
    ${semIA ? `<div class="alerta aviso" style="margin-bottom:16px">${ic('alerta')}<div><strong>Leitura de fotos desativada.</strong> Falta configurar a chave da IA no servidor. Enquanto isso, envie o <b>XML</b> da nota ou <a href="#/notas/nova">cadastre manualmente</a>.</div></div>` : ''}
    <div class="zona-envio" id="zona">
      <div class="ic-grande">${ic('camera')}</div>
      <h2>Fotografe a nota fiscal</h2>
      <p class="muted" style="margin-top:6px">Também aceita PDF ou o arquivo XML da NF-e.</p>
      <div class="botoes">
        <button class="btn primario grande" id="bt-camera">${ic('camera')} Tirar foto</button>
        <button class="btn grande" id="bt-arquivo">${ic('upload')} Escolher arquivo</button>
      </div>
      <input type="file" id="in-camera" accept="image/*" capture="environment" hidden />
      <input type="file" id="in-arquivo" accept="image/*,application/pdf,.pdf,.xml,text/xml,application/xml" multiple hidden />
      <p class="tiny so-desktop" style="margin-top:14px">Ou arraste os arquivos para cá.</p>
    </div>
    <div id="lista-envio"></div>
    <div class="dicas">
      <div>${ic('luz')}<span><b>Boa luz</b>, sem sombra e sem flash estourando.</span></div>
      <div>${ic('quadro')}<span><b>Nota inteira</b> na foto, reta e sem cortar os valores.</span></div>
      <div>${ic('folhas')}<span><b>Várias páginas?</b> Tire uma foto de cada e envie juntas.</span></div>
    </div>
    <p class="small muted" style="margin-top:20px;text-align:center">Prefere digitar? <a href="#/notas/nova">Cadastrar nota manualmente</a></p>`;

  const adicionar = async (files) => {
    for (const f of files) {
      try {
        const a = await prepararArquivo(f);
        if (a.tipo === 'text/xml') envio = [a];
        else envio = envio.filter((x) => x.tipo !== 'text/xml').concat(a);
      } catch (e) {
        falhou(e);
      }
    }
    if (envio.length > 8) {
      envio = envio.slice(0, 8);
      toast('Máximo de 8 fotos por nota.', 'erro');
    }
    desenharLista();
  };

  const desenharLista = () => {
    const el = $('#lista-envio');
    if (!envio.length) return (el.innerHTML = '');
    const temXml = envio.some((a) => a.tipo === 'text/xml');
    el.innerHTML = `
      <div class="card pad secao">
        <div class="linha entre"><h3>${envio.length} arquivo${envio.length > 1 ? 's' : ''} pronto${envio.length > 1 ? 's' : ''}</h3>
          ${temXml ? '' : `<button class="btn peq" id="bt-mais">${ic('mais', 'sm')} Adicionar página</button>`}</div>
        <div class="miniaturas">
          ${envio
            .map(
              (a, i) => `<div class="mini">${a.preview ? `<img src="${a.preview}" alt="">` : `<div class="tipo">${a.rotulo}<small>${esc(a.nome)}</small></div>`}
              <button class="remover" data-rem="${i}" aria-label="Remover">${ic('x', 'sm')}</button>${envio.length > 1 ? `<span class="pag">pág. ${i + 1}</span>` : ''}</div>`,
            )
            .join('')}
        </div>
        <button class="btn primario grande bloco" id="bt-ler" style="margin-top:18px" ${!temXml && semIA ? 'disabled' : ''}>${ic('check')} ${temXml ? 'Importar nota' : 'Ler nota fiscal'}</button>
      </div>`;
    $$('[data-rem]', el).forEach((b) => (b.onclick = () => (envio.splice(Number(b.dataset.rem), 1), desenharLista())));
    $('#bt-mais', el)?.addEventListener('click', () => $('#in-camera').click());
    $('#bt-ler', el).onclick = enviar;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const enviar = async () => {
    const etapas = ['Enviando a nota…', 'Lendo os itens…', 'Conferindo os valores…', 'Procurando encomendas dos clientes…', 'Quase lá…'];
    const ov = document.createElement('div');
    ov.className = 'lendo';
    ov.innerHTML = `<div class="caixa"><div class="spinner"></div><h2>Lendo a nota fiscal</h2><p class="etapa">${etapas[0]}</p><p class="tiny" style="margin-top:10px">Pode levar alguns segundos.</p></div>`;
    document.body.append(ov);
    let k = 0;
    const t = setInterval(() => {
      k = Math.min(k + 1, etapas.length - 1);
      $('.etapa', ov).textContent = etapas[k];
    }, 3500);
    try {
      const r = await POST('/api/notas/ler', { arquivos: envio.map(({ nome, tipo, base64 }) => ({ nome, tipo, base64 })) });
      envio = [];
      estado.flash = { nota: r.id, vinculadas: r.vinculadas };
      location.hash = `#/notas/${r.id}`;
    } catch (e) {
      if (e.status === 409 && e.dados?.nota_id) {
        toast('Essa nota já estava cadastrada. Abrindo…');
        envio = [];
        location.hash = `#/notas/${e.dados.nota_id}`;
      } else falhou(e);
    } finally {
      clearInterval(t);
      ov.remove();
    }
  };

  $('#bt-camera').onclick = () => $('#in-camera').click();
  $('#bt-arquivo').onclick = () => $('#in-arquivo').click();
  $('#in-camera').onchange = (e) => (adicionar([...e.target.files]), (e.target.value = ''));
  $('#in-arquivo').onchange = (e) => (adicionar([...e.target.files]), (e.target.value = ''));
  const zona = $('#zona');
  zona.ondragover = (e) => (e.preventDefault(), zona.classList.add('arrastando'));
  zona.ondragleave = () => zona.classList.remove('arrastando');
  zona.ondrop = (e) => {
    e.preventDefault();
    zona.classList.remove('arrastando');
    adicionar([...e.dataTransfer.files]);
  };
  desenharLista();
}

// ============================================================
// LISTA DE NOTAS
// ============================================================
async function paginaNotas(pag) {
  pag.innerHTML = `
    <div class="cabecalho">
      <div><h1>Notas fiscais</h1><p class="sub">Tudo o que você comprou, com custo, preço de venda e retorno.</p></div>
      <div class="linha"><a class="btn" href="#/notas/nova">${ic('lapis', 'sm')} Digitar nota</a><a class="btn primario" href="#/enviar">${ic('camera')} Enviar nota</a></div>
    </div>
    <div class="linha" style="margin-bottom:14px"><label class="busca">${ic('busca')}<input type="search" id="busca" placeholder="Buscar fornecedor, número ou produto…" /></label></div>
    <div id="lista"></div>`;
  const carregar = async () => {
    const b = $('#busca').value.trim();
    const notas = await GET(`/api/notas${b ? `?busca=${encodeURIComponent(b)}` : ''}`);
    const el = $('#lista');
    if (!el) return;
    if (!notas.length) {
      el.innerHTML = `<div class="card">${b ? vazio('busca', 'Nada encontrado', 'Tente outra palavra.') : vazio('nota', 'Nenhuma nota ainda', 'Envie a foto da primeira nota fiscal.', `<a class="btn primario" href="#/enviar">${ic('camera')} Enviar nota</a>`)}</div>`;
      return;
    }
    const tot = notas.reduce((a, n) => ({ inv: a.inv + n.investido, ven: a.ven + n.venda }), { inv: 0, ven: 0 });
    el.innerHTML = `
      <div class="card so-desktop rolagem-x">
        <table class="tabela">
          <thead><tr><th>Data</th><th>Fornecedor</th><th>Nº</th><th class="dir">Itens</th><th class="dir">Investido</th><th class="dir">Venda</th><th class="dir">Retorno</th><th>Encomendas</th></tr></thead>
          <tbody>${notas
            .map(
              (n) => `<tr class="clicavel" data-ir="#/notas/${n.id}">
              <td class="num">${dataBR(n.data_emissao) || dataHoraBR(n.criado_em)}</td>
              <td><strong>${esc(n.emitente_nome || '—')}</strong><div class="tiny ellipsis" style="max-width:320px">${esc(n.primeiro_item || '')}</div></td>
              <td>${esc(n.numero || '—')}</td>
              <td class="dir num">${n.itens}</td>
              <td class="dir num">${R(n.investido)}</td>
              <td class="dir num">${R(n.venda)}</td>
              <td class="dir num lucro-pos">${R(n.lucro)}</td>
              <td>${n.para_avisar ? `<span class="badge st-chegou">${n.para_avisar} p/ avisar</span>` : n.encomendas ? `<span class="badge">${n.encomendas}</span>` : '<span class="tiny">—</span>'}</td>
            </tr>`,
            )
            .join('')}</tbody>
          <tfoot><tr><td colspan="4" class="tiny" style="padding:12px">${notas.length} nota${notas.length > 1 ? 's' : ''}</td><td class="dir num"><strong>${R(tot.inv)}</strong></td><td class="dir num"><strong>${R(tot.ven)}</strong></td><td class="dir num lucro-pos"><strong>${R(tot.ven - tot.inv)}</strong></td><td></td></tr></tfoot>
        </table>
      </div>
      <div class="card lista so-mobile">${notas.map(linhaNota).join('')}</div>`;
    $$('[data-ir]', el).forEach((tr) => (tr.onclick = () => (location.hash = tr.dataset.ir)));
  };
  $('#busca').oninput = debounce(carregar, 250);
  await carregar();
}

// ============================================================
// NOTA (detalhe, porcentagens e encomendas)
// ============================================================
async function paginaNota(pag, id) {
  const nota = await GET(`/api/notas/${id}`);
  const modo = estado.ajustes.arredondamento;
  const flash = estado.flash?.nota === Number(id) ? estado.flash : null;
  estado.flash = null;

  const recalc = () => C.resumoNota(nota, nota.itens, modo);
  let r = recalc();
  const vinculadas = nota.itens.flatMap((i) => i.encomendas);
  const abertas = vinculadas.filter((e) => ['chegou', 'avisado'].includes(e.status));
  const grupos = agruparPorContato(abertas);
  const despesas = nota.valor_total - nota.itens.reduce((s, i) => s + i.valor_total, 0);

  const pessoasDoItem = (item) => {
    const usados = item.encomendas.reduce((s, e) => s + e.quantidade, 0);
    return `<div class="para-quem">
      ${item.encomendas
        .map(
          (e) => `<span class="pessoa st-${e.status}" title="${esc(e.produto)} · ${badgeStatusTexto(e.status)}">
          <a href="#/contatos/${e.contato_id}" style="color:inherit">${esc(C.primeiroNome(e.contato_nome))}${e.quantidade !== 1 ? ` · ${C.numeroBR(e.quantidade, 3)}` : ''}</a>
          ${e.status === 'entregue' ? ic('check', 'sm') : whatsMini({ id: e.contato_id, nome: e.contato_nome, telefone: e.contato_telefone }, [e])}
          <button data-desvincular="${e.id}" title="Tirar desta nota">${ic('x', 'sm')}</button></span>`,
        )
        .join('')}
      ${usados + 1e-9 < item.quantidade ? `<button class="add-pessoa" data-para-quem="${item.id}">${ic('mais', 'sm')} Para quem é?</button>` : ''}
    </div>`;
  };

  pag.innerHTML = `
    <a href="#/notas" class="voltar">${ic('seta', 'sm')} Notas</a>
    <div class="cabecalho">
      <div class="cresce">
        <h1>${esc(nota.emitente_nome || 'Nota fiscal')}</h1>
        <p class="sub">${[nota.numero && `Nº ${esc(nota.numero)}${nota.serie ? `/${esc(nota.serie)}` : ''}`, dataBR(nota.data_emissao), nota.emitente_cnpj && `CNPJ ${esc(nota.emitente_cnpj)}`, { foto: '📷 por foto', pdf: '📄 PDF', xml: '🧾 XML', manual: '✍️ digitada' }[nota.origem]].filter(Boolean).join(' · ')}</p>
      </div>
      <div class="linha">
        <button class="btn" id="bt-editar">${ic('lapis', 'sm')} Editar dados</button>
        <button class="btn perigo icone" id="bt-excluir" title="Excluir nota">${ic('lixo', 'sm')}</button>
      </div>
    </div>

    ${flash ? `<div class="alerta ok" style="margin-bottom:14px">${ic('check')}<div><strong>Nota cadastrada com ${nota.itens.length} ite${nota.itens.length === 1 ? 'm' : 'ns'}.</strong> ${flash.vinculadas ? `Encontrei <b>${flash.vinculadas} encomenda${flash.vinculadas > 1 ? 's' : ''}</b> de clientes nesta nota — confira abaixo e avise pelo WhatsApp.` : 'Nenhuma encomenda pendente bateu com estes itens. Use “Para quem é?” para indicar o cliente.'} Confira os valores lidos.</div></div>` : ''}
    ${nota.avisos.length ? `<div class="alerta aviso" style="margin-bottom:14px">${ic('alerta')}<div><strong>Atenção na leitura:</strong><ul>${nota.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div></div>` : ''}

    <div class="grid kpis" id="kpis"></div>

    <div class="card secao">
      <div class="controles-nota">
        <label class="campo markup-geral">Porcentagem padrão
          <span class="input-sufixo"><input id="markup-geral" inputmode="decimal" value="${campoNum(nota.markup_padrao)}" /><span>%</span></span>
        </label>
        <button class="btn" id="bt-aplicar">Aplicar a todos os itens</button>
        <label class="check" title="Espalha frete, impostos e descontos da nota no custo de cada item">
          <input type="checkbox" id="ratear" ${nota.ratear_despesas ? 'checked' : ''} />
          <span>Incluir frete/impostos no custo <span class="tiny" style="display:block">${Math.abs(despesas) >= 0.01 ? `${despesas > 0 ? '+' : '−'}${R(Math.abs(despesas))} além dos produtos` : 'nota sem despesas extras'}</span></span>
        </label>
        ${nota.arquivos.length ? `<div class="foto-nota" style="margin-left:auto">${nota.arquivos.map((a) => (a.tipo.startsWith('image/') ? `<button data-ver="/arquivos/${esc(a.arquivo)}"><img src="/arquivos/${esc(a.arquivo)}" alt="Foto da nota" loading="lazy"></button>` : `<a class="btn peq" href="/arquivos/${esc(a.arquivo)}" target="_blank">${ic(a.tipo.includes('xml') ? 'xml' : 'nota', 'sm')} ${a.tipo.includes('xml') ? 'XML' : 'PDF'}</a>`)).join('')}</div>` : ''}
      </div>

      <div class="itens-tabela rolagem-x">
        <table class="tabela">
          <thead><tr><th>Produto</th><th class="dir">Qtd</th><th class="dir">Custo un.</th><th class="dir">% em cima</th><th class="dir">Preço un.</th><th class="dir">Total venda</th><th class="dir">Retorno</th><th></th></tr></thead>
          <tbody>${r.itens
            .map(
              (i) => `<tr data-item="${i.id}">
              <td style="min-width:260px"><div class="item-desc">${esc(i.descricao)}</div><div class="item-meta">${[i.codigo && `Cód. ${esc(i.codigo)}`, `${R(i.valor_unitario)} na nota`].filter(Boolean).join(' · ')}</div>${pessoasDoItem(nota.itens.find((x) => x.id === i.id))}</td>
              <td class="dir num">${C.numeroBR(i.quantidade, 3)}${i.unidade ? ` <span class="tiny">${esc(i.unidade)}</span>` : ''}</td>
              <td class="dir num c-custo"></td>
              <td class="dir"><span class="input-sufixo c-mk-wrap"><input class="campo-tab c-markup" inputmode="decimal" /><span>%</span></span></td>
              <td class="dir"><span class="input-prefixo"><input class="campo-tab preco c-preco" inputmode="decimal" /><span>R$</span></span></td>
              <td class="dir num c-total" style="font-weight:650"></td>
              <td class="dir num c-lucro"></td>
              <td><button class="btn fantasma icone" data-menu-item="${i.id}" title="Editar item">${ic('lapis', 'sm')}</button></td>
            </tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>
      <div class="itens-cards">${r.itens
        .map(
          (i) => `<div class="item-card" data-item="${i.id}">
          <div class="linha entre" style="align-items:flex-start;flex-wrap:nowrap"><div class="cresce"><div class="item-desc">${esc(i.descricao)}</div>
          <div class="item-meta">${C.numeroBR(i.quantidade, 3)} ${esc(i.unidade || 'un')} · custo <span class="c-custo"></span> cada</div></div>
          <button class="btn fantasma icone" data-menu-item="${i.id}">${ic('lapis', 'sm')}</button></div>
          <div class="valores">
            <label>% em cima<span class="input-sufixo c-mk-wrap"><input class="c-markup" inputmode="decimal" /><span>%</span></span></label>
            <label>Preço de venda (un.)<span class="input-prefixo"><input class="c-preco" inputmode="decimal" /><span>R$</span></span></label>
          </div>
          <div class="totais"><span>Total: <strong class="c-total num"></strong></span><span>Retorno: <strong class="c-lucro num"></strong></span></div>
          ${pessoasDoItem(nota.itens.find((x) => x.id === i.id))}
        </div>`,
        )
        .join('')}</div>
      <div style="padding:12px 18px;border-top:1px solid var(--border)" class="linha entre">
        <button class="btn peq" id="bt-add-item">${ic('mais', 'sm')} Adicionar item</button>
        <button class="btn peq fantasma" id="bt-combinar" title="Procura de novo encomendas pendentes que batem com os itens">${ic('link', 'sm')} Procurar encomendas</button>
      </div>
    </div>

    ${
      grupos.length
        ? `<section class="secao"><div class="titulo"><h2>Avisar os clientes desta nota</h2><span class="tiny">Mensagem pronta com o valor de cada produto</span></div>
      <div class="card lista">${grupos.map(cartaoAviso).join('')}</div></section>`
        : ''
    }
    ${nota.observacoes ? `<div class="card pad secao"><h3>Observações</h3><p class="muted" style="margin-top:6px;white-space:pre-wrap">${esc(nota.observacoes)}</p></div>` : ''}`;

  // ---- valores ao vivo ----
  const pintarKpis = () => {
    $('#kpis').innerHTML = `
      <div class="card kpi"><div class="rotulo">${ic('carteira', 'sm')} Investido</div><div class="valor">${R(r.investido)}</div><div class="det">total da nota ${R(nota.valor_total)}</div></div>
      <div class="card kpi"><div class="rotulo">${ic('sacola', 'sm')} Valor de venda</div><div class="valor">${R(r.venda)}</div><div class="det">${nota.itens.length} ite${nota.itens.length === 1 ? 'm' : 'ns'}</div></div>
      <div class="card kpi destaque"><div class="rotulo">${ic('tendencia', 'sm')} Retorno</div><div class="valor">${R(r.lucro)}</div><div class="det">margem ${pct(r.margem)}</div></div>
      <div class="card kpi"><div class="rotulo">${ic('caixa', 'sm')} Encomendas</div><div class="valor">${vinculadas.length}</div><div class="det">${abertas.filter((e) => e.status === 'chegou').length} para avisar</div></div>`;
  };
  const pintarItem = (calc, id, exceto) => {
    $$(`[data-item="${id}"]`, pag).forEach((row) => {
      $('.c-custo', row).textContent = R(calc.custoUnit);
      const mk = $('.c-markup', row);
      const pr = $('.c-preco', row);
      if (mk !== exceto) mk.value = campoNum(calc.markup);
      if (pr !== exceto) pr.value = calc.precoUnit.toFixed(2).replace('.', ',');
      $('.c-mk-wrap', row).classList.toggle('markup-proprio', calc.markupProprio);
      $('.c-total', row).textContent = R(calc.precoTotal);
      const l = $('.c-lucro', row);
      l.textContent = R(calc.lucro);
      l.className = `c-lucro num ${calc.lucro >= 0 ? 'lucro-pos' : 'lucro-neg'}`;
    });
  };
  const pintarTudo = (exceto) => {
    r = recalc();
    r.itens.forEach((i) => pintarItem(i.calc, i.id, exceto));
    pintarKpis();
  };
  pintarTudo();

  const salvarMarkup = debounce(async (itemId, markup) => {
    try {
      await PUT(`/api/itens/${itemId}`, { markup });
    } catch (e) {
      falhou(e);
    }
  }, 500);

  $$('.c-markup', pag).forEach((inp) => {
    inp.oninput = () => {
      const id = Number(inp.closest('[data-item]').dataset.item);
      const item = nota.itens.find((x) => x.id === id);
      const v = C.lerNumero(inp.value);
      item.markup = inp.value.trim() === '' ? null : Number.isFinite(v) ? v : item.markup;
      pintarTudo(inp);
      salvarMarkup(id, item.markup);
    };
    inp.onfocus = () => inp.select();
  });
  $$('.c-preco', pag).forEach((inp) => {
    inp.oninput = () => {
      const id = Number(inp.closest('[data-item]').dataset.item);
      const item = nota.itens.find((x) => x.id === id);
      const calc = r.itens.find((x) => x.id === id).calc;
      const v = C.lerNumero(inp.value);
      if (!Number.isFinite(v) || v <= 0) return;
      item.markup = C.markupParaPreco(calc.custoUnit, v);
      pintarTudo(inp);
      salvarMarkup(id, item.markup);
    };
    inp.onfocus = () => inp.select();
    inp.onblur = () => pintarTudo();
  });

  const mg = $('#markup-geral');
  mg.onfocus = () => mg.select();
  mg.oninput = () => {
    const v = C.lerNumero(mg.value);
    if (!Number.isFinite(v)) return;
    nota.markup_padrao = v;
    pintarTudo();
    salvarPadrao(v);
  };
  const salvarPadrao = debounce((v) => PUT(`/api/notas/${id}`, { markup_padrao: v }).catch(falhou), 500);
  $('#bt-aplicar').onclick = async () => {
    const v = C.lerNumero(mg.value);
    if (!Number.isFinite(v)) return toast('Digite a porcentagem.', 'erro');
    const proprios = nota.itens.filter((i) => i.markup !== null && i.markup !== undefined).length;
    if (proprios && !(await confirmar('Aplicar a todos?', `${proprios} ite${proprios > 1 ? 'ns têm' : 'm tem'} porcentagem própria. Todos vão ficar com ${C.numeroBR(v)}%.`, { botao: 'Aplicar' }))) return;
    await POST(`/api/notas/${id}/markup`, { markup: v }).catch(falhou);
    toast(`${C.numeroBR(v)}% aplicado em todos os itens ✓`);
    render();
  };
  $('#ratear').onchange = async (e) => {
    await PUT(`/api/notas/${id}`, { ratear_despesas: e.target.checked }).catch(falhou);
    render();
  };

  // ---- ações ----
  $$('[data-ver]', pag).forEach((b) => (b.onclick = () => verImagem(b.dataset.ver)));
  $('#bt-editar').onclick = () => formCabecalhoNota(nota);
  $('#bt-excluir').onclick = async () => {
    if (!(await confirmar('Excluir esta nota?', `A nota e seus ${nota.itens.length} itens serão apagados. As encomendas ligadas voltam para “aguardando”.`, { botao: 'Excluir', perigo: true }))) return;
    await DEL(`/api/notas/${id}`).catch(falhou);
    toast('Nota excluída');
    location.hash = '#/notas';
  };
  $('#bt-add-item').onclick = () => formItem(nota, null);
  $('#bt-combinar').onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const x = await POST(`/api/notas/${id}/combinar`);
      toast(x.vinculadas ? `${x.vinculadas} encomenda(s) encontrada(s) ✓` : 'Nenhuma encomenda pendente bateu com os itens.');
      if (x.vinculadas) render();
    });
  $$('[data-menu-item]', pag).forEach((b) => (b.onclick = () => formItem(nota, nota.itens.find((i) => i.id === Number(b.dataset.menuItem)))));
  $$('[data-para-quem]', pag).forEach((b) => (b.onclick = () => paraQuem(nota, nota.itens.find((i) => i.id === Number(b.dataset.paraQuem)), r)));
  $$('[data-desvincular]', pag).forEach(
    (b) =>
      (b.onclick = async () => {
        if (!(await confirmar('Tirar o cliente deste item?', 'A encomenda volta para “aguardando chegar”.', { botao: 'Tirar' }))) return;
        await POST(`/api/encomendas/${b.dataset.desvincular}/vincular`, { item_id: null }).catch(falhou);
        render();
      }),
  );
  atualizarBadge();
}

const badgeStatusTexto = (s) => ({ aguardando: 'aguardando', chegou: 'chegou, falta avisar', avisado: 'cliente avisado', entregue: 'entregue', cancelada: 'cancelada' })[s] || s;

function formCabecalhoNota(nota) {
  const campos = [
    ['emitente_nome', 'Fornecedor', 'text', 'inteiro'],
    ['emitente_cnpj', 'CNPJ', 'text'],
    ['data_emissao', 'Data de emissão', 'date'],
    ['numero', 'Número', 'text'],
    ['serie', 'Série', 'text'],
    ['valor_total', 'Valor total da nota (R$)', 'money'],
    ['frete', 'Frete (R$)', 'money'],
    ['desconto', 'Desconto (R$)', 'money'],
    ['impostos', 'IPI / ICMS-ST (R$)', 'money'],
  ];
  const m = modal(
    'Dados da nota',
    `<form class="form-grid" id="f">
      ${campos.map(([k, n, t, cl]) => `<label class="campo ${cl || ''}">${n}<input name="${k}" ${t === 'money' ? 'inputmode="decimal"' : `type="${t}"`} value="${esc(t === 'money' ? campoNum(nota[k]) : nota[k] || '')}" /></label>`).join('')}
      <label class="campo inteiro">Chave de acesso<input name="chave" inputmode="numeric" value="${esc(nota.chave || '')}" /></label>
      <label class="campo inteiro">Observações<textarea name="observacoes">${esc(nota.observacoes || '')}</textarea></label>
    </form>`,
    { rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">Salvar</button>' },
  );
  $('#salvar', m.el).onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const f = $('#f', m.el);
      const d = Object.fromEntries(new FormData(f));
      for (const [k, , t] of campos) if (t === 'money') d[k] = C.lerNumero(d[k]) || 0;
      await PUT(`/api/notas/${nota.id}`, d);
      m.fechar();
      toast('Nota atualizada ✓');
      render();
    });
}

function formItem(nota, item) {
  const novo = !item;
  const i = item || { descricao: '', codigo: '', quantidade: 1, unidade: 'UN', valor_unitario: '', valor_total: '' };
  const m = modal(
    novo ? 'Adicionar item' : 'Editar item',
    `<form class="form-grid" id="f">
      <label class="campo inteiro">Descrição<input name="descricao" value="${esc(i.descricao)}" required autofocus /></label>
      <label class="campo">Código<input name="codigo" value="${esc(i.codigo || '')}" /></label>
      <label class="campo">Unidade<input name="unidade" value="${esc(i.unidade || '')}" /></label>
      <label class="campo">Quantidade<input name="quantidade" inputmode="decimal" value="${campoNum(i.quantidade)}" /></label>
      <label class="campo">Valor unitário (R$)<input name="valor_unitario" inputmode="decimal" value="${campoNum(i.valor_unitario)}" /></label>
      <label class="campo inteiro">Valor total do item (R$) <span class="tiny">deixe vazio para calcular (qtd × unitário)</span><input name="valor_total" inputmode="decimal" value="${campoNum(i.valor_total)}" /></label>
      ${!novo && i.markup !== null && i.markup !== undefined ? `<div class="inteiro"><button type="button" class="btn peq" id="reset-mk">${ic('desfazer', 'sm')} Voltar para a porcentagem padrão da nota (${C.numeroBR(nota.markup_padrao)}%)</button></div>` : ''}
    </form>`,
    {
      rodape: `${novo ? '' : `<button class="btn perigo" id="excluir" style="margin-right:auto">${ic('lixo', 'sm')} Excluir</button>`}<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">Salvar</button>`,
    },
  );
  const f = $('#f', m.el);
  const unit = f.valor_unitario;
  const tot = f.valor_total;
  const qtd = f.quantidade;
  const sync = () => {
    const u = C.lerNumero(unit.value);
    const q = C.lerNumero(qtd.value) || 1;
    if (Number.isFinite(u)) tot.value = campoNum(u * q);
  };
  unit.oninput = sync;
  qtd.oninput = sync;
  $('#reset-mk', m.el)?.addEventListener('click', async () => {
    await PUT(`/api/itens/${i.id}`, { markup: null }).catch(falhou);
    m.fechar();
    render();
  });
  $('#excluir', m.el)?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir item?', esc(i.descricao), { botao: 'Excluir', perigo: true }))) return;
    try {
      await DEL(`/api/itens/${i.id}`);
      m.fechar();
      render();
    } catch (e) {
      falhou(e);
    }
  });
  $('#salvar', m.el).onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const d = {
        descricao: f.descricao.value,
        codigo: f.codigo.value,
        unidade: f.unidade.value,
        quantidade: C.lerNumero(f.quantidade.value) || 1,
        valor_unitario: C.lerNumero(f.valor_unitario.value) || 0,
        valor_total: C.lerNumero(f.valor_total.value) || 0,
      };
      if (novo) await POST(`/api/notas/${nota.id}/itens`, d);
      else await PUT(`/api/itens/${i.id}`, { ...d, markup: i.markup });
      m.fechar();
      toast(novo ? 'Item adicionado ✓' : 'Item atualizado ✓');
      render();
    });
}

// Escolher o cliente de um item: encomenda pendente ou nova encomenda.
async function paraQuem(nota, item, r) {
  const pendentes = (await GET('/api/encomendas?status=aguardando')).filter((e) => !e.item_id);
  const calc = r.itens.find((x) => x.id === item.id).calc;
  const livre = item.quantidade - item.encomendas.reduce((s, e) => s + e.quantidade, 0);
  const ordenadas = pendentes
    .map((e) => ({ e, s: semelhanca(e.produto, `${item.descricao} ${item.codigo || ''}`) }))
    .sort((a, b) => b.s - a.s || String(a.e.criado_em).localeCompare(String(b.e.criado_em)));
  const m = modal(
    'Para quem é este produto?',
    `<div class="card pad" style="box-shadow:none;background:var(--surface-2)"><div class="item-desc">${esc(item.descricao)}</div>
      <div class="tiny">${C.numeroBR(livre, 3)} de ${C.numeroBR(item.quantidade, 3)} sem dono · preço ${R(calc.precoUnit)} cada</div></div>
    ${
      ordenadas.length
        ? `<h3 style="margin:18px 0 10px">Encomendas aguardando</h3>
      <div class="pilha" style="max-height:260px;overflow:auto">${ordenadas
        .map(
          ({ e, s }) => `<button class="opcao" data-enc="${e.id}"><span class="avatar">${esc(iniciais(e.contato_nome))}</span>
          <span class="cresce"><strong>${esc(e.contato_nome)}</strong><span class="tiny" style="display:block">${C.numeroBR(e.quantidade, 3)}× ${esc(e.produto)} · desde ${dataHoraBR(e.criado_em)}</span></span>
          ${s >= LIMITE ? '<span class="badge st-entregue sug">parece ser</span>' : ''}</button>`,
        )
        .join('')}</div>
      <div class="separador">ou</div>`
        : '<p class="muted small" style="margin:14px 0">Nenhuma encomenda aguardando. Cadastre o cliente abaixo.</p>'
    }
    <h3 style="margin-bottom:10px">Novo cliente para este item</h3>
    <form class="form-grid" id="f">
      <div class="inteiro">${campoCliente()}</div>
      <label class="campo">Quantidade<input name="quantidade" inputmode="decimal" value="${C.numeroBR(Math.min(1, livre) || livre, 3)}" /></label>
      <label class="campo">Valor combinado, cada <span class="tiny">(opcional)</span><span class="input-prefixo"><input name="valor_combinado" inputmode="decimal" placeholder="${campoNum(calc.precoUnit)}" /><span>R$</span></span></label>
    </form>`,
    { rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">Salvar cliente</button>' },
  );
  ligarCampoCliente(m.el);
  $$('[data-enc]', m.el).forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await POST(`/api/encomendas/${b.dataset.enc}/vincular`, { item_id: item.id });
          m.fechar();
          toast('Cliente ligado ao item ✓');
          render();
        } catch (e) {
          falhou(e);
        }
      }),
  );
  $('#salvar', m.el).onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const f = $('#f', m.el);
      const cliente = lerCampoCliente(m.el);
      const valor = C.lerNumero(f.valor_combinado.value);
      const qtd = C.lerNumero(f.quantidade.value) || 1;
      await POST('/api/encomendas', {
        ...cliente,
        produto: item.descricao,
        quantidade: qtd,
        valor_combinado: Number.isFinite(valor) ? valor * qtd : null,
        item_id: item.id,
      });
      m.fechar();
      toast('Cliente ligado ao item ✓');
      render();
    });
}

// ---- campo "cliente": busca nos contatos ou cadastra novo ----
function campoCliente(atual = null) {
  return `<div class="campo-cliente">
    <label class="campo">Cliente
      <div class="auto"><input class="cli-busca" placeholder="Digite o nome do cliente…" autocomplete="off" value="${esc(atual?.nome || '')}" ${atual ? `data-id="${atual.id}"` : ''} autofocus />
      <div class="auto-lista hidden"></div></div>
    </label>
    <div class="cli-novo hidden" style="margin-top:10px">
      <div class="alerta info small" style="margin-bottom:10px">${ic('mais', 'sm')}<span>Cliente novo — informe o WhatsApp para poder avisar.</span></div>
      <label class="campo">WhatsApp do cliente<input class="cli-tel" type="tel" inputmode="tel" placeholder="(47) 99999-9999" /></label>
    </div>
  </div>`;
}

function ligarCampoCliente(raiz) {
  const inp = $('.cli-busca', raiz);
  const lista = $('.auto-lista', raiz);
  const novo = $('.cli-novo', raiz);
  let contatos = [];
  GET('/api/contatos')
    .then((c) => (contatos = c))
    .catch(() => {});
  const mostrar = () => {
    const t = inp.value.trim().toLowerCase();
    delete inp.dataset.id;
    const achados = t ? contatos.filter((c) => c.nome.toLowerCase().includes(t) || (c.telefone || '').replace(/\D/g, '').includes(t.replace(/\D/g, '') || '§')).slice(0, 8) : contatos.slice(0, 8);
    const exato = contatos.find((c) => c.nome.toLowerCase() === t);
    if (exato) inp.dataset.id = exato.id;
    novo.classList.toggle('hidden', !t || Boolean(exato));
    lista.innerHTML = achados
      .map((c) => `<button type="button" data-id="${c.id}"><span class="avatar" style="width:30px;height:30px;font-size:12px">${esc(iniciais(c.nome))}</span><span class="cresce"><strong>${esc(c.nome)}</strong> <span class="tiny">${esc(C.formatarTelefone(c.telefone))}</span></span></button>`)
      .join('');
    lista.classList.toggle('hidden', !achados.length || Boolean(exato));
    $$('button', lista).forEach(
      (b) =>
        (b.onmousedown = (ev) => {
          ev.preventDefault();
          const c = contatos.find((x) => x.id === Number(b.dataset.id));
          inp.value = c.nome;
          inp.dataset.id = c.id;
          lista.classList.add('hidden');
          novo.classList.add('hidden');
        }),
    );
  };
  inp.oninput = mostrar;
  inp.onfocus = () => !inp.dataset.id && mostrar();
  inp.onblur = () => setTimeout(() => lista.classList.add('hidden'), 150);
}

function lerCampoCliente(raiz) {
  const inp = $('.cli-busca', raiz);
  if (inp.dataset.id) return { contato_id: Number(inp.dataset.id) };
  const nome = inp.value.trim();
  if (!nome) throw new Error('Digite o nome do cliente.');
  return { novo_contato: { nome, telefone: $('.cli-tel', raiz).value } };
}

// ============================================================
// NOTA MANUAL
// ============================================================
async function paginaNotaManual(pag) {
  let linhas = [{ descricao: '', quantidade: '1', valor_unitario: '' }];
  pag.innerHTML = `
    <a href="#/notas" class="voltar">${ic('seta', 'sm')} Notas</a>
    <div class="cabecalho"><div><h1>Digitar nota</h1><p class="sub">Para notas sem foto ou quando a leitura automática não estiver disponível.</p></div></div>
    <form id="f">
      <div class="card pad"><div class="form-grid">
        <label class="campo inteiro">Fornecedor<input name="emitente_nome" placeholder="Ex.: Distribuidora XYZ" /></label>
        <label class="campo">Número da nota<input name="numero" /></label>
        <label class="campo">Data<input name="data_emissao" type="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
        <label class="campo">Frete (R$)<input name="frete" inputmode="decimal" placeholder="0,00" /></label>
        <label class="campo">Porcentagem padrão<span class="input-sufixo"><input name="markup_padrao" inputmode="decimal" value="${campoNum(estado.ajustes.markup_padrao)}" /><span>%</span></span></label>
      </div></div>
      <div class="card secao">
        <div class="card-head"><h3>Itens</h3><span class="tiny" id="soma"></span></div>
        <div class="card-body pilha" id="linhas"></div>
        <div style="padding:0 18px 16px"><button type="button" class="btn peq" id="mais">${ic('mais', 'sm')} Adicionar item</button></div>
      </div>
      <div class="linha secao" style="justify-content:flex-end"><a class="btn" href="#/notas">Cancelar</a><button class="btn primario grande" id="salvar">${ic('check')} Salvar nota</button></div>
    </form>`;
  const desenhar = () => {
    $('#linhas').innerHTML = linhas
      .map(
        (l, i) => `<div class="form-grid" style="grid-template-columns:1fr 90px 130px 40px;align-items:end" data-l="${i}">
        <label class="campo">${i === 0 ? 'Descrição' : ''}<input data-k="descricao" value="${esc(l.descricao)}" placeholder="Produto" /></label>
        <label class="campo">${i === 0 ? 'Qtd' : ''}<input data-k="quantidade" inputmode="decimal" value="${esc(l.quantidade)}" /></label>
        <label class="campo">${i === 0 ? 'Valor un. (R$)' : ''}<input data-k="valor_unitario" inputmode="decimal" value="${esc(l.valor_unitario)}" /></label>
        <button type="button" class="btn fantasma icone" data-rem="${i}" ${linhas.length === 1 ? 'disabled' : ''}>${ic('x', 'sm')}</button>
      </div>`,
      )
      .join('');
    $$('[data-k]').forEach(
      (inp) =>
        (inp.oninput = () => {
          linhas[Number(inp.closest('[data-l]').dataset.l)][inp.dataset.k] = inp.value;
          somar();
        }),
    );
    $$('[data-rem]').forEach((b) => (b.onclick = () => (linhas.splice(Number(b.dataset.rem), 1), desenhar())));
    somar();
  };
  const somar = () => {
    const s = linhas.reduce((t, l) => t + (C.lerNumero(l.valor_unitario) || 0) * (C.lerNumero(l.quantidade) || 1), 0);
    $('#soma').textContent = `Total dos produtos: ${R(s)}`;
  };
  $('#mais').onclick = () => {
    linhas.push({ descricao: '', quantidade: '1', valor_unitario: '' });
    desenhar();
    $$('[data-k="descricao"]').at(-1).focus();
  };
  $('#f').onsubmit = (e) => {
    e.preventDefault();
    comBotao($('#salvar'), async () => {
      const f = $('#f');
      const itens = linhas
        .filter((l) => l.descricao.trim())
        .map((l) => ({ descricao: l.descricao, quantidade: C.lerNumero(l.quantidade) || 1, valor_unitario: C.lerNumero(l.valor_unitario) || 0 }));
      if (!itens.length) throw new Error('Adicione pelo menos um item com descrição.');
      const frete = C.lerNumero(f.frete.value) || 0;
      const soma = itens.reduce((t, i) => t + i.valor_unitario * i.quantidade, 0);
      const r = await POST('/api/notas', {
        emitente_nome: f.emitente_nome.value,
        numero: f.numero.value,
        data_emissao: f.data_emissao.value,
        frete,
        valor_produtos: soma,
        valor_total: soma + frete,
        markup_padrao: C.lerNumero(f.markup_padrao.value),
        itens,
      });
      estado.flash = { nota: r.id, vinculadas: r.vinculadas };
      location.hash = `#/notas/${r.id}`;
    });
  };
  desenhar();
}

// ============================================================
// ENCOMENDAS
// ============================================================
const FILTROS_ENC = { abertas: 'Em aberto', aguardando: 'Aguardando', chegou: 'Chegou · avisar', avisado: 'Avisados', entregue: 'Entregues', cancelada: 'Canceladas', todas: 'Todas' };

async function paginaEncomendas(pag) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let filtro = q.get('status') || 'abertas';
  pag.innerHTML = `
    <div class="cabecalho">
      <div><h1>Encomendas</h1><p class="sub">Anote aqui o que cada cliente pediu. Quando a nota chegar, o sistema avisa de quem é.</p></div>
      <button class="btn primario" id="nova">${ic('mais')} Nova encomenda</button>
    </div>
    <div class="chips rolagem" style="margin-bottom:12px">${Object.entries(FILTROS_ENC).map(([k, v]) => `<button class="chip ${k === filtro ? 'ativo' : ''}" data-f="${k}">${v}</button>`).join('')}</div>
    <div class="linha" style="margin-bottom:14px"><label class="busca">${ic('busca')}<input type="search" id="busca" placeholder="Buscar produto ou cliente…" /></label></div>
    <div id="lista"></div>`;

  const carregar = async () => {
    const b = $('#busca')?.value.trim();
    const params = new URLSearchParams();
    if (filtro !== 'todas') params.set('status', filtro);
    if (b) params.set('busca', b);
    const encs = await GET(`/api/encomendas?${params}`);
    const el = $('#lista');
    if (!el) return;
    if (!encs.length) {
      el.innerHTML = `<div class="card">${vazio('caixa', b ? 'Nada encontrado' : 'Nenhuma encomenda aqui', b ? 'Tente outra palavra.' : 'Quando um cliente pedir algo, cadastre aqui para não esquecer.', b ? '' : `<button class="btn primario" data-nova>${ic('mais')} Nova encomenda</button>`)}</div>`;
      $('[data-nova]', el)?.addEventListener('click', () => formEncomenda(null, carregar));
      return;
    }
    el.innerHTML = `<div class="card lista">${encs.map(linhaEncomenda).join('')}</div>`;
    ligarAcoesEncomenda(el, encs, carregar);
  };
  $$('[data-f]', pag).forEach(
    (b) =>
      (b.onclick = () => {
        filtro = b.dataset.f;
        $$('[data-f]', pag).forEach((x) => x.classList.toggle('ativo', x === b));
        history.replaceState(null, '', `#/encomendas?status=${filtro}`);
        carregar();
      }),
  );
  $('#busca').oninput = debounce(carregar, 250);
  $('#nova').onclick = () => formEncomenda(null, carregar);
  if (q.get('nova')) {
    history.replaceState(null, '', '#/encomendas');
    formEncomenda(null, carregar);
  }
  await carregar();
  atualizarBadge();
}

function linhaEncomenda(e) {
  const contato = { id: e.contato_id, nome: e.contato_nome, telefone: e.contato_telefone };
  return `<div class="aviso-cliente" data-enc="${e.id}">
    <a href="#/contatos/${e.contato_id}" class="avatar" style="text-decoration:none">${esc(iniciais(e.contato_nome))}</a>
    <div class="cresce">
      <div class="linha" style="gap:8px"><strong>${esc(e.produto)}</strong>${e.quantidade !== 1 ? `<span class="badge">${C.numeroBR(e.quantidade, 3)} un</span>` : ''}${badgeStatus(e.status)}</div>
      <div class="small muted" style="margin-top:2px"><a href="#/contatos/${e.contato_id}" style="color:inherit"><b>${esc(e.contato_nome)}</b></a>${e.contato_telefone ? ` · ${esc(C.formatarTelefone(e.contato_telefone))}` : ''} · pedido ${dataHoraBR(e.criado_em)}</div>
      ${e.item_id ? `<div class="tiny" style="margin-top:4px">${ic('link', 'sm')} <a href="#/notas/${e.nota_id}">Nota ${esc(e.nota_numero || '#' + e.nota_id)}${e.nota_emitente ? ` · ${esc(e.nota_emitente)}` : ''}</a> — ${esc(e.item_descricao)}</div>` : ''}
      ${e.observacoes ? `<div class="tiny" style="margin-top:4px;white-space:pre-wrap">📝 ${esc(e.observacoes)}</div>` : ''}
    </div>
    <div class="acoes" style="min-width:170px">
      <div class="num" style="text-align:right;font-weight:700;font-size:16px">${e.valor_total != null ? R(e.valor_total) : '<span class="tiny">sem preço ainda</span>'}${e.valor_origem === 'combinado' ? '<div class="tiny">combinado</div>' : ''}</div>
      ${['chegou', 'avisado'].includes(e.status) ? botaoWhats(contato, [e], { rotulo: e.status === 'chegou' ? 'Avisar' : 'Reenviar', classe: 'peq' }) : ''}
      <div class="linha" style="gap:6px;justify-content:flex-end;flex-wrap:nowrap">
        <select class="peq" data-status style="height:32px;font-size:13px;padding:0 8px">${Object.entries({ aguardando: 'Aguardando', chegou: 'Chegou', avisado: 'Avisado', entregue: 'Entregue', cancelada: 'Cancelada' }).map(([k, v]) => `<option value="${k}" ${k === e.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn peq icone" data-editar title="Editar" style="width:32px;height:32px">${ic('lapis', 'sm')}</button>
      </div>
    </div>
  </div>`;
}

function ligarAcoesEncomenda(el, encs, recarregar) {
  $$('[data-enc]', el).forEach((row) => {
    const e = encs.find((x) => x.id === Number(row.dataset.enc));
    $('[data-status]', row).onchange = async (ev) => {
      const st = ev.target.value;
      if (st === 'chegou' && !e.item_id) toast('Dica: ligue a encomenda a uma nota para o preço sair automático.');
      await POST('/api/encomendas/status', { ids: [e.id], status: st }).catch(falhou);
      toast('Situação atualizada ✓');
      atualizarBadge();
      recarregar();
    };
    $('[data-editar]', row).onclick = () => formEncomenda(e, recarregar);
  });
}

function formEncomenda(enc, depois, contatoFixo = null) {
  const novo = !enc;
  const m = modal(
    novo ? 'Nova encomenda' : 'Editar encomenda',
    `<form class="form-grid" id="f">
      <div class="inteiro">${contatoFixo ? `<label class="campo">Cliente<input value="${esc(contatoFixo.nome)}" disabled /></label>` : campoCliente(enc ? { id: enc.contato_id, nome: enc.contato_nome } : null)}</div>
      <label class="campo inteiro">O que ele encomendou?<input name="produto" value="${esc(enc?.produto || '')}" placeholder="Ex.: iPhone 14 128GB azul" ${contatoFixo || enc ? 'autofocus' : ''} required /></label>
      <label class="campo">Quantidade<input name="quantidade" inputmode="decimal" value="${campoNum(enc?.quantidade ?? 1)}" /></label>
      <label class="campo">Valor combinado <span class="tiny">(opcional)</span><span class="input-prefixo"><input name="valor_combinado" inputmode="decimal" value="${campoNum(enc?.valor_combinado)}" placeholder="calcula pela nota" /><span>R$</span></span></label>
      <label class="campo inteiro">Observações<textarea name="observacoes" placeholder="Cor, tamanho, forma de pagamento, sinal pago…" style="min-height:70px">${esc(enc?.observacoes || '')}</textarea></label>
      <p class="tiny inteiro">Escreva o produto do jeito que vai aparecer na nota (marca, modelo, capacidade). Assim, quando a nota chegar, o sistema reconhece que é deste cliente.</p>
    </form>`,
    {
      rodape: `${novo ? '' : `<button class="btn perigo" id="excluir" style="margin-right:auto">${ic('lixo', 'sm')} Excluir</button>`}<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">${novo ? 'Salvar encomenda' : 'Salvar'}</button>`,
    },
  );
  if (!contatoFixo) ligarCampoCliente(m.el);
  if (enc && !contatoFixo) $('.cli-busca', m.el).dataset.id = enc.contato_id;
  $('#excluir', m.el)?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir encomenda?', esc(enc.produto), { botao: 'Excluir', perigo: true }))) return;
    await DEL(`/api/encomendas/${enc.id}`).catch(falhou);
    m.fechar();
    toast('Encomenda excluída');
    depois?.();
  });
  $('#salvar', m.el).onclick = (ev) =>
    comBotao(ev.currentTarget, async () => {
      const f = $('#f', m.el);
      const cliente = contatoFixo ? { contato_id: contatoFixo.id } : lerCampoCliente(m.el);
      const valor = C.lerNumero(f.valor_combinado.value);
      const d = {
        ...cliente,
        produto: f.produto.value,
        quantidade: C.lerNumero(f.quantidade.value) || 1,
        valor_combinado: Number.isFinite(valor) ? valor : null,
        observacoes: f.observacoes.value,
      };
      if (novo) await POST('/api/encomendas', d);
      else await PUT(`/api/encomendas/${enc.id}`, d);
      m.fechar();
      toast(novo ? 'Encomenda anotada ✓' : 'Encomenda atualizada ✓');
      depois?.();
    });
}

// ============================================================
// CLIENTES
// ============================================================
async function paginaContatos(pag) {
  pag.innerHTML = `
    <div class="cabecalho">
      <div><h1>Clientes</h1><p class="sub">Quem encomenda com você, com WhatsApp a um toque.</p></div>
      <button class="btn primario" id="novo">${ic('mais')} Novo cliente</button>
    </div>
    <div class="linha" style="margin-bottom:14px"><label class="busca">${ic('busca')}<input type="search" id="busca" placeholder="Buscar nome ou telefone…" /></label></div>
    <div id="lista"></div>`;
  const carregar = async () => {
    const b = $('#busca')?.value.trim();
    const cs = await GET(`/api/contatos${b ? `?busca=${encodeURIComponent(b)}` : ''}`);
    const el = $('#lista');
    if (!el) return;
    el.innerHTML = cs.length
      ? `<div class="card lista">${cs
          .map(
            (c) => `<a class="lista-item" href="#/contatos/${c.id}">
          <span class="avatar">${esc(iniciais(c.nome))}</span>
          <span class="cresce"><strong>${esc(c.nome)}</strong><span class="tiny" style="display:block">${esc(C.formatarTelefone(c.telefone)) || 'sem telefone'}${c.total_encomendas ? ` · ${c.total_encomendas} encomenda${c.total_encomendas > 1 ? 's' : ''}` : ''}</span></span>
          ${c.abertas ? `<span class="badge st-chegou">${c.abertas} em aberto</span>` : ''}${ic('setaDir', 'sm')}</a>`,
          )
          .join('')}</div>`
      : `<div class="card">${vazio('pessoas', b ? 'Ninguém encontrado' : 'Nenhum cliente ainda', b ? 'Tente outro nome.' : 'Cadastre seus clientes para avisar pelo WhatsApp.')}</div>`;
  };
  $('#busca').oninput = debounce(carregar, 250);
  $('#novo').onclick = () => formContato(null, (c) => (location.hash = `#/contatos/${c.id}`));
  await carregar();
}

async function paginaContato(pag, id) {
  const c = await GET(`/api/contatos/${id}`);
  const abertas = c.encomendas.filter((e) => ['chegou', 'avisado'].includes(e.status));
  const gasto = c.encomendas.filter((e) => e.status === 'entregue').reduce((s, e) => s + (e.valor_total || 0), 0);
  pag.innerHTML = `
    <a href="#/contatos" class="voltar">${ic('seta', 'sm')} Clientes</a>
    <div class="cabecalho">
      <div class="linha" style="gap:14px"><span class="avatar" style="width:56px;height:56px;font-size:20px">${esc(iniciais(c.nome))}</span>
        <div><h1>${esc(c.nome)}</h1><p class="sub">${esc(C.formatarTelefone(c.telefone)) || 'sem telefone'}${gasto ? ` · já comprou ${R(gasto)}` : ''}</p></div></div>
      <div class="linha">
        ${c.telefone ? `<a class="btn wa" href="${esc(C.linkWhatsApp(c.telefone, `Olá, ${C.primeiroNome(c.nome)}!`))}" target="_blank" rel="noopener">${ic('whats')} Conversar</a>` : ''}
        <button class="btn" id="editar">${ic('lapis', 'sm')} Editar</button>
        <button class="btn perigo icone" id="excluir" title="Excluir">${ic('lixo', 'sm')}</button>
      </div>
    </div>
    ${c.observacoes ? `<div class="alerta info" style="margin-bottom:14px">📝 <span style="white-space:pre-wrap">${esc(c.observacoes)}</span></div>` : ''}
    ${abertas.length ? `<div class="card" style="margin-bottom:16px">${cartaoAviso({ id: c.id, nome: c.nome, telefone: c.telefone, encs: abertas })}</div>` : ''}
    <div class="secao"><div class="titulo"><h2>Encomendas</h2><button class="btn peq" id="nova">${ic('mais', 'sm')} Nova encomenda</button></div>
      <div id="lista">${c.encomendas.length ? `<div class="card lista">${c.encomendas.map(linhaEncomenda).join('')}</div>` : `<div class="card">${vazio('caixa', 'Nenhuma encomenda', 'Anote o que este cliente pediu.')}</div>`}</div>
    </div>`;
  ligarAcoesEncomenda($('#lista'), c.encomendas, render);
  $('#nova').onclick = () => formEncomenda(null, render, c);
  $('#editar').onclick = () => formContato(c, render);
  $('#excluir').onclick = async () => {
    if (!(await confirmar(`Excluir ${esc(c.nome)}?`, `O cliente e ${c.encomendas.length} encomenda(s) dele serão apagados.`, { botao: 'Excluir', perigo: true }))) return;
    await DEL(`/api/contatos/${c.id}`).catch(falhou);
    toast('Cliente excluído');
    location.hash = '#/contatos';
  };
}

function formContato(c, depois) {
  const novo = !c;
  const m = modal(
    novo ? 'Novo cliente' : 'Editar cliente',
    `<form class="pilha" id="f">
      <label class="campo">Nome<input name="nome" value="${esc(c?.nome || '')}" required autofocus /></label>
      <label class="campo">WhatsApp<input name="telefone" type="tel" inputmode="tel" value="${esc(c?.telefone || '')}" placeholder="(47) 99999-9999" /></label>
      <label class="campo">Observações<textarea name="observacoes" placeholder="Ex.: prefere retirar à tarde">${esc(c?.observacoes || '')}</textarea></label>
    </form>`,
    { rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">Salvar</button>' },
  );
  $('#salvar', m.el).onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const d = Object.fromEntries(new FormData($('#f', m.el)));
      const r = novo ? await POST('/api/contatos', d) : await PUT(`/api/contatos/${c.id}`, d);
      m.fechar();
      toast('Cliente salvo ✓');
      depois?.(r);
    });
}

// ============================================================
// AJUSTES
// ============================================================
async function paginaAjustes(pag) {
  const a = (estado.ajustes = await GET('/api/ajustes'));
  pag.innerHTML = `
    <div class="cabecalho"><div><h1>Ajustes</h1><p class="sub">Padrões de preço e a mensagem do WhatsApp.</p></div></div>
    <form id="f" class="pilha" style="gap:16px;max-width:760px">
      <div class="card pad"><h2 style="margin-bottom:14px">Preço de venda</h2>
        <div class="form-grid">
          <label class="campo">Porcentagem padrão para notas novas<span class="input-sufixo"><input name="markup_padrao" inputmode="decimal" value="${campoNum(a.markup_padrao)}" /><span>%</span></span></label>
          <label class="campo">Arredondar o preço final<select name="arredondamento">${Object.entries(C.MODOS_ARREDONDAMENTO).map(([k, v]) => `<option value="${k}" ${k === a.arredondamento ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <p class="tiny inteiro" id="exemplo"></p>
        </div>
      </div>
      <div class="card pad"><h2 style="margin-bottom:4px">Mensagem do WhatsApp</h2>
        <p class="tiny" style="margin-bottom:12px">Use: <b>{nome}</b> primeiro nome · <b>{itens}</b> lista dos produtos com valor · <b>{total}</b> valor total · <b>{loja}</b> nome da loja</p>
        <div class="form-grid">
          <label class="campo inteiro">Nome da loja (opcional)<input name="nome_loja" value="${esc(a.nome_loja)}" /></label>
          <label class="campo">Modelo<textarea name="mensagem" style="min-height:220px">${esc(a.mensagem)}</textarea></label>
          <div class="campo"><span>Como o cliente vê</span><div id="previa" class="card pad" style="white-space:pre-wrap;background:#e7ffdb;color:#111;font-size:14px;box-shadow:none;border-color:#cfeec0;min-height:220px"></div></div>
        </div>
        <button type="button" class="btn peq" id="restaurar" style="margin-top:10px">${ic('desfazer', 'sm')} Voltar à mensagem padrão</button>
      </div>
      <div class="linha"><button class="btn primario grande" id="salvar">${ic('check')} Salvar ajustes</button></div>
    </form>
    <div class="card pad secao" style="max-width:760px">
      <h2 style="margin-bottom:8px">Sistema</h2>
      <p class="small muted">${estado.sessao.ia ? '✓ Leitura automática de fotos de notas ativa.' : '⚠ Leitura de fotos desativada: configure a chave da IA (ANTHROPIC_API_KEY) no servidor. XML e notas digitadas funcionam normalmente.'}</p>
      <p class="small muted" style="margin-top:6px">📱 No celular, use “Adicionar à tela de início” no navegador para abrir como aplicativo.</p>
      ${estado.sessao.protegido ? `<button class="btn" id="sair" style="margin-top:14px">${ic('sair', 'sm')} Sair</button>` : '<p class="small" style="color:var(--warn);margin-top:6px">⚠ Site sem senha. Defina APP_PASSWORD no servidor.</p>'}
    </div>`;
  const f = $('#f');
  const previa = () => {
    $('#previa').textContent = C.montarMensagem(f.mensagem.value, {
      nome: 'Joel Souza',
      loja: f.nome_loja.value,
      itens: [
        { produto: 'iPhone 14 128GB', quantidade: 1, valorUnit: 5390 },
        { produto: 'Capinha', quantidade: 2, valorUnit: 39.9 },
      ],
    });
    const mk = C.lerNumero(f.markup_padrao.value) || 0;
    $('#exemplo').textContent = `Exemplo: produto que custou R$ 100,00 com ${C.numeroBR(mk)}% → vende por ${R(C.arredondar(100 * (1 + mk / 100), f.arredondamento.value))}`;
  };
  f.oninput = previa;
  f.onchange = previa;
  previa();
  $('#restaurar').onclick = () => {
    f.mensagem.value = C.MENSAGEM_PADRAO;
    previa();
  };
  f.onsubmit = (e) => {
    e.preventDefault();
    comBotao($('#salvar'), async () => {
      estado.ajustes = await PUT('/api/ajustes', {
        markup_padrao: C.lerNumero(f.markup_padrao.value),
        arredondamento: f.arredondamento.value,
        mensagem: f.mensagem.value,
        nome_loja: f.nome_loja.value,
      });
      toast('Ajustes salvos ✓');
    });
  };
  $('#sair')?.addEventListener('click', async () => {
    await POST('/api/logout').catch(() => {});
    estado.sessao.logado = false;
    telaLogin();
  });
}

// ============================================================
// início
// ============================================================
async function iniciar() {
  try {
    estado.sessao = await GET('/api/sessao');
  } catch (e) {
    $('#raiz').innerHTML = `<div class="login">${vazio('alerta', 'Sem conexão', 'Não consegui falar com o servidor. Verifique a internet e recarregue.')}</div>`;
    return;
  }
  if (!estado.sessao.logado) return telaLogin();
  estado.ajustes = await GET('/api/ajustes');
  montarEstrutura();
  rotaAtual = null;
  render();
}

iniciar();
