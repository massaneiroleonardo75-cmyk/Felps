// Textos enviados pelo WhatsApp. Tudo num lugar só para ficar fácil de ajustar o tom.
import { config } from './config.js';
import { TIPOS, VOLUMES } from './dominio.js';
import { reais, formatarDataHora, formatarHora, formatarTelefone } from './util.js';

const app = () => config.nomeApp;

export function quandoTexto(p) {
  return p.quando === 'imediato' ? '⚡ *IMEDIATO* (agora)' : `📅 ${formatarDataHora(p.data_hora)}`;
}

function resumoPedido(p) {
  const andar = (n, el) => (n > 0 ? ` (${n}º andar${el ? ', com elevador' : ', sem elevador'})` : '');
  const destino = p.destino_cidade === 'Jaraguá do Sul' ? p.destino_bairro : `${p.destino_bairro ? p.destino_bairro + ', ' : ''}${p.destino_cidade}`;
  return [
    `🚚 *${TIPOS[p.tipo]}* — ${VOLUMES[p.volume].nome}`,
    `📍 De: ${p.origem_bairro}${andar(p.origem_andar, p.origem_elevador)}`,
    `🏁 Para: ${destino}${andar(p.destino_andar, p.destino_elevador)} (~${Math.round(p.distancia_km)} km)`,
    quandoTexto(p),
    `📦 ${p.itens}`,
    p.ajudantes ? `💪 Precisa de ${p.ajudantes} ajudante(s)` : '💪 Sem ajudante',
    p.montagem ? '🔧 Precisa desmontar/montar móveis' : null,
    p.cliente_tipo === 'pj' ? '🏢 Cliente empresa (pode emitir recibo/NF)' : null,
    p.observacoes ? `📝 ${p.observacoes}` : null,
  ].filter(Boolean).join('\n');
}

export function novoPedidoFreteiro(p, linkOferta) {
  return (
    `🔔 *Novo pedido #${p.codigo}*\n\n${resumoPedido(p)}\n\n` +
    `💰 Faixa de referência: ${reais(p.estimativa_min)} a ${reais(p.estimativa_max)}\n` +
    `⏳ Ofertas até ${formatarHora(p.prazo_ofertas)}\n\n` +
    `Responda aqui com valor e horário, ex:\n` +
    `_#${p.codigo} 350 reais, chego em 40 min, com 1 ajudante_\n\n` +
    `Ou mande pelo link: ${linkOferta}`
  );
}

export function novoPedidoGrupo(p) {
  return (
    `🔔 *Novo pedido #${p.codigo}*\n\n${resumoPedido(p)}\n\n` +
    `💰 Referência: ${reais(p.estimativa_min)} a ${reais(p.estimativa_max)}\n` +
    `⏳ Ofertas até ${formatarHora(p.prazo_ofertas)}\n\n` +
    `👉 Mande sua oferta *no privado* do ${app()} (não no grupo), ex:\n_#${p.codigo} 350, chego em 40 min_`
  );
}

export function ofertaRegistrada(p, o, atualizada) {
  const quando = o.imediato ? `chega em ~${o.eta_minutos ?? '?'} min` : o.horario ? formatarDataHora(o.horario) : 'horário a combinar';
  return (
    `✅ Oferta ${atualizada ? 'atualizada' : 'registrada'} no pedido #${p.codigo}: *${reais(o.valor)}*, ${quando}` +
    `${o.ajudantes != null ? `, ${o.ajudantes} ajudante(s)` : ''}.\n` +
    `Às ${formatarHora(p.prazo_ofertas)} o cliente recebe as melhores. Para mudar, é só mandar outra mensagem com #${p.codigo}.`
  );
}

export const naoEntendi = (codigos) =>
  `Não consegui entender a oferta 🤔\nMande no formato: _#${codigos[0] || 'CODIGO'} 350 reais, chego em 30 min_` +
  (codigos.length > 1 ? `\nPedidos abertos para você: ${codigos.map((c) => '#' + c).join(', ')}` : '');

export const pedidoFechado = (codigo) => `O pedido #${codigo} já não está recebendo ofertas. Fique de olho nos próximos! 🚚`;

export const pedidoRecebidoCliente = (p, link) =>
  `Olá, ${p.cliente_nome.split(' ')[0]}! 👋 Recebemos seu pedido *#${p.codigo}* no ${app()}.\n\n` +
  `${resumoPedido(p)}\n\nEstimativa: ${reais(p.estimativa_min)} a ${reais(p.estimativa_max)}.\n` +
  `Já avisamos os freteiros de Jaraguá. Às *${formatarHora(p.prazo_ofertas)}* te mandamos as 3 melhores ofertas.\n\n` +
  `Acompanhe: ${link}`;

export function top3Cliente(p, top3, resumo, link) {
  const linhas = top3.map((o, i) => {
    const f = o.freteiro;
    const nota = f.avaliacoes ? `⭐ ${(f.nota_soma / f.avaliacoes).toFixed(1)} (${f.avaliacoes})` : '🆕 novo';
    const quando = o.imediato ? `chega em ~${o.eta_minutos ?? '?'} min` : o.horario ? formatarDataHora(o.horario) : 'horário a combinar';
    return (
      `*${i + 1}️⃣ ${reais(o.valor)}* — ${f.nome.split(' ')[0]} ${nota}\n` +
      `   🕒 ${quando} · 🚚 ${o.veiculo || f.veiculo_nome} · 💪 ${o.ajudantes ?? f.ajudantes} ajud.\n` +
      (o.selos?.length ? `   🏷️ ${o.selos.join(' · ')}\n` : '') +
      (o.motivo ? `   💡 ${o.motivo}\n` : '') +
      (o.alertaIA ? `   ⚠️ ${o.alertaIA}\n` : '')
    );
  });
  return (
    `🎯 *Suas 3 melhores ofertas — pedido #${p.codigo}*\n\n${resumo}\n\n${linhas.join('\n')}\n` +
    `Responda *1*, *2* ou *3* para escolher, ou veja os detalhes: ${link}`
  );
}

export const semOfertasCliente = (p) =>
  `Poxa, ainda não recebemos ofertas para o pedido #${p.codigo} 😕. ` +
  `Nossa equipe vai procurar um freteiro manualmente e te chama aqui. Se preferir, responda *CANCELAR*.`;

export const lembreteEscolha = (p, link) =>
  `⏰ Suas ofertas do pedido #${p.codigo} ainda estão esperando! Responda 1, 2 ou 3, ou veja: ${link}`;

export function confirmadoCliente(p, o, f) {
  return (
    `🎉 Fechado! *${f.nome}* vai fazer seu frete #${p.codigo} por *${reais(o.valor)}*.\n\n` +
    `📞 Contato: ${formatarTelefone(f.telefone)} — wa.me/${f.telefone}\n` +
    `🚚 ${o.veiculo || f.veiculo_nome}${f.placa ? ` · placa ${f.placa}` : ''}\n\n` +
    `Combine os detalhes direto com ele(a). Depois do serviço, mande uma nota de *1 a 5* aqui pra ajudar a comunidade ⭐`
  );
}

export function escolhidoFreteiro(p, o) {
  return (
    `🏆 *Você ganhou o pedido #${p.codigo}!* Valor: ${reais(o.valor)}\n\n${resumoPedido(p)}\n\n` +
    `👤 Cliente: ${p.cliente_nome}${p.empresa ? ` (${p.empresa})` : ''}\n` +
    `📞 ${formatarTelefone(p.cliente_telefone)} — wa.me/${p.cliente_telefone}\n` +
    (p.origem_endereco ? `📍 Retirada: ${p.origem_endereco}, ${p.origem_bairro}\n` : '') +
    (p.destino_endereco ? `🏁 Entrega: ${p.destino_endereco}, ${p.destino_bairro || ''} ${p.destino_cidade}\n` : '') +
    `\nChame o cliente agora para confirmar. Quando terminar, responda *CONCLUIDO #${p.codigo}*.`
  );
}

export const naoEscolhidoFreteiro = (p) => `O cliente do pedido #${p.codigo} escolheu outra oferta desta vez. Obrigado por participar! 🙏`;

export const obrigadoAvaliacao = () => `Valeu pela avaliação! ⭐ Ela ajuda a gente a indicar os melhores freteiros de Jaraguá.`;

export const ajudaFreteiro = () =>
  `Comandos do ${app()}:\n• *#CODIGO valor horário* — mandar oferta\n• *PAUSAR* — parar de receber pedidos\n• *VOLTAR* — receber pedidos de novo\n• *CONCLUIDO #CODIGO* — avisar que terminou o serviço`;
