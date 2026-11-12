import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'giba-'));
process.env.DATA_DIR = dir;
process.env.APP_PASSWORD = 'segredo123';
delete process.env.ANTHROPIC_API_KEY;

const { abrirDb } = await import('../src/db.js');
const { criarApp } = await import('../src/server.js');

let srv, base, cookie = '';
const req = async (metodo, url, corpo) => {
  const r = await fetch(base + url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', cookie },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: r.status, corpo: await r.json().catch(() => null) };
};

before(async () => {
  abrirDb(':memory:');
  srv = criarApp().listen(0);
  await new Promise((r) => srv.once('listening', r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => {
  srv.close();
  rmSync(dir, { recursive: true, force: true });
});

test('exige senha', async () => {
  assert.equal((await req('GET', '/api/notas')).status, 401);
  assert.equal((await req('POST', '/api/login', { senha: 'errada' })).status, 401);
  assert.equal((await req('POST', '/api/login', { senha: 'segredo123' })).status, 200);
  assert.equal((await req('GET', '/api/notas')).status, 200);
});

test('fluxo: encomenda → XML da nota → vínculo automático → preço → avisado', async () => {
  const joel = await req('POST', '/api/encomendas', { novo_contato: { nome: 'Joel Souza', telefone: '(47) 99999-1234' }, produto: 'iPhone 14 128gb', quantidade: 1 });
  assert.equal(joel.status, 201);
  const ana = await req('POST', '/api/encomendas', { novo_contato: { nome: 'Ana Lima', telefone: '47988887777' }, produto: 'Fone JBL', quantidade: 1 });
  const bia = await req('POST', '/api/encomendas', { novo_contato: { nome: 'Bia' }, produto: 'iPhone 15', quantidade: 1 });

  const xml = readFileSync(new URL('./fixtures/nfe-exemplo.xml', import.meta.url));
  const lida = await req('POST', '/api/notas/ler', { arquivos: [{ nome: 'nota.xml', tipo: 'text/xml', base64: xml.toString('base64') }] });
  assert.equal(lida.status, 201, JSON.stringify(lida.corpo));
  assert.equal(lida.corpo.vinculadas, 2);

  const dup = await req('POST', '/api/notas/ler', { arquivos: [{ nome: 'nota.xml', tipo: 'text/xml', base64: xml.toString('base64') }] });
  assert.equal(dup.status, 409);
  assert.equal(dup.corpo.nota_id, lida.corpo.id);

  const nota = (await req('GET', `/api/notas/${lida.corpo.id}`)).corpo;
  assert.equal(nota.emitente_nome, 'Distribuidora Exemplo');
  assert.equal(nota.itens.length, 3);
  assert.equal(nota.itens[2].descricao, 'FONE BLUETOOTH JBL TUNE 520BT & ESTOJO');
  const iphone = nota.itens[0];
  assert.equal(iphone.encomendas[0].contato_nome, 'Joel Souza');
  // custo com frete rateado: 8000 * 8433.5/8350 = 8080 → 4040 cada; 30% → 5252
  assert.equal(Math.round(iphone.calc.custoUnit * 100) / 100, 4040);
  assert.equal(iphone.calc.precoUnit, 5252);

  // muda a porcentagem só do iPhone
  await req('PUT', `/api/itens/${iphone.id}`, { markup: 25 });
  const enc = (await req('GET', '/api/encomendas?status=chegou')).corpo;
  assert.equal(enc.length, 2);
  const ej = enc.find((e) => e.contato_nome === 'Joel Souza');
  assert.equal(ej.valor_total, 5050);

  const bi = (await req('GET', '/api/encomendas?status=aguardando')).corpo;
  assert.deepEqual(bi.map((e) => e.id), [bia.corpo.id]);

  await req('POST', '/api/encomendas/status', { ids: [ej.id], status: 'avisado' });
  await req('POST', '/api/encomendas/status', { ids: [ana.corpo.id], status: 'entregue' });
  const painel = (await req('GET', '/api/painel?periodo=tudo')).corpo;
  assert.equal(painel.encomendas.avisado, 1);
  assert.equal(painel.retirar[0].id, joel.corpo.id);
  assert.ok(painel.vendido > 0);
  assert.ok(painel.lucro_previsto > 0);

  // excluir a nota devolve a encomenda avisada para "aguardando"
  await req('DELETE', `/api/notas/${lida.corpo.id}`);
  const j2 = (await req('GET', `/api/contatos/${ej.contato_id}`)).corpo.encomendas[0];
  assert.equal(j2.status, 'aguardando');
  assert.equal(j2.item_id, null);
});

test('nota digitada e foto sem IA configurada', async () => {
  const r = await req('POST', '/api/notas', { emitente_nome: 'Loja X', itens: [{ descricao: 'Cabo USB-C', quantidade: 3, valor_unitario: 10 }], frete: 0 });
  assert.equal(r.status, 201);
  const n = (await req('GET', `/api/notas/${r.corpo.id}`)).corpo;
  assert.equal(n.itens[0].valor_total, 30);
  const foto = await req('POST', '/api/notas/ler', { arquivos: [{ nome: 'a.jpg', tipo: 'image/jpeg', base64: '/9j/' }] });
  assert.equal(foto.status, 503);
  assert.match(foto.corpo.erro, /ANTHROPIC_API_KEY/);
});

test('ajustes e validações', async () => {
  assert.equal((await req('PUT', '/api/ajustes', { markup_padrao: 40, arredondamento: '90' })).corpo.arredondamento, '90');
  assert.equal((await req('PUT', '/api/ajustes', { arredondamento: 'x' })).status, 400);
  assert.equal((await req('POST', '/api/contatos', { nome: 'Zé', telefone: '123' })).status, 400);
  assert.equal((await req('POST', '/api/encomendas', { produto: 'x' })).status, 400);
});
