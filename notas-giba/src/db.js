import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

let db;

export function abrirDb(caminho = config.dbPath) {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  db = new DatabaseSync(caminho);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrar();
  return db;
}

export function getDb() {
  if (!db) abrirDb();
  return db;
}

function migrar() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT,
      serie TEXT,
      chave TEXT,
      emitente_nome TEXT,
      emitente_cnpj TEXT,
      data_emissao TEXT,
      valor_produtos REAL NOT NULL DEFAULT 0,
      frete REAL NOT NULL DEFAULT 0,
      seguro REAL NOT NULL DEFAULT 0,
      desconto REAL NOT NULL DEFAULT 0,
      outras REAL NOT NULL DEFAULT 0,
      impostos REAL NOT NULL DEFAULT 0,
      valor_total REAL NOT NULL DEFAULT 0,
      markup_padrao REAL NOT NULL DEFAULT 30,
      ratear_despesas INTEGER NOT NULL DEFAULT 1,
      origem TEXT NOT NULL DEFAULT 'manual',
      arquivos TEXT NOT NULL DEFAULT '[]',
      avisos_leitura TEXT,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nota_id INTEGER NOT NULL REFERENCES notas(id) ON DELETE CASCADE,
      ordem INTEGER NOT NULL DEFAULT 0,
      codigo TEXT,
      descricao TEXT NOT NULL,
      ncm TEXT,
      quantidade REAL NOT NULL DEFAULT 1,
      unidade TEXT,
      valor_unitario REAL NOT NULL DEFAULT 0,
      valor_total REAL NOT NULL DEFAULT 0,
      markup REAL
    );
    CREATE INDEX IF NOT EXISTS idx_itens_nota ON itens(nota_id);
    CREATE TABLE IF NOT EXISTS contatos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS encomendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contato_id INTEGER NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
      produto TEXT NOT NULL,
      quantidade REAL NOT NULL DEFAULT 1,
      valor_combinado REAL,
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'aguardando',
      item_id INTEGER REFERENCES itens(id) ON DELETE SET NULL,
      vinculo_auto INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      chegou_em TEXT,
      avisado_em TEXT,
      entregue_em TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_enc_status ON encomendas(status);
    CREATE INDEX IF NOT EXISTS idx_enc_item ON encomendas(item_id);
    CREATE TABLE IF NOT EXISTS ajustes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);
}
