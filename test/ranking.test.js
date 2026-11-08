import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ranquearOfertas, escolherTop3, notaBayesiana } from '../src/ranking.js';
import { estimarPreco } from '../src/precos.js';

const f = (id, extra = {}) => ({ id, nome: `F${id}`, veiculo: 'van', ajudantes: 1, nota_soma: 0, avaliacoes: 0, concluidos: 0, cancelamentos: 0, faz_montagem: 0, ...extra });
const pedido = { quando: 'imediato', volume: 'medio', ajudantes: 1, montagem: 0, estimativa_min: 250, estimativa_max: 380 };

test('nota bayesiana não deixa 1 avaliação 5 passar quem tem muitas 4,8', () => {
  const novo = f(1, { nota_soma: 5, avaliacoes: 1 });
  const veterano = f(2, { nota_soma: 4.8 * 40, avaliacoes: 40 });
  assert.ok(notaBayesiana(veterano) > notaBayesiana(novo));
});

test('oferta barata, rápida e bem avaliada ganha', () => {
  const ofertas = [
    { id: 1, valor: 300, imediato: 1, eta_minutos: 20, freteiro: f(1, { nota_soma: 48, avaliacoes: 10 }) },
    { id: 2, valor: 420, imediato: 1, eta_minutos: 90, freteiro: f(2, { nota_soma: 30, avaliacoes: 8 }) },
    { id: 3, valor: 320, imediato: 1, eta_minutos: 30, freteiro: f(3) },
  ];
  const r = ranquearOfertas(ofertas, pedido);
  assert.equal(r[0].id, 1);
  assert.equal(r.at(-1).id, 2);
});

test('veículo pequeno demais é descartado quando há opções viáveis', () => {
  const grande = { ...pedido, volume: 'muito_grande' };
  const ofertas = [
    { id: 1, valor: 200, imediato: 1, eta_minutos: 10, veiculo: 'Fiorino', freteiro: f(1, { veiculo: 'utilitario' }) },
    { id: 2, valor: 900, imediato: 1, eta_minutos: 30, freteiro: f(2, { veiculo: 'caminhao_bau' }) },
  ];
  const r = ranquearOfertas(ofertas, grande);
  assert.deepEqual(r.map((o) => o.id), [2]);
});

test('top 3 sempre inclui a mais barata', () => {
  const ofertas = [
    { id: 1, valor: 400, imediato: 1, eta_minutos: 10, freteiro: f(1, { nota_soma: 50, avaliacoes: 10 }) },
    { id: 2, valor: 410, imediato: 1, eta_minutos: 10, freteiro: f(2, { nota_soma: 50, avaliacoes: 10 }) },
    { id: 3, valor: 420, imediato: 1, eta_minutos: 10, freteiro: f(3, { nota_soma: 50, avaliacoes: 10 }) },
    { id: 4, valor: 250, imediato: 1, eta_minutos: 180, freteiro: f(4, { nota_soma: 20, avaliacoes: 6, cancelamentos: 3, concluidos: 3 }) },
  ];
  const top = escolherTop3(ranquearOfertas(ofertas, pedido), pedido);
  assert.equal(top.length, 3);
  assert.ok(top.some((o) => o.id === 4));
  assert.ok(top.find((o) => o.id === 4).selos.includes('Mais barato'));
  assert.ok(top[0].selos.includes('Melhor escolha'));
});

test('agendado: horário próximo do pedido pontua mais', () => {
  const ag = { ...pedido, quando: 'agendado', data_hora: '2026-11-10T13:00:00.000Z' };
  const ofertas = [
    { id: 1, valor: 300, imediato: 0, horario: '2026-11-10T19:00:00.000Z', freteiro: f(1) },
    { id: 2, valor: 300, imediato: 0, horario: '2026-11-10T13:00:00.000Z', freteiro: f(2) },
  ];
  assert.equal(ranquearOfertas(ofertas, ag)[0].id, 2);
});

test('estimativa cresce com distância, ajudante e andares', () => {
  const base = estimarPreco({ volume: 'medio', distancia_km: 8, ajudantes: 0 });
  const mais = estimarPreco({ volume: 'medio', distancia_km: 50, ajudantes: 2, origem_andar: 3 });
  assert.ok(mais.min > base.max);
  assert.ok(base.min < base.max);
});

test('selo "Chega mais rápido" vai para o menor tempo de chegada', () => {
  const ofertas = [
    { id: 1, valor: 260, imediato: 1, eta_minutos: 30, freteiro: f(1) },
    { id: 2, valor: 350, imediato: 1, eta_minutos: 20, freteiro: f(2, { nota_soma: 39, avaliacoes: 8 }) },
    { id: 3, valor: 320, imediato: 1, eta_minutos: 30, freteiro: f(3) },
  ];
  const top = escolherTop3(ranquearOfertas(ofertas, pedido), pedido);
  assert.ok(top.find((o) => o.id === 2).selos.includes('Chega mais rápido'));
  assert.ok(!top.find((o) => o.id === 1).selos.includes('Chega mais rápido'));
});
