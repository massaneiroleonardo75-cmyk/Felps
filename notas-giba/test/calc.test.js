import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../public/calc.js';

test('preço com porcentagem em cima do custo', () => {
  const nota = { markup_padrao: 30, valor_total: 100, ratear_despesas: 1 };
  const c = C.calcularItem({ quantidade: 2, valor_total: 100, markup: null }, nota, 1);
  assert.equal(c.custoUnit, 50);
  assert.equal(c.precoUnit, 65);
  assert.equal(c.precoTotal, 130);
  assert.equal(c.lucro, 30);
});

test('porcentagem própria do item vence a padrão', () => {
  const c = C.calcularItem({ quantidade: 1, valor_total: 200, markup: 50 }, { markup_padrao: 30 }, 1);
  assert.equal(c.precoUnit, 300);
  assert.equal(c.markupProprio, true);
});

test('frete e impostos são rateados proporcionalmente', () => {
  const nota = { markup_padrao: 0, valor_total: 1100, ratear_despesas: 1 };
  const itens = [{ quantidade: 1, valor_total: 1000 }, { quantidade: 1, valor_total: 0 }];
  const r = C.resumoNota(nota, itens);
  assert.equal(Math.round(r.investido), 1100);
  assert.equal(C.resumoNota({ ...nota, ratear_despesas: 0 }, itens).investido, 1000);
});

test('arredondamentos', () => {
  assert.equal(C.arredondar(129.01, '90'), 129.9);
  assert.equal(C.arredondar(129.95, '90'), 130.9);
  assert.equal(C.arredondar(121.2, 'inteiro'), 122);
  assert.equal(C.arredondar(121, '5'), 125);
  assert.equal(C.arredondar(130, '10'), 130);
});

test('preço digitado vira porcentagem', () => {
  const m = C.markupParaPreco(80, 100);
  assert.equal(m, 25);
  assert.equal(C.calcularItem({ quantidade: 1, valor_total: 33.33, markup: C.markupParaPreco(33.33, 49.9) }, { markup_padrao: 0 }).precoUnit, 49.9);
});

test('números no formato brasileiro', () => {
  assert.equal(C.lerNumero('1.234,56'), 1234.56);
  assert.equal(C.lerNumero('R$ 10'), 10);
  assert.equal(C.lerNumero('27,5'), 27.5);
  assert.equal(C.lerNumero('1234.5'), 1234.5);
});

test('telefone e link do WhatsApp', () => {
  assert.equal(C.normalizarTelefone('(47) 99999-1234'), '5547999991234');
  assert.equal(C.formatarTelefone('47999991234'), '(47) 99999-1234');
  assert.match(C.linkWhatsApp('47 99999-1234', 'Olá'), /^https:\/\/wa\.me\/5547999991234\?text=Ol%C3%A1$/);
});

test('mensagem pronta com itens e total', () => {
  const t = C.montarMensagem(null, { nome: 'Joel Souza', itens: [{ produto: 'iPhone 14', quantidade: 1, valorUnit: 5200 }, { produto: 'Capa', quantidade: 2, valorUnit: 30 }] });
  assert.match(t, /^Olá, Joel!/);
  assert.match(t, /• iPhone 14 — \*R\$\s5\.200,00\*/);
  assert.match(t, /• 2x Capa — \*R\$\s60,00\*/);
  assert.match(t, /Total: R\$\s5\.260,00/);
});
