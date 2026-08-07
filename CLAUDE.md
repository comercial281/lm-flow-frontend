# LM Flow — Frontend

## ⚠️ Deploy / branch de produção (LEIA ANTES DE ABRIR PR)

- **A produção deste frontend roda a branch `main`.**
  - Hospedagem: **Vercel**, projeto `lm-flow-frontend`.
  - Domínios: `*.lmflow.com.br`, `app.lmflow.com.br`, `lmflow.com.br` (inclui os sites de cliente, ex.: `corretorindaiatuba.lmflow.com.br`).
  - Auto-deploy ligado: **merge na `main` publica sozinho no Vercel** (~1–2 min).
- **Toda alteração de tela / visual / site builder deve ter o PR com base `main`.**
- Branches que **não** são `main` viram apenas **preview** na Vercel — não vão para o ar.

## Não confundir com o backend

A lógica/API fica em **outro repositório**: `comercial281/lm-flow` (Railway).
Lá a produção roda a branch **`saas-multitenant`** (NÃO `main`). Mudança de
backend (ex.: deletar contato, endpoints, jobs) vai nesse outro repo, com base
`saas-multitenant`.

| Peça | Repositório | Hospedagem | Branch de produção |
|---|---|---|---|
| Frontend (telas, site builder) | `lm-flow-frontend` | Vercel | **`main`** |
| Backend (API, lógica) | `lm-flow` | Railway | **`saas-multitenant`** |

## ⚠️ Como responder ao dono do produto (vale para TODA conversa neste repo)

**Quem lê a resposta não está com o código aberto.** Escrever nome de variável,
de componente ou de arquivo com número de linha no meio de uma frase não comunica
nada — obriga a pessoa a pedir tradução, toda vez.

Ao explicar o que foi feito, ou ao pedir uma decisão:

- **Chame as coisas pelo nome que elas têm NA TELA**: "o botão *Aviso do gestor*",
  "a aba Origem do card", "o campo Número do gestor". Nunca o nome no código.
- **Nada de nome de arquivo, componente ou número de linha no meio do texto.** Se
  um caminho for mesmo necessário, vai no fim, numa linha separada e avisada como
  detalhe técnico.
- **Descreva o EFEITO para quem usa**: o que muda na tela, quem vê, o que some e o
  que aparece.
- **Pedido de decisão vem em linguagem de produto**, com as opções e o que cada
  uma custa. A pessoa decide sobre o produto, não sobre a implementação.
- **Detalhe técnico tem lugar certo**: a mensagem de commit, o corpo do PR e os
  comentários no código. Ali pode e deve ser preciso. Na conversa, não.

Isto não é pedido de resposta curta nem de simplificação do trabalho — o trabalho
segue igual. É sobre a linguagem da conversa.
