// Teste de ponta a ponta do fluxo: pedido -> freteiros avisados -> ofertas por WhatsApp
// -> top 3 para o cliente -> cliente responde "1" -> freteiro recebe o contato -> avaliação.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.ANTHROPIC_API_KEY = '';
process.env.ANTHROPIC_AUTH_TOKEN = '';
process.env.WHATSAPP_PROVIDER = 'console';

const { openDb, getDb } = await import('../src/db.js');
const fluxo = await import('../src/fluxo.js');

const log = console.log;
before(() => {
  openDb(':memory:');
  console.log = () => {}; // silencia o provedor "console"
  const fs = [
    ['Ana', '47990000101', 'van', 1, 45, 10],
    ['Beto', '47990000102', 'caminhao_34', 2, 20, 5],
    ['Caio', '47990000103', 'utilitario', 0, 0, 0],
    ['Duda', '47990000104', 'caminhao_bau', 2, 0, 0],
  ];
  for (const [nome, telefone, veiculo, ajudantes, soma, n] of fs) {
    const f = fluxo.cadastrarFreteiro({ nome: nome + ' Teste', telefone, veiculo, ajudantes, aceite: true, aprovado: true, atende_empresas: true });
    getDb().prepare('UPDATE freteiros SET nota_soma=?, avaliacoes=? WHERE id=?').run(soma, n, f.id);
  }
});

const ultimaMsg = (tel) => getDb().prepare("SELECT texto FROM mensagens WHERE telefone=? AND direcao='saida' ORDER BY id DESC LIMIT 1").get(tel)?.texto;

test('fluxo completo', async () => {
  const { pedido, avisados } = await fluxo.criarPedido({
    tipo: 'mudanca_residencial', cliente_nome: 'Fulana de Tal', cliente_telefone: '(47) 98888-7777',
    origem_bairro: 'Centro', destino_cidade: 'Jaraguá do Sul', destino_bairro: 'Vila Nova',
    quando: 'imediato', volume: 'medio', itens: 'Quarto: cama, guarda-roupa, 10 caixas', ajudantes: 1,
  });
  assert.equal(avisados, 3, 'utilitário não deve ser avisado para carga média');
  assert.match(ultimaMsg('5547990000101'), new RegExp(`#${pedido.codigo}`));
  assert.match(ultimaMsg('5547988887777'), /Recebemos seu pedido/);

  let r = await fluxo.processarMensagem({ telefone: '47990000101', texto: `#${pedido.codigo} 320 reais, chego em 25 min com 1 ajudante` });
  assert.equal(r.tipo, 'oferta');
  // Sem código: só tem um pedido aberto, então vale para ele.
  r = await fluxo.processarMensagem({ telefone: '47990000102', texto: 'faço por 290, em 1 hora, 2 ajudantes' });
  assert.equal(r.tipo, 'oferta');
  r = await fluxo.processarMensagem({ telefone: '47990000104', texto: `#${pedido.codigo} R$ 450 agora` });
  assert.equal(r.tipo, 'oferta');
  // Atualiza a oferta
  r = await fluxo.processarMensagem({ telefone: '47990000104', texto: `#${pedido.codigo} 380 agora` });
  assert.equal(r.atualizada, true);
  // Mensagem que não é oferta
  r = await fluxo.processarMensagem({ telefone: '47990000101', texto: 'tem escada?' });
  assert.equal(r.tipo, 'nao_entendi');

  // Prazo vence
  getDb().prepare("UPDATE pedidos SET prazo_ofertas='2000-01-01T00:00:00Z' WHERE id=?").run(pedido.id);
  await fluxo.tick();
  let p = fluxo.buscarPedido(pedido.id);
  assert.equal(p.status, 'aguardando_escolha');
  const top3 = fluxo.top3DoPedido(p.id);
  assert.equal(top3.length, 3);
  assert.match(ultimaMsg('5547988887777'), /3 melhores ofertas/);

  // Oferta atrasada é recusada
  r = await fluxo.processarMensagem({ telefone: '47990000101', texto: `#${pedido.codigo} 200` });
  assert.equal(r.tipo, 'fechado');

  // Cliente escolhe a 1ª respondendo no WhatsApp
  r = await fluxo.processarMensagem({ telefone: '5547988887777', texto: '1' });
  assert.equal(r.tipo, 'escolha');
  p = fluxo.buscarPedido(pedido.id);
  assert.equal(p.status, 'confirmado');
  const escolhida = top3.find((o) => o.posicao === 1);
  assert.match(ultimaMsg(escolhida.freteiro.telefone), /Você ganhou o pedido/);
  assert.match(ultimaMsg(escolhida.freteiro.telefone), /98888-7777/);

  // Avaliação
  r = await fluxo.processarMensagem({ telefone: '5547988887777', texto: '5' });
  assert.equal(r.tipo, 'avaliacao');
  p = fluxo.buscarPedido(pedido.id);
  assert.equal(p.status, 'concluido');
  assert.equal(p.nota, 5);
  const f = fluxo.buscarFreteiro(escolhida.freteiro.id);
  assert.equal(f.concluidos, 1);
});

test('pedido sem ofertas é prorrogado uma vez e depois avisa o cliente', async () => {
  const { pedido } = await fluxo.criarPedido({
    tipo: 'frete_pequeno', cliente_nome: 'Sicrano', cliente_telefone: '47977776666',
    origem_bairro: 'Baependi', destino_cidade: 'Guaramirim', quando: 'imediato', volume: 'pequeno', itens: 'Uma geladeira',
  });
  const vencer = () => getDb().prepare("UPDATE pedidos SET prazo_ofertas='2000-01-01T00:00:00Z' WHERE id=?").run(pedido.id);
  vencer();
  await fluxo.tick();
  assert.equal(fluxo.buscarPedido(pedido.id).prorrogado, 1);
  assert.equal(fluxo.buscarPedido(pedido.id).status, 'aberto');
  vencer();
  await fluxo.tick();
  assert.equal(fluxo.buscarPedido(pedido.id).status, 'sem_ofertas');
  console.log = log;
});

test('validação de pedido', async () => {
  await assert.rejects(() => fluxo.criarPedido({ tipo: 'x' }), fluxo.ErroValidacao);
});
