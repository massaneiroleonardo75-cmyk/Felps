// Leitor de ofertas SEM IA (fallback). Entende mensagens como:
//   "#K7QP 350 reais, chego em 40 min, Fiorino com 1 ajudante"
//   "k7qp R$ 1.200,00 sábado às 14h caminhão 3/4"
//   "posso agora 280"
// A versão com IA (ai.js) é usada quando há chave da Anthropic e cobre casos mais soltos.

import { nivelVeiculo } from './dominio.js';

export function extrairCodigo(texto) {
  const m = String(texto).toUpperCase().match(/(?:#|\bPEDIDO\s*)([A-Z2-9]{4})\b/) ||
    String(texto).toUpperCase().match(/^\s*([A-Z2-9]{4})\b/);
  return m ? m[1] : null;
}

export function extrairValor(texto) {
  const t = String(texto).replace(/#[A-Za-z0-9]{4}\b/, ' ');
  // Prioriza números colados a "R$" ou "reais"/"conto(s)".
  const comMarcador =
    t.match(/r\$\s*([\d.]+(?:,\d{1,2})?)/i) ||
    t.match(/([\d.]+(?:,\d{1,2})?)\s*(?:reais|conto|contos|pila|real)\b/i) ||
    t.match(/\b(\d+(?:[.,]\d+)?)\s*(?:mil)\b/i);
  if (comMarcador) {
    let v = paraNumero(comMarcador[1]);
    if (/mil\b/i.test(comMarcador[0])) v *= 1000;
    return v;
  }
  // Senão, o primeiro número "de preço" que não seja horário, minutos ou quantidade de ajudantes.
  const limpo = t
    .replace(/\b\d{1,2}\s*(?:h|hs|horas?)\s*\d{0,2}\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b\d+\s*(?:min|minutos?)\b/gi, ' ')
    .replace(/\b\d+\s*(?:ajudantes?|chapas?|pessoas?)\b/gi, ' ')
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ');
  const n = limpo.match(/\b(\d{2,5}(?:[.,]\d{3})*(?:,\d{1,2})?)\b/);
  return n ? paraNumero(n[1]) : null;
}

function paraNumero(s) {
  s = String(s).trim();
  if (/,\d{1,2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s.replace(',', '.'));
}

export function extrairDisponibilidade(texto, agora = new Date()) {
  const t = String(texto).toLowerCase();
  const min = t.match(/(\d+)\s*(?:min|minutos?)\b/);
  const horasRel = t.match(/\bem\s*(\d+)\s*(?:h|horas?)\b/);
  if (min) return { imediato: true, eta_minutos: Number(min[1]), horario: null };
  if (horasRel) return { imediato: true, eta_minutos: Number(horasRel[1]) * 60, horario: null };
  if (/\b(agora|j[aá]|imediat|na hora|to indo|tô indo|saindo)/.test(t)) {
    return { imediato: true, eta_minutos: 30, horario: null };
  }
  const h = t.match(/(?:[àa]s?\s*)?\b(\d{1,2})(?:\s*(?:h|hs|:)\s*(\d{2})?)\b/);
  if (h && (/(h|hs|:)/.test(h[0]) || /[àa]s?\s/.test(h[0]))) {
    const hora = Number(h[1]);
    const minuto = Number(h[2] || 0);
    if (hora <= 23 && minuto <= 59) {
      const d = horarioBrasilia(agora, hora, minuto, diaRelativo(t, agora));
      return { imediato: false, eta_minutos: null, horario: d.toISOString() };
    }
  }
  return { imediato: false, eta_minutos: null, horario: null };
}

function diaRelativo(t, agora) {
  if (/depois de amanh[aã]/.test(t)) return 2;
  if (/amanh[aã]/.test(t)) return 1;
  const dias = ['domingo', 'segunda', 'ter[cç]a', 'quarta', 'quinta', 'sexta', 's[aá]bado'];
  const hoje = diaSemanaBrasilia(agora);
  for (let i = 0; i < dias.length; i++) {
    if (new RegExp(`\\b${dias[i]}`).test(t)) return (i - hoje + 7) % 7;
  }
  return 0;
}

const diaSemanaBrasilia = (d) => new Date(d.getTime() - 3 * 3600_000).getUTCDay();

function horarioBrasilia(agora, hora, minuto, somaDias) {
  const local = new Date(agora.getTime() - 3 * 3600_000);
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + somaDias, hora + 3, minuto));
  return d;
}

export function extrairAjudantes(texto) {
  const t = String(texto).toLowerCase();
  const m = t.match(/(\d+)\s*(?:ajudantes?|chapas?)/) || t.match(/(?:com|\+)\s*(um|uma|dois|duas|tr[eê]s)\s*(?:ajudantes?|chapas?)/);
  if (m) return { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3 }[m[1]] ?? Number(m[1]);
  if (/sem ajudante|sozinho/.test(t)) return 0;
  if (/\b(com )?ajudante\b/.test(t)) return 1;
  return null;
}

export function extrairVeiculo(texto) {
  const t = String(texto);
  const m = t.match(/(fiorino|kangoo|saveiro|strada|s10|hilux|caminhonete|picape|pickup|carretinha|reboque|van|furg[aã]o|ducato|master|sprinter|boxer|daily|hr\b|bongo|accelo|caminh[aã]o(?:\s*(?:3\/4|ba[uú]|toco))?|ba[uú]|3\/4)/i);
  return m ? m[0] : null;
}

export function lerOfertaSemIA(texto, agora = new Date()) {
  const valor = extrairValor(texto);
  const disp = extrairDisponibilidade(texto, agora);
  const veiculo = extrairVeiculo(texto);
  return {
    codigo: extrairCodigo(texto),
    eh_oferta: valor !== null && valor >= 20,
    valor,
    ...disp,
    veiculo,
    nivel_veiculo: nivelVeiculo(veiculo),
    ajudantes: extrairAjudantes(texto),
    observacoes: null,
  };
}
