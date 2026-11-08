# MudaJá — fretes e mudanças em Jaraguá do Sul

Marketplace que liga quem precisa de frete/mudança (pessoas e empresas) a **freteiros autônomos** da região.
O cliente descreve o serviço, os freteiros recebem o pedido no **WhatsApp** e respondem com preço e horário,
e a **IA** seleciona as **3 melhores ofertas** para o cliente escolher.

> "MudaJá" é um nome provisório.

## Como funciona

```
Cliente preenche o site (2 min)
   │  bairro de origem/destino, itens, tamanho, agora ou agendado, ajudantes
   ▼
Estimativa de preço na hora  ──►  pedido #K7QP criado
   │
   ▼
Freteiros compatíveis recebem no WhatsApp (veículo que comporta a carga, região, atende empresa)
   │  respondem: "#K7QP 350 reais, chego em 40 min, com 1 ajudante"   (ou pelo link do formulário)
   ▼
IA lê a mensagem livre → valor, horário/ETA, veículo, ajudantes, observações
   │
   ▼  (prazo: 10 min se for imediato, 60 min se agendado — configurável)
Ranking: preço 40% · disponibilidade 25% · reputação 25% · veículo/ajudantes 10%
   │  + garante que a opção mais barata esteja entre as 3
   │  + IA escreve o "por que" de cada opção e aponta alertas
   ▼
Cliente recebe as 3 no WhatsApp e no site → responde 1, 2 ou 3
   ▼
Escolhido recebe o contato e endereço do cliente; os outros são avisados
   ▼
Cliente avalia de 1 a 5 → nota alimenta o ranking dos próximos pedidos
```

### Decisões importantes

- **Ofertas no privado, não no grupo.** Se o freteiro manda o preço no grupo, vira leilão para baixo
  e todo mundo vê o valor do outro. O pedido pode ser anunciado no grupo, mas a oferta vai no privado do número do app.
- **O freteiro não vê o contato do cliente antes de ser escolhido** — só bairro, itens e horário.
  Isso evita que o cliente seja "puxado" para fora da plataforma.
- **Ranking por regra + IA para texto.** A nota é calculada de forma transparente (dá para explicar para o
  freteiro por que ele perdeu). A IA lê as mensagens bagunçadas do WhatsApp ("300 conto, chego já com um chapa")
  e escreve a justificativa para o cliente. Sem chave de IA, um leitor por regras assume.
- **Freteiro novo não passa na frente de veterano** com uma única avaliação 5 (média bayesiana).
- **Freteiro precisa ser aprovado** no painel antes de receber pedidos (confira CNH, CRLV e antecedentes).

## Rodando

Requer Node.js 22.13+ (usa o SQLite embutido do Node).

```bash
npm install
npm run seed      # cria 7 freteiros fictícios
npm start         # http://localhost:3000
npm test
```

| Página | Para quem |
|---|---|
| `/` | Cliente pede orçamento |
| `/p/<token>` | Cliente acompanha o pedido e escolhe a oferta |
| `/freteiro` | Cadastro de freteiro |
| `/o/<codigo>?f=<token>` | Freteiro manda oferta pelo formulário (link vai no WhatsApp) |
| `/admin` | Painel: pedidos, freteiros, aprovações, métricas (senha `ADMIN_PASSWORD`, padrão `admin`) |
| `/simulador` | Simula o WhatsApp de freteiros e clientes, para testar sem número real |

**Teste rápido:** faça um pedido em `/`, abra `/simulador`, entre como freteiros e mande ofertas,
clique em "Rodar agendador agora" (ou "Fechar agora" no painel) e veja as 3 melhores chegarem.

Configuração: veja `.env.example`.

## WhatsApp

Três provedores em `src/whatsapp.js`:

| Provedor | Oficial? | Grupo? | Quando usar |
|---|---|---|---|
| `console` | — | — | Desenvolvimento (mensagens aparecem no `/simulador`) |
| `meta` (WhatsApp Cloud API) | Sim | Não usado | **Produção recomendada.** Sem risco de banimento. |
| `evolution` (Evolution API) | Não | Sim | Se fizer questão do grupo. Risco de o número ser banido. |

Webhook para os dois: `POST /webhook/whatsapp` (a verificação da Meta usa `GET` com `META_VERIFY_TOKEN`).

**Atenção com a API oficial:** mensagem iniciada pela empresa fora da janela de 24h só pode ser **template
aprovado** pela Meta. Para produção, crie templates para "novo pedido" (freteiro) e "suas 3 ofertas" (cliente) e
troque o envio em `enviarMeta`. Cada conversa iniciada pela empresa é cobrada pela Meta.

## Próximos passos sugeridos

1. **Pagamento pelo app (Pix com split)** — Mercado Pago/Asaas/Pagar.me. É o que garante a comissão e
   dá segurança: cliente paga, o valor fica retido, libera para o freteiro depois do serviço.
2. **Templates da Meta** e número oficial verificado.
3. **Fotos dos itens** pelo WhatsApp/site (a IA estima o volume a partir das fotos).
4. **Distância real** com Google Maps/OSRM (hoje é estimativa por bairro/cidade em `src/dominio.js`).
5. **Calibrar `src/precos.js`** com as ofertas reais (aba "Preços" do painel).
6. **Contas de empresa**: pedidos recorrentes, várias entregas por dia, nota/recibo, faturamento mensal.
7. Verificação de documentos do freteiro no cadastro (upload de CNH/CRLV).
8. Deploy: qualquer VPS/Render/Railway/Fly com disco persistente para `data/mudaja.db`.

## Estrutura

```
src/
  server.js     rotas HTTP, webhook, painel
  fluxo.js      ciclo de vida: pedido → ofertas → top 3 → escolha → avaliação
  ranking.js    nota das ofertas e escolha das 3 melhores
  ai.js         Claude: leitura das ofertas e justificativas
  parser.js     leitura de ofertas sem IA (fallback)
  precos.js     estimativa de preço
  whatsapp.js   envio/recebimento (console, Meta, Evolution)
  mensagens.js  todos os textos enviados no WhatsApp
  dominio.js    bairros, cidades, veículos, tipos de serviço
public/         páginas (HTML + JS sem build)
test/           testes (node --test)
```
