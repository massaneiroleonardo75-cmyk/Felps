import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerOfertaSemIA, extrairValor, extrairCodigo } from '../src/parser.js';

const agora = new Date('2026-11-08T13:00:00Z'); // 10:00 em Brasília, domingo

test('lê código, valor, prazo e ajudante', () => {
  const o = lerOfertaSemIA('#K7QP 350 reais, chego em 40 min, Fiorino com 1 ajudante', agora);
  assert.equal(o.codigo, 'K7QP');
  assert.equal(o.valor, 350);
  assert.equal(o.imediato, true);
  assert.equal(o.eta_minutos, 40);
  assert.equal(o.ajudantes, 1);
  assert.match(o.veiculo, /fiorino/i);
  assert.equal(o.nivel_veiculo, 1);
  assert.equal(o.eh_oferta, true);
});

test('valor com R$ e milhar, horário agendado', () => {
  const o = lerOfertaSemIA('k7qp R$ 1.200,00 amanhã às 14h caminhão 3/4', agora);
  assert.equal(o.codigo, 'K7QP');
  assert.equal(o.valor, 1200);
  assert.equal(o.imediato, false);
  assert.equal(o.horario, '2026-11-09T17:00:00.000Z');
  assert.equal(o.nivel_veiculo, 3);
});

test('não confunde horário e minutos com preço', () => {
  assert.equal(extrairValor('chego 14:30, faço por 280'), 280);
  assert.equal(extrairValor('em 20 min, 2 ajudantes, 450'), 450);
  assert.equal(extrairValor('faço por 1,5 mil'), 1500);
  assert.equal(extrairValor('300 conto'), 300);
});

test('"agora" vira imediato', () => {
  const o = lerOfertaSemIA('posso agora 280', agora);
  assert.equal(o.imediato, true);
  assert.equal(o.valor, 280);
});

test('mensagem sem preço não é oferta', () => {
  assert.equal(lerOfertaSemIA('é longe esse lugar?', agora).eh_oferta, false);
  assert.equal(extrairCodigo('qual o andar? #AB2C'), 'AB2C');
});
