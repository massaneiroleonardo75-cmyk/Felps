// Regras de negócio: ciclo de vida do pedido.
//
//  aberto ──(prazo ou ofertas suficientes)──> aguardando_escolha ──(cliente escolhe)──> confirmado ──> concluido
//     └──(sem ofertas após prorrogação)──> sem_ofertas            (cliente/admin pode cancelar em qualquer etapa)

import { getDb, agoraIso, minutosDepois } from './db.js';
import { config } from './config.js';
import { TIPOS, VOLUMES, VEICULOS, CIDADES, BAIRROS_JARAGUA, distanciaEstimada, nivelVeiculo } from './dominio.js';
import { estimarPreco } from './precos.js';
import { ranquearOfertas, escolherTop3 } from './ranking.js';
import { lerOferta, revisarTop3 } from './ai.js';
import { enviarMensagem, enviarParaGrupo, suportaGrupo, registrarEntrada } from './whatsapp.js';
import { gerarCodigo, gerarToken, normalizarTelefone, localParaIso } from './util.js';
import * as msg from './mensagens.js';

const db = () => getDb();

export class ErroValidacao extends Error {}

// ---------- consultas ----------

export const linkPedido = (p) => `${config.baseUrl}/p/${p.token}`;
export const linkOferta = (p, f) => `${config.baseUrl}/o/${p.codigo}?f=${f.token}`;

export function comNomeVeiculo(f) {
  return f && { ...f, veiculo_nome: VEICULOS[f.veiculo]?.nome || f.veiculo };
}

export const buscarPedido = (id) => db().prepare('SELECT * FROM pedidos WHERE id = ?').get(id);
export const buscarPedidoPorToken = (t) => db().prepare('SELECT * FROM pedidos WHERE token = ?').get(t);
export const buscarPedidoPorCodigo = (c) => db().prepare('SELECT * FROM pedidos WHERE codigo = ?').get(String(c).toUpperCase());
export const buscarFreteiro = (id) => comNomeVeiculo(db().prepare('SELECT * FROM freteiros WHERE id = ?').get(id));
export const buscarFreteiroPorToken = (t) => comNomeVeiculo(db().prepare('SELECT * FROM freteiros WHERE token = ?').get(t));
export const buscarFreteiroPorTelefone = (tel) =>
  comNomeVeiculo(db().prepare('SELECT * FROM freteiros WHERE telefone = ?').get(normalizarTelefone(tel)));

export function ofertasDoPedido(pedidoId) {
  const linhas = db().prepare('SELECT * FROM ofertas WHERE pedido_id = ? ORDER BY COALESCE(posicao, 999), valor').all(pedidoId);
  return linhas.map((o) => ({
    ...o,
    selos: o.selos ? JSON.parse(o.selos) : [],
    alertas: o.alertas ? JSON.parse(o.alertas) : [],
    freteiro: buscarFreteiro(o.freteiro_id),
  }));
}

export const top3DoPedido = (pedidoId) => ofertasDoPedido(pedidoId).filter((o) => o.posicao && o.posicao <= 3 && o.status !== 'recebida');

function pedidosAbertosDoFreteiro(freteiroId) {
  return db()
    .prepare(
      `SELECT p.* FROM pedidos p JOIN notificacoes n ON n.pedido_id = p.id
       WHERE n.freteiro_id = ? AND p.status = 'aberto' ORDER BY p.id DESC`,
    )
    .all(freteiroId);
}

// ---------- pedidos ----------

export function validarPedido(d) {
  const erros = [];
  const req = (campo, nome) => (!d[campo] || String(d[campo]).trim() === '') && erros.push(`${nome} é obrigatório`);
  req('cliente_nome', 'Nome');
  req('cliente_telefone', 'WhatsApp');
  req('origem_bairro', 'Bairro de origem');
  req('destino_cidade', 'Cidade de destino');
  req('itens', 'Descrição dos itens');
  if (!TIPOS[d.tipo]) erros.push('Tipo de serviço inválido');
  if (!VOLUMES[d.volume]) erros.push('Tamanho da carga inválido');
  if (!(d.destino_cidade in CIDADES)) erros.push('Cidade de destino inválida');
  if (d.origem_bairro && !BAIRROS_JARAGUA.includes(d.origem_bairro)) erros.push('Bairro de origem inválido');
  if (!['imediato', 'agendado'].includes(d.quando)) erros.push('Informe se é imediato ou agendado');
  if (d.quando === 'agendado') {
    const dt = d.data_hora ? new Date(localParaIso(d.data_hora)) : null;
    if (!dt || isNaN(dt)) erros.push('Data e hora do agendamento são obrigatórias');
    else if (dt < Date.now() - 5 * 60000) erros.push('A data do agendamento já passou');
  }
  const tel = normalizarTelefone(d.cliente_telefone);
  if (d.cliente_telefone && !/^55\d{10,11}$/.test(tel)) erros.push('WhatsApp inválido (use DDD + número)');
  if (erros.length) throw new ErroValidacao(erros.join('. '));
}

export async function criarPedido(d) {
  validarPedido(d);
  const int = (v) => Math.max(0, Math.min(30, parseInt(v, 10) || 0));
  const bool = (v) => (v === true || v === 'on' || v === '1' || v === 1 || v === 'true' ? 1 : 0);

  const p = {
    tipo: d.tipo,
    cliente_nome: String(d.cliente_nome).trim().slice(0, 80),
    cliente_telefone: normalizarTelefone(d.cliente_telefone),
    cliente_tipo: d.cliente_tipo === 'pj' ? 'pj' : 'pf',
    empresa: d.cliente_tipo === 'pj' ? String(d.empresa || '').slice(0, 100) || null : null,
    origem_bairro: d.origem_bairro,
    origem_endereco: d.origem_endereco ? String(d.origem_endereco).slice(0, 200) : null,
    origem_andar: int(d.origem_andar),
    origem_elevador: bool(d.origem_elevador),
    destino_cidade: d.destino_cidade,
    destino_bairro: d.destino_bairro ? String(d.destino_bairro).slice(0, 80) : null,
    destino_endereco: d.destino_endereco ? String(d.destino_endereco).slice(0, 200) : null,
    destino_andar: int(d.destino_andar),
    destino_elevador: bool(d.destino_elevador),
    quando: d.quando,
    data_hora: d.quando === 'agendado' ? localParaIso(d.data_hora) : null,
    volume: d.volume,
    itens: String(d.itens).trim().slice(0, 1000),
    ajudantes: Math.min(int(d.ajudantes), 6),
    montagem: bool(d.montagem),
    observacoes: d.observacoes ? String(d.observacoes).slice(0, 500) : null,
  };
  p.distancia_km = Number(d.distancia_km) > 0 ? Number(d.distancia_km) : distanciaEstimada(p);
  const est = estimarPreco(p);
  p.estimativa_min = est.min;
  p.estimativa_max = est.max;
  p.prazo_ofertas = minutosDepois(p.quando === 'imediato' ? config.janelaImediatoMin : config.janelaAgendadoMin);
  p.token = gerarToken();

  let codigo;
  do codigo = gerarCodigo(); while (buscarPedidoPorCodigo(codigo));
  p.codigo = codigo;

  const cols = Object.keys(p);
  const info = db()
    .prepare(`INSERT INTO pedidos (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map((c) => p[c]));
  const pedido = buscarPedido(Number(info.lastInsertRowid));

  await enviarMensagem(pedido.cliente_telefone, msg.pedidoRecebidoCliente(pedido, linkPedido(pedido)));
  const avisados = await notificarFreteiros(pedido);
  return { pedido, avisados };
}

export function freteirosElegiveis(p) {
  const precisa = VOLUMES[p.volume].nivel;
  return db()
    .prepare('SELECT * FROM freteiros WHERE aprovado = 1 AND ativo = 1')
    .all()
    .filter((f) => (nivelVeiculo(f.veiculo) ?? 1) >= precisa)
    .filter((f) => p.cliente_tipo !== 'pj' || f.atende_empresas)
    .filter((f) => {
      const regioes = f.regioes.split(',').map((s) => s.trim()).filter(Boolean);
      return !regioes.length || regioes.includes('Todas') || regioes.includes(p.origem_bairro);
    })
    .map(comNomeVeiculo);
}

async function notificarFreteiros(p) {
  const freteiros = freteirosElegiveis(p);
  const ins = db().prepare('INSERT OR IGNORE INTO notificacoes (pedido_id, freteiro_id) VALUES (?, ?)');
  // Envio individual: o freteiro responde no privado, ninguém vê o preço do outro
  // (evita leilão para baixo no grupo e cliente sendo "roubado" da plataforma).
  for (const f of freteiros) {
    ins.run(p.id, f.id);
    await enviarMensagem(f.telefone, msg.novoPedidoFreteiro(p, linkOferta(p, f)));
  }
  if (suportaGrupo()) await enviarParaGrupo(msg.novoPedidoGrupo(p));
  return freteiros.length;
}

// ---------- ofertas ----------

export async function registrarOferta({ pedido, freteiro, dados, canal = 'whatsapp', mensagem = null }) {
  if (pedido.status !== 'aberto') throw new ErroValidacao('Este pedido não está mais recebendo ofertas.');
  if (!freteiro.aprovado || !freteiro.ativo) throw new ErroValidacao('Seu cadastro ainda não foi aprovado.');
  const valor = Number(dados.valor);
  if (!(valor >= 20 && valor <= 100000)) throw new ErroValidacao('Valor inválido.');

  const existente = db().prepare('SELECT id FROM ofertas WHERE pedido_id = ? AND freteiro_id = ?').get(pedido.id, freteiro.id);
  const o = {
    valor,
    imediato: dados.imediato ? 1 : 0,
    eta_minutos: dados.eta_minutos != null ? Math.round(Number(dados.eta_minutos)) : null,
    horario: dados.horario || null,
    veiculo: dados.veiculo || null,
    ajudantes: dados.ajudantes != null && dados.ajudantes !== '' ? Number(dados.ajudantes) : null,
    observacoes: dados.observacoes ? String(dados.observacoes).slice(0, 300) : null,
    mensagem_original: mensagem,
    canal,
  };
  if (existente) {
    db()
      .prepare(
        `UPDATE ofertas SET valor=?, imediato=?, eta_minutos=?, horario=?, veiculo=?, ajudantes=?, observacoes=?,
         mensagem_original=COALESCE(?, mensagem_original), canal=?, criado_em=datetime('now') WHERE id=?`,
      )
      .run(o.valor, o.imediato, o.eta_minutos, o.horario, o.veiculo, o.ajudantes, o.observacoes, o.mensagem_original, o.canal, existente.id);
  } else {
    db()
      .prepare(
        `INSERT INTO ofertas (pedido_id, freteiro_id, valor, imediato, eta_minutos, horario, veiculo, ajudantes, observacoes, mensagem_original, canal)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(pedido.id, freteiro.id, o.valor, o.imediato, o.eta_minutos, o.horario, o.veiculo, o.ajudantes, o.observacoes, o.mensagem_original, o.canal);
  }
  db().prepare('INSERT OR IGNORE INTO notificacoes (pedido_id, freteiro_id) VALUES (?, ?)').run(pedido.id, freteiro.id);
  await enviarMensagem(freteiro.telefone, msg.ofertaRegistrada(pedido, o, Boolean(existente)));

  const total = db().prepare('SELECT COUNT(*) n FROM ofertas WHERE pedido_id = ?').get(pedido.id).n;
  if (pedido.quando === 'imediato' && total >= config.ofertasParaFecharCedo) await fecharPedido(buscarPedido(pedido.id));
  return { atualizada: Boolean(existente), total };
}

// ---------- fechamento: IA escolhe as 3 melhores ----------

export async function fecharPedido(pedido) {
  // Trava otimista: só um processo fecha o pedido.
  const r = db().prepare("UPDATE pedidos SET status = 'fechando' WHERE id = ? AND status = 'aberto'").run(pedido.id);
  if (!r.changes) return null;
  pedido = buscarPedido(pedido.id);
  const ofertas = ofertasDoPedido(pedido.id);

  if (!ofertas.length) {
    if (!pedido.prorrogado) {
      db().prepare("UPDATE pedidos SET status='aberto', prorrogado=1, prazo_ofertas=? WHERE id=?").run(minutosDepois(config.prorrogacaoMin), pedido.id);
      return { prorrogado: true };
    }
    db().prepare("UPDATE pedidos SET status='sem_ofertas' WHERE id=?").run(pedido.id);
    await enviarMensagem(pedido.cliente_telefone, msg.semOfertasCliente(pedido));
    return { semOfertas: true };
  }

  const ranqueadas = ranquearOfertas(ofertas, pedido);
  const top3 = escolherTop3(ranqueadas, pedido);
  const revisao = await revisarTop3(pedido, top3);

  const upd = db().prepare('UPDATE ofertas SET score=?, posicao=?, selos=?, alertas=?, motivo=?, status=? WHERE id=?');
  for (const o of ranqueadas) upd.run(o.score, null, '[]', JSON.stringify(o.alertas), null, 'recebida', o.id);
  top3.forEach((o, i) => {
    const rev = revisao.opcoes.find((x) => x.oferta_id === o.id);
    o.motivo = rev?.motivo || null;
    o.alertaIA = rev?.alerta || null;
    const alertas = o.alertaIA ? [o.alertaIA, ...o.alertas.filter((a) => a !== o.alertaIA)] : o.alertas;
    upd.run(o.score, i + 1, JSON.stringify(o.selos), JSON.stringify(alertas), o.motivo, 'top3', o.id);
  });

  db()
    .prepare("UPDATE pedidos SET status='aguardando_escolha', resumo_ia=?, top3_enviado_em=? WHERE id=?")
    .run(revisao.resumo, agoraIso(), pedido.id);
  pedido = buscarPedido(pedido.id);
  await enviarMensagem(pedido.cliente_telefone, msg.top3Cliente(pedido, top3, revisao.resumo, linkPedido(pedido)));
  return { top3 };
}

export async function escolherOferta(pedido, ofertaId) {
  if (pedido.status !== 'aguardando_escolha') throw new ErroValidacao('Este pedido não está aguardando escolha.');
  const top3 = top3DoPedido(pedido.id);
  const o = top3.find((x) => x.id === Number(ofertaId));
  if (!o) throw new ErroValidacao('Oferta inválida.');
  const r = db()
    .prepare("UPDATE pedidos SET status='confirmado', oferta_escolhida_id=? WHERE id=? AND status='aguardando_escolha'")
    .run(o.id, pedido.id);
  if (!r.changes) throw new ErroValidacao('Este pedido já foi confirmado.');
  db().prepare("UPDATE ofertas SET status = CASE WHEN id = ? THEN 'escolhida' ELSE 'recusada' END WHERE pedido_id = ?").run(o.id, pedido.id);

  pedido = buscarPedido(pedido.id);
  await enviarMensagem(pedido.cliente_telefone, msg.confirmadoCliente(pedido, o, o.freteiro));
  await enviarMensagem(o.freteiro.telefone, msg.escolhidoFreteiro(pedido, o));
  for (const outra of ofertasDoPedido(pedido.id)) {
    if (outra.id !== o.id) await enviarMensagem(outra.freteiro.telefone, msg.naoEscolhidoFreteiro(pedido));
  }
  return { pedido, oferta: o };
}

export function concluirPedido(pedido) {
  if (pedido.status !== 'confirmado') return false;
  db().prepare("UPDATE pedidos SET status='concluido' WHERE id=?").run(pedido.id);
  const o = db().prepare('SELECT freteiro_id FROM ofertas WHERE id=?').get(pedido.oferta_escolhida_id);
  if (o) db().prepare('UPDATE freteiros SET concluidos = concluidos + 1 WHERE id=?').run(o.freteiro_id);
  return true;
}

export async function avaliarPedido(pedido, nota, comentario = null) {
  nota = Math.round(Number(nota));
  if (!(nota >= 1 && nota <= 5)) throw new ErroValidacao('A nota deve ser de 1 a 5.');
  if (!['confirmado', 'concluido'].includes(pedido.status)) throw new ErroValidacao('Só dá para avaliar depois de confirmar o frete.');
  if (pedido.nota) throw new ErroValidacao('Este pedido já foi avaliado.');
  if (pedido.status === 'confirmado') concluirPedido(pedido);
  db().prepare('UPDATE pedidos SET nota=?, comentario=? WHERE id=?').run(nota, comentario ? String(comentario).slice(0, 500) : null, pedido.id);
  const o = db().prepare('SELECT freteiro_id FROM ofertas WHERE id=?').get(pedido.oferta_escolhida_id);
  if (o) db().prepare('UPDATE freteiros SET nota_soma = nota_soma + ?, avaliacoes = avaliacoes + 1 WHERE id=?').run(nota, o.freteiro_id);
  return true;
}

export async function cancelarPedido(pedido, motivo = 'cliente') {
  if (['concluido', 'cancelado'].includes(pedido.status)) return false;
  const eraConfirmado = pedido.status === 'confirmado';
  db().prepare("UPDATE pedidos SET status='cancelado' WHERE id=?").run(pedido.id);
  if (eraConfirmado) {
    const o = db().prepare('SELECT freteiro_id FROM ofertas WHERE id=?').get(pedido.oferta_escolhida_id);
    if (o) {
      const f = buscarFreteiro(o.freteiro_id);
      if (motivo === 'freteiro') db().prepare('UPDATE freteiros SET cancelamentos = cancelamentos + 1 WHERE id=?').run(f.id);
      await enviarMensagem(f.telefone, `❌ O pedido #${pedido.codigo} foi cancelado.`);
    }
  }
  return true;
}

// ---------- mensagens recebidas no WhatsApp ----------

export async function processarMensagem({ telefone, texto, grupo = null }) {
  telefone = normalizarTelefone(telefone);
  texto = String(texto || '').trim();
  if (!texto) return { tipo: 'vazio' };
  registrarEntrada(grupo || telefone, grupo ? `[${telefone}] ${texto}` : texto);

  const freteiro = buscarFreteiroPorTelefone(telefone);
  if (freteiro) return processarMensagemFreteiro(freteiro, texto, grupo);
  if (grupo) return { tipo: 'ignorada' };
  return processarMensagemCliente(telefone, texto);
}

async function processarMensagemFreteiro(f, texto, grupo) {
  const t = texto.toUpperCase();
  if (!grupo) {
    if (/^(AJUDA|MENU|OI|OLÁ|OLA)\b/.test(t)) return enviarMensagem(f.telefone, msg.ajudaFreteiro()).then(() => ({ tipo: 'ajuda' }));
    if (/^PAUSAR?\b/.test(t)) {
      db().prepare('UPDATE freteiros SET ativo=0 WHERE id=?').run(f.id);
      await enviarMensagem(f.telefone, '⏸️ Pausado. Você não vai receber novos pedidos. Mande *VOLTAR* quando quiser.');
      return { tipo: 'pausa' };
    }
    if (/^VOLTAR\b/.test(t)) {
      db().prepare('UPDATE freteiros SET ativo=1 WHERE id=?').run(f.id);
      await enviarMensagem(f.telefone, '▶️ Pronto! Você voltou a receber pedidos.');
      return { tipo: 'volta' };
    }
    const conc = t.match(/^CONCLU[IÍ]D[OA]\s*#?([A-Z2-9]{4})/);
    if (conc) {
      const p = buscarPedidoPorCodigo(conc[1]);
      const o = p && db().prepare('SELECT freteiro_id FROM ofertas WHERE id=?').get(p.oferta_escolhida_id);
      if (p && o?.freteiro_id === f.id && concluirPedido(p)) {
        await enviarMensagem(f.telefone, `👏 Pedido #${p.codigo} concluído. Bom trabalho!`);
        await enviarMensagem(p.cliente_telefone, `Seu frete #${p.codigo} foi concluído! Como foi? Responda com uma nota de *1 a 5* ⭐`);
        return { tipo: 'concluido' };
      }
    }
  }

  const abertos = pedidosAbertosDoFreteiro(f.id);
  const lida = await lerOferta(texto, { pedidosAbertos: abertos });
  let pedido = lida.codigo ? buscarPedidoPorCodigo(lida.codigo) : null;
  // Sem código: se ele só tem um pedido aberto, a oferta é para esse.
  if (!pedido && abertos.length === 1) pedido = abertos[0];

  if (!lida.eh_oferta || !lida.valor) {
    if (grupo) return { tipo: 'ignorada' };
    await enviarMensagem(f.telefone, msg.naoEntendi(abertos.map((p) => p.codigo)));
    return { tipo: 'nao_entendi', lida };
  }
  if (!pedido) {
    await enviarMensagem(f.telefone, msg.naoEntendi(abertos.map((p) => p.codigo)));
    return { tipo: 'sem_pedido', lida };
  }
  if (pedido.status !== 'aberto') {
    await enviarMensagem(f.telefone, msg.pedidoFechado(pedido.codigo));
    return { tipo: 'fechado' };
  }
  try {
    const r = await registrarOferta({ pedido, freteiro: f, dados: lida, canal: grupo ? 'grupo' : 'whatsapp', mensagem: texto });
    return { tipo: 'oferta', pedido: pedido.codigo, lida, ...r };
  } catch (e) {
    if (!(e instanceof ErroValidacao)) throw e;
    await enviarMensagem(f.telefone, `⚠️ ${e.message}`);
    return { tipo: 'erro', erro: e.message };
  }
}

async function processarMensagemCliente(telefone, texto) {
  const pedido = db()
    .prepare(
      `SELECT * FROM pedidos WHERE cliente_telefone = ? AND status NOT IN ('cancelado')
       ORDER BY id DESC LIMIT 1`,
    )
    .get(telefone);
  if (!pedido) {
    await enviarMensagem(telefone, `Olá! 👋 Para pedir um frete ou mudança em Jaraguá do Sul, acesse ${config.baseUrl}`);
    return { tipo: 'cliente_sem_pedido' };
  }
  const t = texto.trim().toUpperCase();
  if (/^CANCELAR\b/.test(t)) {
    await cancelarPedido(pedido);
    await enviarMensagem(telefone, `Pedido #${pedido.codigo} cancelado. Quando precisar, é só chamar! 👋`);
    return { tipo: 'cancelado' };
  }
  const n = t.match(/^\s*([1-5])\s*(?:️⃣)?\s*(?:ESTRELAS?)?\s*$/);
  if (pedido.status === 'aguardando_escolha' && n && Number(n[1]) <= 3) {
    const o = top3DoPedido(pedido.id).find((x) => x.posicao === Number(n[1]));
    if (o) {
      await escolherOferta(pedido, o.id);
      return { tipo: 'escolha', oferta: o.id };
    }
  }
  if (['confirmado', 'concluido'].includes(pedido.status) && n && !pedido.nota) {
    await avaliarPedido(pedido, Number(n[1]));
    await enviarMensagem(telefone, msg.obrigadoAvaliacao());
    return { tipo: 'avaliacao' };
  }
  await enviarMensagem(telefone, `Seu pedido #${pedido.codigo} está: *${STATUS[pedido.status] || pedido.status}*. Detalhes: ${linkPedido(pedido)}`);
  return { tipo: 'status' };
}

export const STATUS = {
  aberto: 'Recebendo ofertas',
  fechando: 'Selecionando as melhores',
  aguardando_escolha: 'Aguardando sua escolha',
  confirmado: 'Confirmado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  sem_ofertas: 'Sem ofertas',
};

// ---------- agendador ----------

export async function tick(agora = new Date()) {
  const iso = agora.toISOString();
  const vencidos = db().prepare("SELECT * FROM pedidos WHERE status='aberto' AND prazo_ofertas <= ?").all(iso);
  for (const p of vencidos) {
    try {
      await fecharPedido(p);
    } catch (e) {
      console.error(`[tick] erro ao fechar #${p.codigo}:`, e);
      db().prepare("UPDATE pedidos SET status='aberto' WHERE id=? AND status='fechando'").run(p.id);
    }
  }
  const limite = new Date(agora.getTime() - config.lembreteEscolhaMin * 60000).toISOString();
  const esperando = db()
    .prepare("SELECT * FROM pedidos WHERE status='aguardando_escolha' AND lembrete_enviado=0 AND top3_enviado_em <= ?")
    .all(limite);
  for (const p of esperando) {
    db().prepare('UPDATE pedidos SET lembrete_enviado=1 WHERE id=?').run(p.id);
    await enviarMensagem(p.cliente_telefone, msg.lembreteEscolha(p, linkPedido(p)));
  }
  // Pedido que travou em "fechando" (ex: servidor reiniciou no meio) volta a ser processado.
  db().prepare("UPDATE pedidos SET status='aberto' WHERE status='fechando' AND prazo_ofertas <= ?").run(
    new Date(agora.getTime() - 5 * 60000).toISOString(),
  );
}

// ---------- freteiros ----------

export function cadastrarFreteiro(d) {
  const erros = [];
  if (!d.nome || String(d.nome).trim().length < 3) erros.push('Nome é obrigatório');
  const tel = normalizarTelefone(d.telefone);
  if (!/^55\d{10,11}$/.test(tel)) erros.push('WhatsApp inválido');
  if (!VEICULOS[d.veiculo]) erros.push('Veículo inválido');
  if (!d.aceite) erros.push('É preciso aceitar os termos');
  if (erros.length) throw new ErroValidacao(erros.join('. '));
  if (buscarFreteiroPorTelefone(tel)) throw new ErroValidacao('Este WhatsApp já está cadastrado.');
  const regioes = [].concat(d.regioes || []).filter((r) => r === 'Todas' || BAIRROS_JARAGUA.includes(r));
  const info = db()
    .prepare(
      `INSERT INTO freteiros (nome, telefone, token, veiculo, placa, ajudantes, regioes, atende_empresas, faz_montagem, aprovado)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      String(d.nome).trim().slice(0, 80),
      tel,
      gerarToken(),
      d.veiculo,
      d.placa ? String(d.placa).toUpperCase().slice(0, 8) : null,
      Math.min(Math.max(parseInt(d.ajudantes, 10) || 0, 0), 6),
      regioes.join(','),
      d.atende_empresas ? 1 : 0,
      d.faz_montagem ? 1 : 0,
      d.aprovado ? 1 : 0,
    );
  return buscarFreteiro(Number(info.lastInsertRowid));
}

export async function aprovarFreteiro(id) {
  db().prepare('UPDATE freteiros SET aprovado=1 WHERE id=?').run(id);
  const f = buscarFreteiro(id);
  if (f) {
    await enviarMensagem(
      f.telefone,
      `✅ Cadastro aprovado no ${config.nomeApp}! A partir de agora você recebe aqui os pedidos de frete de Jaraguá do Sul.\n\n${msg.ajudaFreteiro()}`,
    );
  }
  return f;
}
