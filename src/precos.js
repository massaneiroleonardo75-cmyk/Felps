// Estimativa de preço mostrada ao cliente ANTES das ofertas chegarem.
// Os valores são uma referência inicial para Jaraguá do Sul e devem ser calibrados
// com as ofertas reais (o painel admin mostra a média por tipo/volume).

const TABELA = {
  //            saída  R$/km  ajudante  por andar sem elevador
  pequeno:      { base: 90,  km: 3.0, ajudante: 80,  andar: 15 },
  medio:        { base: 200, km: 4.0, ajudante: 100, andar: 30 },
  grande:       { base: 420, km: 6.0, ajudante: 120, andar: 50 },
  muito_grande: { base: 750, km: 8.0, ajudante: 140, andar: 80 },
};

const MONTAGEM = { pequeno: 60, medio: 120, grande: 200, muito_grande: 300 };

export function estimarPreco(p) {
  const t = TABELA[p.volume] || TABELA.medio;
  const km = Math.max(0, Number(p.distancia_km) || 0);
  let valor = t.base + t.km * km;
  // Ida e volta pesa mais em viagens longas: acima de 30 km, cobra parte do retorno.
  if (km > 30) valor += t.km * (km - 30) * 0.5;
  valor += (Number(p.ajudantes) || 0) * t.ajudante;
  const andares = andarSemElevador(p.origem_andar, p.origem_elevador) + andarSemElevador(p.destino_andar, p.destino_elevador);
  valor += andares * t.andar;
  if (p.montagem) valor += MONTAGEM[p.volume] || 120;
  if (p.quando === 'imediato') valor *= 1.15;

  return {
    min: arredondar(valor * 0.85),
    max: arredondar(valor * 1.2),
    referencia: arredondar(valor),
  };
}

const andarSemElevador = (andar, elevador) => (elevador ? 0 : Math.max(0, Number(andar) || 0));
const arredondar = (v) => Math.round(v / 10) * 10;
