// Cálculos compartilhados entre o navegador e o servidor (mesma regra nos dois lados).

export const MODOS_ARREDONDAMENTO = {
  nenhum: 'Sem arredondar (centavos exatos)',
  '90': 'Terminar em ,90 (ex.: R$ 129,90)',
  inteiro: 'Real inteiro para cima (ex.: R$ 130,00)',
  '5': 'Múltiplo de R$ 5 para cima',
  '10': 'Múltiplo de R$ 10 para cima',
};

const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function arredondar(valor, modo = 'nenhum') {
  const v = centavos(valor);
  if (v <= 0) return v;
  switch (String(modo)) {
    case '90': {
      const base = Math.floor(v) + 0.9;
      return centavos(base >= v ? base : base + 1);
    }
    case 'inteiro':
      return Math.ceil(v - 0.0001);
    case '5':
      return Math.ceil(v / 5 - 0.00001) * 5;
    case '10':
      return Math.ceil(v / 10 - 0.00001) * 10;
    default:
      return v;
  }
}

// Fator que espalha frete, impostos (IPI/ST), seguro e descontos da nota proporcionalmente
// ao valor de cada item, para o custo refletir o que realmente foi pago.
export function fatorRateio(nota, itens) {
  const soma = itens.reduce((s, i) => s + (Number(i.valor_total) || 0), 0);
  const total = Number(nota.valor_total) || 0;
  if (!nota.ratear_despesas || soma <= 0 || total <= 0) return 1;
  return total / soma;
}

export function markupDoItem(item, nota) {
  const m = item.markup;
  return m === null || m === undefined || m === '' ? Number(nota.markup_padrao) || 0 : Number(m);
}

export function calcularItem(item, nota, fator = 1, modo = 'nenhum') {
  const qtd = Number(item.quantidade) > 0 ? Number(item.quantidade) : 1;
  const custoTotal = (Number(item.valor_total) || 0) * fator;
  const custoUnit = custoTotal / qtd;
  const markup = markupDoItem(item, nota);
  const precoUnit = arredondar(custoUnit * (1 + markup / 100), modo);
  const precoTotal = centavos(precoUnit * qtd);
  const lucro = precoTotal - custoTotal;
  return {
    quantidade: qtd,
    custoUnit,
    custoTotal,
    markup,
    markupProprio: !(item.markup === null || item.markup === undefined || item.markup === ''),
    precoUnit,
    precoTotal,
    lucro,
    margem: precoTotal > 0 ? (lucro / precoTotal) * 100 : 0,
  };
}

export function markupParaPreco(custoUnit, precoUnit) {
  if (!(custoUnit > 0)) return 0;
  return Math.round((precoUnit / custoUnit - 1) * 100 * 1e6) / 1e6;
}

export function resumoNota(nota, itens, modo = 'nenhum') {
  const fator = fatorRateio(nota, itens);
  let investido = 0;
  let venda = 0;
  const calculados = itens.map((i) => {
    const c = calcularItem(i, nota, fator, modo);
    investido += c.custoTotal;
    venda += c.precoTotal;
    return { ...i, calc: c };
  });
  const lucro = venda - investido;
  return {
    fator,
    itens: calculados,
    investido,
    venda,
    lucro,
    margem: venda > 0 ? (lucro / venda) * 100 : 0,
  };
}

// ---------- formatação ----------
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (v) => fmtBRL.format(Number(v) || 0);

export function numeroBR(v, casas = 2) {
  return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 10".
export function lerNumero(texto) {
  if (typeof texto === 'number') return texto;
  let s = String(texto ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  return Number(s);
}

// ---------- WhatsApp ----------
export function normalizarTelefone(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

export function formatarTelefone(tel) {
  const d = normalizarTelefone(tel);
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : tel || '';
}

export const MENSAGEM_PADRAO =
  'Olá, {nome}! Tudo bem? 😊\n' +
  'Sua encomenda chegou! 📦\n\n' +
  '{itens}\n\n' +
  '*Total: {total}*\n\n' +
  'Quando fica bom pra você retirar?';

export function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

// itens: [{ produto, quantidade, valorUnit }] — valorUnit pode ser null (ainda sem preço)
export function montarMensagem(modelo, { nome, itens, loja }) {
  const comPreco = itens.filter((i) => i.valorUnit !== null && i.valorUnit !== undefined);
  const linhas = itens.map((i) => {
    const q = Number(i.quantidade) || 1;
    const qtd = q !== 1 ? `${numeroBR(q, 3)}x ` : '';
    const preco = i.valorUnit === null || i.valorUnit === undefined ? '' : ` — *${reais(i.valorUnit * q)}*`;
    return `• ${qtd}${i.produto}${preco}`;
  });
  const total = comPreco.reduce((s, i) => s + i.valorUnit * (Number(i.quantidade) || 1), 0);
  let texto = String(modelo || MENSAGEM_PADRAO);
  if (!comPreco.length) texto = texto.replace(/^[^\n]*\{total\}[^\n]*\n?/m, '');
  return texto
    .replaceAll('{nome}', primeiroNome(nome))
    .replaceAll('{nome_completo}', String(nome || '').trim())
    .replaceAll('{itens}', linhas.join('\n'))
    .replaceAll('{total}', reais(total))
    .replaceAll('{loja}', loja || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function linkWhatsApp(telefone, texto) {
  const tel = normalizarTelefone(telefone);
  const q = texto ? `?text=${encodeURIComponent(texto)}` : '';
  return tel ? `https://wa.me/${tel}${q}` : `https://wa.me/${q}`;
}
