# Notas do Giba

Site para controlar **notas fiscais de compra**, **preço de venda** e **encomendas de clientes**,
pensado para usar no celular (tirar a foto da nota) e no computador (conferir e administrar).

## O que faz

1. **Saudação**: cada vez que abre, cumprimenta com um nome diferente: "Bom dia, Giba!", "Olá, Gilberto!", "E aí, Beto!"…
2. **Fotografar a nota**: no celular, toque no botão da câmera, tire a foto (uma por página) e envie.
   A IA lê fornecedor, número, data, **todos os itens** (quantidade, valor unitário e total) e os totais.
   Também aceita **PDF** e o **XML da NF-e** (o XML é lido com exatidão, sem IA).
3. **Preço de venda sem calculadora**: cada item mostra o custo; você digita a **% em cima** e o site
   mostra o preço unitário, o total e o retorno. Também dá para digitar o **preço final**, e o site calcula a %.
   - % padrão por nota, com "Aplicar a todos os itens"; cada item pode ter a sua própria %.
   - Opção de **ratear frete/impostos** da nota no custo de cada item (custo real).
   - Arredondamento opcional (terminar em ,90, real inteiro, múltiplo de 5 ou 10).
4. **Encomendas e clientes**: anote "iPhone 14 para o Joel" com o WhatsApp dele. Quando a nota com um
   iPhone 14 chegar, o site **liga o item ao Joel automaticamente** (a IA ajuda a reconhecer, e uma regra de
   semelhança exige que modelo e capacidade batam). No item da nota também tem o botão **"Para quem é?"**, para escolher
   ou cadastrar o cliente na hora.
5. **Avisar no WhatsApp**: botão verde com **mensagem pronta** (produtos e valores) para cada cliente.
   Ao tocar, a encomenda fica como "avisado". Depois é só marcar "entregue".
6. **Painel**: investido, valor de venda, retorno previsto, já vendido e lucro realizado, por período,
   além de gráfico dos últimos 6 meses e a lista de quem falta avisar.
7. **Ajustes**: % padrão, arredondamento e modelo da mensagem (com prévia), usando `{nome}`, `{itens}`, `{total}` e `{loja}`.

## Como rodar

Requer **Node.js 22.13+** (usa o SQLite embutido no Node, sem instalar banco).

```bash
cd notas-giba
npm install
APP_PASSWORD='uma-senha-forte' ANTHROPIC_API_KEY='sk-ant-...' npm start
# abre em http://localhost:3000
```

| Variável | Para quê |
|---|---|
| `APP_PASSWORD` | Senha de acesso ao site. **Obrigatória antes de colocar na internet.** Sem ela, o site fica aberto. |
| `ANTHROPIC_API_KEY` | Chave da API do Claude (console.anthropic.com), usada para ler fotos e PDFs. Sem ela, XML e notas digitadas continuam funcionando. |
| `PORT` | Porta (padrão 3000). |
| `DATA_DIR` | Pasta onde ficam o banco (`giba.db`) e as fotos das notas (padrão `./data`). **Faça backup dela.** |
| `SESSION_SECRET` | (opcional) Segredo do login; se mudar, todos precisam entrar de novo. |
| `CLAUDE_MODEL` | (opcional) Modelo usado na leitura; padrão `claude-opus-5-5`. |

### Colocar no ar

Qualquer hospedagem Node com **disco persistente** serve (Railway, Render com disco, Fly.io com volume, uma VPS…).
Aponte `DATA_DIR` para o volume persistente e use HTTPS (a câmera do celular e o login funcionam melhor em HTTPS).
No celular, abra o site e use **"Adicionar à tela de início"** para virar um ícone de aplicativo.

## Testes

```bash
npm test
```

Cobrem o cálculo de preços, arredondamento, rateio de frete, mensagem do WhatsApp, combinação item × encomenda,
leitura do XML da NF-e, login e o fluxo completo pela API. A leitura de fotos é testada com um servidor que
imita a API da IA, sem gastar créditos.

## Estrutura

```
src/server.js    rotas da API, login e envio de arquivos
src/dados.js     regras: notas, itens, encomendas, clientes, painel
src/ia.js        leitura da foto/PDF com o Claude (saída estruturada)
src/nfe-xml.js   leitura do XML da NF-e
public/calc.js   cálculo de preço, rateio, arredondamento e mensagem (usado no navegador e no servidor)
public/combinar.js  reconhece de qual encomenda é cada item
public/app.js    o site (tela única, funciona no celular e no computador)
```
