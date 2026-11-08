// Camada de envio/recebimento de WhatsApp com 3 provedores:
//  - console:   desenvolvimento. Só registra no banco e no terminal (veja /simulador).
//  - meta:      WhatsApp Cloud API oficial da Meta. Mensagens 1:1 (sem grupo).
//  - evolution: Evolution API (gateway open-source, não-oficial). Suporta grupos.
// Toda mensagem (enviada e recebida) é registrada na tabela `mensagens`.

import { config } from './config.js';
import { getDb } from './db.js';

const wa = config.whatsapp;

function registrar(direcao, telefone, texto) {
  getDb().prepare('INSERT INTO mensagens (direcao, telefone, texto) VALUES (?, ?, ?)').run(direcao, telefone, texto);
}

export async function enviarMensagem(telefone, texto) {
  registrar('saida', telefone, texto);
  try {
    if (wa.provider === 'meta') return await enviarMeta(telefone, texto);
    if (wa.provider === 'evolution') return await enviarEvolution(telefone, texto);
    console.log(`\n[whatsapp -> ${telefone}]\n${texto}\n`);
  } catch (err) {
    console.error(`[whatsapp] falha ao enviar para ${telefone}:`, err.message);
  }
}

// Envia para o grupo dos freteiros, se houver um configurado e o provedor suportar.
export async function enviarParaGrupo(texto) {
  if (!wa.grupoFreteiros) return false;
  if (wa.provider === 'meta') return false; // Cloud API: usamos envio individual
  await enviarMensagem(wa.grupoFreteiros, texto);
  return true;
}

export const suportaGrupo = () => Boolean(wa.grupoFreteiros) && wa.provider !== 'meta';

export function registrarEntrada(telefone, texto) {
  registrar('entrada', telefone, texto);
}

async function enviarMeta(telefone, texto) {
  // Atenção: fora da janela de 24h desde a última mensagem do contato a Meta só aceita
  // mensagens de template aprovadas. Veja README > WhatsApp.
  const url = `https://graph.facebook.com/${wa.metaApiVersion}/${wa.metaPhoneNumberId}/messages`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wa.metaToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: telefone, type: 'text', text: { body: texto, preview_url: true } }),
  });
  if (!r.ok) throw new Error(`Meta ${r.status}: ${await r.text()}`);
}

async function enviarEvolution(destino, texto) {
  const url = `${wa.evolutionUrl.replace(/\/$/, '')}/message/sendText/${wa.evolutionInstance}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { apikey: wa.evolutionKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: destino, text: texto }),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${await r.text()}`);
}

// Converte o corpo do webhook de cada provedor em [{ telefone, texto, grupo }].
export function lerWebhook(body) {
  const saida = [];
  // Meta Cloud API
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      for (const m of change.value?.messages || []) {
        const texto = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title;
        if (texto) saida.push({ telefone: m.from, texto, grupo: null });
      }
    }
  }
  // Evolution API (evento messages.upsert)
  if (body?.event && /messages[._]upsert/i.test(body.event)) {
    const itens = Array.isArray(body.data) ? body.data : [body.data];
    for (const d of itens) {
      if (!d || d.key?.fromMe) continue;
      const jid = d.key?.remoteJid || '';
      const ehGrupo = jid.endsWith('@g.us');
      const autor = (ehGrupo ? d.key?.participant : jid) || '';
      const texto = d.message?.conversation || d.message?.extendedTextMessage?.text;
      if (texto) saida.push({ telefone: autor.split('@')[0], texto, grupo: ehGrupo ? jid : null });
    }
  }
  return saida;
}
