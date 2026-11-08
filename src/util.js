import { randomBytes, randomInt } from 'node:crypto';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I

export function gerarCodigo(tamanho = 4) {
  let s = '';
  for (let i = 0; i < tamanho; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

export const gerarToken = () => randomBytes(16).toString('hex');

// Normaliza telefone brasileiro para o formato E.164 sem "+": 5547999998888
export function normalizarTelefone(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

export function formatarTelefone(tel) {
  const d = normalizarTelefone(tel);
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}

export const reais = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const TZ = 'America/Sao_Paulo';

export function formatarDataHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function formatarHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

// Converte "2026-11-08T14:30" digitado no horário de Brasília para ISO UTC.
// (Brasil não tem horário de verão desde 2019: UTC-3 fixo.)
export function localParaIso(local) {
  if (!local) return null;
  if (/[zZ]|[+-]\d\d:\d\d$/.test(local)) return new Date(local).toISOString();
  return new Date(`${local}${local.length === 16 ? ':00' : ''}-03:00`).toISOString();
}
