// Funções compartilhadas pelas páginas.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export async function api(url, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || `Erro ${r.status}`);
  return dados;
}

export const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
export const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function dadosDoForm(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.multi !== undefined) { if (el.checked) (d[el.name] ||= []).push(el.value); }
      else d[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
    else d[el.name] = el.value;
  }
  return d;
}

export function mostrarErro(el, msg) {
  el.textContent = msg || '';
  el.classList.toggle('on', Boolean(msg));
  if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export const opcoes = (lista, sel) => lista.map((v) => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

export function quandoOferta(o) {
  if (o.imediato) return `Chega em ~${o.eta_minutos ?? '?'} min`;
  return o.horario ? dataHora(o.horario) : 'Horário a combinar';
}
