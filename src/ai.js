// Integração com o Claude (Anthropic). Usado para:
//  1. Ler a mensagem livre do freteiro no WhatsApp e transformar em oferta estruturada.
//  2. Revisar as melhores ofertas e escrever, em linguagem simples, por que cada uma
//     foi indicada ao cliente (e apontar riscos escritos nas entrelinhas).
// Sem ANTHROPIC_API_KEY o sistema continua funcionando com o leitor por regras (parser.js)
// e justificativas automáticas.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { config } from './config.js';
import { lerOfertaSemIA } from './parser.js';
import { nivelVeiculo, VOLUMES, TIPOS } from './dominio.js';
import { reais, formatarDataHora } from './util.js';

let client;
const getClient = () => (client ??= new Anthropic());

// Fallback no servidor: se o modelo recusar por política, a API tenta outro modelo na mesma chamada.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

const OfertaSchema = z.object({
  eh_oferta: z.boolean().describe('true se a mensagem é uma proposta de preço para o pedido'),
  codigo: z.string().nullable().describe('código do pedido de 4 letras/números, se citado'),
  valor: z.number().nullable().describe('valor total em reais'),
  imediato: z.boolean().describe('true se pode ir agora / em minutos ou poucas horas hoje'),
  eta_minutos: z.number().nullable().describe('minutos até chegar na origem, se for imediato'),
  horario: z.string().nullable().describe('horário proposto em ISO 8601 com fuso -03:00, se informou um horário'),
  veiculo: z.string().nullable(),
  ajudantes: z.number().nullable().describe('quantos ajudantes inclusos no valor'),
  observacoes: z.string().nullable().describe('condições importantes: o que está ou não incluso, pedágio, pagamento etc. Curto.'),
});

export async function lerOferta(texto, contexto = {}) {
  const agora = contexto.agora || new Date();
  if (!config.ai.enabled) return lerOfertaSemIA(texto, agora);
  try {
    const pedidosAbertos = (contexto.pedidosAbertos || [])
      .map((p) => `#${p.codigo}: ${TIPOS[p.tipo]} ${p.origem_bairro} -> ${p.destino_cidade}, ${p.quando === 'imediato' ? 'IMEDIATO' : formatarDataHora(p.data_hora)}`)
      .join('\n');
    const resp = await getClient().beta.messages.parse({
      model: config.ai.model,
      max_tokens: 2000,
      ...FALLBACK,
      output_config: { effort: 'low', format: betaZodOutputFormat(OfertaSchema) },
      system:
        'Você lê mensagens de WhatsApp de freteiros de Jaraguá do Sul (SC) respondendo a pedidos de frete/mudança. ' +
        'Extraia a oferta. Gírias comuns: "conto"/"pila" = reais, "chapa" = ajudante, "3/4" = caminhão três quartos. ' +
        'Se a mensagem for só uma dúvida, conversa ou recusa, eh_oferta = false. Não invente valores.',
      messages: [
        {
          role: 'user',
          content:
            `Agora (horário de Brasília): ${agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n` +
            (pedidosAbertos ? `Pedidos abertos que este freteiro recebeu:\n${pedidosAbertos}\n` : '') +
            `\nMensagem do freteiro:\n"""${texto}"""`,
        },
      ],
    });
    const o = resp.stop_reason === 'refusal' ? null : resp.parsed_output;
    if (!o) return lerOfertaSemIA(texto, agora);
    return {
      ...o,
      codigo: o.codigo ? o.codigo.replace('#', '').toUpperCase() : null,
      horario: o.horario ? new Date(o.horario).toISOString() : null,
      nivel_veiculo: nivelVeiculo(o.veiculo),
    };
  } catch (err) {
    console.error('[ia] falha ao ler oferta, usando regras:', err.message);
    return lerOfertaSemIA(texto, agora);
  }
}

const RevisaoSchema = z.object({
  resumo: z.string().describe('1 a 2 frases para o cliente sobre as opções'),
  opcoes: z.array(
    z.object({
      oferta_id: z.number(),
      motivo: z.string().describe('por que essa opção foi indicada, até 20 palavras'),
      alerta: z.string().nullable().describe('risco ou ponto de atenção, se houver; senão null'),
    }),
  ),
});

export async function revisarTop3(pedido, top3) {
  const padrao = revisaoPadrao(pedido, top3);
  if (!config.ai.enabled || !top3.length) return padrao;
  try {
    const descricao = top3
      .map(
        (o) =>
          `oferta_id=${o.id} | ${reais(o.valor)} | ${o.imediato ? `chega em ~${o.eta_minutos ?? '?'} min` : formatarDataHora(o.horario) || 'horário a combinar'}` +
          ` | veículo: ${o.veiculo || o.freteiro.veiculo} | ajudantes: ${o.ajudantes ?? o.freteiro.ajudantes}` +
          ` | nota ${o.freteiro.avaliacoes ? (o.freteiro.nota_soma / o.freteiro.avaliacoes).toFixed(1) : 'sem avaliações'} (${o.freteiro.avaliacoes} aval., ${o.freteiro.concluidos} serviços)` +
          ` | score ${o.score} | selos: ${o.selos.join(', ') || '-'} | alertas automáticos: ${o.alertas.join(' ') || '-'}` +
          ` | mensagem original: "${(o.mensagem_original || '').slice(0, 300)}"`,
      )
      .join('\n');
    const resp = await getClient().beta.messages.parse({
      model: config.ai.model,
      max_tokens: 3000,
      ...FALLBACK,
      output_config: { effort: 'low', format: betaZodOutputFormat(RevisaoSchema) },
      system:
        'Você ajuda clientes de Jaraguá do Sul a escolherem um freteiro. Escreva em português do Brasil, tom simples e direto, ' +
        'sem exageros. Baseie-se só nos dados fornecidos. Aponte alertas reais (ex: valor não inclui ajudante, ' +
        'veículo pequeno, cobra pedágio à parte). Não reordene as opções.',
      messages: [
        {
          role: 'user',
          content:
            `Pedido: ${TIPOS[pedido.tipo]}, ${VOLUMES[pedido.volume]?.nome}, ${pedido.origem_bairro} -> ${pedido.destino_bairro || ''} ${pedido.destino_cidade}, ` +
            `${pedido.quando === 'imediato' ? 'para agora' : `agendado ${formatarDataHora(pedido.data_hora)}`}, ajudantes pedidos: ${pedido.ajudantes}. ` +
            `Itens: ${pedido.itens}. Estimativa: ${reais(pedido.estimativa_min)}–${reais(pedido.estimativa_max)}.\n\nOpções:\n${descricao}`,
        },
      ],
    });
    const r = resp.stop_reason === 'refusal' ? null : resp.parsed_output;
    if (!r) return padrao;
    const porId = new Map(r.opcoes.map((x) => [x.oferta_id, x]));
    return {
      resumo: r.resumo,
      opcoes: top3.map((o) => {
        const x = porId.get(o.id);
        const p = padrao.opcoes.find((y) => y.oferta_id === o.id);
        return { oferta_id: o.id, motivo: x?.motivo || p.motivo, alerta: x?.alerta || p.alerta };
      }),
    };
  } catch (err) {
    console.error('[ia] falha ao revisar top 3, usando texto padrão:', err.message);
    return padrao;
  }
}

function revisaoPadrao(pedido, top3) {
  return {
    resumo: `Recebemos ofertas de freteiros e separamos as ${top3.length} melhores pelo preço, horário e avaliações.`,
    opcoes: top3.map((o) => {
      const partes = [];
      if (o.selos.includes('Mais barato')) partes.push('menor preço');
      if (o.detalhes.disponibilidade >= 0.85) partes.push(pedido.quando === 'imediato' ? 'chega rápido' : 'horário bate com o pedido');
      if (o.detalhes.reputacao >= 0.85 && o.freteiro.avaliacoes) partes.push('ótimas avaliações');
      if (o.detalhes.adequacao >= 0.95) partes.push('veículo adequado');
      return {
        oferta_id: o.id,
        motivo: partes.length ? capitalizar(partes.join(', ')) + '.' : 'Bom equilíbrio entre preço e disponibilidade.',
        alerta: o.alertas[0] || null,
      };
    }),
  };
}

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);
