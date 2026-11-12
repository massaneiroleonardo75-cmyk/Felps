// Leitura da nota fiscal por foto/PDF usando o Claude (visão + saída estruturada).
// Também sugere quais encomendas pendentes correspondem a cada item.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { config } from './config.js';

let cliente;
const getCliente = () => (cliente ??= new Anthropic());

// Se o modelo principal recusar por política, a própria API tenta outro modelo na mesma chamada.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

function erroPublico(msg, status) {
  return Object.assign(new Error(msg), { status, publico: true });
}

const valor = () => z.number().nullable();

const NotaSchema = z.object({
  eh_nota_fiscal: z.boolean().describe('true se as imagens mostram uma nota fiscal, DANFE, cupom fiscal ou pedido de compra com itens e valores'),
  emitente_nome: z.string().nullable().describe('nome do fornecedor/loja que emitiu a nota'),
  emitente_cnpj: z.string().nullable().describe('CNPJ do emitente, só números'),
  numero: z.string().nullable().describe('número da nota'),
  serie: z.string().nullable(),
  chave_acesso: z.string().nullable().describe('chave de acesso de 44 dígitos, só números, se legível'),
  data_emissao: z.string().nullable().describe('data de emissão no formato AAAA-MM-DD'),
  itens: z.array(
    z.object({
      codigo: z.string().nullable(),
      descricao: z.string().describe('descrição do produto exatamente como está na nota'),
      ncm: z.string().nullable(),
      quantidade: z.number(),
      unidade: z.string().nullable(),
      valor_unitario: z.number().describe('valor unitário em reais'),
      valor_total: z.number().describe('valor total do item em reais (quantidade x unitário, já com desconto do item se houver)'),
      encomendas_ids: z.array(z.number()).describe('ids das encomendas pendentes que são claramente este mesmo produto; [] se nenhuma'),
    }),
  ),
  valor_produtos: valor().describe('soma dos produtos'),
  frete: valor(),
  seguro: valor(),
  desconto: valor(),
  outras_despesas: valor(),
  impostos_adicionais: valor().describe('IPI + ICMS-ST somados ao total da nota, se houver'),
  valor_total: valor().describe('valor total da nota (o que foi pago)'),
  avisos: z.array(z.string()).describe('problemas de leitura: partes ilegíveis, cortadas, valores que não fecham. Curto. [] se tudo ok'),
});

const SISTEMA =
  'Você lê notas fiscais brasileiras (DANFE de NF-e, NFC-e, cupom fiscal, nota de serviço ou pedido) fotografadas pelo celular ' +
  'de um comprador que revende produtos. Extraia com precisão cada item e os totais. Regras:\n' +
  '- Valores em reais como número (1.234,56 -> 1234.56). Não invente: se não der para ler, use null e registre em avisos.\n' +
  '- Liste TODOS os itens, na ordem da nota. Se houver várias fotos, são páginas da mesma nota: junte, sem repetir itens.\n' +
  '- Descrição exatamente como impressa (pode corrigir só quebras de linha).\n' +
  '- Confira se a soma dos itens bate com o total de produtos; se não bater, avise.\n' +
  '- encomendas_ids: só associe uma encomenda se for claramente o mesmo produto (mesmo modelo, capacidade, versão). ' +
  'Na dúvida, não associe. A soma das quantidades das encomendas associadas não pode passar da quantidade do item.';

export async function lerNotaPorImagem(arquivos, encomendasPendentes = []) {
  if (!config.ia.habilitada) {
    throw erroPublico('Leitura automática desativada: falta configurar a chave da IA (ANTHROPIC_API_KEY). Cadastre a nota manualmente ou envie o XML.', 503);
  }
  const conteudo = [];
  for (const a of arquivos) {
    if (a.tipo === 'application/pdf') {
      conteudo.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.base64 } });
    } else {
      conteudo.push({ type: 'image', source: { type: 'base64', media_type: a.tipo, data: a.base64 } });
    }
  }
  const lista = encomendasPendentes.length
    ? encomendasPendentes.map((e) => `id ${e.id}: ${e.produto} (qtd ${e.quantidade}) — cliente ${e.contato_nome}`).join('\n')
    : '(nenhuma)';
  conteudo.push({
    type: 'text',
    text:
      `Encomendas pendentes de clientes (para associar aos itens):\n${lista}\n\n` +
      `Extraia os dados da nota fiscal ${arquivos.length > 1 ? `(${arquivos.length} páginas/fotos)` : ''}.`,
  });

  let resp;
  try {
    resp = await getCliente().beta.messages.parse({
      model: config.ia.modelo,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: 'medium', format: betaZodOutputFormat(NotaSchema) },
      system: SISTEMA,
      messages: [{ role: 'user', content: conteudo }],
    });
  } catch (err) {
    console.error('[ia] falha na leitura:', err.status, err.message);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw erroPublico('A chave da IA está inválida. Confira a ANTHROPIC_API_KEY no servidor.', 503);
    }
    if (err instanceof Anthropic.RateLimitError) throw erroPublico('Muitas leituras ao mesmo tempo. Espere um minuto e tente de novo.', 429);
    if (err instanceof Anthropic.BadRequestError) throw erroPublico('Não consegui processar este arquivo. Tente outra foto (JPG) ou o PDF da nota.', 422);
    throw erroPublico('O serviço de leitura não respondeu. Tente de novo em instantes.', 502);
  }

  if (resp.stop_reason === 'refusal' || !resp.parsed_output) {
    throw erroPublico('Não consegui ler esta nota. Tente outra foto, mais nítida e com a nota inteira.', 422);
  }
  const n = resp.parsed_output;
  if (!n.eh_nota_fiscal || !n.itens.length) {
    throw erroPublico('Não encontrei uma nota fiscal com itens nesta imagem. Tente fotografar de novo, com boa luz e a nota inteira.', 422);
  }
  const avisos = [...n.avisos];
  if (resp.stop_reason === 'max_tokens') avisos.push('A nota é muito longa e pode ter ficado incompleta. Confira os itens.');

  const sugestoes = new Map();
  n.itens.forEach((i, idx) => i.encomendas_ids?.length && sugestoes.set(idx, i.encomendas_ids));
  const soma = n.itens.reduce((s, i) => s + (i.valor_total || 0), 0);

  return {
    nota: {
      numero: n.numero,
      serie: n.serie,
      chave: n.chave_acesso ? n.chave_acesso.replace(/\D/g, '') : null,
      emitente_nome: n.emitente_nome,
      emitente_cnpj: n.emitente_cnpj ? n.emitente_cnpj.replace(/\D/g, '') : null,
      data_emissao: /^\d{4}-\d{2}-\d{2}$/.test(n.data_emissao || '') ? n.data_emissao : null,
      valor_produtos: n.valor_produtos ?? soma,
      frete: n.frete ?? 0,
      seguro: n.seguro ?? 0,
      desconto: n.desconto ?? 0,
      outras: n.outras_despesas ?? 0,
      impostos: n.impostos_adicionais ?? 0,
      valor_total: n.valor_total ?? soma,
      itens: n.itens.map((i, ordem) => ({
        ordem,
        codigo: i.codigo,
        descricao: i.descricao,
        ncm: i.ncm,
        quantidade: i.quantidade > 0 ? i.quantidade : 1,
        unidade: i.unidade,
        valor_unitario: i.valor_unitario,
        valor_total: i.valor_total || i.valor_unitario * (i.quantidade || 1),
      })),
      avisos,
    },
    sugestoes,
  };
}
