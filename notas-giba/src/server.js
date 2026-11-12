import express from 'express';
import { join, extname, basename } from 'node:path';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { abrirDb } from './db.js';
import * as d from './dados.js';
import { ErroValidacao } from './dados.js';
import { ehXmlNFe, lerXmlNFe } from './nfe-xml.js';
import { lerNotaPorImagem } from './ia.js';
import { protegido, senhaCorreta, logado, criarSessao, encerrarSessao, exigirLogin } from './auth.js';

const PUBLIC = join(config.raiz, 'public');
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf', 'text/xml': '.xml' };

const id = (req) => Number(req.params.id);

export function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '45mb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(express.static(PUBLIC, { extensions: ['html'], index: 'index.html' }));

  // ---------- sessão ----------
  app.get('/api/sessao', (req, res) => {
    res.json({ logado: logado(req), protegido: protegido(), ia: config.ia.habilitada });
  });

  let tentativas = 0;
  setInterval(() => (tentativas = 0), 60_000).unref();
  app.post('/api/login', async (req, res) => {
    if (++tentativas > 20) return res.status(429).json({ erro: 'Muitas tentativas. Espere um minuto.' });
    await new Promise((r) => setTimeout(r, 300));
    if (!senhaCorreta(req.body?.senha || '')) return res.status(401).json({ erro: 'Senha incorreta.' });
    criarSessao(req, res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (_req, res) => {
    encerrarSessao(res);
    res.json({ ok: true });
  });

  app.use('/api', exigirLogin);
  app.use('/arquivos', exigirLogin);

  // ---------- arquivos das notas (fotos/PDF/XML) ----------
  app.get('/arquivos/:nome', (req, res) => {
    const nome = basename(req.params.nome);
    const caminho = join(config.uploadsDir, nome);
    if (!/^[\w-]+\.\w+$/.test(nome) || !existsSync(caminho)) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=86400');
    res.sendFile(caminho);
  });

  // ---------- ajustes ----------
  app.get('/api/ajustes', (_req, res) => res.json(d.ajustes()));
  app.put('/api/ajustes', (req, res) => res.json(d.salvarAjustes(req.body || {})));

  // ---------- painel ----------
  app.get('/api/painel', (req, res) => res.json(d.painel(String(req.query.periodo || 'mes'))));

  // ---------- notas ----------
  app.get('/api/notas', (req, res) => res.json(d.listarNotas({ busca: req.query.busca })));

  // Envio de foto(s), PDF ou XML da nota: lê, cadastra e vincula às encomendas.
  app.post('/api/notas/ler', async (req, res) => {
    const arquivos = Array.isArray(req.body?.arquivos) ? req.body.arquivos : [];
    if (!arquivos.length) throw new ErroValidacao('Envie pelo menos uma foto ou arquivo da nota.');
    if (arquivos.length > 8) throw new ErroValidacao('Envie no máximo 8 fotos por nota.');

    const xml = arquivos.find((a) => /xml/.test(a.tipo || '') || /\.xml$/i.test(a.nome || ''));
    let lido;
    let origem;
    let salvar;
    if (xml) {
      const conteudo = Buffer.from(xml.base64 || '', 'base64').toString('utf8');
      if (!ehXmlNFe(conteudo)) throw new ErroValidacao('Este XML não é de uma NF-e.');
      lido = { nota: lerXmlNFe(conteudo), sugestoes: new Map() };
      origem = 'xml';
      salvar = [{ ...xml, tipo: 'text/xml' }];
    } else {
      for (const a of arquivos) {
        if (![...TIPOS_IMAGEM, 'application/pdf'].includes(a.tipo)) {
          throw new ErroValidacao('Formato não suportado. Envie foto (JPG/PNG), PDF ou o XML da nota.');
        }
        if (!a.base64) throw new ErroValidacao('Arquivo vazio.');
      }
      lido = await lerNotaPorImagem(arquivos, d.encomendasPendentes());
      origem = arquivos.some((a) => a.tipo === 'application/pdf') ? 'pdf' : 'foto';
      salvar = arquivos;
    }

    const guardados = guardarArquivos(salvar);
    try {
      const r = d.criarNota(lido.nota, { origem, arquivos: guardados, sugestoes: lido.sugestoes });
      res.status(201).json(r);
    } catch (e) {
      apagarArquivos(guardados);
      throw e;
    }
  });

  app.post('/api/notas', (req, res) => res.status(201).json(d.criarNota(req.body || {}, { origem: 'manual' })));

  app.get('/api/notas/:id', (req, res) => {
    const n = d.buscarNota(id(req));
    if (!n) return res.status(404).json({ erro: 'Nota não encontrada.' });
    res.json(n);
  });
  app.put('/api/notas/:id', (req, res) => res.json(d.atualizarNota(id(req), req.body || {})));
  app.delete('/api/notas/:id', (req, res) => {
    const arquivos = d.excluirNota(id(req));
    if (!arquivos) return res.status(404).json({ erro: 'Nota não encontrada.' });
    apagarArquivos(arquivos);
    res.json({ ok: true });
  });
  app.post('/api/notas/:id/markup', (req, res) => res.json(d.aplicarMarkupNota(id(req), req.body?.markup)));
  app.post('/api/notas/:id/combinar', (req, res) => {
    const vinculadas = d.combinarNota(id(req));
    res.json({ vinculadas, nota: d.buscarNota(id(req)) });
  });
  app.post('/api/notas/:id/itens', (req, res) => res.status(201).json(d.adicionarItem(id(req), req.body || {})));
  app.put('/api/itens/:id', (req, res) => res.json(d.atualizarItem(id(req), req.body || {})));
  app.delete('/api/itens/:id', (req, res) => res.json(d.excluirItem(id(req))));

  // ---------- contatos ----------
  app.get('/api/contatos', (req, res) => res.json(d.listarContatos({ busca: req.query.busca })));
  app.post('/api/contatos', (req, res) => res.status(201).json(d.criarContato(req.body || {})));
  app.get('/api/contatos/:id', (req, res) => {
    const c = d.buscarContato(id(req));
    if (!c) return res.status(404).json({ erro: 'Contato não encontrado.' });
    res.json(c);
  });
  app.put('/api/contatos/:id', (req, res) => res.json(d.atualizarContato(id(req), req.body || {})));
  app.delete('/api/contatos/:id', (req, res) => res.json({ ok: d.excluirContato(id(req)) }));

  // ---------- encomendas ----------
  app.get('/api/encomendas', (req, res) => res.json(d.listarEncomendas(req.query)));
  app.post('/api/encomendas', (req, res) => res.status(201).json(d.criarEncomenda(req.body || {})));
  app.post('/api/encomendas/status', (req, res) => res.json(d.mudarStatus(req.body?.ids, req.body?.status)));
  app.put('/api/encomendas/:id', (req, res) => res.json(d.atualizarEncomenda(id(req), req.body || {})));
  app.post('/api/encomendas/:id/vincular', (req, res) => res.json(d.vincular(id(req), req.body?.item_id)));
  app.delete('/api/encomendas/:id', (req, res) => res.json({ ok: d.excluirEncomenda(id(req)) }));

  app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  // SPA: qualquer outra rota abre o app
  app.get('/{*resto}', (_req, res) => res.sendFile(join(PUBLIC, 'index.html')));

  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Arquivo grande demais. Envie fotos menores.' });
    const status = err.status || err.statusCode || 500;
    const conhecido = err instanceof ErroValidacao || err.publico;
    if (!conhecido) console.error('[erro]', err);
    res.status(conhecido || status < 500 ? status : 500).json({
      erro: conhecido || (status < 500 && err.expose) ? err.message : 'Algo deu errado no servidor. Tente de novo.',
      ...(err.notaId ? { nota_id: err.notaId } : {}),
    });
  });

  return app;
}

function guardarArquivos(arquivos) {
  mkdirSync(config.uploadsDir, { recursive: true });
  return arquivos.map((a) => {
    const ext = EXT[a.tipo] || extname(a.nome || '').toLowerCase().replace(/[^.\w]/g, '') || '.bin';
    const nome = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${ext}`;
    writeFileSync(join(config.uploadsDir, nome), Buffer.from(a.base64, 'base64'));
    return { arquivo: nome, tipo: a.tipo, nome: String(a.nome || nome).slice(0, 120) };
  });
}

function apagarArquivos(lista) {
  for (const a of lista || []) {
    try {
      unlinkSync(join(config.uploadsDir, basename(a.arquivo)));
    } catch {}
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  abrirDb();
  criarApp().listen(config.port, () => {
    console.log(`Notas do Giba rodando em http://localhost:${config.port}`);
    if (!protegido()) console.warn('⚠️  APP_PASSWORD não definida: o site está SEM senha. Defina antes de colocar na internet.');
    if (!config.ia.habilitada) console.warn('⚠️  ANTHROPIC_API_KEY não definida: leitura de fotos desativada (XML e cadastro manual funcionam).');
  });
}
