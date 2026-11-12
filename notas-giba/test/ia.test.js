// Testa o caminho "foto → IA → nota" com um servidor falso no lugar da API da Anthropic.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let falso, recebido;
const resposta = {
  eh_nota_fiscal: true, emitente_nome: 'Loja Celulares', emitente_cnpj: '12.345.678/0001-99', numero: '777', serie: '1',
  chave_acesso: null, data_emissao: '2026-11-11',
  itens: [
    { codigo: null, descricao: 'SMARTPHONE APPLE IPHONE 14 128GB', ncm: null, quantidade: 1, unidade: 'UN', valor_unitario: 4000, valor_total: 4000, encomendas_ids: [] },
    { codigo: null, descricao: 'CARREGADOR TURBO 20W', ncm: null, quantidade: 2, unidade: 'UN', valor_unitario: 50, valor_total: 100, encomendas_ids: [2] },
  ],
  valor_produtos: 4100, frete: 0, seguro: null, desconto: null, outras_despesas: null, impostos_adicionais: null, valor_total: 4100,
  avisos: ['Rodapé da nota cortado na foto'],
};

before(async () => {
  falso = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      recebido = { url: req.url, headers: req.headers, corpo: JSON.parse(b) };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
        content: [{ type: 'text', text: JSON.stringify(resposta) }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }));
    });
  }).listen(0);
  await new Promise((r) => falso.once('listening', r));
  process.env.ANTHROPIC_API_KEY = 'teste';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${falso.address().port}`;
});
after(() => falso.close());

test('foto da nota é lida e vinculada às encomendas', async () => {
  const { abrirDb } = await import('../src/db.js');
  abrirDb(':memory:');
  const { config } = await import('../src/config.js');
  config.ia.habilitada = true;
  const d = await import('../src/dados.js');
  const { lerNotaPorImagem } = await import('../src/ia.js');

  d.criarEncomenda({ novo_contato: { nome: 'Joel', telefone: '47999991234' }, produto: 'iPhone 14' });
  d.criarEncomenda({ novo_contato: { nome: 'Carla', telefone: '47999995678' }, produto: 'carregador rápido' });

  const lido = await lerNotaPorImagem([{ tipo: 'image/jpeg', base64: '/9j/AAAA' }], d.encomendasPendentes());
  assert.match(recebido.url, /^\/v1\/messages/);
  assert.match(recebido.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(recebido.corpo.model, 'claude-opus-5-5');
  assert.equal(recebido.corpo.content, undefined);
  assert.equal(recebido.corpo.messages[0].content[0].type, 'image');
  assert.equal(recebido.corpo.output_config.format.type, 'json_schema');
  assert.equal(recebido.corpo.fallbacks, 'default');
  assert.match(recebido.corpo.messages[0].content.at(-1).text, /id 2: carregador rápido \(qtd 1\) — cliente Carla/);

  assert.equal(lido.nota.emitente_cnpj, '12345678000199');
  assert.deepEqual(lido.nota.avisos, ['Rodapé da nota cortado na foto']);
  const r = d.criarNota(lido.nota, { origem: 'foto', sugestoes: lido.sugestoes });
  assert.equal(r.vinculadas, 2); // iPhone por semelhança, carregador pela sugestão da IA
  const nota = d.buscarNota(r.id);
  assert.equal(nota.itens[1].encomendas[0].contato_nome, 'Carla');
  assert.equal(nota.itens[0].encomendas[0].contato_nome, 'Joel');
});
