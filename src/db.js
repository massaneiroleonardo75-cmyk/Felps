import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

let db;

export function openDb(path = config.dbPath) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate();
  return db;
}

export function getDb() {
  if (!db) openDb();
  return db;
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS freteiros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      veiculo TEXT NOT NULL,
      placa TEXT,
      ajudantes INTEGER NOT NULL DEFAULT 0,
      regioes TEXT NOT NULL DEFAULT '',
      atende_empresas INTEGER NOT NULL DEFAULT 1,
      faz_montagem INTEGER NOT NULL DEFAULT 0,
      aprovado INTEGER NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      nota_soma REAL NOT NULL DEFAULT 0,
      avaliacoes INTEGER NOT NULL DEFAULT 0,
      concluidos INTEGER NOT NULL DEFAULT 0,
      cancelamentos INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL,
      cliente_nome TEXT NOT NULL,
      cliente_telefone TEXT NOT NULL,
      cliente_tipo TEXT NOT NULL DEFAULT 'pf',
      empresa TEXT,
      origem_bairro TEXT NOT NULL,
      origem_endereco TEXT,
      origem_andar INTEGER NOT NULL DEFAULT 0,
      origem_elevador INTEGER NOT NULL DEFAULT 0,
      destino_cidade TEXT NOT NULL,
      destino_bairro TEXT,
      destino_endereco TEXT,
      destino_andar INTEGER NOT NULL DEFAULT 0,
      destino_elevador INTEGER NOT NULL DEFAULT 0,
      distancia_km REAL NOT NULL,
      quando TEXT NOT NULL,
      data_hora TEXT,
      volume TEXT NOT NULL,
      itens TEXT NOT NULL,
      ajudantes INTEGER NOT NULL DEFAULT 0,
      montagem INTEGER NOT NULL DEFAULT 0,
      observacoes TEXT,
      estimativa_min REAL NOT NULL,
      estimativa_max REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto',
      prazo_ofertas TEXT NOT NULL,
      prorrogado INTEGER NOT NULL DEFAULT 0,
      resumo_ia TEXT,
      oferta_escolhida_id INTEGER,
      nota INTEGER,
      comentario TEXT,
      top3_enviado_em TEXT,
      lembrete_enviado INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ofertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      freteiro_id INTEGER NOT NULL REFERENCES freteiros(id),
      valor REAL NOT NULL,
      imediato INTEGER NOT NULL DEFAULT 0,
      eta_minutos INTEGER,
      horario TEXT,
      veiculo TEXT,
      ajudantes INTEGER,
      observacoes TEXT,
      mensagem_original TEXT,
      canal TEXT NOT NULL DEFAULT 'whatsapp',
      score REAL,
      posicao INTEGER,
      selos TEXT,
      motivo TEXT,
      alertas TEXT,
      status TEXT NOT NULL DEFAULT 'recebida',
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (pedido_id, freteiro_id)
    );

    CREATE TABLE IF NOT EXISTS notificacoes (
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
      freteiro_id INTEGER NOT NULL REFERENCES freteiros(id),
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (pedido_id, freteiro_id)
    );

    CREATE TABLE IF NOT EXISTS mensagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direcao TEXT NOT NULL,
      telefone TEXT NOT NULL,
      texto TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
    CREATE INDEX IF NOT EXISTS idx_ofertas_pedido ON ofertas(pedido_id);
    CREATE INDEX IF NOT EXISTS idx_mensagens_tel ON mensagens(telefone);
  `);
}

// Datas sempre em ISO UTC no banco.
export const agoraIso = () => new Date().toISOString();
export const minutosDepois = (min, base = new Date()) => new Date(base.getTime() + min * 60_000).toISOString();
