import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { openDb, getDb } from './db.js';
import { BAIRROS_JARAGUA, CIDADES, TIPOS, VOLUMES, VEICULOS, distanciaEstimada } from './dominio.js';
import { estimarPreco } from './precos.js';
import { lerWebhook } from './whatsapp.js';
import * as fluxo from './fluxo.js';
import { ErroValidacao, STATUS } from './fluxo.js';
import { formatarTelefone } from './util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

export function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(PUBLIC, { extensions: ['html'] }));

  const pagina = (arquivo) => (_req, res) => res.sendFile(join(PUBLIC, arquivo));
  app.get('/p/:token', pagina('pedido.html'));
  app.get('/o/:codigo', pagina('oferta.html'));

  // ---------- dados públicos ----------
  app.get('/api/meta', (_req, res) => {
    res.json({
      nomeApp: config.nomeApp,
      bairros: BAIRROS_JARAGUA,
      cidades: Object.keys(CIDADES),
      tipos: TIPOS,
      volumes: VOLUMES,
      veiculos: VEICULOS,
      janelaImediatoMin: config.janelaImediatoMin,
      janelaAgendadoMin: config.janelaAgendadoMin,
      simulador: config.whatsapp.provider === 'console',
    });
  });

  app.post('/api/estimativa', (req, res) => {
    const d = { ...req.body };
    d.distancia_km = Number(d.distancia_km) > 0 ? Number(d.distancia_km) : distanciaEstimada(d);
    res.json({ ...estimarPreco(d), distancia_km: d.distancia_km });
  });

  // ---------- cliente ----------
  app.post('/api/pedidos', async (req, res) => {
    const { pedido, avisados } = await fluxo.criarPedido(req.body);
    res.status(201).json({ token: pedido.token, codigo: pedido.codigo, avisados, link: fluxo.linkPedido(pedido) });
  });

  app.get('/api/pedidos/:token', (req, res) => {
    const p = fluxo.buscarPedidoPorToken(req.params.token);
    if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
    res.json(visaoCliente(p));
  });

  app.post('/api/pedidos/:token/escolher', async (req, res) => {
    const p = fluxo.buscarPedidoPorToken(req.params.token);
    if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
    await fluxo.escolherOferta(p, req.body.oferta_id);
    res.json(visaoCliente(fluxo.buscarPedido(p.id)));
  });

  app.post('/api/pedidos/:token/avaliar', async (req, res) => {
    const p = fluxo.buscarPedidoPorToken(req.params.token);
    if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
    await fluxo.avaliarPedido(p, req.body.nota, req.body.comentario);
    res.json(visaoCliente(fluxo.buscarPedido(p.id)));
  });

  app.post('/api/pedidos/:token/cancelar', async (req, res) => {
    const p = fluxo.buscarPedidoPorToken(req.params.token);
    if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
    await fluxo.cancelarPedido(p);
    res.json(visaoCliente(fluxo.buscarPedido(p.id)));
  });

  // ---------- freteiro ----------
  app.post('/api/freteiros', (req, res) => {
    const f = fluxo.cadastrarFreteiro({ ...req.body, aprovado: false });
    res.status(201).json({ id: f.id, nome: f.nome });
  });

  app.get('/api/ofertas/:codigo', (req, res) => {
    const { p, f } = pedidoEFreteiro(req);
    const minha = getDb().prepare('SELECT * FROM ofertas WHERE pedido_id=? AND freteiro_id=?').get(p.id, f.id);
    res.json({ pedido: visaoFreteiro(p), freteiro: { nome: f.nome, veiculo: f.veiculo_nome, ajudantes: f.ajudantes }, minhaOferta: minha || null });
  });

  app.post('/api/ofertas/:codigo', async (req, res) => {
    const { p, f } = pedidoEFreteiro(req);
    const b = req.body;
    const imediato = b.quando === 'imediato';
    const horario = !imediato && b.horario ? new Date(`${b.horario}${b.horario.length === 16 ? ':00' : ''}-03:00`).toISOString() : null;
    const r = await fluxo.registrarOferta({
      pedido: p,
      freteiro: f,
      canal: 'web',
      dados: {
        valor: b.valor,
        imediato,
        eta_minutos: imediato ? Number(b.eta_minutos) || 30 : null,
        horario,
        veiculo: b.veiculo || f.veiculo_nome,
        ajudantes: b.ajudantes,
        observacoes: b.observacoes,
      },
    });
    res.json(r);
  });

  function pedidoEFreteiro(req) {
    const p = fluxo.buscarPedidoPorCodigo(req.params.codigo);
    const f = req.query.f && fluxo.buscarFreteiroPorToken(String(req.query.f));
    if (!p || !f) throw new NaoEncontrado('Link inválido');
    return { p, f };
  }

  // ---------- webhook WhatsApp ----------
  // Verificação da Meta (GET) — https://developers.facebook.com/docs/graph-api/webhooks/getting-started
  app.get('/webhook/whatsapp', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.whatsapp.metaVerifyToken) {
      return res.send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
  });

  app.post('/webhook/whatsapp', (req, res) => {
    res.sendStatus(200); // responde rápido; processa depois
    for (const m of lerWebhook(req.body)) {
      fluxo.processarMensagem(m).catch((e) => console.error('[webhook]', e));
    }
  });

  // ---------- admin ----------
  const admin = express.Router();
  admin.use((req, res, next) => {
    const senha = Buffer.from(String(req.get('x-admin-senha') || ''));
    const certa = Buffer.from(config.adminPassword);
    if (senha.length !== certa.length || !timingSafeEqual(senha, certa)) return res.status(401).json({ erro: 'Senha inválida' });
    next();
  });

  admin.get('/resumo', (_req, res) => {
    const db = getDb();
    const porStatus = Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM pedidos GROUP BY status').all().map((r) => [r.status, r.n]));
    const faturamento = db
      .prepare(`SELECT COALESCE(SUM(o.valor),0) total, COUNT(*) n FROM pedidos p JOIN ofertas o ON o.id = p.oferta_escolhida_id WHERE p.status IN ('confirmado','concluido')`)
      .get();
    const mediaOfertas = db.prepare('SELECT AVG(n) m FROM (SELECT COUNT(*) n FROM ofertas GROUP BY pedido_id)').get().m || 0;
    const precoMedio = db
      .prepare(
        `SELECT p.volume, ROUND(AVG(o.valor)) media, ROUND(AVG((p.estimativa_min+p.estimativa_max)/2.0)) estimativa, COUNT(*) n
         FROM ofertas o JOIN pedidos p ON p.id=o.pedido_id GROUP BY p.volume`,
      )
      .all();
    const freteiros = db.prepare('SELECT SUM(aprovado) aprovados, SUM(aprovado=0) pendentes, SUM(ativo AND aprovado) ativos FROM freteiros').get();
    res.json({
      porStatus,
      fechados: faturamento.n,
      gmv: faturamento.total,
      comissaoEstimada: Math.round((faturamento.total * config.comissaoPercentual) / 100),
      comissaoPercentual: config.comissaoPercentual,
      mediaOfertasPorPedido: Math.round(mediaOfertas * 10) / 10,
      precoMedio,
      freteiros,
      ia: config.ai.enabled,
      whatsapp: config.whatsapp.provider,
    });
  });

  admin.get('/pedidos', (_req, res) => {
    const linhas = getDb().prepare('SELECT * FROM pedidos ORDER BY id DESC LIMIT 200').all();
    res.json(
      linhas.map((p) => ({
        ...p,
        status_nome: STATUS[p.status] || p.status,
        tipo_nome: TIPOS[p.tipo],
        ofertas: fluxo.ofertasDoPedido(p.id).map((o) => ({ ...o, freteiro: { id: o.freteiro.id, nome: o.freteiro.nome } })),
      })),
    );
  });

  admin.post('/pedidos/:id/fechar', async (req, res) => {
    const p = fluxo.buscarPedido(req.params.id);
    if (!p) throw new NaoEncontrado('Pedido não encontrado');
    res.json((await fluxo.fecharPedido(p)) || { ok: false, erro: 'Pedido não está aberto' });
  });

  admin.post('/pedidos/:id/cancelar', async (req, res) => {
    const p = fluxo.buscarPedido(req.params.id);
    if (!p) throw new NaoEncontrado('Pedido não encontrado');
    res.json({ ok: await fluxo.cancelarPedido(p, req.body.motivo || 'admin') });
  });

  admin.get('/freteiros', (_req, res) => {
    res.json(getDb().prepare('SELECT * FROM freteiros ORDER BY aprovado, id DESC').all().map((f) => ({ ...fluxo.comNomeVeiculo(f), telefone_fmt: formatarTelefone(f.telefone) })));
  });

  admin.post('/freteiros', (req, res) => res.status(201).json(fluxo.cadastrarFreteiro({ ...req.body, aceite: true, aprovado: true })));
  admin.post('/freteiros/:id/aprovar', async (req, res) => res.json(await fluxo.aprovarFreteiro(Number(req.params.id))));
  admin.post('/freteiros/:id/ativo', (req, res) => {
    getDb().prepare('UPDATE freteiros SET ativo=? WHERE id=?').run(req.body.ativo ? 1 : 0, req.params.id);
    res.json({ ok: true });
  });

  // Simulador de WhatsApp (para testar sem número real)
  admin.get('/sim/contatos', (_req, res) => {
    const db = getDb();
    const freteiros = db.prepare('SELECT id, nome, telefone FROM freteiros WHERE aprovado=1 ORDER BY nome').all();
    const clientes = db.prepare('SELECT cliente_nome nome, cliente_telefone telefone, MAX(id) ultimo FROM pedidos GROUP BY cliente_telefone ORDER BY ultimo DESC LIMIT 30').all();
    res.json({ freteiros, clientes, grupo: config.whatsapp.grupoFreteiros || null });
  });
  admin.get('/sim/mensagens', (req, res) => {
    res.json(getDb().prepare('SELECT * FROM mensagens WHERE telefone = ? ORDER BY id DESC LIMIT 100').all(String(req.query.telefone)).reverse());
  });
  admin.post('/sim/enviar', async (req, res) => res.json(await fluxo.processarMensagem({ telefone: req.body.telefone, texto: req.body.texto })));
  admin.post('/tick', async (_req, res) => {
    await fluxo.tick();
    res.json({ ok: true });
  });

  app.use('/api/admin', admin);

  // ---------- erros ----------
  app.use((err, _req, res, _next) => {
    if (err instanceof ErroValidacao) return res.status(400).json({ erro: err.message });
    if (err instanceof NaoEncontrado) return res.status(404).json({ erro: err.message });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  });

  return app;
}

class NaoEncontrado extends Error {}

function visaoCliente(p) {
  const confirmado = ['confirmado', 'concluido'].includes(p.status);
  const top3 = ['aguardando_escolha', 'confirmado', 'concluido'].includes(p.status) ? fluxo.top3DoPedido(p.id) : [];
  const recebidas = getDb().prepare('SELECT COUNT(*) n FROM ofertas WHERE pedido_id=?').get(p.id).n;
  return {
    codigo: p.codigo,
    status: p.status,
    status_nome: STATUS[p.status] || p.status,
    tipo: TIPOS[p.tipo],
    volume: VOLUMES[p.volume]?.nome,
    origem: p.origem_bairro,
    destino: [p.destino_bairro, p.destino_cidade].filter(Boolean).join(', '),
    quando: p.quando,
    data_hora: p.data_hora,
    itens: p.itens,
    ajudantes: p.ajudantes,
    estimativa_min: p.estimativa_min,
    estimativa_max: p.estimativa_max,
    prazo_ofertas: p.prazo_ofertas,
    ofertas_recebidas: recebidas,
    resumo_ia: p.resumo_ia,
    nota: p.nota,
    oferta_escolhida_id: p.oferta_escolhida_id,
    opcoes: top3.map((o) => {
      const f = o.freteiro;
      const escolhida = o.id === p.oferta_escolhida_id;
      return {
        id: o.id,
        posicao: o.posicao,
        valor: o.valor,
        imediato: Boolean(o.imediato),
        eta_minutos: o.eta_minutos,
        horario: o.horario,
        veiculo: o.veiculo || f.veiculo_nome,
        ajudantes: o.ajudantes ?? f.ajudantes,
        observacoes: o.observacoes,
        selos: o.selos,
        motivo: o.motivo,
        alertas: o.alertas,
        score: o.score,
        freteiro: {
          nome: f.nome.split(' ')[0],
          nota: f.avaliacoes ? Math.round((f.nota_soma / f.avaliacoes) * 10) / 10 : null,
          avaliacoes: f.avaliacoes,
          concluidos: f.concluidos,
          // Contato só depois de confirmar, e só do escolhido.
          ...(confirmado && escolhida ? { nome_completo: f.nome, telefone: f.telefone, telefone_fmt: formatarTelefone(f.telefone), placa: f.placa } : {}),
        },
      };
    }),
  };
}

// O freteiro vê o pedido sem dados de contato nem endereço exato do cliente.
function visaoFreteiro(p) {
  return {
    codigo: p.codigo,
    status: p.status,
    aberto: p.status === 'aberto',
    tipo: TIPOS[p.tipo],
    volume: VOLUMES[p.volume]?.nome,
    origem: p.origem_bairro,
    origem_andar: p.origem_andar,
    origem_elevador: Boolean(p.origem_elevador),
    destino: [p.destino_bairro, p.destino_cidade].filter(Boolean).join(', '),
    destino_andar: p.destino_andar,
    destino_elevador: Boolean(p.destino_elevador),
    distancia_km: p.distancia_km,
    quando: p.quando,
    data_hora: p.data_hora,
    itens: p.itens,
    ajudantes: p.ajudantes,
    montagem: Boolean(p.montagem),
    empresa: p.cliente_tipo === 'pj',
    observacoes: p.observacoes,
    estimativa_min: p.estimativa_min,
    estimativa_max: p.estimativa_max,
    prazo_ofertas: p.prazo_ofertas,
  };
}

// ---------- inicialização ----------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  openDb();
  const app = criarApp();
  app.listen(config.port, () => {
    console.log(`${config.nomeApp} rodando em ${config.baseUrl}`);
    console.log(`WhatsApp: ${config.whatsapp.provider} | IA: ${config.ai.enabled ? config.ai.model : 'desligada (sem ANTHROPIC_API_KEY)'}`);
  });
  setInterval(() => fluxo.tick().catch((e) => console.error('[tick]', e)), 20_000);
}
