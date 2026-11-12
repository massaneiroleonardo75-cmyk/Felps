// Combina itens da nota fiscal com encomendas pendentes, por semelhança de texto.
// Ex.: encomenda "iPhone 14 128gb" x item "APPLE IPHONE 14 128GB AZUL MPVN3BZ/A".
// Números (modelo, capacidade) precisam bater; palavras comuns são ignoradas.

const IGNORAR = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'p', 'c', 'a', 'o', 'em', 'un', 'und', 'unid',
  'pc', 'pcs', 'peca', 'cx', 'kit', 'novo', 'nova', 'original', 'cor', 'modelo', 'mod', 'ref',
]);

export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d+)[\s-]*(gb|tb|mb|ml|l|mm|cm|m|kg|g|w|v|pol|polegadas|")\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function palavras(texto) {
  return normalizar(texto)
    .split(' ')
    .filter((p) => p && !IGNORAR.has(p));
}

const temDigito = (p) => /\d/.test(p);

// Nota de 0 a 1: quanto da descrição da encomenda aparece no item.
export function semelhanca(encomenda, item) {
  const pe = [...new Set(palavras(encomenda))];
  if (!pe.length) return 0;
  const pi = palavras(item);
  const conjunto = new Set(pi);
  const bate = (p) =>
    conjunto.has(p) ||
    (!temDigito(p) && p.length >= 4 && pi.some((x) => x.length >= 4 && (x.startsWith(p) || p.startsWith(x))));
  const numeros = pe.filter(temDigito);
  if (numeros.some((n) => !bate(n))) return 0;
  const texto = pe.filter((p) => !temDigito(p));
  if (texto.length && !texto.some(bate)) return 0;
  const acertos = pe.filter(bate).length;
  return acertos / pe.length;
}

export const LIMITE = 0.7;

// Distribui encomendas pendentes entre os itens, respeitando a quantidade de cada item.
// sugestoesIA: Map(itemIndex -> [encomendaId]) vindo da leitura da nota (opcional, tem prioridade).
export function distribuir(itens, encomendas, sugestoesIA = new Map()) {
  const livre = itens.map((i) => Number(i.quantidade) || 1);
  const usadas = new Set();
  const vinculos = []; // { itemIndex, encomendaId }
  const porId = new Map(encomendas.map((e) => [e.id, e]));

  const tentar = (idx, enc) => {
    if (usadas.has(enc.id)) return;
    const q = Number(enc.quantidade) || 1;
    if (livre[idx] + 1e-9 < q) return;
    livre[idx] -= q;
    usadas.add(enc.id);
    vinculos.push({ itemIndex: idx, encomendaId: enc.id });
  };

  for (const [idx, ids] of sugestoesIA) {
    for (const id of ids) if (porId.has(id) && itens[idx]) tentar(idx, porId.get(id));
  }

  const candidatos = [];
  encomendas.forEach((enc) => {
    itens.forEach((item, idx) => {
      const s = semelhanca(enc.produto, `${item.descricao} ${item.codigo || ''}`);
      if (s >= LIMITE) candidatos.push({ enc, idx, s });
    });
  });
  // melhor semelhança primeiro; em empate, quem encomendou antes
  candidatos.sort((a, b) => b.s - a.s || String(a.enc.criado_em).localeCompare(String(b.enc.criado_em)) || a.enc.id - b.enc.id);
  for (const c of candidatos) tentar(c.idx, c.enc);
  return vinculos;
}
