import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semelhanca, distribuir } from '../public/combinar.js';

test('reconhece o produto da encomenda na descrição da nota', () => {
  assert.ok(semelhanca('iPhone 14', 'APPLE IPHONE 14 128GB AZUL MPVN3BZ/A') >= 0.7);
  assert.ok(semelhanca('iphone 14 128 gb', 'APPLE IPHONE 14 128GB AZUL') >= 0.7);
  assert.ok(semelhanca('Fone JBL', 'FONE BLUETOOTH JBL TUNE 520BT') >= 0.7);
});

test('modelo diferente não combina', () => {
  assert.equal(semelhanca('iPhone 15', 'APPLE IPHONE 14 128GB'), 0);
  assert.equal(semelhanca('iPhone 14 256gb', 'APPLE IPHONE 14 128GB'), 0);
  assert.equal(semelhanca('Samsung S23', 'APPLE IPHONE 14'), 0);
});

test('distribui respeitando a quantidade e a ordem dos pedidos', () => {
  const itens = [{ descricao: 'APPLE IPHONE 14 128GB', quantidade: 1 }];
  const encs = [
    { id: 2, produto: 'iPhone 14', quantidade: 1, criado_em: '2026-11-02' },
    { id: 1, produto: 'iPhone 14', quantidade: 1, criado_em: '2026-11-01' },
  ];
  assert.deepEqual(distribuir(itens, encs), [{ itemIndex: 0, encomendaId: 1 }]);
});

test('sugestão da IA tem prioridade', () => {
  const itens = [{ descricao: 'SMARTPHONE A1 PRO', quantidade: 1 }];
  const encs = [{ id: 9, produto: 'celular da Maria', quantidade: 1, criado_em: '2026-11-01' }];
  assert.deepEqual(distribuir(itens, encs, new Map([[0, [9]]])), [{ itemIndex: 0, encomendaId: 9 }]);
});
