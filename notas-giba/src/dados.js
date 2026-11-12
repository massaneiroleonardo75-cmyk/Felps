// Regras de negócio e acesso ao banco: notas, itens, contatos, encomendas e ajustes.

import { getDb } from './db.js';
import { resumoNota, calcularItem, fatorRateio, MENSAGEM_PADRAO, MODOS_ARREDONDAMENTO } from '../public/calc.js';
import { distribuir } from '../public/combinar.js';

export class ErroValidacao extends Error {
  constructor(msg, status = 400) {
    super(msg);
    this.status = status;
  }
}

const texto = (v, max = 500) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const numero = (v, padrao = 0) => {
  if (v === null || v === undefined || v === '') return padrao;
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
};
const opcional = (v) => (v === null || v === undefined || v === '' ? null : numero(v, null));
const agora = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// ---------------- ajustes ----------------
const AJUSTES_PADRAO = {
  markup_padrao: '30',
  arredondamento: 'nenhum',
  mensagem: MENSAGEM_PADRAO,
  nome_loja: '',
};

export function ajustes() {
  const linhas = getDb().prepare('SELECT chave, valor FROM ajustes').all();
  const a = { ...AJUSTES_PADRAO };
  for (const l of linhas) a[l.chave] = l.valor;
  return { ...a, markup_padrao: Number(a.markup_padrao) };
}

export function salvarAjustes(dados) {
  const st = getDb().prepare('INSERT INTO ajustes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor');
  if (dados.markup_padrao !== undefined) {
    const m = numero(dados.markup_padrao, NaN);
    if (!Number.isFinite(m) || m < -100 || m > 10000) throw new ErroValidacao('Porcentagem padrão inválida.');
    st.run('markup_padrao', String(m));
  }
  if (dados.arredondamento !== undefined) {
    if (!(dados.arredondamento in MODOS_ARREDONDAMENTO)) throw new ErroValidacao('Arredondamento inválido.');
    st.run('arredondamento', dados.arredondamento);
  }
  if (dados.mensagem !== undefined) st.run('mensagem', String(dados.mensagem || MENSAGEM_PADRAO).slice(0, 2000));
  if (dados.nome_loja !== undefined) st.run('nome_loja', String(dados.nome_loja || '').slice(0, 100));
  return ajustes();
}

// ---------------- cálculo ----------------
const calculoCache = () => {
  const cache = new Map();
  const modo = ajustes().arredondamento;
  return (notaId) => {
    if (!cache.has(notaId)) {
      const nota = getDb().prepare('SELECT * FROM notas WHERE id = ?').get(notaId);
      const itens = getDb().prepare('SELECT * FROM itens WHERE nota_id = ? ORDER BY ordem, id').all(notaId);
      const r = nota ? resumoNota(nota, itens, modo) : null;
      cache.set(notaId, r && { ...r, porItem: new Map(r.itens.map((i) => [i.id, i.calc])) });
    }
    return cache.get(notaId);
  };
};

// Valor de venda de uma encomenda: o combinado, se houver; senão o preço calculado do item da nota.
function valorEncomenda(enc, calc) {
  if (enc.valor_combinado !== null && enc.valor_combinado !== undefined) {
    return { valorUnit: enc.valor_combinado / (enc.quantidade || 1), origem: 'combinado' };
  }
  if (enc.item_id && enc.nota_id) {
    const c = calc(enc.nota_id)?.porItem.get(enc.item_id);
    if (c) return { valorUnit: c.precoUnit, origem: 'nota', custoUnit: c.custoUnit };
  }
  return { valorUnit: null, origem: null };
}

function custoEncomenda(enc, calc) {
  if (!enc.item_id || !enc.nota_id) return null;
  return calc(enc.nota_id)?.porItem.get(enc.item_id)?.custoUnit ?? null;
}

const SQL_ENC = `
  SELECT e.*, c.nome AS contato_nome, c.telefone AS contato_telefone,
         i.descricao AS item_descricao, i.nota_id AS nota_id,
         n.numero AS nota_numero, n.emitente_nome AS nota_emitente
  FROM encomendas e
  JOIN contatos c ON c.id = e.contato_id
  LEFT JOIN itens i ON i.id = e.item_id
  LEFT JOIN notas n ON n.id = i.nota_id`;

function enriquecer(encs, calc = calculoCache()) {
  return encs.map((e) => {
    const v = valorEncomenda(e, calc);
    const custoUnit = custoEncomenda(e, calc);
    return {
      ...e,
      valor_unit: v.valorUnit,
      valor_total: v.valorUnit === null ? null : v.valorUnit * (e.quantidade || 1),
      valor_origem: v.origem,
      custo_total: custoUnit === null ? null : custoUnit * (e.quantidade || 1),
    };
  });
}

// ---------------- notas ----------------
const CAMPOS_NOTA = ['numero', 'serie', 'chave', 'emitente_nome', 'emitente_cnpj', 'data_emissao', 'observacoes'];
const VALORES_NOTA = ['valor_produtos', 'frete', 'seguro', 'desconto', 'outras', 'impostos', 'valor_total'];

function limparItem(i, ordem) {
  const descricao = texto(i.descricao, 300);
  if (!descricao) throw new ErroValidacao('Todo item precisa de uma descrição.');
  const quantidade = numero(i.quantidade, 1) > 0 ? numero(i.quantidade, 1) : 1;
  let valorUnit = numero(i.valor_unitario, 0);
  let valorTotal = numero(i.valor_total, 0);
  if (!valorTotal && valorUnit) valorTotal = Math.round(valorUnit * quantidade * 100) / 100;
  if (!valorUnit && valorTotal) valorUnit = valorTotal / quantidade;
  return {
    ordem: numero(i.ordem, ordem),
    codigo: texto(i.codigo, 60),
    descricao,
    ncm: texto(i.ncm, 20),
    quantidade,
    unidade: texto(i.unidade, 10),
    valor_unitario: valorUnit,
    valor_total: valorTotal,
    markup: opcional(i.markup),
  };
}

export function encomendasPendentes() {
  return getDb()
    .prepare(
      `SELECT e.id, e.produto, e.quantidade, e.criado_em, c.nome AS contato_nome
       FROM encomendas e JOIN contatos c ON c.id = e.contato_id
       WHERE e.status = 'aguardando' AND e.item_id IS NULL ORDER BY e.criado_em, e.id`,
    )
    .all();
}

export function criarNota(dados, { origem = 'manual', arquivos = [], sugestoes = new Map() } = {}) {
  const db = getDb();
  const itens = (dados.itens || []).map(limparItem);
  if (!itens.length) throw new ErroValidacao('A nota precisa de pelo menos um item.');
  const soma = itens.reduce((s, i) => s + i.valor_total, 0);
  const a = ajustes();
  const nota = {};
  for (const c of CAMPOS_NOTA) nota[c] = texto(dados[c], c === 'observacoes' ? 2000 : 200);
  for (const c of VALORES_NOTA) nota[c] = numero(dados[c], 0);
  if (!nota.valor_produtos) nota.valor_produtos = soma;
  if (!nota.valor_total) nota.valor_total = soma;
  if (nota.chave) {
    const existe = db.prepare('SELECT id FROM notas WHERE chave = ?').get(nota.chave);
    if (existe) throw Object.assign(new ErroValidacao('Esta nota já foi cadastrada.', 409), { notaId: existe.id });
  }

  db.exec('BEGIN');
  try {
    const r = db
      .prepare(
        `INSERT INTO notas (numero, serie, chave, emitente_nome, emitente_cnpj, data_emissao, observacoes,
           valor_produtos, frete, seguro, desconto, outras, impostos, valor_total,
           markup_padrao, ratear_despesas, origem, arquivos, avisos_leitura)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ...CAMPOS_NOTA.map((c) => nota[c]),
        ...VALORES_NOTA.map((c) => nota[c]),
        numero(dados.markup_padrao, a.markup_padrao),
        dados.ratear_despesas === false ? 0 : 1,
        origem,
        JSON.stringify(arquivos),
        dados.avisos?.length ? dados.avisos.join('\n') : null,
      );
    const notaId = Number(r.lastInsertRowid);
    const ins = db.prepare(
      `INSERT INTO itens (nota_id, ordem, codigo, descricao, ncm, quantidade, unidade, valor_unitario, valor_total, markup)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const ids = itens.map((i) =>
      Number(ins.run(notaId, i.ordem, i.codigo, i.descricao, i.ncm, i.quantidade, i.unidade, i.valor_unitario, i.valor_total, i.markup).lastInsertRowid),
    );
    const vinculadas = combinarNota(notaId, sugestoes, ids);
    db.exec('COMMIT');
    return { id: notaId, vinculadas };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Procura encomendas pendentes para os itens desta nota e vincula automaticamente.
export function combinarNota(notaId, sugestoes = new Map(), idsNaOrdem = null) {
  const db = getDb();
  const itens = db.prepare('SELECT * FROM itens WHERE nota_id = ? ORDER BY ordem, id').all(notaId);
  const ordem = idsNaOrdem ? idsNaOrdem.map((id) => itens.find((i) => i.id === id)) : itens;
  // quantidade já comprometida com encomendas
  const comprometido = db.prepare('SELECT COALESCE(SUM(quantidade), 0) AS q FROM encomendas WHERE item_id = ?');
  const disponiveis = ordem.map((i) => ({ ...i, quantidade: Math.max(0, i.quantidade - comprometido.get(i.id).q) }));
  const vinculos = distribuir(disponiveis, encomendasPendentes(), sugestoes);
  const up = db.prepare(
    "UPDATE encomendas SET item_id = ?, status = 'chegou', chegou_em = ?, vinculo_auto = 1 WHERE id = ? AND status = 'aguardando'",
  );
  for (const v of vinculos) up.run(ordem[v.itemIndex].id, agora(), v.encomendaId);
  return vinculos.length;
}

export function listarNotas({ busca } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM notas';
  const args = [];
  if (busca) {
    sql += ` WHERE emitente_nome LIKE ? OR numero LIKE ? OR id IN (SELECT nota_id FROM itens WHERE descricao LIKE ?)`;
    const b = `%${busca}%`;
    args.push(b, b, b);
  }
  sql += ' ORDER BY COALESCE(data_emissao, date(criado_em)) DESC, id DESC LIMIT 500';
  const calc = calculoCache();
  const contEnc = db.prepare(
    "SELECT COUNT(*) AS n, SUM(CASE WHEN e.status IN ('chegou') THEN 1 ELSE 0 END) AS avisar FROM encomendas e JOIN itens i ON i.id = e.item_id WHERE i.nota_id = ?",
  );
  return db
    .prepare(sql)
    .all(...args)
    .map((n) => {
      const r = calc(n.id);
      const enc = contEnc.get(n.id);
      return {
        id: n.id,
        numero: n.numero,
        emitente_nome: n.emitente_nome,
        data_emissao: n.data_emissao,
        criado_em: n.criado_em,
        origem: n.origem,
        itens: r.itens.length,
        primeiro_item: r.itens[0]?.descricao,
        investido: r.investido,
        venda: r.venda,
        lucro: r.lucro,
        encomendas: enc.n,
        para_avisar: enc.avisar || 0,
      };
    });
}

export function buscarNota(id) {
  const db = getDb();
  const nota = db.prepare('SELECT * FROM notas WHERE id = ?').get(id);
  if (!nota) return null;
  const calc = calculoCache();
  const r = calc(nota.id);
  const encs = enriquecer(db.prepare(`${SQL_ENC} WHERE i.nota_id = ? ORDER BY e.id`).all(id), calc);
  return {
    ...nota,
    arquivos: JSON.parse(nota.arquivos || '[]'),
    avisos: nota.avisos_leitura ? nota.avisos_leitura.split('\n') : [],
    resumo: { investido: r.investido, venda: r.venda, lucro: r.lucro, margem: r.margem, fator: r.fator },
    itens: r.itens.map((i) => ({ ...i, encomendas: encs.filter((e) => e.item_id === i.id) })),
  };
}

export function atualizarNota(id, dados) {
  const db = getDb();
  const nota = db.prepare('SELECT * FROM notas WHERE id = ?').get(id);
  if (!nota) throw new ErroValidacao('Nota não encontrada.', 404);
  const sets = [];
  const args = [];
  for (const c of CAMPOS_NOTA) if (c in dados) sets.push(`${c} = ?`) && args.push(texto(dados[c], c === 'observacoes' ? 2000 : 200));
  for (const c of VALORES_NOTA) if (c in dados) sets.push(`${c} = ?`) && args.push(numero(dados[c], 0));
  if ('markup_padrao' in dados) sets.push('markup_padrao = ?') && args.push(numero(dados.markup_padrao, nota.markup_padrao));
  if ('ratear_despesas' in dados) sets.push('ratear_despesas = ?') && args.push(dados.ratear_despesas ? 1 : 0);
  if (sets.length) db.prepare(`UPDATE notas SET ${sets.join(', ')} WHERE id = ?`).run(...args, id);
  return buscarNota(id);
}

export function aplicarMarkupNota(id, markup) {
  const m = numero(markup, NaN);
  if (!Number.isFinite(m)) throw new ErroValidacao('Porcentagem inválida.');
  const db = getDb();
  db.prepare('UPDATE notas SET markup_padrao = ? WHERE id = ?').run(m, id);
  db.prepare('UPDATE itens SET markup = NULL WHERE nota_id = ?').run(id);
  return buscarNota(id);
}

function liberarEncomendasDoItem(where, arg) {
  getDb()
    .prepare(
      `UPDATE encomendas SET status = CASE WHEN status IN ('chegou','avisado') THEN 'aguardando' ELSE status END,
         chegou_em = NULL, item_id = NULL, vinculo_auto = 0 WHERE ${where}`,
    )
    .run(arg);
}

export function excluirNota(id) {
  const db = getDb();
  const nota = db.prepare('SELECT * FROM notas WHERE id = ?').get(id);
  if (!nota) return null;
  liberarEncomendasDoItem('item_id IN (SELECT id FROM itens WHERE nota_id = ?)', id);
  db.prepare('DELETE FROM notas WHERE id = ?').run(id);
  return JSON.parse(nota.arquivos || '[]');
}

export function adicionarItem(notaId, dados) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM notas WHERE id = ?').get(notaId)) throw new ErroValidacao('Nota não encontrada.', 404);
  const ordem = db.prepare('SELECT COALESCE(MAX(ordem), -1) + 1 AS o FROM itens WHERE nota_id = ?').get(notaId).o;
  const i = limparItem({ ...dados, ordem }, ordem);
  db.prepare(
    `INSERT INTO itens (nota_id, ordem, codigo, descricao, ncm, quantidade, unidade, valor_unitario, valor_total, markup)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(notaId, i.ordem, i.codigo, i.descricao, i.ncm, i.quantidade, i.unidade, i.valor_unitario, i.valor_total, i.markup);
  return buscarNota(notaId);
}

export function atualizarItem(id, dados) {
  const db = getDb();
  const atual = db.prepare('SELECT * FROM itens WHERE id = ?').get(id);
  if (!atual) throw new ErroValidacao('Item não encontrado.', 404);
  // Só a porcentagem (ou o preço final, convertido em porcentagem no navegador)
  if (Object.keys(dados).every((k) => k === 'markup')) {
    db.prepare('UPDATE itens SET markup = ? WHERE id = ?').run(opcional(dados.markup), id);
  } else {
    const i = limparItem({ ...atual, ...dados }, atual.ordem);
    db.prepare(
      'UPDATE itens SET codigo = ?, descricao = ?, ncm = ?, quantidade = ?, unidade = ?, valor_unitario = ?, valor_total = ?, markup = ? WHERE id = ?',
    ).run(i.codigo, i.descricao, i.ncm, i.quantidade, i.unidade, i.valor_unitario, i.valor_total, i.markup, id);
  }
  return buscarNota(atual.nota_id);
}

export function excluirItem(id) {
  const db = getDb();
  const atual = db.prepare('SELECT * FROM itens WHERE id = ?').get(id);
  if (!atual) throw new ErroValidacao('Item não encontrado.', 404);
  if (db.prepare('SELECT COUNT(*) AS n FROM itens WHERE nota_id = ?').get(atual.nota_id).n <= 1) {
    throw new ErroValidacao('A nota precisa ter pelo menos um item. Para apagar tudo, exclua a nota.');
  }
  liberarEncomendasDoItem('item_id = ?', id);
  db.prepare('DELETE FROM itens WHERE id = ?').run(id);
  return buscarNota(atual.nota_id);
}

// ---------------- contatos ----------------
function limparContato(d) {
  const nome = texto(d.nome, 120);
  if (!nome) throw new ErroValidacao('Informe o nome do contato.');
  const telefone = texto(d.telefone, 40);
  if (telefone && telefone.replace(/\D/g, '').length < 10) throw new ErroValidacao('Telefone incompleto: coloque o DDD + número.');
  return { nome, telefone, observacoes: texto(d.observacoes, 1000) };
}

export function listarContatos({ busca } = {}) {
  let sql = `SELECT c.*,
      (SELECT COUNT(*) FROM encomendas e WHERE e.contato_id = c.id AND e.status IN ('aguardando','chegou','avisado')) AS abertas,
      (SELECT COUNT(*) FROM encomendas e WHERE e.contato_id = c.id) AS total_encomendas,
      (SELECT MAX(criado_em) FROM encomendas e WHERE e.contato_id = c.id) AS ultima
    FROM contatos c`;
  const args = [];
  if (busca) {
    sql += ' WHERE c.nome LIKE ? OR c.telefone LIKE ?';
    args.push(`%${busca}%`, `%${String(busca).replace(/\D/g, '') || busca}%`);
  }
  sql += ' ORDER BY c.nome COLLATE NOCASE';
  return getDb().prepare(sql).all(...args);
}

export function buscarContato(id) {
  const c = getDb().prepare('SELECT * FROM contatos WHERE id = ?').get(id);
  if (!c) return null;
  const encs = enriquecer(getDb().prepare(`${SQL_ENC} WHERE e.contato_id = ? ORDER BY e.criado_em DESC, e.id DESC`).all(id));
  return { ...c, encomendas: encs };
}

export function criarContato(d) {
  const c = limparContato(d);
  const r = getDb().prepare('INSERT INTO contatos (nome, telefone, observacoes) VALUES (?, ?, ?)').run(c.nome, c.telefone, c.observacoes);
  return buscarContato(Number(r.lastInsertRowid));
}

export function atualizarContato(id, d) {
  if (!getDb().prepare('SELECT id FROM contatos WHERE id = ?').get(id)) throw new ErroValidacao('Contato não encontrado.', 404);
  const c = limparContato(d);
  getDb().prepare('UPDATE contatos SET nome = ?, telefone = ?, observacoes = ? WHERE id = ?').run(c.nome, c.telefone, c.observacoes, id);
  return buscarContato(id);
}

export function excluirContato(id) {
  return getDb().prepare('DELETE FROM contatos WHERE id = ?').run(id).changes > 0;
}

// ---------------- encomendas ----------------
export const STATUS = {
  aguardando: 'Aguardando chegar',
  chegou: 'Chegou — avisar cliente',
  avisado: 'Cliente avisado',
  entregue: 'Entregue / vendido',
  cancelada: 'Cancelada',
};

export function listarEncomendas({ status, busca, contato_id } = {}) {
  const cond = [];
  const args = [];
  if (status === 'abertas') cond.push("e.status IN ('aguardando','chegou','avisado')");
  else if (status && STATUS[status]) cond.push('e.status = ?') && args.push(status);
  if (contato_id) cond.push('e.contato_id = ?') && args.push(Number(contato_id));
  if (busca) {
    cond.push('(e.produto LIKE ? OR c.nome LIKE ? OR i.descricao LIKE ?)');
    args.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
  }
  const sql = `${SQL_ENC} ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
    ORDER BY CASE e.status WHEN 'chegou' THEN 0 WHEN 'avisado' THEN 1 WHEN 'aguardando' THEN 2 WHEN 'entregue' THEN 3 ELSE 4 END,
             e.criado_em DESC, e.id DESC LIMIT 1000`;
  return enriquecer(getDb().prepare(sql).all(...args));
}

export function buscarEncomenda(id) {
  return enriquecer(getDb().prepare(`${SQL_ENC} WHERE e.id = ?`).all(id))[0] || null;
}

function resolverContato(d) {
  if (d.contato_id) {
    const c = getDb().prepare('SELECT id FROM contatos WHERE id = ?').get(Number(d.contato_id));
    if (!c) throw new ErroValidacao('Contato não encontrado.');
    return c.id;
  }
  if (d.novo_contato) return criarContato(d.novo_contato).id;
  throw new ErroValidacao('Escolha o cliente (ou cadastre um novo).');
}

export function criarEncomenda(d) {
  const produto = texto(d.produto, 300);
  if (!produto) throw new ErroValidacao('Informe o produto encomendado.');
  const quantidade = numero(d.quantidade, 1) > 0 ? numero(d.quantidade, 1) : 1;
  const db = getDb();
  db.exec('BEGIN');
  try {
    const contatoId = resolverContato(d);
    const r = db
      .prepare('INSERT INTO encomendas (contato_id, produto, quantidade, valor_combinado, observacoes) VALUES (?, ?, ?, ?, ?)')
      .run(contatoId, produto, quantidade, opcional(d.valor_combinado), texto(d.observacoes, 1000));
    const id = Number(r.lastInsertRowid);
    if (d.item_id) vincular(id, d.item_id);
    db.exec('COMMIT');
    return buscarEncomenda(id);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function atualizarEncomenda(id, d) {
  const db = getDb();
  const atual = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(id);
  if (!atual) throw new ErroValidacao('Encomenda não encontrada.', 404);
  const produto = 'produto' in d ? texto(d.produto, 300) : atual.produto;
  if (!produto) throw new ErroValidacao('Informe o produto encomendado.');
  const quantidade = 'quantidade' in d ? (numero(d.quantidade, 1) > 0 ? numero(d.quantidade, 1) : 1) : atual.quantidade;
  const valor = 'valor_combinado' in d ? opcional(d.valor_combinado) : atual.valor_combinado;
  const obs = 'observacoes' in d ? texto(d.observacoes, 1000) : atual.observacoes;
  const contatoId = d.contato_id || d.novo_contato ? resolverContato(d) : atual.contato_id;
  db.prepare('UPDATE encomendas SET produto = ?, quantidade = ?, valor_combinado = ?, observacoes = ?, contato_id = ? WHERE id = ?').run(
    produto, quantidade, valor, obs, contatoId, id,
  );
  return buscarEncomenda(id);
}

export function mudarStatus(ids, status) {
  if (!STATUS[status]) throw new ErroValidacao('Situação inválida.');
  const db = getDb();
  const lista = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
  const coluna = { chegou: 'chegou_em', avisado: 'avisado_em', entregue: 'entregue_em' }[status];
  for (const id of lista) {
    const e = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(id);
    if (!e) continue;
    if (status === 'chegou' && !e.chegou_em) db.prepare('UPDATE encomendas SET chegou_em = ? WHERE id = ?').run(agora(), id);
    if (coluna) db.prepare(`UPDATE encomendas SET status = ?, ${coluna} = COALESCE(${coluna}, ?) WHERE id = ?`).run(status, agora(), id);
    else db.prepare('UPDATE encomendas SET status = ? WHERE id = ?').run(status, id);
    if (status === 'aguardando') db.prepare('UPDATE encomendas SET avisado_em = NULL, entregue_em = NULL WHERE id = ?').run(id);
    if (status === 'chegou') db.prepare('UPDATE encomendas SET avisado_em = NULL, entregue_em = NULL WHERE id = ?').run(id);
    if (status === 'avisado') db.prepare('UPDATE encomendas SET entregue_em = NULL WHERE id = ?').run(id);
  }
  return lista.map(buscarEncomenda).filter(Boolean);
}

export function vincular(encomendaId, itemId) {
  const db = getDb();
  const e = db.prepare('SELECT * FROM encomendas WHERE id = ?').get(encomendaId);
  if (!e) throw new ErroValidacao('Encomenda não encontrada.', 404);
  if (!itemId) {
    liberarEncomendasDoItem('id = ?', encomendaId);
    return buscarEncomenda(encomendaId);
  }
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(Number(itemId));
  if (!item) throw new ErroValidacao('Item da nota não encontrado.');
  const status = ['aguardando', 'cancelada'].includes(e.status) ? 'chegou' : e.status;
  db.prepare('UPDATE encomendas SET item_id = ?, status = ?, chegou_em = COALESCE(chegou_em, ?), vinculo_auto = 0 WHERE id = ?').run(
    item.id, status, agora(), encomendaId,
  );
  return buscarEncomenda(encomendaId);
}

export function excluirEncomenda(id) {
  return getDb().prepare('DELETE FROM encomendas WHERE id = ?').run(id).changes > 0;
}

// ---------------- painel ----------------
function intervalo(periodo) {
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const iso = (d) => d.toISOString().slice(0, 10);
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  switch (periodo) {
    case 'mes_passado':
      return [iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))];
    case '30d':
      return [iso(new Date(hoje.getTime() - 29 * 864e5)), iso(hoje)];
    case 'ano':
      return [`${y}-01-01`, `${y}-12-31`];
    case 'tudo':
      return ['0000-01-01', '9999-12-31'];
    default:
      return [iso(new Date(Date.UTC(y, m, 1))), iso(new Date(Date.UTC(y, m + 1, 0)))];
  }
}

export function painel(periodo = 'mes') {
  const db = getDb();
  const [de, ate] = intervalo(periodo);
  const calc = calculoCache();
  const notas = db
    .prepare('SELECT id FROM notas WHERE COALESCE(data_emissao, date(criado_em)) BETWEEN ? AND ?')
    .all(de, ate);
  let investido = 0;
  let venda = 0;
  for (const n of notas) {
    const r = calc(n.id);
    investido += r.investido;
    venda += r.venda;
  }
  const entregues = enriquecer(
    db.prepare(`${SQL_ENC} WHERE e.status = 'entregue' AND date(e.entregue_em) BETWEEN ? AND ?`).all(de, ate),
    calc,
  );
  const vendido = entregues.reduce((s, e) => s + (e.valor_total || 0), 0);
  const custoVendido = entregues.reduce((s, e) => s + (e.custo_total || 0), 0);
  const contagem = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) AS n FROM encomendas WHERE status IN ('aguardando','chegou','avisado') GROUP BY status").all().map((r) => [r.status, r.n]),
  );
  const avisar = listarEncomendas({ status: 'chegou' });
  const retirar = listarEncomendas({ status: 'avisado' });

  // últimos 6 meses (investido x venda prevista), para o gráfico
  const meses = [];
  const base = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - k, 1));
    const ini = d.toISOString().slice(0, 10);
    const fim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    let inv = 0;
    let ven = 0;
    for (const n of db.prepare('SELECT id FROM notas WHERE COALESCE(data_emissao, date(criado_em)) BETWEEN ? AND ?').all(ini, fim)) {
      const r = calc(n.id);
      inv += r.investido;
      ven += r.venda;
    }
    meses.push({ mes: ini.slice(0, 7), investido: inv, venda: ven, lucro: ven - inv });
  }

  return {
    periodo: { de, ate, nome: periodo },
    notas: notas.length,
    investido,
    venda_prevista: venda,
    lucro_previsto: venda - investido,
    vendido,
    lucro_realizado: vendido - custoVendido,
    encomendas: { aguardando: contagem.aguardando || 0, chegou: contagem.chegou || 0, avisado: contagem.avisado || 0 },
    avisar,
    retirar,
    recentes: listarNotas().slice(0, 5),
    meses,
  };
}

export { fatorRateio, calcularItem };
