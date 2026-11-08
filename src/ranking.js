// Ranking das ofertas. A nota é determinística e explicável (o freteiro e o cliente
// conseguem entender por que uma oferta ganhou). A IA entra depois só para
// escrever a justificativa e apontar alertas que estão no texto livre.

import { VOLUMES, nivelVeiculo } from './dominio.js';

export const PESOS = { preco: 0.4, disponibilidade: 0.25, reputacao: 0.25, adequacao: 0.1 };

// Média bayesiana: freteiro novo começa com 4,5 "emprestado" de 3 avaliações virtuais,
// assim um único 5 estrelas não passa na frente de quem tem 40 avaliações 4,8.
export function notaBayesiana(f, prior = 4.5, peso = 3) {
  return (prior * peso + (f.nota_soma || 0)) / (peso + (f.avaliacoes || 0));
}

export function pontuarReputacao(f) {
  const nota = notaBayesiana(f); // 1..5
  let s = (nota - 1) / 4; // 0..1
  const total = (f.concluidos || 0) + (f.cancelamentos || 0);
  if (total > 0) s -= 0.5 * ((f.cancelamentos || 0) / total);
  s += Math.min(0.1, (f.concluidos || 0) * 0.005); // experiência ajuda um pouco
  return clamp(s);
}

export function pontuarPreco(valor, todos) {
  const validos = todos.filter((v) => v > 0);
  const menor = Math.min(...validos);
  const maior = Math.max(...validos);
  if (maior === menor) return 1;
  return clamp(1 - (valor - menor) / (maior - menor)) * 0.8 + (menor / valor) * 0.2;
}

export function pontuarDisponibilidade(oferta, pedido) {
  if (pedido.quando === 'imediato') {
    if (!oferta.imediato && !oferta.horario) return 0.4; // não disse quando
    if (oferta.imediato) {
      const eta = oferta.eta_minutos ?? 60;
      if (eta <= 30) return 1;
      if (eta <= 60) return 0.85;
      if (eta <= 120) return 0.6;
      return 0.35;
    }
    const atraso = (new Date(oferta.horario) - Date.now()) / 60000;
    return atraso <= 60 ? 0.8 : atraso <= 180 ? 0.5 : 0.2;
  }
  // Agendado: quanto mais perto do horário pedido, melhor.
  if (oferta.imediato && !oferta.horario) return 0.6; // disponível, mas não confirmou o horário
  if (!oferta.horario || !pedido.data_hora) return 0.6;
  const diffMin = Math.abs(new Date(oferta.horario) - new Date(pedido.data_hora)) / 60000;
  if (diffMin <= 30) return 1;
  if (diffMin <= 90) return 0.75;
  if (diffMin <= 240) return 0.4;
  return 0.1;
}

export function pontuarAdequacao(oferta, freteiro, pedido) {
  const precisa = VOLUMES[pedido.volume]?.nivel ?? 2;
  const tem = nivelVeiculo(oferta.veiculo) ?? nivelVeiculo(freteiro.veiculo) ?? precisa;
  let s = 1;
  const alertas = [];
  if (tem < precisa) {
    s -= 0.6 * (precisa - tem);
    alertas.push('Veículo pode ser pequeno para a carga (talvez precise de mais de uma viagem).');
  }
  const ajudantes = oferta.ajudantes ?? freteiro.ajudantes ?? 0;
  if (pedido.ajudantes > 0 && ajudantes < pedido.ajudantes) {
    s -= 0.3;
    alertas.push(`Pediu ${pedido.ajudantes} ajudante(s), oferta inclui ${ajudantes}.`);
  }
  if (pedido.montagem && !freteiro.faz_montagem) {
    s -= 0.2;
    alertas.push('Freteiro não marcou que faz montagem/desmontagem.');
  }
  return { score: clamp(s), alertas };
}

export function ranquearOfertas(ofertas, pedido) {
  if (!ofertas.length) return [];
  const valores = ofertas.map((o) => o.valor);
  const ref = (pedido.estimativa_min + pedido.estimativa_max) / 2;

  const avaliadas = ofertas.map((o) => {
    const f = o.freteiro;
    const preco = pontuarPreco(o.valor, valores);
    const disp = pontuarDisponibilidade(o, pedido);
    const rep = pontuarReputacao(f);
    const adequacao = pontuarAdequacao(o, f, pedido);
    const alertas = [...adequacao.alertas];
    if (o.valor < ref * 0.45) alertas.push('Preço muito abaixo do normal: confirme o que está incluso.');
    if (!f.avaliacoes) alertas.push('Freteiro novo na plataforma (ainda sem avaliações).');

    const score =
      100 * (PESOS.preco * preco + PESOS.disponibilidade * disp + PESOS.reputacao * rep + PESOS.adequacao * adequacao.score);
    return {
      ...o,
      score: Math.round(score * 10) / 10,
      detalhes: { preco, disponibilidade: disp, reputacao: rep, adequacao: adequacao.score },
      alertas,
      inviavel: adequacao.score <= 0.1,
    };
  });

  const viaveis = avaliadas.filter((o) => !o.inviavel);
  const base = viaveis.length ? viaveis : avaliadas;
  base.sort((a, b) => b.score - a.score || a.valor - b.valor);
  return base.map((o, i) => ({ ...o, posicao: i + 1 }));
}

// Escolhe as 3 que vão para o cliente, garantindo variedade: se a mais barata
// ou a mais rápida ficou de fora, ela entra no lugar da 3ª.
export function escolherTop3(ranqueadas, pedido) {
  const top = ranqueadas.slice(0, 3);
  if (ranqueadas.length > 3) {
    const maisBarata = [...ranqueadas].sort((a, b) => a.valor - b.valor)[0];
    if (!top.includes(maisBarata)) top[2] = maisBarata;
  }
  return comSelos(top, pedido);
}

function comSelos(top, pedido) {
  if (!top.length) return top;
  const maisBarata = [...top].sort((a, b) => a.valor - b.valor)[0];
  const melhorNota = [...top].sort((a, b) => notaBayesiana(b.freteiro) - notaBayesiana(a.freteiro))[0];
  const maisRapida = [...top]
    .filter((o) => o.imediato)
    .sort((a, b) => (a.eta_minutos ?? 999) - (b.eta_minutos ?? 999))[0];
  return top.map((o, i) => {
    const selos = [];
    if (i === 0) selos.push('Melhor escolha');
    if (o === maisBarata) selos.push('Mais barato');
    if (o === maisRapida && pedido.quando === 'imediato' && o.imediato) selos.push('Chega mais rápido');
    if (o === melhorNota && o.freteiro.avaliacoes >= 3) selos.push('Mais bem avaliado');
    return { ...o, selos };
  });
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
