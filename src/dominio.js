// Dados de domínio: bairros, cidades vizinhas, veículos e tipos de serviço.

export const BAIRROS_JARAGUA = [
  'Água Verde', 'Amizade', 'Baependi', 'Barra do Rio Cerro', 'Barra do Rio Molha', 'Boa Vista',
  'Centenário', 'Centro', 'Chico de Paulo', 'Czerniewicz', 'Estrada Nova', 'Garibaldi',
  'Ilha da Figueira', 'Jaraguá 84', 'Jaraguá 99', 'Jaraguá Esquerdo', 'João Pessoa', 'Nereu Ramos',
  'Nova Brasília', 'Ribeirão Cavalo', 'Rau', 'Rio Cerro I', 'Rio Cerro II', 'Rio da Luz',
  'Rio Molha', 'Santa Luzia', 'Santo Antônio', 'São Luís', 'Tifa Martins', 'Tifa Monos',
  'Três Rios do Norte', 'Três Rios do Sul', 'Vieira', 'Vila Baependi', 'Vila Lalau', 'Vila Lenzi',
  'Vila Nova', 'Outro',
];

// Distância aproximada por estrada a partir do centro de Jaraguá do Sul (km).
// Valores de referência para a estimativa; o freteiro dá o preço final.
export const CIDADES = {
  'Jaraguá do Sul': 0,
  'Guaramirim': 12,
  'Schroeder': 15,
  'Corupá': 22,
  'Massaranduba': 28,
  'Pomerode': 40,
  'São Bento do Sul': 50,
  'Joinville': 55,
  'Blumenau': 65,
  'Barra Velha': 55,
  'Balneário Piçarras': 60,
  'São Francisco do Sul': 90,
  'Itajaí': 90,
  'Balneário Camboriú': 100,
  'Florianópolis': 190,
  'Curitiba': 190,
  'Outra': null,
};

export const TIPOS = {
  mudanca_residencial: 'Mudança residencial',
  mudanca_comercial: 'Mudança comercial / escritório',
  frete_pequeno: 'Frete pequeno (poucos itens)',
  entrega_empresa: 'Entrega / coleta para empresa',
  compra_loja: 'Retirar compra em loja',
  descarte: 'Levar para descarte / doação',
};

// Volume da carga -> o que cabe em cada veículo.
export const VOLUMES = {
  pequeno: { nome: 'Pequeno', exemplo: 'Até ~5 itens: geladeira, sofá, algumas caixas', nivel: 1 },
  medio: { nome: 'Médio', exemplo: 'Quarto ou kitnet completo', nivel: 2 },
  grande: { nome: 'Grande', exemplo: 'Apartamento de 2 quartos', nivel: 3 },
  muito_grande: { nome: 'Muito grande', exemplo: 'Casa de 3+ quartos / escritório', nivel: 4 },
};

// Capacidade de cada veículo, no mesmo nível dos volumes.
export const VEICULOS = {
  carro: { nome: 'Carro com reboque/carretinha', nivel: 1 },
  utilitario: { nome: 'Utilitário (Fiorino, Kangoo, Saveiro)', nivel: 1 },
  caminhonete: { nome: 'Caminhonete (Strada cabine dupla, S10, Hilux)', nivel: 1 },
  van: { nome: 'Van / furgão (Ducato, Master, Sprinter)', nivel: 2 },
  caminhao_34: { nome: 'Caminhão 3/4 (HR, Bongo, Accelo)', nivel: 3 },
  caminhao_bau: { nome: 'Caminhão baú / toco', nivel: 4 },
};

export function nivelVeiculo(chaveOuTexto) {
  if (!chaveOuTexto) return null;
  if (VEICULOS[chaveOuTexto]) return VEICULOS[chaveOuTexto].nivel;
  const t = String(chaveOuTexto).toLowerCase();
  if (/(ba[uú]|toco|truck)/.test(t)) return 4;
  if (/(3\/4|tres quartos|três quartos|hr\b|bongo|accelo|caminh[aã]o)/.test(t)) return 3;
  if (/(van|furg[aã]o|ducato|master|sprinter|boxer|daily)/.test(t)) return 2;
  if (/(fiorino|kangoo|saveiro|strada|s10|hilux|caminhonete|pickup|picape|carretinha|reboque|utilit)/.test(t)) return 1;
  return null;
}

export function distanciaEstimada({ origem_bairro, destino_cidade, destino_bairro }) {
  const kmCidade = CIDADES[destino_cidade];
  if (destino_cidade === 'Jaraguá do Sul' || kmCidade === 0) {
    return origem_bairro && destino_bairro && origem_bairro === destino_bairro ? 3 : 8;
  }
  return kmCidade ?? 60;
}
