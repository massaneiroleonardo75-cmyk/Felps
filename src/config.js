// Configuração central. Tudo pode ser sobrescrito por variáveis de ambiente.
const env = process.env;
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  port: num(env.PORT, 3000),
  baseUrl: env.BASE_URL || `http://localhost:${num(env.PORT, 3000)}`,
  dbPath: env.DB_PATH || 'data/mudaja.db',
  adminPassword: env.ADMIN_PASSWORD || 'admin',
  nomeApp: env.NOME_APP || 'MudaJá',
  cidade: 'Jaraguá do Sul',

  // Janela (em minutos) para os freteiros mandarem ofertas antes da IA escolher as 3 melhores.
  janelaImediatoMin: num(env.JANELA_IMEDIATO_MIN, 10),
  janelaAgendadoMin: num(env.JANELA_AGENDADO_MIN, 60),
  // Pedido imediato fecha antes do prazo se já tiver esse número de ofertas.
  ofertasParaFecharCedo: num(env.OFERTAS_PARA_FECHAR_CEDO, 6),
  // Se ninguém ofertar, prorroga uma vez por esse tempo antes de desistir.
  prorrogacaoMin: num(env.PRORROGACAO_MIN, 10),
  // Quanto tempo o cliente tem para escolher antes de avisarmos de novo.
  lembreteEscolhaMin: num(env.LEMBRETE_ESCOLHA_MIN, 30),

  // Comissão da plataforma (só informativo no painel por enquanto).
  comissaoPercentual: num(env.COMISSAO_PERCENTUAL, 10),

  whatsapp: {
    // console | meta | evolution
    provider: env.WHATSAPP_PROVIDER || 'console',
    // Meta WhatsApp Cloud API (oficial)
    metaToken: env.META_WHATSAPP_TOKEN || '',
    metaPhoneNumberId: env.META_PHONE_NUMBER_ID || '',
    metaVerifyToken: env.META_VERIFY_TOKEN || 'mudaja-verify',
    metaApiVersion: env.META_API_VERSION || 'v21.0',
    // Evolution API (gateway não-oficial que suporta grupos)
    evolutionUrl: env.EVOLUTION_API_URL || '',
    evolutionKey: env.EVOLUTION_API_KEY || '',
    evolutionInstance: env.EVOLUTION_INSTANCE || '',
    // JID do grupo dos freteiros (ex: 120363000000000000@g.us). Opcional.
    grupoFreteiros: env.WHATSAPP_GRUPO_FRETEIROS || '',
  },

  ai: {
    enabled: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
    model: env.CLAUDE_MODEL || 'claude-opus-5-5',
  },
};
