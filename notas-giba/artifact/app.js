// Notas do Giba — versão hospedada no Claude (sem servidor).
// Dados: capability `db` (compartilhado entre celular e computador).
// Fotos das notas: capability `assets`. Leitura das notas: capability `sample` (Claude).
// calc.js, combinar.js e nfe-xml.js são embutidos antes deste arquivo pelo build.

// ============================================================
// utilidades
// ============================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const R = reais;
const agoraISO = () => new Date().toISOString();
const dataBR = (iso) => {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return d ? `${d}/${m}/${a}` : iso;
};
const dataHoraBR = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const diaLocal = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
};
const pct = (v) => `${numeroBR(v, 1)}%`;
const campoNum = (v) => (v === null || v === undefined || v === '' ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ','));
const iniciais = (nome) =>
  String(nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
const novoId = () => Math.random().toString(36).slice(2, 10);
// Versão de link aberto (GitHub Pages): dados no próprio navegador, leitura de foto com a chave da API.
const LOCAL = window.__NOTAS_LOCAL || null;
const srcArquivo = (id) => (LOCAL ? LOCAL.url(id) : `/_blob/${id}`);

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
  lapis: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  lixo: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  luz: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  quadro: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>',
  folhas: '<path d="M8 2h10a2 2 0 0 1 2 2v14M4 6h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  desfazer: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  carteira: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  sacola: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  tendencia: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  xml: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  whats:
    '<path fill="currentColor" stroke="none" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2m5.8 14.01c-.24.68-1.43 1.32-1.97 1.37-.5.05-.98.24-3.3-.69-2.79-1.1-4.56-3.95-4.7-4.13-.13-.18-1.12-1.49-1.12-2.85s.71-2.02.97-2.3c.25-.27.55-.34.73-.34l.53.01c.17.01.4-.06.62.48.24.56.8 1.94.86 2.08.07.14.11.3.02.48-.09.18-.14.3-.27.46l-.41.48c-.14.13-.28.28-.12.55.16.27.71 1.17 1.52 1.89 1.05.93 1.93 1.22 2.2 1.36.27.13.43.11.59-.07.16-.18.68-.8.86-1.07.18-.27.36-.23.61-.14.25.09 1.6.75 1.87.89.27.14.45.2.52.32.07.11.07.66-.17 1.31"/>',
};
const ic = (nome, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[nome] || ''}</svg>`;

// ============================================================
// estado e banco de dados
// ============================================================
const AJUSTES_PADRAO = { markup_padrao: 30, arredondamento: 'nenhum', mensagem: MENSAGEM_PADRAO, nome_loja: '' };
const S = {
  db: null,
  assets: null,
  sample: null,
  limites: null,
  notas: new Map(),
  contatos: new Map(),
  encomendas: new Map(),
  ajustes: { ...AJUSTES_PADRAO },
  carregado: new Set(),
  flash: null,
  melhorando: new Set(),
  tentouCotacao: new Set(),
  filtroEnc: 'abertas',
  abrirNovaEncomenda: false,
};

function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 5000 : 3000);
}
const MSG_DB = {
  permission_denied: 'Sua conta só pode ver. Peça para quem compartilhou te dar permissão de edição.',
  unauthenticated: 'Entre na sua conta do Claude para salvar.',
};
const falhou = (e) => {
  console.error(e);
  toast(MSG_DB[e?.code] || e?.message || 'Algo deu errado. Tente de novo.', 'erro');
};

class ErroUsuario extends Error {}

// Lê as três coleções uma vez e acompanha as mudanças ao vivo (celular ↔ computador).
function assinar() {
  const col = (nome, mapa) =>
    S.db.collection(nome).onSnapshot(
      (snap) => {
        S[mapa] = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
        S.carregado.add(nome);
        agendarRender();
      },
      (e) => {
        S.carregado.add(nome);
        falhou(e);
        agendarRender();
      },
    );
  col('notas', 'notas');
  col('contatos', 'contatos');
  col('encomendas', 'encomendas');
  S.db.doc('config/ajustes').onSnapshot(
    (s) => {
      S.ajustes = { ...AJUSTES_PADRAO, ...(s.data() || {}) };
      S.carregado.add('ajustes');
      agendarRender();
    },
    () => S.carregado.add('ajustes'),
  );
}
const pronto = () => ['notas', 'contatos', 'encomendas'].every((c) => S.carregado.has(c));

// ---------------- regras de negócio ----------------
const memoResumo = new WeakMap();
const resumo = (nota) => {
  const modo = S.ajustes.arredondamento;
  const m = memoResumo.get(nota);
  if (m && m.modo === modo) return m.r;
  const r = resumoNota(nota, nota.itens || [], modo);
  r.porItem = new Map(r.itens.map((i) => [i.id, i.calc]));
  memoResumo.set(nota, { modo, r });
  return r;
};

// ---------------- cotação do dólar ----------------
async function obterCotacao() {
  const a = S.ajustes;
  if (a.cotacao_modo === 'fixa' && Number(a.cotacao_fixa) > 0) return { valor: Number(a.cotacao_fixa), fonte: 'fixa' };
  const tentar = async (url, ler) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) return null; const v = Number(ler(await r.json())); return v > 0 ? v : null; } catch { return null; } finally { clearTimeout(t); }
  };
  const v = (await tentar('https://economia.awesomeapi.com.br/json/last/USD-BRL', (d) => d.USDBRL.ask)) || (await tentar('https://open.er-api.com/v6/latest/USD', (d) => d.rates.BRL)) || (await tentar('https://api.frankfurter.app/latest?from=USD&to=BRL', (d) => d.rates.BRL));
  if (v) {
    const valor = Math.round(v * 10000) / 10000;
    S.db.doc('config/ajustes').set({ ...S.ajustes, ultima_cotacao: valor, ultima_cotacao_em: agoraISO() }).catch(() => {});
    return { valor, fonte: 'dia' };
  }
  if (Number(a.ultima_cotacao) > 0) return { valor: Number(a.ultima_cotacao), fonte: 'ultima' };
  return null;
}

function enc(e) {
  const c = S.contatos.get(e.contato_id);
  const n = e.nota_id ? S.notas.get(e.nota_id) : null;
  const item = n ? (n.itens || []).find((i) => i.id === e.item_id) : null;
  const qtd = Number(e.quantidade) || 1;
  let valorUnit = null;
  let origem = null;
  let custoUnit = null;
  if (item) {
    const c2 = resumo(n).porItem.get(item.id);
    custoUnit = c2.custoUnit;
    valorUnit = c2.precoUnit;
    origem = 'nota';
  }
  if (e.valor_combinado !== null && e.valor_combinado !== undefined && e.valor_combinado !== '') {
    valorUnit = Number(e.valor_combinado) / qtd;
    origem = 'combinado';
  }
  return {
    ...e,
    quantidade: qtd,
    contato_nome: c?.nome || 'Cliente removido',
    contato_telefone: c?.telefone || '',
    nota_id: item ? e.nota_id : null,
    item_id: item ? e.item_id : null,
    item_descricao: item ? nomeItem(item) : undefined,
    nota_numero: n?.numero,
    nota_emitente: n?.emitente_nome,
    valor_unit: valorUnit,
    valor_total: valorUnit === null ? null : valorUnit * qtd,
    valor_origem: origem,
    custo_total: custoUnit === null ? null : custoUnit * qtd,
  };
}

const ORDEM_STATUS = { chegou: 0, avisado: 1, aguardando: 2, entregue: 3, cancelada: 4 };
function listarEncomendas({ status, busca, contato_id } = {}) {
  let l = [...S.encomendas.values()].map(enc);
  if (status === 'abertas') l = l.filter((e) => ['aguardando', 'chegou', 'avisado'].includes(e.status));
  else if (status && status !== 'todas') l = l.filter((e) => e.status === status);
  if (contato_id) l = l.filter((e) => e.contato_id === contato_id);
  if (busca) {
    const b = normalizar(busca);
    l = l.filter((e) => normalizar(`${e.produto} ${e.contato_nome} ${e.item_descricao || ''}`).includes(b));
  }
  return l.sort((a, b) => (ORDEM_STATUS[a.status] ?? 9) - (ORDEM_STATUS[b.status] ?? 9) || String(b.criado_em).localeCompare(String(a.criado_em)));
}

const nomeItem = (i) => i?.nome || i?.descricao || '';
const pendentes = () =>
  [...S.encomendas.values()]
    .filter((e) => e.status === 'aguardando' && !e.item_id)
    .sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));

const dataNota = (n) => n.data_emissao || diaLocal(n.criado_em);

function resumoLista(n) {
  const r = resumo(n);
  const vinc = [...S.encomendas.values()].filter((e) => e.nota_id === n.id && (n.itens || []).some((i) => i.id === e.item_id));
  return {
    id: n.id,
    numero: n.numero,
    emitente_nome: n.emitente_nome,
    data: dataNota(n),
    origem: n.origem,
    itens: (n.itens || []).length,
    primeiro_item: nomeItem(n.itens?.[0]),
    investido: r.investido,
    venda: r.venda,
    lucro: r.lucro,
    encomendas: vinc.length,
    para_avisar: vinc.filter((e) => e.status === 'chegou').length,
  };
}

function listarNotas(busca) {
  let l = [...S.notas.values()];
  if (busca) {
    const b = normalizar(busca);
    l = l.filter((n) => normalizar(`${n.emitente_nome || ''} ${n.numero || ''} ${(n.itens || []).map((i) => `${i.descricao} ${i.nome || ''}`).join(' ')}`).includes(b));
  }
  return l.sort((a, b) => dataNota(b).localeCompare(dataNota(a)) || String(b.criado_em).localeCompare(String(a.criado_em))).map(resumoLista);
}

function limparItem(i, ordem) {
  const descricao = String(i.descricao ?? '').trim().slice(0, 300);
  if (!descricao) throw new ErroUsuario('Todo item precisa de uma descrição.');
  const q = Number(i.quantidade);
  const quantidade = q > 0 ? q : 1;
  let vu = Number(i.valor_unitario) || 0;
  let vt = Number(i.valor_total) || 0;
  if (!vt && vu) vt = Math.round(vu * quantidade * 100) / 100;
  if (!vu && vt) vu = vt / quantidade;
  const txt = (v, m) => (String(v ?? '').trim() ? String(v).trim().slice(0, m) : null);
  return {
    id: i.id || novoId(),
    ordem: i.ordem ?? ordem,
    codigo: txt(i.codigo, 60),
    descricao,
    nome: txt(i.nome, 200),
    categoria: txt(i.categoria, 40),
    ncm: txt(i.ncm, 20),
    quantidade,
    unidade: txt(i.unidade, 10),
    valor_unitario: vu,
    valor_total: vt,
    markup: i.markup === '' || i.markup === undefined ? null : i.markup,
  };
}

// Liga encomendas pendentes aos itens da nota (semelhança do texto + sugestão da IA).
async function combinarNota(nota, sugestoes = new Map()) {
  const itens = nota.itens || [];
  const comprometido = (item) =>
    [...S.encomendas.values()].filter((e) => e.nota_id === nota.id && e.item_id === item.id).reduce((s, e) => s + (Number(e.quantidade) || 1), 0);
  const disponiveis = itens.map((i) => ({ ...i, quantidade: Math.max(0, i.quantidade - comprometido(i)) }));
  const vinculos = distribuir(disponiveis, pendentes(), sugestoes);
  for (const v of vinculos) {
    await S.db.doc(`encomendas/${v.encomendaId}`).update({ nota_id: nota.id, item_id: itens[v.itemIndex].id, status: 'chegou', chegou_em: agoraISO() });
  }
  return vinculos.length;
}

async function criarNota(dados, { origem = 'manual', arquivos = [], sugestoes = new Map() } = {}) {
  const itens = (dados.itens || []).map((i, k) => limparItem(i, k));
  if (!itens.length) throw new ErroUsuario('A nota precisa de pelo menos um item.');
  const soma = itens.reduce((s, i) => s + i.valor_total, 0);
  const chave = dados.chave ? String(dados.chave).replace(/\D/g, '') : null;
  if (chave && chave.length === 44) {
    const existe = [...S.notas.values()].find((n) => n.chave === chave);
    if (existe) throw Object.assign(new ErroUsuario('Esta nota já estava cadastrada.'), { notaId: existe.id });
  }
  const num = (v) => Number(v) || 0;
  const nota = {
    numero: dados.numero || null,
    serie: dados.serie || null,
    chave,
    emitente_nome: dados.emitente_nome || null,
    emitente_cnpj: dados.emitente_cnpj ? String(dados.emitente_cnpj).replace(/\D/g, '') : null,
    data_emissao: /^\d{4}-\d{2}-\d{2}$/.test(dados.data_emissao || '') ? dados.data_emissao : null,
    valor_produtos: num(dados.valor_produtos) || soma,
    frete: num(dados.frete),
    seguro: num(dados.seguro),
    desconto: num(dados.desconto),
    outras: num(dados.outras),
    impostos: num(dados.impostos),
    valor_total: num(dados.valor_total) || soma,
    moeda: dados.moeda === 'USD' ? 'USD' : 'BRL',
    cotacao: null,
    markup_padrao: Number.isFinite(Number(dados.markup_padrao)) && dados.markup_padrao !== null && dados.markup_padrao !== '' ? Number(dados.markup_padrao) : Number(S.ajustes.markup_padrao),
    ratear_despesas: dados.ratear_despesas === false ? 0 : 1,
    origem,
    arquivos,
    avisos: dados.avisos || [],
    observacoes: dados.observacoes || null,
    itens,
    criado_em: agoraISO(),
  };
  if (nota.moeda === 'USD') {
    if (Number(dados.cotacao) > 0) nota.cotacao = Number(dados.cotacao);
    else {
      const c = await obterCotacao();
      if (c) { nota.cotacao = c.valor; nota.cotacao_fonte = c.fonte; }
    }
  }
  const ref = await S.db.collection('notas').add(nota);
  const vinculadas = await combinarNota({ ...nota, id: ref.id }, sugestoes);
  return { id: ref.id, vinculadas };
}

const salvarNota = (id, dados) => S.db.doc(`notas/${id}`).update(dados);

async function liberar(filtro) {
  for (const e of [...S.encomendas.values()].filter(filtro)) {
    await S.db.doc(`encomendas/${e.id}`).update({
      status: ['chegou', 'avisado'].includes(e.status) ? 'aguardando' : e.status,
      nota_id: null,
      item_id: null,
      chegou_em: null,
      avisado_em: null,
    });
  }
}

async function mudarStatus(ids, status) {
  const campo = { chegou: 'chegou_em', avisado: 'avisado_em', entregue: 'entregue_em' }[status];
  for (const id of ids) {
    const e = S.encomendas.get(id);
    if (!e) continue;
    const d = { status };
    if (campo && !e[campo]) d[campo] = agoraISO();
    if (status === 'aguardando' || status === 'chegou') Object.assign(d, { avisado_em: null, entregue_em: null });
    if (status === 'aguardando') d.chegou_em = null;
    if (status === 'avisado') d.entregue_em = null;
    await S.db.doc(`encomendas/${id}`).update(d);
  }
}

async function vincular(encId, nota, item) {
  const e = S.encomendas.get(encId);
  await S.db.doc(`encomendas/${encId}`).update({
    nota_id: nota.id,
    item_id: item.id,
    status: ['aguardando', 'cancelada'].includes(e.status) ? 'chegou' : e.status,
    chegou_em: e.chegou_em || agoraISO(),
  });
}

async function criarContato({ nome, telefone, observacoes }) {
  nome = String(nome || '').trim();
  if (!nome) throw new ErroUsuario('Informe o nome do cliente.');
  telefone = String(telefone || '').trim();
  if (telefone && telefone.replace(/\D/g, '').length < 10) throw new ErroUsuario('Telefone incompleto: coloque o DDD + número.');
  const ref = await S.db.collection('contatos').add({ nome, telefone, observacoes: String(observacoes || '').trim(), criado_em: agoraISO() });
  return ref.id;
}

async function salvarContato(id, { nome, telefone, observacoes }) {
  nome = String(nome || '').trim();
  if (!nome) throw new ErroUsuario('Informe o nome do cliente.');
  telefone = String(telefone || '').trim();
  if (telefone && telefone.replace(/\D/g, '').length < 10) throw new ErroUsuario('Telefone incompleto: coloque o DDD + número.');
  await S.db.doc(`contatos/${id}`).update({ nome, telefone, observacoes: String(observacoes || '').trim() });
}

async function criarEncomenda(d) {
  const produto = String(d.produto || '').trim();
  if (!produto) throw new ErroUsuario('Informe o produto encomendado.');
  const contato_id = d.contato_id || (d.novo_contato ? await criarContato(d.novo_contato) : null);
  if (!contato_id) throw new ErroUsuario('Escolha o cliente (ou cadastre um novo).');
  const q = Number(d.quantidade);
  const dados = {
    contato_id,
    produto,
    quantidade: q > 0 ? q : 1,
    valor_combinado: Number.isFinite(d.valor_combinado) ? d.valor_combinado : null,
    observacoes: String(d.observacoes || '').trim(),
    status: 'aguardando',
    nota_id: null,
    item_id: null,
    criado_em: agoraISO(),
    chegou_em: null,
    avisado_em: null,
    entregue_em: null,
  };
  if (d.nota && d.item) Object.assign(dados, { nota_id: d.nota.id, item_id: d.item.id, status: 'chegou', chegou_em: agoraISO() });
  const ref = await S.db.collection('encomendas').add(dados);
  return ref.id;
}

function painel(periodo) {
  const hoje = diaLocal(agoraISO());
  const [y, m] = hoje.split('-').map(Number);
  const iso = (d) => d.toISOString().slice(0, 10);
  const faixas = {
    mes: [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))],
    mes_passado: [iso(new Date(Date.UTC(y, m - 2, 1))), iso(new Date(Date.UTC(y, m - 1, 0)))],
    '30d': [iso(new Date(Date.parse(hoje) - 29 * 864e5)), hoje],
    ano: [`${y}-01-01`, `${y}-12-31`],
    tudo: ['0000-01-01', '9999-12-31'],
  };
  const [de, ate] = faixas[periodo] || faixas.mes;
  const notas = [...S.notas.values()].filter((n) => dataNota(n) >= de && dataNota(n) <= ate);
  let investido = 0;
  let venda = 0;
  for (const n of notas) {
    const r = resumo(n);
    investido += r.investido;
    venda += r.venda;
  }
  const todas = [...S.encomendas.values()].map(enc);
  const entregues = todas.filter((e) => e.status === 'entregue' && e.entregue_em && diaLocal(e.entregue_em) >= de && diaLocal(e.entregue_em) <= ate);
  const vendido = entregues.reduce((s, e) => s + (e.valor_total || 0), 0);
  const custo = entregues.reduce((s, e) => s + (e.custo_total || 0), 0);
  const conta = (st) => todas.filter((e) => e.status === st).length;
  const meses = [];
  for (let k = 5; k >= 0; k--) {
    const ini = iso(new Date(Date.UTC(y, m - 1 - k, 1)));
    const fim = iso(new Date(Date.UTC(y, m - k, 0)));
    let inv = 0;
    let ven = 0;
    for (const n of S.notas.values()) {
      if (dataNota(n) < ini || dataNota(n) > fim) continue;
      const r = resumo(n);
      inv += r.investido;
      ven += r.venda;
    }
    meses.push({ mes: ini.slice(0, 7), investido: inv, venda: ven, lucro: ven - inv });
  }
  return {
    notas: notas.length,
    investido,
    venda_prevista: venda,
    lucro_previsto: venda - investido,
    vendido,
    lucro_realizado: vendido - custo,
    encomendas: { aguardando: conta('aguardando'), chegou: conta('chegou'), avisado: conta('avisado') },
    avisar: listarEncomendas({ status: 'chegou' }),
    retirar: listarEncomendas({ status: 'avisado' }),
    recentes: listarNotas().slice(0, 5),
    meses,
  };
}

// ============================================================
// leitura da nota por foto (Claude)
// ============================================================
const REGRAS_NOME = `COMO ESCREVER "nome_produto" (muito importante):
Notas fiscais abreviam, cortam e às vezes erram o nome. Escreva o nome comercial do produto como um vendedor brasileiro falaria para o cliente: tipo do produto + marca + linha/modelo + variação (tamanho, capacidade, cor, volume).
- Expanda abreviações: PERF = Perfume, DES/DESOD = Desodorante, CEL/SMARTP = Celular/Smartphone, FONE OUV = Fone de ouvido, CARREG = Carregador, CX = Caixa, PT/PRT = Preto, BR/BCO = Branco, AZ = Azul, EDP = Eau de Parfum, EDT = Eau de Toilette, UN = unidade.
- Corrija grafias erradas ou "quebradas" quando reconhecer o produto real. Ex.: "PERF F-K-H-A-R BLACK EDP 100ML" ou "PERF FAKAR BLK 100" -> "Perfume Lattafa Fakhar Black EDP 100ml".
- Outros exemplos: "APPLE IPH 14 128GB AZ MPVN3BZ/A" -> "iPhone 14 128GB Azul"; "FONE JBL T520BT PT" -> "Fone de ouvido JBL Tune 520BT Preto"; "CARREG TURBO 20W USB-C BCO" -> "Carregador turbo 20W USB-C Branco"; "AIR FRYER MOND AF-34 4L" -> "Air Fryer Mondial AF-34 4L".
- Se não tiver certeza da marca ou do modelo, não invente: escreva só o que dá para entender por extenso. Nunca troque números (capacidade, volume, modelo).
- "categoria": uma palavra ou duas (ex.: Perfume, Celular, Eletrônico, Eletrodoméstico, Acessório, Roupa, Alimento).`;

const PROMPT_NOTA = `Você é um assistente que lê notas fiscais e faturas de compra (factura, invoice, DANFE de NF-e, NFC-e, cupom fiscal ou pedido de compra) fotografadas pelo celular de um comprador que revende produtos no Brasil. As imagens anexadas são as páginas de UMA mesma nota. Extraia tudo com precisão.

MOEDA (muito importante):
- O padrão é DÓLAR: "moeda": "USD". Valores com "US$", "U$", "$", "USD" ou sem símbolo nenhum são em dólar.
- Só use "moeda": "BRL" quando os valores aparecem com "R$" ou quando o documento é um DANFE/NF-e/NFC-e brasileiro (tem "DANFE", CNPJ ou chave de acesso de 44 dígitos).
- Informe todos os valores exatamente como estão na nota, na moeda original. Não converta.

REGRAS DE LEITURA:
- Valores como número com ponto decimal (1.234,56 -> 1234.56; 1,234.56 -> 1234.56). Leia com cuidado vírgulas e pontos. Não invente: se uma parte estiver ilegível, use null e explique em "avisos".
- Liste TODOS os itens da tabela de produtos, na ordem da nota, sem repetir itens entre páginas. Ignore linhas que não são produtos (tributos, observações, totais).
- "descricao": exatamente como impressa na nota.
- "valor_total" do item = quantidade x valor unitário (já com desconto do item, se houver).
- "emitente_nome": a loja/fornecedor que vendeu (não o comprador). "data_emissao" no formato AAAA-MM-DD.
- Confira se a soma dos itens bate com o total dos produtos; se não bater, avise em "avisos".
- Se as imagens não forem uma nota fiscal, cupom ou pedido com itens, responda "eh_nota_fiscal": false e "itens": [].

${REGRAS_NOME}

ENCOMENDAS DE CLIENTES:
- "encomendas_ids": se um item for claramente o mesmo produto de uma encomenda pendente da lista abaixo (mesmo modelo, capacidade, volume, versão), coloque o id dela. Considere apelidos e grafias diferentes (ex.: encomenda "fakhar preto" = "Perfume Lattafa Fakhar Black"). Na dúvida, deixe []. A soma das quantidades associadas não pode passar da quantidade do item.

Responda SOMENTE com um objeto JSON neste formato:
{"eh_nota_fiscal": true, "moeda": "USD ou BRL", "emitente_nome": "texto ou null", "emitente_cnpj": "só números ou null", "numero": "texto ou null", "serie": "texto ou null", "chave_acesso": "44 dígitos ou null", "data_emissao": "AAAA-MM-DD ou null", "itens": [{"codigo": "texto ou null", "descricao": "texto", "nome_produto": "texto", "categoria": "texto ou null", "ncm": "texto ou null", "quantidade": 1, "unidade": "UN", "valor_unitario": 0.0, "valor_total": 0.0, "encomendas_ids": []}], "valor_produtos": 0.0, "frete": 0.0, "seguro": 0.0, "desconto": 0.0, "outras_despesas": 0.0, "impostos_adicionais": 0.0, "valor_total": 0.0, "avisos": []}`;

const PROMPT_NOMES = `Você ajuda um revendedor brasileiro a entender os itens de uma nota fiscal. Para cada descrição abaixo (copiada da nota), escreva o nome comercial claro do produto.

${REGRAS_NOME}

Se algum item for claramente o mesmo produto de uma encomenda pendente da lista, coloque o id em "encomendas_ids" (na dúvida, []).

Responda SOMENTE com JSON: {"itens": [{"indice": 0, "nome_produto": "texto", "categoria": "texto ou null", "encomendas_ids": []}]}`;

const MSG_SAMPLE = {
  not_granted: 'Para ler a foto, permita que a página use o Claude (menu de permissões da página).',
  rate_limited: 'O limite de uso do Claude desta conta foi atingido por agora. Tente mais tarde ou digite a nota.',
  images_unavailable: 'Este aparelho não pode enviar imagens ao Claude. Tente pelo app do Claude ou pelo navegador.',
  image_rejected: 'A foto não foi aceita. Tente tirar outra (JPG).',
  invalid_json: 'A leitura veio incompleta. Tente de novo com uma foto mais nítida.',
  refused: 'O Claude não conseguiu ler esta imagem. Tente outra foto.',
  prompt_too_large: 'Fotos grandes demais. Envie menos páginas por vez.',
  session_expired: 'Sua sessão expirou. Recarregue a página.',
  sampling_disabled: 'A leitura por IA está desativada nesta conta.',
  upstream_error: 'O serviço de leitura não respondeu. Tente de novo em instantes.',
  queue_overflow: 'Muitas leituras ao mesmo tempo. Espere um pouco.',
  cancelled: 'Leitura cancelada.',
  chave_invalida: 'A chave do Google Gemini não foi aceita. Confira em Ajustes.',
  pedido_recusado: 'A leitura foi recusada. Tente outra foto (JPG) ou confira a chave em Ajustes.',
  sem_internet: 'Sem internet para ler a foto. Tente de novo quando conectar.',
  limite_gratis: 'A cota grátis de leituras de hoje acabou. Amanhã volta sozinha. Enquanto isso, envie o XML ou digite a nota.',
};

async function lerNotaPorFoto(blobs) {
  if (!S.sample) throw new ErroUsuario(LOCAL ? 'Para ler fotos, coloque a chave grátis do Google Gemini em Ajustes. Enquanto isso, envie o XML ou digite a nota.' : 'A leitura por foto não está disponível aqui. Abra pelo claude.ai com a sua conta, ou digite a nota.');
  const pend = listaPendentesIA();
  const tiers = S.limites?.modelTiers;
  const modelTier = !tiers || tiers.includes('complex') ? 'complex' : 'default';
  let n;
  try {
    n = await S.sample.json(`${PROMPT_NOTA}\n\nEncomendas pendentes de clientes (para associar aos itens):\n${pend.join('\n') || '(nenhuma)'}\n\nA nota tem ${blobs.length} foto(s).`, { images: blobs, modelTier, cache: false });
  } catch (e) {
    throw new ErroUsuario(MSG_SAMPLE[e?.code] || 'Não consegui ler a nota agora. Tente de novo.');
  }
  if (!n || n.eh_nota_fiscal === false || !Array.isArray(n.itens) || !n.itens.length) {
    throw new ErroUsuario('Não encontrei uma nota fiscal com itens nessa foto. Tente de novo com boa luz e a nota inteira.');
  }
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const itens = n.itens.map((i, ordem) => {
    const q = num(i.quantidade) > 0 ? num(i.quantidade) : 1;
    const vu = num(i.valor_unitario) || 0;
    return {
      ordem,
      codigo: i.codigo || null,
      descricao: String(i.descricao || `Item ${ordem + 1}`),
      nome: i.nome_produto ? String(i.nome_produto).slice(0, 200) : null,
      categoria: i.categoria ? String(i.categoria).slice(0, 40) : null,
      ncm: i.ncm || null,
      quantidade: q,
      unidade: i.unidade || null,
      valor_unitario: vu,
      valor_total: num(i.valor_total) || vu * q,
    };
  });
  const soma = itens.reduce((s, i) => s + i.valor_total, 0);
  const sugestoes = new Map();
  n.itens.forEach((i, k) => Array.isArray(i.encomendas_ids) && i.encomendas_ids.length && sugestoes.set(k, i.encomendas_ids.map(String)));
  const avisos = Array.isArray(n.avisos) ? n.avisos.map(String) : [];
  const total = num(n.valor_total);
  if (total && Math.abs(total - soma - (num(n.frete) || 0) - (num(n.impostos_adicionais) || 0) - (num(n.outras_despesas) || 0) - (num(n.seguro) || 0) + (num(n.desconto) || 0)) > 0.05 && !avisos.length) {
    avisos.push('A soma dos itens não fecha com o total da nota. Confira os valores.');
  }
  return {
    nota: {
      numero: n.numero,
      serie: n.serie,
      chave: n.chave_acesso,
      emitente_nome: n.emitente_nome,
      emitente_cnpj: n.emitente_cnpj,
      data_emissao: n.data_emissao,
      valor_produtos: num(n.valor_produtos) ?? soma,
      frete: num(n.frete) || 0,
      seguro: num(n.seguro) || 0,
      desconto: num(n.desconto) || 0,
      outras: num(n.outras_despesas) || 0,
      impostos: num(n.impostos_adicionais) || 0,
      valor_total: total || soma,
      moeda: n.moeda === 'BRL' ? 'BRL' : 'USD',
      itens,
      avisos,
    },
    sugestoes,
  };
}

// Lista enviada à IA: só o produto e a quantidade (sem nome nem telefone de cliente).
const listaPendentesIA = () => pendentes().map((e) => `id ${e.id}: ${e.produto} (qtd ${e.quantidade})`);

// Para notas importadas por XML: pede à IA só os nomes claros dos produtos (não é obrigatório dar certo).
async function nomearItens(itens) {
  if (!S.sample || !LOCAL) return new Map();
  try {
    const lista = itens.map((i, k) => `${k}: ${i.descricao}`).join('\n');
    const r = await S.sample.json(`${PROMPT_NOMES}\n\nEncomendas pendentes:\n${listaPendentesIA().join('\n') || '(nenhuma)'}\n\nItens da nota:\n${lista}`, { tipo: 'nomes' });
    const sugestoes = new Map();
    for (const x of r?.itens || []) {
      const it = itens[x.indice];
      if (!it) continue;
      if (x.nome_produto) it.nome = String(x.nome_produto).slice(0, 200);
      if (x.categoria) it.categoria = String(x.categoria).slice(0, 40);
      if (Array.isArray(x.encomendas_ids) && x.encomendas_ids.length) sugestoes.set(x.indice, x.encomendas_ids.map(String));
    }
    return sugestoes;
  } catch (e) {
    console.warn('nomes não gerados', e);
    return new Map();
  }
}

// Depois da leitura rápida, um modelo mais caprichoso revisa os nomes dos produtos (em segundo plano).
async function melhorarNomes(notaId) {
  if (!S.sample || !LOCAL) return;
  const nota = S.notas.get(notaId);
  if (!nota) return;
  S.melhorando.add(notaId); agendarRender();
  try {
    const itens = (nota.itens || []).map((i) => ({ ...i }));
    const antes = itens.map((i) => i.nome);
    const sugestoes = await nomearItens(itens, { rapido: false });
    const atual = S.notas.get(notaId);
    if (!atual) return;
    const novos = (atual.itens || []).map((i) => { const m = itens.find((x) => x.id === i.id); return m && m.nome ? { ...i, nome: m.nome, categoria: m.categoria || i.categoria } : i; });
    const mudou = novos.some((i, k) => i.nome !== antes[k]);
    if (mudou) await salvarNota(notaId, { itens: novos });
    const mais = await combinarNota({ ...atual, itens: novos, id: notaId }, sugestoes);
    if (mudou || mais) toast(mais ? `Nomes revisados ✓ e mais ${mais} encomenda(s) encontrada(s)` : 'Nomes dos produtos revisados pela IA ✓');
  } catch (e) {
    console.warn('revisão de nomes falhou', e);
  } finally {
    S.melhorando.delete(notaId); agendarRender();
  }
}

// PDF → imagens (pdf.js carregado só quando precisa)
let pdfjsPromessa;
function carregarPdfJs() {
  const base = window.__PDFJS_BASE || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const script = (src) =>
    new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => erro(new ErroUsuario('Não consegui abrir o leitor de PDF. Tente uma foto da nota.'));
      document.head.append(s);
    });
  pdfjsPromessa ??= script(base + 'pdf.worker.min.js').then(() => script(base + 'pdf.min.js')).then(() => window.pdfjsLib);
  return pdfjsPromessa;
}

async function pdfParaImagens(file, max = 4) {
  const pdfjs = await carregarPdfJs();
  pdfjs.GlobalWorkerOptions.workerSrc = (window.__PDFJS_BASE || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/') + 'pdf.worker.min.js';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const paginas = [];
  for (let p = 1; p <= Math.min(doc.numPages, max); p++) {
    const pg = await doc.getPage(p);
    const vp0 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: Math.min(2.5, 2000 / Math.max(vp0.width, vp0.height)) });
    const cv = document.createElement('canvas');
    cv.width = vp.width;
    cv.height = vp.height;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    paginas.push(cv);
  }
  return paginas;
}

const canvasParaBlob = (cv) => new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.86));

// ============================================================
// interface: modais, confirmações
// ============================================================
function modal(titulo, corpo, { rodape = '', largo = false } = {}) {
  const fundo = document.createElement('div');
  fundo.className = 'fundo-modal';
  fundo.innerHTML = `
    <div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${titulo}</h2><button class="btn fantasma icone" data-fechar aria-label="Fechar">${ic('x')}</button></div>
      <div class="modal-body">${corpo}</div>
      ${rodape ? `<div class="modal-foot">${rodape}</div>` : ''}
    </div>`;
  let aoFechar = null;
  const fechar = () => {
    fundo.remove();
    document.removeEventListener('keydown', teclaEsc);
    aoFechar?.();
  };
  const teclaEsc = (e) => e.key === 'Escape' && fechar();
  document.addEventListener('keydown', teclaEsc);
  fundo.addEventListener('mousedown', (e) => e.target === fundo && fechar());
  fundo.addEventListener('click', (e) => e.target.closest('[data-fechar]') && fechar());
  document.body.append(fundo);
  setTimeout(() => fundo.querySelector('[autofocus]')?.focus(), 60);
  return { el: fundo, fechar, aoFechar: (fn) => (aoFechar = fn) };
}

function confirmar(titulo, texto, { botao = 'Confirmar', perigo = false } = {}) {
  return new Promise((ok) => {
    let resp = false;
    const m = modal(titulo, `<p class="muted">${texto}</p>`, {
      rodape: `<button class="btn" data-fechar>Cancelar</button><button class="btn ${perigo ? 'perigo' : 'primario'}" data-sim>${botao}</button>`,
    });
    m.aoFechar(() => ok(resp));
    m.el.querySelector('[data-sim]').onclick = () => {
      resp = true;
      m.fechar();
    };
  });
}

function verImagem(src) {
  const v = document.createElement('div');
  v.className = 'visualizador';
  v.innerHTML = `<img src="${esc(src)}" alt="Foto da nota fiscal" />`;
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
  const periodo = h < 5 || h >= 18 ? 'Boa noite' : h < 12 ? 'Bom dia' : 'Boa tarde';
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
let saudacaoAtual = saudacao();

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

const mensagemPara = (nome, encs) =>
  montarMensagem(S.ajustes.mensagem, {
    nome,
    loja: S.ajustes.nome_loja,
    itens: encs.map((e) => ({ produto: e.produto, quantidade: e.quantidade, valorUnit: e.valor_unit })),
  });

// Botão verde: abre o WhatsApp com a mensagem pronta e marca como "avisado".
function botaoWhats(contato, encs, { rotulo = 'Enviar no WhatsApp', classe = '' } = {}) {
  if (!contato.telefone) return `<button class="btn ${classe}" data-sem-telefone="${esc(contato.id)}">${ic('lapis', 'sm')} Adicionar WhatsApp</button>`;
  const texto = mensagemPara(contato.nome, encs);
  const ids = encs.filter((e) => e.status === 'chegou').map((e) => e.id);
  return `<a class="btn wa ${classe}" href="${esc(linkWhatsApp(contato.telefone, texto))}" target="_blank" rel="noopener" data-avisar="${esc(ids.join(','))}">${ic('whats')} ${rotulo}</a>`;
}

function whatsMini(contato, encs) {
  if (!contato.telefone) return '';
  const ids = encs.filter((e) => e.status === 'chegou').map((e) => e.id);
  return `<a class="wa-mini" title="Avisar no WhatsApp" href="${esc(linkWhatsApp(contato.telefone, mensagemPara(contato.nome, encs)))}" target="_blank" rel="noopener" data-avisar="${esc(ids.join(','))}">${ic('whats', 'sm')}</a>`;
}

document.addEventListener('click', async (e) => {
  const wa = e.target.closest('[data-avisar]');
  if (wa) {
    const ids = wa.dataset.avisar.split(',').filter(Boolean);
    if (ids.length) setTimeout(() => mudarStatus(ids, 'avisado').then(() => toast('Marcado como avisado ✓')).catch(falhou), 400);
    return;
  }
  const semTel = e.target.closest('[data-sem-telefone]');
  if (semTel) {
    const c = S.contatos.get(semTel.dataset.semTelefone);
    if (c) formContato(c);
  }
});

// ============================================================
// estrutura e roteador
// ============================================================
const MENU = [
  { rota: 'inicio', nome: 'Início', icone: 'casa' },
  { rota: 'notas', nome: 'Notas fiscais', icone: 'nota' },
  { rota: 'encomendas', nome: 'Encomendas', icone: 'caixa', badge: true },
  { rota: 'clientes', nome: 'Clientes', icone: 'pessoas' },
  { rota: 'ajustes', nome: 'Ajustes', icone: 'ajustes' },
];

function montarEstrutura() {
  $('#raiz').innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <a href="#inicio" class="logo"><span class="marca">G</span><span>Notas do Giba<small>Compras & encomendas</small></span></a>
        <a href="#enviar" class="btn primario cta">${ic('camera')} Enviar nota fiscal</a>
        ${MENU.map((m) => `<a class="nav-link" href="#${m.rota}" data-rota="${m.rota}">${ic(m.icone)} ${m.nome}${m.badge ? '<span class="badge num-alerta" data-badge hidden></span>' : ''}</a>`).join('')}
        <div class="rodape tiny" id="status-sistema"></div>
      </aside>
      <header class="topo-mobile">
        <a href="#inicio" class="logo"><span class="marca">G</span> Notas do Giba</a>
        <a href="#ajustes" class="btn fantasma icone" aria-label="Ajustes">${ic('ajustes')}</a>
      </header>
      <main class="main"><div class="conteudo" id="pagina"></div></main>
      <nav class="bottom-nav">
        <a href="#inicio" data-rota="inicio">${ic('casa')}Início</a>
        <a href="#notas" data-rota="notas">${ic('nota')}Notas</a>
        <a href="#enviar" data-rota="enviar" aria-label="Fotografar nota"><span class="camera">${ic('camera')}</span></a>
        <a href="#encomendas" data-rota="encomendas">${ic('caixa')}Encomendas<span class="badge num-alerta" data-badge hidden></span></a>
        <a href="#clientes" data-rota="clientes">${ic('pessoas')}Clientes</a>
      </nav>
    </div>`;
  window.addEventListener('scroll', () => $('.topo-mobile')?.classList.toggle('sombra', scrollY > 4), { passive: true });
  // re-render adiado enquanto se digita
  $('#pagina').addEventListener('focusout', () => setTimeout(() => S.renderPendente && !editando() && render(), 250));
}

function atualizarBadge() {
  const n = [...S.encomendas.values()].filter((e) => e.status === 'chegou').length;
  $$('[data-badge]').forEach((b) => {
    b.textContent = n;
    b.hidden = !n;
  });
}

const ROTAS = [
  [/^inicio$/, paginaInicio],
  [/^enviar$/, paginaEnviar],
  [/^notas$/, paginaNotas],
  [/^nova-nota$/, paginaNotaManual],
  [/^nota-([\w-]+)$/, paginaNota],
  [/^encomendas$/, paginaEncomendas],
  [/^clientes$/, paginaContatos],
  [/^cliente-([\w-]+)$/, paginaContato],
  [/^ajustes$/, paginaAjustes],
];
let rotaAtual = null;
const rotaDoHash = () => location.hash.replace(/^#/, '') || 'inicio';
const ir = (r) => (location.hash = `#${r}`);

function editando() {
  const a = document.activeElement;
  return a && $('#pagina')?.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
}

const agendarRender = debounce(() => {
  atualizarBadge();
  if (editando() || document.querySelector('.lendo')) {
    S.renderPendente = true;
    return;
  }
  render();
}, 80);

// Link de configuração: ...#chave-XXXX liga a leitura de fotos neste aparelho e some da barra de endereço.
// Funciona ao abrir o link e também quando o site já está aberto na mesma aba.
function lerChaveDoLink() {
  if (!LOCAL || !/^#chave-/.test(location.hash)) return false;
  const chave = decodeURIComponent(location.hash.slice(7)).replace(/\s+/g, '');
  history.replaceState(null, '', location.pathname + location.search + '#inicio');
  if (chave.length < 20) return false;
  try {
    LOCAL.salvarChave(chave);
    return true;
  } catch (e) {
    falhou(e);
    return false;
  }
}
window.addEventListener('hashchange', async () => {
  if (!/^#chave-/.test(location.hash) || !S.db) return;
  if (lerChaveDoLink()) {
    S.sample = await window.claude.use('sample');
    S.limites = S.sample ? await S.sample.limits() : null;
    $('#status-sistema').textContent = S.sample ? '✓ Leitura de fotos ativa' : '⚠ Leitura de fotos desligada';
    toast(S.sample ? 'Leitura automática de fotos ligada neste aparelho ✓' : 'Não consegui ligar a leitura de fotos. Cole a chave em Ajustes.', S.sample ? '' : 'erro');
    render();
  }
});

window.addEventListener('hashchange', () => { if (/^#conectar-/.test(location.hash)) location.reload(); });

function render() {
  if (/^#(chave|conectar)-/.test(location.hash)) return; // links de configuração são tratados à parte
  S.renderPendente = false;
  const pag = $('#pagina');
  if (!pag) return;
  const caminho = rotaDoHash();
  const mudou = caminho !== rotaAtual;
  rotaAtual = caminho;
  $$('[data-rota]').forEach((a) => {
    const r = a.dataset.rota;
    a.classList.toggle('ativo', caminho === r || (r === 'notas' && /^nota-|^nova-nota/.test(caminho)) || (r === 'clientes' && /^cliente-/.test(caminho)));
  });
  if (mudou) {
    if (S.flash && caminho !== `nota-${S.flash.nota}`) S.flash = null;
    scrollTo(0, 0);
    if (caminho === 'inicio') saudacaoAtual = saudacao();
  }
  if (!pronto()) {
    pag.innerHTML = '<div class="carregando"><div class="spinner"></div><p class="muted">Carregando seus dados…</p></div>';
    return;
  }
  const y = scrollY;
  for (const [re, fn] of ROTAS) {
    const m = caminho.match(re);
    if (m) {
      try {
        fn(pag, ...m.slice(1));
      } catch (e) {
        falhou(e);
      }
      if (!mudou) scrollTo(0, y);
      return;
    }
  }
  ir('inicio');
}
window.addEventListener('hashchange', render);

const vazio = (icone, titulo, texto, acao = '') =>
  `<div class="vazio">${ic(icone)}<h3>${titulo}</h3><p>${texto}</p>${acao ? `<div class="vazio-acao">${acao}</div>` : ''}</div>`;

const NOMES_STATUS = { aguardando: 'Aguardando chegar', chegou: 'Chegou · avisar', avisado: 'Avisado', entregue: 'Entregue', cancelada: 'Cancelada' };
const badgeStatus = (s) => `<span class="badge st-${s}">${NOMES_STATUS[s] || s}</span>`;

// ============================================================
// INÍCIO
// ============================================================
let periodoPainel = 'mes';
const PERIODOS = { mes: 'Este mês', mes_passado: 'Mês passado', '30d': '30 dias', ano: 'Este ano', tudo: 'Tudo' };

function paginaInicio(pag) {
  const p = painel(periodoPainel);
  const s = saudacaoAtual;
  const grupos = agruparPorContato(p.avisar);
  const max = Math.max(1, ...p.meses.map((m) => Math.max(m.investido, m.venda)));
  const nomeMes = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
  const novo = !S.notas.size && !S.encomendas.size;

  pag.innerHTML = `
    <div class="saudacao">
      <div><h1>${esc(s.titulo)}</h1><p class="sub">${esc(s.frase)}</p></div>
      <button class="btn so-desktop" id="nova-enc">${ic('mais')} Nova encomenda</button>
    </div>

    <a href="#enviar" class="cta-foto">
      <span class="ic">${ic('camera')}</span>
      <span class="cresce"><strong>Fotografar nota fiscal</strong><span>A gente lê os itens, calcula o preço e acha de quem é a encomenda.</span></span>
      ${ic('setaDir')}
    </a>

    ${
      novo
        ? `<section class="secao card pad boas-vindas">
        <h2>Como funciona</h2>
        <ol class="passos">
          <li><span class="passo-num">1</span><div><strong>Anote as encomendas</strong><p class="muted small">Cliente pediu um iPhone 14? Cadastre em Encomendas com o WhatsApp dele.</p></div></li>
          <li><span class="passo-num">2</span><div><strong>Chegou a mercadoria? Foto da nota</strong><p class="muted small">O site lê cada item e já mostra de qual cliente é cada produto.</p></div></li>
          <li><span class="passo-num">3</span><div><strong>Coloque a sua % e avise</strong><p class="muted small">Digite a porcentagem, o preço sai na hora. Um toque e a mensagem vai pro WhatsApp do cliente.</p></div></li>
        </ol>
        <div class="linha"><button class="btn primario" id="comecar-enc">${ic('mais')} Anotar primeira encomenda</button><a class="btn" href="#enviar">${ic('camera')} Enviar uma nota</a></div>
      </section>`
        : ''
    }

    ${
      grupos.length
        ? `<section class="secao">
        <div class="titulo"><h2>Avisar clientes <span class="badge st-chegou">${p.avisar.length}</span></h2><span class="tiny">Chegaram e ainda não foram avisadas</span></div>
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
        <div class="card kpi destaque"><div class="rotulo">${ic('tendencia', 'sm')} Retorno previsto</div><div class="valor">${R(p.lucro_previsto)}</div><div class="det">${p.venda_prevista ? `margem de ${pct((p.lucro_previsto / p.venda_prevista) * 100)}` : 'sem notas no período'}</div></div>
        <div class="card kpi"><div class="rotulo">${ic('check', 'sm')} Já vendido</div><div class="valor">${R(p.vendido)}</div><div class="det">lucro realizado ${R(p.lucro_realizado)}</div></div>
      </div>
    </section>

    <div class="grid duas secao">
      <div class="card">
        <div class="card-head"><h3>Encomendas em aberto</h3><a href="#encomendas" class="small">Ver todas</a></div>
        <div class="card-body">
          <div class="contadores">
            ${[
              ['aguardando', 'Aguardando', p.encomendas.aguardando, 'relogio'],
              ['chegou', 'Avisar', p.encomendas.chegou, 'alerta'],
              ['avisado', 'P/ retirar', p.encomendas.avisado, 'caixa'],
            ]
              .map(([st, n, q, i]) => `<button class="contador" data-filtro="${st}"><span class="badge st-${st}">${ic(i, 'sm')}</span><span class="num grande-num">${q}</span><span class="tiny">${n}</span></button>`)
              .join('')}
          </div>
          ${
            p.retirar.length
              ? `<h3 class="sub-h">Avisados, esperando retirar</h3>
            <div class="pilha">${p.retirar
              .slice(0, 5)
              .map(
                (e) => `<div class="linha entre nowrap"><div class="cresce"><div class="ellipsis"><strong>${esc(e.contato_nome)}</strong> · ${esc(e.produto)}</div><div class="tiny">avisado ${dataHoraBR(e.avisado_em)}${e.valor_total != null ? ` · ${R(e.valor_total)}` : ''}</div></div>
                <button class="btn peq" data-entregar="${esc(e.id)}">${ic('check', 'sm')} Entregue</button></div>`,
              )
              .join('')}</div>`
              : ''
          }
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Últimos 6 meses</h3><div class="legenda"><span><i class="leg-inv"></i>Investido</span><span><i class="leg-ven"></i>Venda</span></div></div>
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
      <div class="titulo"><h2>Notas recentes</h2><a href="#notas" class="small">Ver todas</a></div>
      ${p.recentes.length ? `<div class="card lista">${p.recentes.map(linhaNota).join('')}</div>` : `<div class="card">${vazio('nota', 'Nenhuma nota ainda', 'Envie a foto da primeira nota fiscal para começar.', `<a class="btn primario" href="#enviar">${ic('camera')} Enviar nota</a>`)}</div>`}
    </section>`;

  $$('[data-periodo]', pag).forEach((b) => (b.onclick = () => ((periodoPainel = b.dataset.periodo), render())));
  $$('[data-filtro]', pag).forEach((b) => (b.onclick = () => ((S.filtroEnc = b.dataset.filtro), ir('encomendas'))));
  $$('[data-entregar]', pag).forEach((b) => (b.onclick = () => comBotao(b, async () => (await mudarStatus([b.dataset.entregar], 'entregue'), toast('Encomenda entregue ✓')))));
  $('#nova-enc')?.addEventListener('click', () => formEncomenda(null));
  $('#comecar-enc')?.addEventListener('click', () => formEncomenda(null));
}

function cartaoAviso(g) {
  const total = g.encs.reduce((s, e) => s + (e.valor_total || 0), 0);
  return `<div class="aviso-cliente">
    <a href="#cliente-${esc(g.id)}" class="avatar">${esc(iniciais(g.nome))}</a>
    <div class="cresce">
      <div class="linha entre"><strong>${esc(g.nome)}</strong><span class="tiny">${esc(formatarTelefone(g.telefone)) || 'sem WhatsApp'}</span></div>
      <ul class="itens">${g.encs
        .map(
          (e) => `<li><span class="ellipsis">${numeroBR(e.quantidade, 3)}× ${esc(e.produto)}${e.nota_id ? ` <a class="tiny" href="#nota-${esc(e.nota_id)}">(nota ${esc(e.nota_numero || 's/nº')})</a>` : ''}</span><span class="num">${e.valor_total != null ? R(e.valor_total) : '—'}</span></li>`,
        )
        .join('')}</ul>
      ${g.encs.length > 1 ? `<div class="linha entre small total-linha"><span>Total</span><strong class="num">${R(total)}</strong></div>` : ''}
    </div>
    <div class="acoes">${botaoWhats(g, g.encs, { rotulo: 'Avisar' })}</div>
  </div>`;
}

function linhaNota(n) {
  return `<a class="lista-item" href="#nota-${esc(n.id)}">
    <span class="avatar quadrado">${ic('nota')}</span>
    <span class="cresce">
      <span class="linha gap-8"><strong class="ellipsis">${esc(n.emitente_nome || 'Fornecedor não identificado')}</strong>${n.para_avisar ? `<span class="badge st-chegou">${n.para_avisar} p/ avisar</span>` : ''}</span>
      <span class="tiny ellipsis bloco">${n.numero ? `Nº ${esc(n.numero)} · ` : ''}${dataBR(n.data)} · ${n.itens} ite${n.itens === 1 ? 'm' : 'ns'}${n.primeiro_item ? ` · ${esc(n.primeiro_item)}` : ''}</span>
    </span>
    <span class="num dir-txt"><strong>${R(n.investido)}</strong><span class="tiny bloco">venda ${R(n.venda)}</span></span>
  </a>`;
}

// ============================================================
// ENVIAR NOTA (foto / PDF / XML)
// ============================================================
let envio = [];

async function prepararArquivo(file) {
  const nome = file.name || 'arquivo';
  if (/xml/.test(file.type) || /\.xml$/i.test(nome)) return [{ nome, tipo: 'xml', texto: await file.text(), rotulo: 'XML' }];
  if (file.type === 'application/pdf' || /\.pdf$/i.test(nome)) {
    const paginas = await pdfParaImagens(file);
    return Promise.all(paginas.map(async (cv, i) => ({ nome: `${nome} p.${i + 1}`, tipo: 'image', blob: await canvasParaBlob(cv), preview: cv.toDataURL('image/jpeg', 0.6) })));
  }
  // Foto: reduz e comprime no próprio aparelho
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await new Promise((ok, erro) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => erro(new ErroUsuario(`Não consegui abrir "${nome}". Envie em JPG ou PNG.`));
      img.src = URL.createObjectURL(file);
    });
  }
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * escala);
  cv.height = Math.round(bmp.height * escala);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return [{ nome, tipo: 'image', blob: await canvasParaBlob(cv), preview: cv.toDataURL('image/jpeg', 0.6) }];
}

function paginaEnviar(pag) {
  const semIA = !S.sample;
  pag.innerHTML = `
    <div class="cabecalho"><div><h1>Enviar nota fiscal</h1><p class="sub">Tire uma foto da nota (ou mande o PDF/XML). Se a nota tiver mais de uma página, adicione todas.</p></div></div>
    ${semIA ? `<div class="alerta aviso mb">${ic('alerta')}<div><strong>Leitura automática de fotos desligada.</strong> ${LOCAL ? 'Para ligar, coloque a chave grátis do Google Gemini em <a href="#ajustes">Ajustes</a> (leva 2 minutos).' : 'Abra o site pelo claude.ai com a sua conta para a leitura automática.'} Enquanto isso, envie o <b>XML</b> da nota ou <a href="#nova-nota">digite a nota</a>.</div></div>` : ''}
    <div class="zona-envio" id="zona">
      <div class="ic-grande">${ic('camera')}</div>
      <h2>Fotografe a nota fiscal</h2>
      <p class="muted">Também aceita PDF ou o arquivo XML da NF-e.</p>
      <div class="botoes">
        <button class="btn primario grande" id="bt-camera">${ic('camera')} Tirar foto</button>
        <button class="btn grande" id="bt-arquivo">${ic('upload')} Escolher arquivo</button>
      </div>
      <input type="file" id="in-camera" accept="image/*" capture="environment" hidden />
      <input type="file" id="in-arquivo" accept="image/*,application/pdf,.pdf,.xml,text/xml,application/xml" multiple hidden />
      <p class="tiny so-desktop">Ou arraste os arquivos para cá.</p>
    </div>
    <div id="lista-envio"></div>
    <div class="dicas">
      <div>${ic('luz')}<span><b>Boa luz</b>, sem sombra e sem flash estourando.</span></div>
      <div>${ic('quadro')}<span><b>Nota inteira</b> na foto, reta e sem cortar os valores.</span></div>
      <div>${ic('folhas')}<span><b>Várias páginas?</b> Tire uma foto de cada e envie juntas.</span></div>
    </div>
    <p class="small muted centro">Prefere digitar? <a href="#nova-nota">Cadastrar nota manualmente</a></p>`;

  const maxFotos = S.limites?.images?.maxCount || 8;
  const adicionar = async (files) => {
    for (const f of files) {
      try {
        const partes = await prepararArquivo(f);
        if (partes[0].tipo === 'xml') envio = partes;
        else envio = envio.filter((x) => x.tipo !== 'xml').concat(partes);
      } catch (e) {
        falhou(e);
      }
    }
    if (envio.length > maxFotos) {
      envio = envio.slice(0, maxFotos);
      toast(`Máximo de ${maxFotos} fotos por nota.`, 'erro');
    }
    desenharLista();
  };

  const desenharLista = () => {
    const el = $('#lista-envio');
    if (!el) return;
    if (!envio.length) return (el.innerHTML = '');
    const temXml = envio.some((a) => a.tipo === 'xml');
    el.innerHTML = `
      <div class="card pad secao">
        <div class="linha entre"><h3>${envio.length} arquivo${envio.length > 1 ? 's' : ''} pronto${envio.length > 1 ? 's' : ''}</h3>
          ${temXml ? '' : `<button class="btn peq" id="bt-mais">${ic('mais', 'sm')} Adicionar página</button>`}</div>
        <div class="miniaturas">
          ${envio
            .map(
              (a, i) => `<div class="mini">${a.preview ? `<img src="${a.preview}" alt="Página ${i + 1}">` : `<div class="tipo">${a.rotulo}<small>${esc(a.nome)}</small></div>`}
              <button class="remover" data-rem="${i}" aria-label="Remover">${ic('x', 'sm')}</button>${envio.length > 1 ? `<span class="pag">pág. ${i + 1}</span>` : ''}</div>`,
            )
            .join('')}
        </div>
        <button class="btn primario grande bloco mt" id="bt-ler" ${!temXml && semIA ? 'disabled' : ''}>${ic('check')} ${temXml ? 'Importar nota' : 'Ler nota fiscal'}</button>
      </div>`;
    $$('[data-rem]', el).forEach((b) => (b.onclick = () => (envio.splice(Number(b.dataset.rem), 1), desenharLista())));
    $('#bt-mais', el)?.addEventListener('click', () => $('#in-camera').click());
    $('#bt-ler', el).onclick = enviar;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const enviar = async () => {
    const etapas = ['Preparando as fotos…', 'Lendo os itens…', 'Conferindo os valores…', 'Procurando encomendas dos clientes…', 'Quase lá…'];
    const ov = document.createElement('div');
    ov.className = 'lendo';
    ov.innerHTML = `<div class="caixa"><div class="spinner"></div><h2>Lendo a nota fiscal</h2><p class="etapa">${etapas[0]}</p><p class="tiny">Normalmente leva poucos segundos.</p></div>`;
    document.body.append(ov);
    let k = 0;
    const t = setInterval(() => {
      k = Math.min(k + 1, etapas.length - 1);
      $('.etapa', ov).textContent = etapas[k];
    }, 2500);
    try {
      let lido;
      let origem;
      let arquivos = [];
      const xml = envio.find((a) => a.tipo === 'xml');
      if (xml) {
        if (!ehXmlNFe(xml.texto)) throw new ErroUsuario('Este XML não é de uma NF-e.');
        const nota = { ...lerXmlNFe(xml.texto), moeda: 'BRL' };
        $('.etapa', ov).textContent = 'Identificando os produtos…';
        lido = { nota, sugestoes: await nomearItens(nota.itens) };
        origem = 'xml';
      } else {
        const blobs = envio.map((a) => a.blob);
        lido = await lerNotaPorFoto(blobs);
        origem = 'foto';
        if (S.assets) {
          $('.etapa', ov).textContent = 'Guardando a foto da nota…';
          for (const b of blobs) {
            try {
              const up = await S.assets.upload(b);
              arquivos.push({ asset_id: up.id, tipo: 'image/jpeg' });
            } catch (e) {
              console.warn('foto não guardada', e);
            }
          }
        }
      }
      $('.etapa', ov).textContent = 'Salvando…';
      const r = await criarNota(lido.nota, { origem, arquivos, sugestoes: lido.sugestoes });
      envio = [];
      S.flash = { nota: r.id, vinculadas: r.vinculadas };
      ir(`nota-${r.id}`);
      if (origem === 'foto') melhorarNomes(r.id);
    } catch (e) {
      if (e.notaId) {
        toast('Essa nota já estava cadastrada. Abrindo…');
        envio = [];
        ir(`nota-${e.notaId}`);
      } else falhou(e);
    } finally {
      clearInterval(t);
      ov.remove();
      if (S.renderPendente) render();
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
let buscaNotas = '';
function paginaNotas(pag) {
  pag.innerHTML = `
    <div class="cabecalho">
      <div><h1>Notas fiscais</h1><p class="sub">Tudo o que você comprou, com custo, preço de venda e retorno.</p></div>
      <div class="linha"><a class="btn" href="#nova-nota">${ic('lapis', 'sm')} Digitar nota</a><a class="btn primario" href="#enviar">${ic('camera')} Enviar nota</a></div>
    </div>
    <div class="linha mb"><label class="busca">${ic('busca')}<input type="search" id="busca-notas" placeholder="Buscar fornecedor, número ou produto…" value="${esc(buscaNotas)}" /></label></div>
    <div id="lista"></div>`;
  const carregar = () => {
    const notas = listarNotas(buscaNotas);
    const el = $('#lista');
    if (!notas.length) {
      el.innerHTML = `<div class="card">${buscaNotas ? vazio('busca', 'Nada encontrado', 'Tente outra palavra.') : vazio('nota', 'Nenhuma nota ainda', 'Envie a foto da primeira nota fiscal.', `<a class="btn primario" href="#enviar">${ic('camera')} Enviar nota</a>`)}</div>`;
      return;
    }
    const tot = notas.reduce((a, n) => ({ inv: a.inv + n.investido, ven: a.ven + n.venda }), { inv: 0, ven: 0 });
    el.innerHTML = `
      <div class="card so-desktop rolagem-x">
        <table class="tabela">
          <thead><tr><th>Data</th><th>Fornecedor</th><th>Nº</th><th class="dir">Itens</th><th class="dir">Investido</th><th class="dir">Venda</th><th class="dir">Retorno</th><th>Encomendas</th></tr></thead>
          <tbody>${notas
            .map(
              (n) => `<tr class="clicavel" data-ir="nota-${esc(n.id)}">
              <td class="num">${dataBR(n.data)}</td>
              <td><strong>${esc(n.emitente_nome || '—')}</strong><div class="tiny ellipsis max-320">${esc(n.primeiro_item || '')}</div></td>
              <td>${esc(n.numero || '—')}</td>
              <td class="dir num">${n.itens}</td>
              <td class="dir num">${R(n.investido)}</td>
              <td class="dir num">${R(n.venda)}</td>
              <td class="dir num lucro-pos">${R(n.lucro)}</td>
              <td>${n.para_avisar ? `<span class="badge st-chegou">${n.para_avisar} p/ avisar</span>` : n.encomendas ? `<span class="badge">${n.encomendas}</span>` : '<span class="tiny">—</span>'}</td>
            </tr>`,
            )
            .join('')}</tbody>
          <tfoot><tr><td colspan="4" class="tiny">${notas.length} nota${notas.length > 1 ? 's' : ''}</td><td class="dir num"><strong>${R(tot.inv)}</strong></td><td class="dir num"><strong>${R(tot.ven)}</strong></td><td class="dir num lucro-pos"><strong>${R(tot.ven - tot.inv)}</strong></td><td></td></tr></tfoot>
        </table>
      </div>
      <div class="card lista so-mobile">${notas.map(linhaNota).join('')}</div>`;
    $$('[data-ir]', el).forEach((tr) => (tr.onclick = () => ir(tr.dataset.ir)));
  };
  $('#busca-notas').oninput = debounce((e) => ((buscaNotas = $('#busca-notas').value.trim()), carregar()), 200);
  carregar();
}

// ============================================================
// NOTA (detalhe, porcentagens e encomendas)
// ============================================================
const ORIGENS = { foto: '📷 por foto', pdf: '📄 PDF', xml: '🧾 XML', manual: '✍️ digitada' };

function paginaNota(pag, id) {
  const original = S.notas.get(id);
  if (!original) {
    pag.innerHTML = `<a href="#notas" class="voltar">${ic('seta', 'sm')} Notas</a>${vazio('alerta', 'Nota não encontrada', 'Ela pode ter sido excluída.')}`;
    return;
  }
  const nota = JSON.parse(JSON.stringify(original)); // cópia editável
  nota.itens = nota.itens || [];
  const modo = S.ajustes.arredondamento;
  // o aviso de "nota cadastrada" fica até sair desta nota (a tela pode ser redesenhada mais de uma vez)
  const flash = S.flash?.nota === id ? S.flash : null;

  const todasEnc = [...S.encomendas.values()].map(enc).filter((e) => e.nota_id === id);
  nota.itens.forEach((i) => (i.encomendas = todasEnc.filter((e) => e.item_id === i.id)));
  const recalc = () => resumoNota(nota, nota.itens, modo);
  let r = recalc();
  const abertas = todasEnc.filter((e) => ['chegou', 'avisado'].includes(e.status));
  const grupos = agruparPorContato(abertas);
  const despesas = (Number(nota.valor_total) || 0) - nota.itens.reduce((s, i) => s + i.valor_total, 0);

  const pessoasDoItem = (item) => {
    const usados = item.encomendas.reduce((s, e) => s + e.quantidade, 0);
    return `<div class="para-quem">
      ${item.encomendas
        .map(
          (e) => `<span class="pessoa st-${e.status}" title="${esc(e.produto)} · ${NOMES_STATUS[e.status]}">
          <a href="#cliente-${esc(e.contato_id)}">${esc(primeiroNome(e.contato_nome))}${e.quantidade !== 1 ? ` · ${numeroBR(e.quantidade, 3)}` : ''}</a>
          ${e.status === 'entregue' ? ic('check', 'sm') : whatsMini({ id: e.contato_id, nome: e.contato_nome, telefone: e.contato_telefone }, [e])}
          <button data-desvincular="${esc(e.id)}" title="Tirar desta nota" aria-label="Tirar cliente">${ic('x', 'sm')}</button></span>`,
        )
        .join('')}
      ${usados + 1e-9 < item.quantidade ? `<button class="add-pessoa" data-para-quem="${esc(item.id)}">${ic('mais', 'sm')} Para quem é?</button>` : ''}
    </div>`;
  };
  const meta = [nota.numero && `Nº ${esc(nota.numero)}${nota.serie ? `/${esc(nota.serie)}` : ''}`, dataBR(dataNota(nota)), nota.emitente_cnpj && `CNPJ ${esc(nota.emitente_cnpj)}`, ORIGENS[nota.origem], nota.moeda === 'USD' ? '💵 em dólar' : ''].filter(Boolean).join(' · ');
  const M = (v) => naMoeda(v, nota.moeda);
  const semCotacao = nota.moeda === 'USD' && !(Number(nota.cotacao) > 0);
  if (semCotacao && !S.tentouCotacao.has(id)) {
    S.tentouCotacao.add(id);
    obterCotacao().then((c) => c && salvarNota(id, { cotacao: c.valor, cotacao_fonte: c.fonte })).catch(() => {});
  }

  pag.innerHTML = `
    <a href="#notas" class="voltar">${ic('seta', 'sm')} Notas</a>
    <div class="cabecalho">
      <div class="cresce"><h1>${esc(nota.emitente_nome || 'Nota fiscal')}</h1><p class="sub">${meta}</p></div>
      <div class="linha">
        <button class="btn" id="bt-editar">${ic('lapis', 'sm')} Editar dados</button>
        <button class="btn perigo icone" id="bt-excluir" title="Excluir nota" aria-label="Excluir nota">${ic('lixo', 'sm')}</button>
      </div>
    </div>

    ${flash ? `<div class="alerta ok mb">${ic('check')}<div><strong>Nota cadastrada com ${nota.itens.length} ite${nota.itens.length === 1 ? 'm' : 'ns'}.</strong> ${flash.vinculadas ? `Encontrei <b>${flash.vinculadas} encomenda${flash.vinculadas > 1 ? 's' : ''}</b> de clientes nesta nota. Confira abaixo e avise pelo WhatsApp.` : 'Nenhuma encomenda pendente bateu com estes itens. Use “Para quem é?” para indicar o cliente.'} Confira os valores lidos.</div></div>` : ''}
    ${semCotacao ? `<div class="alerta aviso mb">${ic('alerta')}<div><strong>Falta a cotação do dólar.</strong> Não consegui buscar a cotação agora. Digite o valor do dólar no campo “US$ 1 =” abaixo para converter os custos para reais.</div></div>` : ''}
    ${S.melhorando.has(id) ? `<div class="alerta info mb"><span class="spinner peq"></span><div>A IA está revisando os nomes dos produtos. A tela atualiza sozinha.</div></div>` : ''}
    ${nota.avisos?.length ? `<div class="alerta aviso mb">${ic('alerta')}<div><strong>Atenção na leitura:</strong><ul>${nota.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div></div>` : ''}

    <div class="grid kpis" id="kpis"></div>

    <div class="card secao">
      <div class="controles-nota">
        <label class="campo markup-geral" for="markup-geral">Porcentagem padrão
          <span class="input-sufixo"><input id="markup-geral" inputmode="decimal" value="${campoNum(nota.markup_padrao)}" /><span>%</span></span>
        </label>
        <button class="btn" id="bt-aplicar">Aplicar a todos os itens</button>
        <label class="campo moeda-nota" for="moeda-nota">Moeda da nota
          <select id="moeda-nota"><option value="USD" ${nota.moeda === 'USD' ? 'selected' : ''}>Dólar (US$)</option><option value="BRL" ${nota.moeda !== 'USD' ? 'selected' : ''}>Real (R$)</option></select>
        </label>
        ${nota.moeda === 'USD' ? `<label class="campo cotacao-nota" for="cotacao-nota">US$ 1 =
          <span class="input-prefixo"><input id="cotacao-nota" inputmode="decimal" value="${Number(nota.cotacao) > 0 ? String(nota.cotacao).replace('.', ',') : ''}" placeholder="5,40" /><span>R$</span></span>
          <span class="tiny">${nota.cotacao_fonte === 'dia' ? 'cotação do dia' : nota.cotacao_fonte === 'fixa' ? 'cotação fixa dos Ajustes' : nota.cotacao_fonte === 'ultima' ? 'última cotação conhecida' : 'digitada'}</span>
        </label>` : ''}
        <label class="check" title="Espalha frete, impostos e descontos da nota no custo de cada item">
          <input type="checkbox" id="ratear" ${nota.ratear_despesas ? 'checked' : ''} />
          <span>Incluir frete/impostos no custo <span class="tiny bloco">${Math.abs(despesas) >= 0.01 ? `${despesas > 0 ? '+' : '−'}${M(Math.abs(despesas))} além dos produtos` : 'nota sem despesas extras'}</span></span>
        </label>
        ${(nota.arquivos || []).filter((a) => srcArquivo(a.asset_id)).length ? `<div class="foto-nota">${nota.arquivos.filter((a) => srcArquivo(a.asset_id)).map((a) => `<button data-ver="${esc(srcArquivo(a.asset_id))}" aria-label="Ver foto da nota"><img src="${esc(srcArquivo(a.asset_id))}" alt="Foto da nota" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>

      <div class="itens-tabela rolagem-x">
        <table class="tabela">
          <thead><tr><th>Produto</th><th class="dir">Qtd</th><th class="dir">Custo un.</th><th class="dir">% em cima</th><th class="dir">Preço un.</th><th class="dir">Total venda</th><th class="dir">Retorno</th><th></th></tr></thead>
          <tbody>${r.itens
            .map(
              (i) => `<tr data-item="${esc(i.id)}">
              <td class="col-produto"><div class="item-desc">${esc(nomeItem(i))}</div><div class="item-meta">${[i.nome && i.nome !== i.descricao && `Na nota: ${esc(i.descricao)}`, i.codigo && `Cód. ${esc(i.codigo)}`, `${M(i.valor_unitario)} na nota`].filter(Boolean).join(' · ')}</div>${pessoasDoItem(nota.itens.find((x) => x.id === i.id))}</td>
              <td class="dir num">${numeroBR(i.quantidade, 3)}${i.unidade ? ` <span class="tiny">${esc(i.unidade)}</span>` : ''}</td>
              <td class="dir num c-custo"></td>
              <td class="dir"><span class="input-sufixo c-mk-wrap"><input class="campo-tab c-markup" inputmode="decimal" aria-label="Porcentagem" /><span>%</span></span></td>
              <td class="dir"><span class="input-prefixo"><input class="campo-tab preco c-preco" inputmode="decimal" aria-label="Preço de venda" /><span>R$</span></span></td>
              <td class="dir num c-total forte"></td>
              <td class="dir num c-lucro"></td>
              <td><button class="btn fantasma icone" data-menu-item="${esc(i.id)}" title="Editar item" aria-label="Editar item">${ic('lapis', 'sm')}</button></td>
            </tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>
      <div class="itens-cards">${r.itens
        .map(
          (i) => `<div class="item-card" data-item="${esc(i.id)}">
          <div class="linha entre topo nowrap"><div class="cresce"><div class="item-desc">${esc(nomeItem(i))}</div>
          ${i.nome && i.nome !== i.descricao ? `<div class="item-meta">Na nota: ${esc(i.descricao)}</div>` : ''}
          <div class="item-meta">${numeroBR(i.quantidade, 3)} ${esc(i.unidade || 'un')} · custo <span class="c-custo"></span> cada</div></div>
          <button class="btn fantasma icone" data-menu-item="${esc(i.id)}" aria-label="Editar item">${ic('lapis', 'sm')}</button></div>
          <div class="valores">
            <label>% em cima<span class="input-sufixo c-mk-wrap"><input class="c-markup" inputmode="decimal" /><span>%</span></span></label>
            <label>Preço de venda (un.)<span class="input-prefixo"><input class="c-preco" inputmode="decimal" /><span>R$</span></span></label>
          </div>
          <div class="totais"><span>Total: <strong class="c-total num"></strong></span><span>Retorno: <strong class="c-lucro num"></strong></span></div>
          ${pessoasDoItem(nota.itens.find((x) => x.id === i.id))}
        </div>`,
        )
        .join('')}</div>
      <div class="rodape-card linha entre">
        <button class="btn peq" id="bt-add-item">${ic('mais', 'sm')} Adicionar item</button>
        <button class="btn peq fantasma" id="bt-combinar" title="Procura de novo encomendas pendentes que batem com os itens">${ic('link', 'sm')} Procurar encomendas</button>
      </div>
    </div>

    ${grupos.length ? `<section class="secao"><div class="titulo"><h2>Avisar os clientes desta nota</h2><span class="tiny">Mensagem pronta com o valor de cada produto</span></div><div class="card lista">${grupos.map(cartaoAviso).join('')}</div></section>` : ''}
    ${nota.observacoes ? `<div class="card pad secao"><h3>Observações</h3><p class="muted pre">${esc(nota.observacoes)}</p></div>` : ''}`;

  const pintarKpis = () => {
    $('#kpis').innerHTML = `
      <div class="card kpi"><div class="rotulo">${ic('carteira', 'sm')} Investido</div><div class="valor">${R(r.investido)}</div><div class="det">total da nota ${M(nota.valor_total)}${nota.moeda === 'USD' && nota.cotacao ? ` · US$ 1 = ${R(nota.cotacao)}` : ''}</div></div>
      <div class="card kpi"><div class="rotulo">${ic('sacola', 'sm')} Valor de venda</div><div class="valor">${R(r.venda)}</div><div class="det">${nota.itens.length} ite${nota.itens.length === 1 ? 'm' : 'ns'}</div></div>
      <div class="card kpi destaque"><div class="rotulo">${ic('tendencia', 'sm')} Retorno</div><div class="valor">${R(r.lucro)}</div><div class="det">margem ${pct(r.margem)}</div></div>
      <div class="card kpi"><div class="rotulo">${ic('caixa', 'sm')} Encomendas</div><div class="valor">${todasEnc.length}</div><div class="det">${abertas.filter((e) => e.status === 'chegou').length} para avisar</div></div>`;
  };
  const pintarItem = (calc, itemId, exceto) => {
    $$(`[data-item="${CSS.escape(itemId)}"]`, pag).forEach((row) => {
      $('.c-custo', row).textContent = R(calc.custoUnit);
      const mk = $('.c-markup', row);
      const pr = $('.c-preco', row);
      if (mk !== exceto) mk.value = campoNum(calc.markup);
      if (pr !== exceto) pr.value = calc.precoUnit.toFixed(2).replace('.', ',');
      $('.c-mk-wrap', row).classList.toggle('markup-proprio', calc.markupProprio);
      $('.c-total', row).textContent = R(calc.precoTotal);
      const l = $('.c-lucro', row);
      l.textContent = R(calc.lucro);
      l.classList.toggle('lucro-pos', calc.lucro >= 0);
      l.classList.toggle('lucro-neg', calc.lucro < 0);
    });
  };
  const pintarTudo = (exceto) => {
    r = recalc();
    r.itens.forEach((i) => pintarItem(i.calc, i.id, exceto));
    pintarKpis();
  };
  pintarTudo();

  const itensParaSalvar = () => nota.itens.map(({ encomendas, calc, ...i }) => i);
  const salvarItens = debounce(() => salvarNota(id, { itens: itensParaSalvar() }).catch(falhou), 700);

  $$('.c-markup', pag).forEach((inp) => {
    inp.oninput = () => {
      const item = nota.itens.find((x) => x.id === inp.closest('[data-item]').dataset.item);
      const v = lerNumero(inp.value);
      item.markup = inp.value.trim() === '' ? null : Number.isFinite(v) ? v : item.markup;
      pintarTudo(inp);
      salvarItens();
    };
    inp.onfocus = () => inp.select();
  });
  $$('.c-preco', pag).forEach((inp) => {
    inp.oninput = () => {
      const itemId = inp.closest('[data-item]').dataset.item;
      const item = nota.itens.find((x) => x.id === itemId);
      const calc = r.itens.find((x) => x.id === itemId).calc;
      const v = lerNumero(inp.value);
      if (!Number.isFinite(v) || v <= 0) return;
      item.markup = markupParaPreco(calc.custoUnit, v);
      pintarTudo(inp);
      salvarItens();
    };
    inp.onfocus = () => inp.select();
    inp.onblur = () => pintarTudo();
  });

  const mg = $('#markup-geral');
  const salvarPadrao = debounce((v) => salvarNota(id, { markup_padrao: v }).catch(falhou), 700);
  mg.onfocus = () => mg.select();
  mg.oninput = () => {
    const v = lerNumero(mg.value);
    if (!Number.isFinite(v)) return;
    nota.markup_padrao = v;
    pintarTudo();
    salvarPadrao(v);
  };
  $('#bt-aplicar').onclick = async () => {
    const v = lerNumero(mg.value);
    if (!Number.isFinite(v)) return toast('Digite a porcentagem.', 'erro');
    const proprios = nota.itens.filter((i) => i.markup !== null && i.markup !== undefined).length;
    if (proprios && !(await confirmar('Aplicar a todos?', `${proprios} ite${proprios > 1 ? 'ns têm' : 'm tem'} porcentagem própria. Todos vão ficar com ${numeroBR(v)}%.`, { botao: 'Aplicar' }))) return;
    nota.itens.forEach((i) => (i.markup = null));
    await salvarNota(id, { markup_padrao: v, itens: itensParaSalvar() }).catch(falhou);
    toast(`${numeroBR(v)}% aplicado em todos os itens ✓`);
  };
  $('#ratear').onchange = (e) => salvarNota(id, { ratear_despesas: e.target.checked ? 1 : 0 }).catch(falhou);
  $('#moeda-nota').onchange = async (e) => {
    const moeda = e.target.value;
    const dados = { moeda };
    if (moeda === 'USD' && !(Number(nota.cotacao) > 0)) {
      const c = await obterCotacao();
      if (c) Object.assign(dados, { cotacao: c.valor, cotacao_fonte: c.fonte });
    }
    await salvarNota(id, dados).catch(falhou);
    toast(moeda === 'USD' ? 'Nota em dólar: custos convertidos para reais ✓' : 'Nota em reais ✓');
  };
  const cot = $('#cotacao-nota');
  if (cot) {
    const salvarCot = debounce((v) => salvarNota(id, { cotacao: v, cotacao_fonte: 'digitada' }).catch(falhou), 700);
    cot.onfocus = () => cot.select();
    cot.oninput = () => {
      const v = lerNumero(cot.value);
      if (!(v > 0)) return;
      nota.cotacao = v;
      pintarTudo(cot);
      salvarCot(v);
    };
  }

  $$('[data-ver]', pag).forEach((b) => (b.onclick = () => verImagem(b.dataset.ver)));
  $('#bt-editar').onclick = () => formCabecalhoNota(original);
  $('#bt-excluir').onclick = async () => {
    if (!(await confirmar('Excluir esta nota?', `A nota e seus ${nota.itens.length} itens serão apagados. As encomendas ligadas voltam para “aguardando”.`, { botao: 'Excluir', perigo: true }))) return;
    try {
      await liberar((e) => e.nota_id === id);
      await S.db.doc(`notas/${id}`).delete();
      for (const a of original.arquivos || []) await S.assets?.delete(a.asset_id).catch(() => {});
      toast('Nota excluída');
      ir('notas');
    } catch (e) {
      falhou(e);
    }
  };
  $('#bt-add-item').onclick = () => formItem(original, null);
  $('#bt-combinar').onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const n = await combinarNota(original);
      toast(n ? `${n} encomenda(s) encontrada(s) ✓` : 'Nenhuma encomenda pendente bateu com os itens.');
    });
  $$('[data-menu-item]', pag).forEach((b) => (b.onclick = () => formItem(original, original.itens.find((i) => i.id === b.dataset.menuItem))));
  $$('[data-para-quem]', pag).forEach((b) => (b.onclick = () => paraQuem(original, nota.itens.find((i) => i.id === b.dataset.paraQuem), r)));
  $$('[data-desvincular]', pag).forEach(
    (b) =>
      (b.onclick = async () => {
        if (!(await confirmar('Tirar o cliente deste item?', 'A encomenda volta para “aguardando chegar”.', { botao: 'Tirar' }))) return;
        await liberar((e) => e.id === b.dataset.desvincular).catch(falhou);
      }),
  );
}

function formCabecalhoNota(nota) {
  const campos = [
    ['emitente_nome', 'Fornecedor', 'text', 'inteiro'],
    ['emitente_cnpj', 'CNPJ', 'text'],
    ['data_emissao', 'Data de emissão', 'date'],
    ['numero', 'Número', 'text'],
    ['serie', 'Série', 'text'],
    ['valor_total', 'Valor total da nota', 'money'],
    ['frete', 'Frete', 'money'],
    ['desconto', 'Desconto', 'money'],
    ['impostos', 'Impostos adicionais (IPI / ICMS-ST)', 'money'],
    ['cotacao', 'Cotação: US$ 1 = R$ (se for em dólar)', 'money'],
  ];
  const m = modal(
    'Dados da nota',
    `<form class="form-grid" id="f-cab">
      ${campos.map(([k, n, t, cl]) => `<label class="campo ${cl || ''}">${n}<input id="cab-${k}" name="${k}" ${t === 'money' ? 'inputmode="decimal"' : `type="${t}"`} value="${esc(t === 'money' ? campoNum(nota[k]) : nota[k] || '')}" /></label>`).join('')}
      <label class="campo">Moeda<select id="cab-moeda" name="moeda"><option value="USD" ${nota.moeda === 'USD' ? 'selected' : ''}>Dólar (US$)</option><option value="BRL" ${nota.moeda !== 'USD' ? 'selected' : ''}>Real (R$)</option></select></label>
      <label class="campo inteiro">Chave de acesso<input id="cab-chave" name="chave" inputmode="numeric" value="${esc(nota.chave || '')}" /></label>
      <label class="campo inteiro">Observações<textarea id="cab-obs" name="observacoes">${esc(nota.observacoes || '')}</textarea></label>
    </form>`,
    { rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">Salvar</button>' },
  );
  $('#salvar', m.el).onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const d = Object.fromEntries(new FormData($('#f-cab', m.el)));
      for (const [k, , t] of campos) if (t === 'money') d[k] = lerNumero(d[k]) || 0;
      d.cotacao = d.cotacao > 0 ? d.cotacao : null;
      if (d.cotacao) d.cotacao_fonte = 'digitada';
      d.chave = String(d.chave || '').replace(/\D/g, '') || null;
      d.emitente_cnpj = String(d.emitente_cnpj || '').replace(/\D/g, '') || null;
      await salvarNota(nota.id, d);
      m.fechar();
      toast('Nota atualizada ✓');
    });
}

function formItem(nota, item) {
  const novo = !item;
  const i = item || { descricao: '', codigo: '', quantidade: 1, unidade: 'UN', valor_unitario: '', valor_total: '' };
  const m = modal(
    novo ? 'Adicionar item' : 'Editar item',
    `<form class="form-grid" id="f-item">
      <label class="campo inteiro">Nome do produto <span class="tiny">(como você chama)</span><input id="it-nome" name="nome" value="${esc(i.nome || '')}" placeholder="Ex.: Perfume Lattafa Fakhar Black 100ml" autofocus /></label>
      <label class="campo inteiro">Descrição na nota<input id="it-desc" name="descricao" value="${esc(i.descricao)}" required /></label>
      <label class="campo">Código<input id="it-cod" name="codigo" value="${esc(i.codigo || '')}" /></label>
      <label class="campo">Unidade<input id="it-un" name="unidade" value="${esc(i.unidade || '')}" /></label>
      <label class="campo">Quantidade<input id="it-qtd" name="quantidade" inputmode="decimal" value="${campoNum(i.quantidade)}" /></label>
      <label class="campo">Valor unitário (${nota.moeda === 'USD' ? 'US$' : 'R$'})<input id="it-vu" name="valor_unitario" inputmode="decimal" value="${campoNum(i.valor_unitario)}" /></label>
      <label class="campo inteiro">Valor total do item (${nota.moeda === 'USD' ? 'US$' : 'R$'}) <span class="tiny">calculado: quantidade × unitário</span><input id="it-vt" name="valor_total" inputmode="decimal" value="${campoNum(i.valor_total)}" /></label>
      ${!novo && i.markup !== null && i.markup !== undefined ? `<div class="inteiro"><button type="button" class="btn peq" id="reset-mk">${ic('desfazer', 'sm')} Voltar para a porcentagem padrão da nota (${numeroBR(nota.markup_padrao)}%)</button></div>` : ''}
    </form>`,
    {
      rodape: `${novo ? '' : `<button class="btn perigo esquerda" id="excluir">${ic('lixo', 'sm')} Excluir</button>`}<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">Salvar</button>`,
    },
  );
  const f = $('#f-item', m.el);
  const sync = () => {
    const u = lerNumero(f.valor_unitario.value);
    const q = lerNumero(f.quantidade.value) || 1;
    if (Number.isFinite(u)) f.valor_total.value = campoNum(u * q);
  };
  f.valor_unitario.oninput = sync;
  f.quantidade.oninput = sync;
  const itens = () => (nota.itens || []).map((x) => ({ ...x }));
  $('#reset-mk', m.el)?.addEventListener('click', async () => {
    await salvarNota(nota.id, { itens: itens().map((x) => (x.id === i.id ? { ...x, markup: null } : x)) }).catch(falhou);
    m.fechar();
  });
  $('#excluir', m.el)?.addEventListener('click', async () => {
    if ((nota.itens || []).length <= 1) return toast('A nota precisa ter pelo menos um item. Para apagar tudo, exclua a nota.', 'erro');
    if (!(await confirmar('Excluir item?', esc(nomeItem(i)), { botao: 'Excluir', perigo: true }))) return;
    try {
      await liberar((e) => e.nota_id === nota.id && e.item_id === i.id);
      await salvarNota(nota.id, { itens: itens().filter((x) => x.id !== i.id) });
      m.fechar();
    } catch (e) {
      falhou(e);
    }
  });
  $('#salvar', m.el).onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const d = limparItem(
        {
          ...(novo ? {} : i),
          descricao: f.descricao.value,
          nome: f.nome.value,
          codigo: f.codigo.value,
          unidade: f.unidade.value,
          quantidade: lerNumero(f.quantidade.value) || 1,
          valor_unitario: lerNumero(f.valor_unitario.value) || 0,
          valor_total: lerNumero(f.valor_total.value) || 0,
        },
        (nota.itens || []).length,
      );
      const lista = novo ? [...itens(), d] : itens().map((x) => (x.id === i.id ? d : x));
      await salvarNota(nota.id, { itens: lista });
      m.fechar();
      toast(novo ? 'Item adicionado ✓' : 'Item atualizado ✓');
    });
}

// Escolher o cliente de um item: encomenda pendente ou novo cliente.
function paraQuem(nota, item, r) {
  const calc = r.itens.find((x) => x.id === item.id).calc;
  const livre = item.quantidade - item.encomendas.reduce((s, e) => s + e.quantidade, 0);
  const ordenadas = pendentes()
    .map((e) => ({ e: enc(e), s: semelhanca(e.produto, `${item.nome || ''} ${item.descricao} ${item.codigo || ''}`) }))
    .sort((a, b) => b.s - a.s || String(a.e.criado_em).localeCompare(String(b.e.criado_em)));
  const m = modal(
    'Para quem é este produto?',
    `<div class="card pad caixa-item"><div class="item-desc">${esc(nomeItem(item))}</div>${item.nome && item.nome !== item.descricao ? `<div class="tiny">Na nota: ${esc(item.descricao)}</div>` : ''}
      <div class="tiny">${numeroBR(livre, 3)} de ${numeroBR(item.quantidade, 3)} sem dono · preço ${R(calc.precoUnit)} cada</div></div>
    ${
      ordenadas.length
        ? `<h3 class="sub-h">Encomendas aguardando</h3>
      <div class="pilha lista-rolavel">${ordenadas
        .map(
          ({ e, s }) => `<button class="opcao" data-enc="${esc(e.id)}"><span class="avatar">${esc(iniciais(e.contato_nome))}</span>
          <span class="cresce"><strong>${esc(e.contato_nome)}</strong><span class="tiny bloco">${numeroBR(e.quantidade, 3)}× ${esc(e.produto)} · desde ${dataHoraBR(e.criado_em)}</span></span>
          ${s >= LIMITE ? '<span class="badge st-entregue sug">parece ser</span>' : ''}</button>`,
        )
        .join('')}</div>
      <div class="separador">ou</div>`
        : '<p class="muted small mt">Nenhuma encomenda aguardando. Cadastre o cliente abaixo.</p>'
    }
    <h3 class="sub-h">Novo cliente para este item</h3>
    <form class="form-grid" id="f-pq">
      <div class="inteiro">${campoCliente()}</div>
      <label class="campo">Quantidade<input id="pq-qtd" name="quantidade" inputmode="decimal" value="${numeroBR(Math.min(1, livre) || livre, 3)}" /></label>
      <label class="campo">Valor combinado, cada <span class="tiny">(opcional)</span><span class="input-prefixo"><input id="pq-valor" name="valor_combinado" inputmode="decimal" placeholder="${campoNum(calc.precoUnit)}" /><span>R$</span></span></label>
    </form>`,
    { rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">Salvar cliente</button>' },
  );
  ligarCampoCliente(m.el);
  $$('[data-enc]', m.el).forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await vincular(b.dataset.enc, nota, item);
          m.fechar();
          toast('Cliente ligado ao item ✓');
        } catch (e) {
          falhou(e);
        }
      }),
  );
  $('#salvar', m.el).onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const f = $('#f-pq', m.el);
      const cliente = lerCampoCliente(m.el);
      const valor = lerNumero(f.valor_combinado.value);
      const qtd = lerNumero(f.quantidade.value) || 1;
      await criarEncomenda({ ...cliente, produto: nomeItem(item), quantidade: qtd, valor_combinado: Number.isFinite(valor) ? valor * qtd : null, nota, item });
      m.fechar();
      toast('Cliente ligado ao item ✓');
    });
}

// ---- campo "cliente": busca nos clientes ou cadastra novo ----
function campoCliente(atual = null) {
  return `<div class="campo-cliente">
    <label class="campo">Cliente
      <div class="auto"><input class="cli-busca" id="cli-busca" placeholder="Digite o nome do cliente…" autocomplete="off" value="${esc(atual?.nome || '')}" ${atual ? `data-id="${esc(atual.id)}"` : ''} autofocus />
      <div class="auto-lista" hidden></div></div>
    </label>
    <div class="cli-novo" hidden>
      <div class="alerta info small">${ic('mais', 'sm')}<span>Cliente novo. Informe o WhatsApp para poder avisar.</span></div>
      <label class="campo">WhatsApp do cliente<input class="cli-tel" id="cli-tel" type="tel" inputmode="tel" placeholder="(47) 99999-9999" /></label>
    </div>
  </div>`;
}

function ligarCampoCliente(raiz) {
  const inp = $('.cli-busca', raiz);
  const lista = $('.auto-lista', raiz);
  const novo = $('.cli-novo', raiz);
  const contatos = [...S.contatos.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  const mostrar = () => {
    const t = normalizar(inp.value);
    delete inp.dataset.id;
    const dig = inp.value.replace(/\D/g, '');
    const achados = (t ? contatos.filter((c) => normalizar(c.nome).includes(t) || (dig && (c.telefone || '').replace(/\D/g, '').includes(dig))) : contatos).slice(0, 8);
    const exato = contatos.find((c) => normalizar(c.nome) === t);
    if (exato) inp.dataset.id = exato.id;
    novo.hidden = !t || Boolean(exato);
    lista.innerHTML = achados
      .map((c) => `<button type="button" data-id="${esc(c.id)}"><span class="avatar mini-av">${esc(iniciais(c.nome))}</span><span class="cresce"><strong>${esc(c.nome)}</strong> <span class="tiny">${esc(formatarTelefone(c.telefone))}</span></span></button>`)
      .join('');
    lista.hidden = !achados.length || Boolean(exato);
    $$('button', lista).forEach(
      (b) =>
        (b.onmousedown = (ev) => {
          ev.preventDefault();
          const c = S.contatos.get(b.dataset.id);
          inp.value = c.nome;
          inp.dataset.id = c.id;
          lista.hidden = true;
          novo.hidden = true;
        }),
    );
  };
  inp.oninput = mostrar;
  inp.onfocus = () => !inp.dataset.id && mostrar();
  inp.onblur = () => setTimeout(() => (lista.hidden = true), 150);
}

function lerCampoCliente(raiz) {
  const inp = $('.cli-busca', raiz);
  if (inp.dataset.id) return { contato_id: inp.dataset.id };
  const nome = inp.value.trim();
  if (!nome) throw new ErroUsuario('Digite o nome do cliente.');
  return { novo_contato: { nome, telefone: $('.cli-tel', raiz).value } };
}

// ============================================================
// NOTA DIGITADA
// ============================================================
function paginaNotaManual(pag) {
  const linhas = [{ descricao: '', quantidade: '1', valor_unitario: '' }];
  pag.innerHTML = `
    <a href="#notas" class="voltar">${ic('seta', 'sm')} Notas</a>
    <div class="cabecalho"><div><h1>Digitar nota</h1><p class="sub">Para notas sem foto, ou quando preferir digitar.</p></div></div>
    <form id="f-manual">
      <div class="card pad"><div class="form-grid">
        <label class="campo inteiro">Fornecedor<input id="m-forn" name="emitente_nome" placeholder="Ex.: Distribuidora XYZ" /></label>
        <label class="campo">Número da nota<input id="m-num" name="numero" /></label>
        <label class="campo">Data<input id="m-data" name="data_emissao" type="date" value="${diaLocal(agoraISO())}" /></label>
        <label class="campo">Moeda da nota<select id="m-moeda" name="moeda"><option value="USD">Dólar (US$)</option><option value="BRL">Real (R$)</option></select></label>
        <label class="campo">Frete<input id="m-frete" name="frete" inputmode="decimal" placeholder="0,00" /></label>
        <label class="campo">Porcentagem padrão<span class="input-sufixo"><input id="m-mk" name="markup_padrao" inputmode="decimal" value="${campoNum(S.ajustes.markup_padrao)}" /><span>%</span></span></label>
      </div></div>
      <div class="card secao">
        <div class="card-head"><h3>Itens</h3><span class="tiny" id="soma"></span></div>
        <div class="card-body pilha" id="linhas"></div>
        <div class="rodape-card"><button type="button" class="btn peq" id="mais">${ic('mais', 'sm')} Adicionar item</button></div>
      </div>
      <div class="linha secao fim"><a class="btn" href="#notas">Cancelar</a><button class="btn primario grande" id="salvar">${ic('check')} Salvar nota</button></div>
    </form>`;
  const desenhar = () => {
    $('#linhas').innerHTML = linhas
      .map(
        (l, i) => `<div class="linha-item" data-l="${i}">
        <label class="campo">${i === 0 ? 'Descrição' : '<span class="so-mobile">Descrição</span>'}<input id="l${i}-d" data-k="descricao" value="${esc(l.descricao)}" placeholder="Produto" /></label>
        <label class="campo">${i === 0 ? 'Qtd' : '<span class="so-mobile">Qtd</span>'}<input id="l${i}-q" data-k="quantidade" inputmode="decimal" value="${esc(l.quantidade)}" /></label>
        <label class="campo">${i === 0 ? 'Valor unitário' : '<span class="so-mobile">Valor unitário</span>'}<input id="l${i}-v" data-k="valor_unitario" inputmode="decimal" value="${esc(l.valor_unitario)}" /></label>
        <button type="button" class="btn fantasma icone" data-rem="${i}" ${linhas.length === 1 ? 'disabled' : ''} aria-label="Remover item">${ic('x', 'sm')}</button>
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
    const s = linhas.reduce((t, l) => t + (lerNumero(l.valor_unitario) || 0) * (lerNumero(l.quantidade) || 1), 0);
    $('#soma').textContent = `Total dos produtos: ${R(s)}`;
  };
  $('#mais').onclick = () => {
    linhas.push({ descricao: '', quantidade: '1', valor_unitario: '' });
    desenhar();
    $$('[data-k="descricao"]').at(-1).focus();
  };
  $('#f-manual').onsubmit = (e) => {
    e.preventDefault();
    comBotao($('#salvar'), async () => {
      const f = $('#f-manual');
      const itens = linhas
        .filter((l) => l.descricao.trim())
        .map((l) => ({ descricao: l.descricao, quantidade: lerNumero(l.quantidade) || 1, valor_unitario: lerNumero(l.valor_unitario) || 0 }));
      if (!itens.length) throw new ErroUsuario('Adicione pelo menos um item com descrição.');
      const frete = lerNumero(f.frete.value) || 0;
      const soma = itens.reduce((t, i) => t + i.valor_unitario * i.quantidade, 0);
      const r = await criarNota(
        { emitente_nome: f.emitente_nome.value, numero: f.numero.value, data_emissao: f.data_emissao.value, frete, valor_produtos: soma, valor_total: soma + frete, moeda: f.moeda.value, markup_padrao: lerNumero(f.markup_padrao.value), itens },
        { origem: 'manual' },
      );
      S.flash = { nota: r.id, vinculadas: r.vinculadas };
      ir(`nota-${r.id}`);
    });
  };
  desenhar();
}

// ============================================================
// ENCOMENDAS
// ============================================================
const FILTROS_ENC = { abertas: 'Em aberto', aguardando: 'Aguardando', chegou: 'Chegou · avisar', avisado: 'Avisados', entregue: 'Entregues', cancelada: 'Canceladas', todas: 'Todas' };
let buscaEnc = '';

function paginaEncomendas(pag) {
  pag.innerHTML = `
    <div class="cabecalho">
      <div><h1>Encomendas</h1><p class="sub">Anote aqui o que cada cliente pediu. Quando a nota chegar, o site mostra de quem é.</p></div>
      <button class="btn primario" id="nova">${ic('mais')} Nova encomenda</button>
    </div>
    <div class="chips rolagem mb-sm">${Object.entries(FILTROS_ENC).map(([k, v]) => `<button class="chip ${k === S.filtroEnc ? 'ativo' : ''}" data-f="${k}">${v}</button>`).join('')}</div>
    <div class="linha mb"><label class="busca">${ic('busca')}<input type="search" id="busca-enc" placeholder="Buscar produto ou cliente…" value="${esc(buscaEnc)}" /></label></div>
    <div id="lista"></div>`;
  const carregar = () => {
    const encs = listarEncomendas({ status: S.filtroEnc, busca: buscaEnc });
    const el = $('#lista');
    if (!encs.length) {
      el.innerHTML = `<div class="card">${vazio('caixa', buscaEnc ? 'Nada encontrado' : 'Nenhuma encomenda aqui', buscaEnc ? 'Tente outra palavra.' : 'Quando um cliente pedir algo, anote aqui para não esquecer.', buscaEnc ? '' : `<button class="btn primario" data-nova>${ic('mais')} Nova encomenda</button>`)}</div>`;
      $('[data-nova]', el)?.addEventListener('click', () => formEncomenda(null));
      return;
    }
    el.innerHTML = `<div class="card lista">${encs.map(linhaEncomenda).join('')}</div>`;
    ligarAcoesEncomenda(el, encs);
  };
  $$('[data-f]', pag).forEach(
    (b) =>
      (b.onclick = () => {
        S.filtroEnc = b.dataset.f;
        $$('[data-f]', pag).forEach((x) => x.classList.toggle('ativo', x === b));
        carregar();
      }),
  );
  $('#busca-enc').oninput = debounce(() => ((buscaEnc = $('#busca-enc').value.trim()), carregar()), 200);
  $('#nova').onclick = () => formEncomenda(null);
  carregar();
}

function linhaEncomenda(e) {
  const contato = { id: e.contato_id, nome: e.contato_nome, telefone: e.contato_telefone };
  return `<div class="aviso-cliente" data-enc="${esc(e.id)}">
    <a href="#cliente-${esc(e.contato_id)}" class="avatar">${esc(iniciais(e.contato_nome))}</a>
    <div class="cresce">
      <div class="linha gap-8"><strong>${esc(e.produto)}</strong>${e.quantidade !== 1 ? `<span class="badge">${numeroBR(e.quantidade, 3)} un</span>` : ''}${badgeStatus(e.status)}</div>
      <div class="small muted"><a href="#cliente-${esc(e.contato_id)}" class="herda"><b>${esc(e.contato_nome)}</b></a>${e.contato_telefone ? ` · ${esc(formatarTelefone(e.contato_telefone))}` : ''} · pedido ${dataHoraBR(e.criado_em)}</div>
      ${e.item_id ? `<div class="tiny">${ic('link', 'sm')} <a href="#nota-${esc(e.nota_id)}">Nota ${esc(e.nota_numero || 's/nº')}${e.nota_emitente ? ` · ${esc(e.nota_emitente)}` : ''}</a> · ${esc(e.item_descricao)}</div>` : ''}
      ${e.observacoes ? `<div class="tiny pre">📝 ${esc(e.observacoes)}</div>` : ''}
    </div>
    <div class="acoes acoes-enc">
      <div class="num preco-enc">${e.valor_total != null ? R(e.valor_total) : '<span class="tiny">sem preço ainda</span>'}${e.valor_origem === 'combinado' ? '<div class="tiny">combinado</div>' : ''}</div>
      ${['chegou', 'avisado'].includes(e.status) ? botaoWhats(contato, [e], { rotulo: e.status === 'chegou' ? 'Avisar' : 'Reenviar', classe: 'peq' }) : ''}
      <div class="linha nowrap gap-6 fim">
        <select class="sel-peq" data-status aria-label="Situação">${Object.entries({ aguardando: 'Aguardando', chegou: 'Chegou', avisado: 'Avisado', entregue: 'Entregue', cancelada: 'Cancelada' }).map(([k, v]) => `<option value="${k}" ${k === e.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn peq icone" data-editar title="Editar" aria-label="Editar encomenda">${ic('lapis', 'sm')}</button>
      </div>
    </div>
  </div>`;
}

function ligarAcoesEncomenda(el, encs) {
  $$('[data-enc]', el).forEach((row) => {
    const e = encs.find((x) => x.id === row.dataset.enc);
    $('[data-status]', row).onchange = async (ev) => {
      const st = ev.target.value;
      ev.target.blur();
      if (st === 'chegou' && !e.item_id) toast('Dica: ligue a encomenda a uma nota para o preço sair automático.');
      await mudarStatus([e.id], st).then(() => toast('Situação atualizada ✓')).catch(falhou);
    };
    $('[data-editar]', row).onclick = () => formEncomenda(e);
  });
}

function formEncomenda(e, contatoFixo = null) {
  const novo = !e;
  const m = modal(
    novo ? 'Nova encomenda' : 'Editar encomenda',
    `<form class="form-grid" id="f-enc">
      <div class="inteiro">${contatoFixo ? `<label class="campo">Cliente<input id="enc-cli-fixo" value="${esc(contatoFixo.nome)}" disabled /></label>` : campoCliente(e ? { id: e.contato_id, nome: e.contato_nome } : null)}</div>
      <label class="campo inteiro">O que foi encomendado?<input id="enc-prod" name="produto" value="${esc(e?.produto || '')}" placeholder="Ex.: iPhone 14 128GB azul" ${contatoFixo || e ? 'autofocus' : ''} required /></label>
      <label class="campo">Quantidade<input id="enc-qtd" name="quantidade" inputmode="decimal" value="${campoNum(e?.quantidade ?? 1)}" /></label>
      <label class="campo">Valor combinado <span class="tiny">(opcional)</span><span class="input-prefixo"><input id="enc-valor" name="valor_combinado" inputmode="decimal" value="${campoNum(e?.valor_combinado)}" placeholder="calcula pela nota" /><span>R$</span></span></label>
      <label class="campo inteiro">Observações<textarea id="enc-obs" name="observacoes" placeholder="Cor, tamanho, forma de pagamento, sinal pago…">${esc(e?.observacoes || '')}</textarea></label>
      <p class="tiny inteiro">Escreva o produto como deve aparecer na nota (marca, modelo, capacidade). Assim, quando a nota chegar, o site reconhece que é deste cliente.</p>
    </form>`,
    { rodape: `${novo ? '' : `<button class="btn perigo esquerda" id="excluir">${ic('lixo', 'sm')} Excluir</button>`}<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">${novo ? 'Salvar encomenda' : 'Salvar'}</button>` },
  );
  if (!contatoFixo) ligarCampoCliente(m.el);
  $('#excluir', m.el)?.addEventListener('click', async () => {
    if (!(await confirmar('Excluir encomenda?', esc(e.produto), { botao: 'Excluir', perigo: true }))) return;
    await S.db.doc(`encomendas/${e.id}`).delete().catch(falhou);
    m.fechar();
    toast('Encomenda excluída');
  });
  $('#salvar', m.el).onclick = (ev) =>
    comBotao(ev.currentTarget, async () => {
      const f = $('#f-enc', m.el);
      const cliente = contatoFixo ? { contato_id: contatoFixo.id } : lerCampoCliente(m.el);
      const valor = lerNumero(f.valor_combinado.value);
      const d = { ...cliente, produto: f.produto.value, quantidade: lerNumero(f.quantidade.value) || 1, valor_combinado: Number.isFinite(valor) ? valor : null, observacoes: f.observacoes.value };
      if (novo) await criarEncomenda(d);
      else {
        if (!String(d.produto).trim()) throw new ErroUsuario('Informe o produto encomendado.');
        const contato_id = d.contato_id || (await criarContato(d.novo_contato));
        await S.db.doc(`encomendas/${e.id}`).update({ contato_id, produto: d.produto.trim(), quantidade: d.quantidade > 0 ? d.quantidade : 1, valor_combinado: d.valor_combinado, observacoes: d.observacoes.trim() });
      }
      m.fechar();
      toast(novo ? 'Encomenda anotada ✓' : 'Encomenda atualizada ✓');
    });
}

// ============================================================
// CLIENTES
// ============================================================
let buscaCli = '';
function paginaContatos(pag) {
  pag.innerHTML = `
    <div class="cabecalho">
      <div><h1>Clientes</h1><p class="sub">Quem encomenda com você, com WhatsApp a um toque.</p></div>
      <button class="btn primario" id="novo">${ic('mais')} Novo cliente</button>
    </div>
    <div class="linha mb"><label class="busca">${ic('busca')}<input type="search" id="busca-cli" placeholder="Buscar nome ou telefone…" value="${esc(buscaCli)}" /></label></div>
    <div id="lista"></div>`;
  const carregar = () => {
    const t = normalizar(buscaCli);
    const dig = buscaCli.replace(/\D/g, '');
    const encs = [...S.encomendas.values()];
    const cs = [...S.contatos.values()]
      .filter((c) => !t || normalizar(c.nome).includes(t) || (dig && (c.telefone || '').replace(/\D/g, '').includes(dig)))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    $('#lista').innerHTML = cs.length
      ? `<div class="card lista">${cs
          .map((c) => {
            const minhas = encs.filter((e) => e.contato_id === c.id);
            const abertas = minhas.filter((e) => ['aguardando', 'chegou', 'avisado'].includes(e.status)).length;
            return `<a class="lista-item" href="#cliente-${esc(c.id)}">
            <span class="avatar">${esc(iniciais(c.nome))}</span>
            <span class="cresce"><strong>${esc(c.nome)}</strong><span class="tiny bloco">${esc(formatarTelefone(c.telefone)) || 'sem WhatsApp'}${minhas.length ? ` · ${minhas.length} encomenda${minhas.length > 1 ? 's' : ''}` : ''}</span></span>
            ${abertas ? `<span class="badge st-chegou">${abertas} em aberto</span>` : ''}${ic('setaDir', 'sm')}</a>`;
          })
          .join('')}</div>`
      : `<div class="card">${vazio('pessoas', buscaCli ? 'Ninguém encontrado' : 'Nenhum cliente ainda', buscaCli ? 'Tente outro nome.' : 'Cadastre seus clientes para avisar pelo WhatsApp.')}</div>`;
  };
  $('#busca-cli').oninput = debounce(() => ((buscaCli = $('#busca-cli').value), carregar()), 200);
  $('#novo').onclick = () => formContato(null, (id) => ir(`cliente-${id}`));
  carregar();
}

function paginaContato(pag, id) {
  const c = S.contatos.get(id);
  if (!c) {
    pag.innerHTML = `<a href="#clientes" class="voltar">${ic('seta', 'sm')} Clientes</a>${vazio('alerta', 'Cliente não encontrado', 'Ele pode ter sido excluído.')}`;
    return;
  }
  const encs = listarEncomendas({ contato_id: id, status: 'todas' }).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
  const abertas = encs.filter((e) => ['chegou', 'avisado'].includes(e.status));
  const gasto = encs.filter((e) => e.status === 'entregue').reduce((s, e) => s + (e.valor_total || 0), 0);
  pag.innerHTML = `
    <a href="#clientes" class="voltar">${ic('seta', 'sm')} Clientes</a>
    <div class="cabecalho">
      <div class="linha gap-14"><span class="avatar grande-av">${esc(iniciais(c.nome))}</span>
        <div><h1>${esc(c.nome)}</h1><p class="sub">${esc(formatarTelefone(c.telefone)) || 'sem WhatsApp'}${gasto ? ` · já comprou ${R(gasto)}` : ''}</p></div></div>
      <div class="linha">
        ${c.telefone ? `<a class="btn wa" href="${esc(linkWhatsApp(c.telefone, `Olá, ${primeiroNome(c.nome)}!`))}" target="_blank" rel="noopener">${ic('whats')} Conversar</a>` : ''}
        <button class="btn" id="editar">${ic('lapis', 'sm')} Editar</button>
        <button class="btn perigo icone" id="excluir" title="Excluir" aria-label="Excluir cliente">${ic('lixo', 'sm')}</button>
      </div>
    </div>
    ${c.observacoes ? `<div class="alerta info mb">📝 <span class="pre">${esc(c.observacoes)}</span></div>` : ''}
    ${abertas.length ? `<div class="card mb">${cartaoAviso({ id: c.id, nome: c.nome, telefone: c.telefone, encs: abertas })}</div>` : ''}
    <div class="secao"><div class="titulo"><h2>Encomendas</h2><button class="btn peq" id="nova">${ic('mais', 'sm')} Nova encomenda</button></div>
      <div id="lista">${encs.length ? `<div class="card lista">${encs.map(linhaEncomenda).join('')}</div>` : `<div class="card">${vazio('caixa', 'Nenhuma encomenda', 'Anote o que este cliente pediu.')}</div>`}</div>
    </div>`;
  ligarAcoesEncomenda($('#lista'), encs);
  $('#nova').onclick = () => formEncomenda(null, c);
  $('#editar').onclick = () => formContato(c);
  $('#excluir').onclick = async () => {
    if (!(await confirmar(`Excluir ${esc(c.nome)}?`, `O cliente e ${encs.length} encomenda(s) dele serão apagados.`, { botao: 'Excluir', perigo: true }))) return;
    try {
      for (const e of encs) await S.db.doc(`encomendas/${e.id}`).delete();
      await S.db.doc(`contatos/${c.id}`).delete();
      toast('Cliente excluído');
      ir('clientes');
    } catch (err) {
      falhou(err);
    }
  };
}

function formContato(c, depois) {
  const novo = !c;
  const m = modal(
    novo ? 'Novo cliente' : 'Editar cliente',
    `<form class="pilha" id="f-cli">
      <label class="campo">Nome<input id="c-nome" name="nome" value="${esc(c?.nome || '')}" required autofocus /></label>
      <label class="campo">WhatsApp<input id="c-tel" name="telefone" type="tel" inputmode="tel" value="${esc(c?.telefone || '')}" placeholder="(47) 99999-9999" /></label>
      <label class="campo">Observações<textarea id="c-obs" name="observacoes" placeholder="Ex.: prefere retirar à tarde">${esc(c?.observacoes || '')}</textarea></label>
    </form>`,
    { rodape: '<button class="btn" data-fechar>Cancelar</button><button class="btn primario" id="salvar">Salvar</button>' },
  );
  $('#salvar', m.el).onclick = (e) =>
    comBotao(e.currentTarget, async () => {
      const d = Object.fromEntries(new FormData($('#f-cli', m.el)));
      const id = novo ? await criarContato(d) : (await salvarContato(c.id, d), c.id);
      m.fechar();
      toast('Cliente salvo ✓');
      depois?.(id);
    });
}

// ============================================================
// AJUSTES
// ============================================================
function paginaAjustes(pag) {
  const a = S.ajustes;
  pag.innerHTML = `
    <div class="cabecalho"><div><h1>Ajustes</h1><p class="sub">Padrões de preço e a mensagem do WhatsApp.</p></div></div>
    <form id="f-aj" class="pilha largo-760">
      <div class="card pad"><h2 class="mb-sm">Preço de venda</h2>
        <div class="form-grid">
          <label class="campo">Porcentagem padrão para notas novas<span class="input-sufixo"><input id="aj-mk" name="markup_padrao" inputmode="decimal" value="${campoNum(a.markup_padrao)}" /><span>%</span></span></label>
          <label class="campo">Arredondar o preço final<select id="aj-arr" name="arredondamento">${Object.entries(MODOS_ARREDONDAMENTO).map(([k, v]) => `<option value="${k}" ${k === a.arredondamento ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <p class="tiny inteiro" id="exemplo"></p>
        </div>
      </div>
      <div class="card pad"><h2>Mensagem do WhatsApp</h2>
        <p class="tiny mb-sm">Use: <b>{nome}</b> primeiro nome · <b>{itens}</b> lista dos produtos com valor · <b>{total}</b> valor total · <b>{loja}</b> nome da loja</p>
        <div class="form-grid">
          <label class="campo inteiro">Nome da loja (opcional)<input id="aj-loja" name="nome_loja" value="${esc(a.nome_loja)}" /></label>
          <label class="campo">Modelo<textarea id="aj-msg" name="mensagem" class="alto">${esc(a.mensagem)}</textarea></label>
          <div class="campo"><span>Como o cliente vê</span><div id="previa" class="bolha-wa"></div></div>
        </div>
        <button type="button" class="btn peq mt" id="restaurar">${ic('desfazer', 'sm')} Voltar à mensagem padrão</button>
      </div>
      <div class="linha"><button class="btn primario grande" id="salvar">${ic('check')} Salvar ajustes</button></div>
    </form>
    ${LOCAL ? secaoSync() + secaoLocal() : `<div class="card pad secao largo-760">
      <h2 class="mb-sm">Sobre este site</h2>
      <p class="small muted">${S.sample ? '✓ Leitura automática de fotos de notas ativa (usa o Claude da sua conta).' : '⚠ Leitura de fotos indisponível nesta tela. Abra pelo claude.ai com a sua conta.'}</p>
      <p class="small muted">Os dados ficam salvos com segurança e aparecem iguais no celular e no computador.</p>
      <p class="small muted">📱 No celular, use “Adicionar à tela de início” no navegador para abrir como aplicativo.</p>
    </div>`}`;
  const f = $('#f-aj');
  const previa = () => {
    $('#previa').textContent = montarMensagem(f.mensagem.value, {
      nome: 'Joel Souza',
      loja: f.nome_loja.value,
      itens: [
        { produto: 'iPhone 14 128GB', quantidade: 1, valorUnit: 5390 },
        { produto: 'Capinha', quantidade: 2, valorUnit: 39.9 },
      ],
    });
    const mk = lerNumero(f.markup_padrao.value) || 0;
    $('#exemplo').textContent = `Exemplo: produto que custou R$ 100,00 com ${numeroBR(mk)}% → vende por ${R(arredondar(100 * (1 + mk / 100), f.arredondamento.value))}`;
  };
  f.oninput = previa;
  f.onchange = previa;
  previa();
  $('#restaurar').onclick = () => ((f.mensagem.value = MENSAGEM_PADRAO), previa());
  if (LOCAL) { ligarSecaoLocal(); ligarSecaoSync(); }
  f.onsubmit = (e) => {
    e.preventDefault();
    comBotao($('#salvar'), async () => {
      const mk = lerNumero(f.markup_padrao.value);
      if (!Number.isFinite(mk)) throw new ErroUsuario('Porcentagem padrão inválida.');
      await S.db.doc('config/ajustes').set({ markup_padrao: mk, arredondamento: f.arredondamento.value, mensagem: f.mensagem.value || MENSAGEM_PADRAO, nome_loja: f.nome_loja.value });
      toast('Ajustes salvos ✓');
    });
  };
}

// Liga a sincronização neste aparelho (espaço novo ou de outro aparelho), levando junto o que já existe aqui.
async function conectarEspaco(espaco) {
  const ov = document.createElement('div');
  ov.className = 'lendo';
  ov.innerHTML = '<div class="caixa"><div class="spinner"></div><h2>Conectando este aparelho</h2><p class="etapa">Enviando os dados deste aparelho…</p><p class="tiny">Não feche a página.</p></div>';
  document.body.append(ov);
  try {
    await LOCAL.sincronizacao.ligar(espaco, (f, t) => ($('.etapa', ov).textContent = `Enviando os dados deste aparelho… ${f} de ${t}`));
    $('.etapa', ov).textContent = 'Pronto! Abrindo…';
    location.hash = '#ajustes';
    location.reload();
  } catch (e) {
    ov.remove();
    falhou(e);
  }
}

function secaoSync() {
  const sy = LOCAL.sincronizacao;
  if (!sy.disponivel) {
    return `<div class="card pad secao largo-760"><h2>Celular e computador juntos</h2><p class="small muted">A sincronização entre aparelhos ainda não foi configurada neste site.</p></div>`;
  }
  if (!sy.ativa) {
    return `<div class="card pad secao largo-760" id="sync">
      <h2>Celular e computador juntos <span class="badge st-chegou">desligado</span></h2>
      <p class="small muted mb-sm">Hoje este aparelho guarda os dados só para ele. Ligue a sincronização para que notas, encomendas, clientes e fotos apareçam iguais no celular e no computador, na hora.</p>
      <div class="linha"><button type="button" class="btn primario" id="ligar-sync">☁️ Ligar sincronização neste aparelho</button></div>
      <p class="tiny mt">Já ligou em outro aparelho? Lá em Ajustes aparece um QR Code e um link de conexão: abra-o neste aparelho. Os dados que já estão aqui são enviados junto, nada se perde.</p>
    </div>`;
  }
  const link = sy.linkConexao(true);
  return `<div class="card pad secao largo-760" id="sync">
      <h2>Celular e computador juntos <span class="badge st-entregue">☁️ ligado</span></h2>
      <p class="small muted mb-sm">Este aparelho está sincronizado. Para conectar outro celular ou computador, escaneie o QR Code com a câmera dele ou mande o link. O link já leva a chave da leitura de fotos.</p>
      <div class="sync-conectar">
        <div class="qr" id="qr-sync">${sy.qrSvg(link)}</div>
        <div class="pilha cresce">
          <label class="campo" for="link-sync">Link de conexão<input id="link-sync" readonly value="${esc(link)}" /></label>
          <div class="linha"><button type="button" class="btn" id="copiar-sync">${ic('copiar', 'sm')} Copiar link</button>
          <a class="btn wa" target="_blank" rel="noopener" href="${esc(linkWhatsApp('', 'Link para conectar o PROSPEC Notas neste aparelho (não compartilhe): ' + link))}">${ic('whats', 'sm')} Mandar no WhatsApp</a></div>
          <p class="tiny">Funciona sem internet também: o que for feito offline é enviado quando a conexão voltar. Trate este link como uma senha.</p>
        </div>
      </div>
      <button type="button" class="btn peq fantasma mt" id="desligar-sync">Desligar a sincronização neste aparelho</button>
    </div>`;
}

function ligarSecaoSync() {
  $('#ligar-sync')?.addEventListener('click', async () => {
    if (!(await confirmar('Ligar a sincronização?', 'Os dados deste aparelho vão para a nuvem e passam a aparecer em todos os aparelhos conectados.', { botao: 'Ligar' }))) return;
    conectarEspaco();
  });
  $('#copiar-sync')?.addEventListener('click', async () => {
    const inp = $('#link-sync');
    try { await navigator.clipboard.writeText(inp.value); toast('Link copiado ✓'); } catch { inp.select(); toast('Selecione e copie o link'); }
  });
  $('#desligar-sync')?.addEventListener('click', async () => {
    if (!(await confirmar('Desligar neste aparelho?', 'Este aparelho volta a usar só os dados guardados nele. Os dados na nuvem e nos outros aparelhos continuam.', { botao: 'Desligar', perigo: true }))) return;
    LOCAL.sincronizacao.desligar();
    location.reload();
  });
}

function secaoLocal() {
  const temChave = Boolean(LOCAL.chave());
  return `<div class="card pad secao largo-760" id="leitura">
      <h2>Leitura automática de fotos <span class="badge st-entregue">grátis</span></h2>
      <p class="small muted mb-sm">O site lê a foto da nota e entende o nome de cada produto usando a inteligência artificial do Google (Gemini), no plano gratuito. Não usa o Claude e não gasta crédito nenhum.</p>
      ${temChave ? '' : `<ol class="passos-chave small">
        <li>Abra <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"><b>aistudio.google.com/apikey</b></a> e entre com uma conta Google (Gmail).</li>
        <li>Clique em <b>Criar chave de API</b> (Create API key) e toque no botão de copiar ao lado da chave.</li>
        <li>Cole aqui embaixo e toque em <b>Salvar chave</b>. Pronto.</li>
      </ol>`}
      <label class="campo" for="aj-chave">Chave do Google Gemini
        <input id="aj-chave" type="password" autocomplete="off" placeholder="${temChave ? '•••••••• chave guardada' : 'Cole a chave aqui (AQ.… ou AIza…)'}" />
      </label>
      <div class="linha mt">
        <button type="button" class="btn primario" id="salvar-chave">${ic('check', 'sm')} Salvar chave</button>
        ${temChave ? `<button type="button" class="btn perigo" id="apagar-chave">${ic('lixo', 'sm')} Remover chave</button>` : ''}
        <span class="small ${temChave ? 'lucro-pos' : 'muted'}">${temChave ? '✓ Leitura de fotos ligada' : 'Sem chave: use o XML da nota ou digite os itens.'}</span>
      </div>
      <p class="tiny mt">A chave fica guardada só neste aparelho. No plano grátis o Google pode usar as fotos enviadas para melhorar os serviços dele; o site manda só a foto da nota e a lista de produtos encomendados, nunca nome ou telefone de cliente. A cota grátis é diária: se acabar, volta no dia seguinte.</p>
    </div>
    <div class="card pad secao largo-760">
      <h2>Seus dados</h2>
      <p class="small muted mb-sm">${LOCAL.sincronizacao.ativa ? 'Os dados ficam na nuvem e também guardados neste aparelho (funciona sem internet). Baixe um backup de vez em quando como cópia de segurança.' : 'Tudo fica salvo neste navegador, mesmo depois de fechar ou desligar o computador. Para ter uma cópia de segurança, baixe o backup.'}</p>
      <p class="small mb-sm" id="espaco"></p>
      <div class="linha">
        <button type="button" class="btn" id="baixar-backup">${ic('upload', 'sm')} Baixar backup</button>
        <button type="button" class="btn" id="abrir-backup">${ic('folhas', 'sm')} Restaurar backup</button>
        <input type="file" id="in-backup" accept="application/json,.json" hidden />
      </div>
      <p class="tiny mt">Dica: baixe um backup de vez em quando. Limpar os dados de navegação do navegador apaga as informações do site.</p>
      <p class="small muted mt">📱 No celular, use “Adicionar à tela de início” no navegador para abrir como aplicativo.</p>
    </div>`;
}

function ligarSecaoLocal() {
  LOCAL.espaco().then((e) => {
    const el = $('#espaco');
    if (!el || !e) return;
    const mb = (b) => `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
    el.innerHTML = `${e.persistido ? '✓ Armazenamento permanente ativado.' : 'Armazenamento normal do navegador.'} Usando ${mb(e.usado)}${e.total ? ` de ${mb(e.total)} disponíveis` : ''}.`;
  });
  $('#salvar-chave').onclick = (ev) =>
    comBotao(ev.currentTarget, async () => {
      // aceita os formatos de chave do Google (AIza…, AQ.…) e tira espaços/quebras que vêm ao colar
      const chave = $('#aj-chave').value.replace(/\s+/g, '');
      if (chave.length < 20) throw new ErroUsuario('Chave incompleta. Copie a chave inteira em aistudio.google.com/apikey (botão de copiar ao lado da chave).');
      LOCAL.salvarChave(chave);
      S.sample = await window.claude.use('sample');
      S.limites = S.sample ? await S.sample.limits() : null;
      $('#status-sistema').textContent = S.sample ? '✓ Leitura de fotos ativa' : '⚠ Leitura de fotos desligada';
      toast('Chave salva. Leitura de fotos ligada ✓');
      render();
    });
  $('#apagar-chave')?.addEventListener('click', async () => {
    if (!(await confirmar('Remover a chave?', 'A leitura automática de fotos será desligada neste aparelho.', { botao: 'Remover', perigo: true }))) return;
    LOCAL.salvarChave('');
    S.sample = null;
    $('#status-sistema').textContent = '⚠ Leitura de fotos desligada';
    toast('Chave removida');
    render();
  });
  $('#baixar-backup').onclick = (ev) =>
    comBotao(ev.currentTarget, async () => {
      const blob = await LOCAL.exportar();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `notas-giba-backup-${diaLocal(agoraISO())}.json`;
      document.body.append(a);
      a.click();
      setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
      toast('Backup baixado ✓');
    });
  $('#abrir-backup').onclick = () => $('#in-backup').click();
  $('#in-backup').onchange = async (ev) => {
    const arq = ev.target.files[0];
    ev.target.value = '';
    if (!arq) return;
    if (!(await confirmar('Restaurar este backup?', 'Os dados atuais deste aparelho serão substituídos pelos dados do backup.', { botao: 'Restaurar', perigo: true }))) return;
    try {
      const n = await LOCAL.importar(arq);
      toast(`Backup restaurado (${n} registros) ✓`);
    } catch (e) {
      falhou(e);
    }
  };
}

// ============================================================
// início
// ============================================================
async function iniciar() {
  montarEstrutura();
  render();
  const cl = window.claude;
  if (!cl?.use) return semAcesso('Abra este site pelo link do claude.ai, entrando com a sua conta.');
  if (LOCAL) document.title = 'Notas do Giba';
  const chaveDoLink = lerChaveDoLink();
  if (LOCAL) {
    const conexao = LOCAL.lerLinkConexao();
    if (conexao) {
      if (conexao.k) LOCAL.salvarChave(conexao.k);
      if (!LOCAL.sincronizacao.disponivel) toast('A sincronização ainda não está configurada no site.', 'erro');
      else if (conexao.e !== LOCAL.sincronizacao.espaco) {
        await conectarEspaco(conexao.e);
        return;
      }
    }
    LOCAL.aoMudarFoto = () => agendarRender();
    let avisouSync = false;
    window.addEventListener('notas-erro-sync', (e) => {
      if (avisouSync) return;
      avisouSync = true;
      toast(e.detail === 'permission-denied' ? 'A nuvem recusou a gravação. Confira a configuração da sincronização.' : 'Não consegui salvar na nuvem agora. Fica guardado no aparelho e envia depois.', 'erro');
      setTimeout(() => (avisouSync = false), 15000);
    });
  }
  const [db, assets, sample] = await Promise.all([cl.use('db').catch(() => null), cl.use('assets').catch(() => null), cl.use('sample').catch(() => null)]);
  if (!db) return semAcesso(LOCAL ? 'Este navegador não conseguiu abrir o armazenamento. Saia do modo anônimo ou use Chrome, Edge, Safari ou Firefox.' : 'Entre na sua conta do Claude (a mesma que recebeu o convite) para ver e salvar suas notas.');
  S.db = db;
  S.assets = assets;
  S.sample = sample;
  if (sample) S.limites = await sample.limits().catch(() => null);
  if (S.sample && S.limites && !S.limites.images) S.sample = null;
  if (chaveDoLink) toast(S.sample ? 'Leitura automática de fotos ligada neste aparelho ✓' : 'Não consegui ligar a leitura de fotos. Cole a chave em Ajustes.', S.sample ? '' : 'erro');
  $('#status-sistema').textContent = (S.sample ? '✓ Leitura de fotos ativa' : LOCAL ? '⚠ Leitura de fotos desligada' : '⚠ Leitura de fotos indisponível') + (LOCAL?.sincronizacao.ativa ? ' · ☁️ Sincronizado' : '');
  const espera = setTimeout(() => {
    if (!pronto()) semAcesso('Não consegui carregar os dados. Verifique a internet e recarregue a página.');
  }, 15000);
  assinar();
  const checar = setInterval(() => pronto() && (clearTimeout(espera), clearInterval(checar)), 300);
}

function semAcesso(msg) {
  const pag = $('#pagina');
  if (pag) pag.innerHTML = `<div class="card pad secao">${vazio('alerta', 'Quase lá', msg)}</div>`;
}

iniciar();
