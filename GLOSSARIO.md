# Glossário e régua de linguagem do LM Flow

> Fase 3 do programa de usabilidade. Aprovado pelo Tony em 30/09/2026 (spec `2026-09-29-fase-3-base-de-design-e-linguagem-design.md`).
> Vale pra **todo texto na tela do cliente**. Não vale pro painel raiz (equipe da Leal Mídia) nem pro que **sai pro lead** (modelos, `{{variáveis}}`, instruções da IA): isso é do cliente e não se mexe.
> A trava do build (`scripts/conferir-padrao.mjs`) confere boa parte disto. O resto é revisão de PR.

## Palavras

| Usar | Nunca na tela do cliente | Quando |
|---|---|---|
| **Número de WhatsApp** | instância, inbox, canal, caixa de entrada, API, número de entrada | O número da imobiliária ou do corretor que atende |
| **Celular** | "WhatsApp" pra falar do número pessoal | O celular pessoal da pessoa da equipe (onde chega aviso e link de acesso) |
| **Contato** | — | Qualquer pessoa na agenda: lead, proprietário, parceiro |
| **Lead** | cliente, prospect, oportunidade | Contato em negociação (tem card no funil) |
| **Funil** | pipeline | Só o quadro de vendas. No menu: **Funil de vendas** (não colide com "Funis de mensagem", que ganha nome novo na fase 4) |
| **Etapa** | estágio, coluna, status | Cada coluna do funil |
| **Etiqueta** | tag, label, marcador | — |
| **Conversa** | atendimento, chat, ticket | Cada conversa de WhatsApp com um contato |
| **Corretor** / **pessoa da equipe** | membro, atendente, agente, usuário | *Corretor* quando o cargo importa (roleta, dono do número); senão *pessoa da equipe* |
| **Equipe** (as pessoas) · **Times** (grupos) | "Equipes" no plural pra falar de grupos | — |
| **IA Vendedora** | agente, assistente, bot, robô, cérebro | — |
| **Ligar / Desligar** · **Ligado(a) / Desligado(a)** | ativar, desativar, habilitar, pausar, reativar | Tudo que age sozinho (automação, IA, roleta, lembrete, follow-up). Exceções: imóvel *Disponível/Indisponível*; pessoa com acesso *Ativo/Desativado* |
| **Excluir** | deletar, apagar | Some de vez (sempre pede confirmação) |
| **Remover** | — | Tira de uma lista sem apagar a coisa (ex.: remover da roleta) |
| **Salvar** / **Criar** | salvar alterações, salvar configurações, atualizar, concluir | *Criar* no formulário de algo novo; *Salvar* no resto. Salvando: *Salvando…* |
| **Mensagem automática** | trigger, template, disparo automático | O que o sistema manda sozinho |
| **Disparo** | broadcast, envio em massa | Mensagem pra uma lista, de uma vez |
| **Follow-up** | — | Fica em inglês: é a palavra do corretor |
| **Modelo** | template | Texto pronto pra reaproveitar |

## Nunca na tela do cliente

Evolution, Cloud API, token(s), webhook, tenant, slug, inbox, instância, HMAC, E.164, trigger, built-in, `string|null`, placeholder, payload, `act_…`.

- **Exceção: tela de conectar outro sistema** (Integrações, Canais, Pixel/CAPI). Ali *token*, *webhook* e o nome do provedor (Evolution, Cloud API) ficam, porque são as palavras que o outro lado usa.
- Siglas de mercado que o gestor não conhece (CAPI, SDR, BANT, SPIN) só aparecem com explicação ao lado.
- **US$** aparece só onde o valor é cobrado em dólar de verdade (custo do Meta, custo da IA), no formato brasileiro: "US$ 0,00".

## Escrita

- **O efeito pra quem usa, não o funcionamento por dentro.** "A IA para de atender lead novo até amanhã", nunca "o job verifica o limite a cada ciclo".
- **Erro diz o que fazer:** "O lembrete não saiu. Confira se o número de WhatsApp está conectado em Canais e tente de novo."
- **Frase normal em título e botão:** "Novo cargo", nunca "Novo Cargo". Nome próprio mantém a maiúscula (WhatsApp, IA Vendedora, LM Flow, Meta).
- **Plural certo:** "1 imóvel", "3 imóveis". Nunca "imóvel(is)" nem "contato(s)". Use `plural()` de `@/lib/formato`; em JSON, a chave base mais a `_other`.
- **Acento sempre.**
- **Texto novo é pt-BR literal no código** (regra da casa). Texto que já mora num JSON de tradução muda no JSON.

## Formato

Tudo que aparece sai de `src/lib/formato.ts`, e o vazio/inválido vira `—`:
- data, data curta e hora (sempre 24h), e data com hora: "30/09/2026", "30/09", "14:32", "30/09/2026 às 14:32";
- dinheiro: "R$ 1.234,56", "R$ 450.000" (imóvel), "R$ 1,2 mi" (painel), "US$ 0,00";
- número e porcentagem: "1.234", "12,5%";
- telefone: "(11) 91234-1234".

## As peças da casa

Cada peça mora em `src/components/base/` (ou `src/hooks/`). A regra de uso vale pra toda tela nova e pra toda tela que a fase 4 refizer.

1. **Chave** (`Chave`): ligar/desligar **com efeito na hora**.
   - O rótulo diz o efeito ("Mandar lembrete no WhatsApp") e o estado vai escrito ao lado (*Ligado/Desligado*).
   - Se o servidor recusar, ela volta sozinha e diz por quê.
   - Se ligar vai mandar mensagem pra alguém, `aoMudar` pergunta antes e devolve `false` se a pessoa desistir.
   - Desligado é **cinza**; vermelho é só erro e Excluir.
2. **Chave × caixinha × escolha.**
   - Chave = já valeu.
   - Caixinha = faz parte de um formulário e espera o *Salvar* (também serve pra marcar itens de uma lista ou aceite).
   - Escolher entre opções = bolinhas ou botões lado a lado, nunca chave.
3. **Salvar.**
   - Campo espera o *Salvar*.
   - Em página, a **BarraSalvar** aparece fixa embaixo quando há alteração ("Alterações não salvas · Descartar · Salvar"). O `useAlteracoesNaoSalvas(temAlteracao)` registra a pendência e faz o navegador perguntar ao fechar a aba.
   - Em janela, o rodapé é *Cancelar* à esquerda e *Salvar*/*Criar* à direita.
   - O aviso "Salvo" só depois de o servidor confirmar.
4. **Sair com alteração pendente pergunta antes:**
   - Onde vale: o menu lateral (os dois `<nav>` e Tutoriais), o menu do celular (Header) e as Abas usam `useGuardaDeSaida`.
   - O que passa direto: Ctrl/Cmd/Shift/Alt+clique (abrir em nova aba) e link que só abre submenu (`data-abre-submenu`, só quando `href === '#'`).
   - **O "voltar" do navegador não é coberto** (`<BrowserRouter>`: o `useBlocker` não funciona).
5. **Cabeçalho** (`BaseHeader`): um desenho só, o do risquinho roxo.
   - Título igual ao nome no menu ou na aba, e uma frase do que a tela faz.
   - Ação principal à direita.
   - Ajuda "?" e "Voltar" entram na peça quando a primeira tela precisar.
6. **Abas** (`Abas`): sublinhado, ícone opcional, nome da aba igual ao título do que ela abre, **no máximo um nível**.
   - Com `para` em todas as abas, a faixa é navegação (e guarda a saída).
   - Sem `para`, é aba de estado. **Ainda sem navegação por setas:** a primeira tela que usar esse modo acrescenta (setas esquerda/direita e tabindex móvel).
7. **Estado vazio** (`EmptyState`): os tipos nunca se confundem.
   - `vazio` explica pra que serve, dá o botão de criar e um **exemplo imobiliário**.
   - `semResultado` oferece limpar filtros.
   - `erro` oferece tentar de novo.
   - Sem acesso é o `NoAccessState`.
   - **Erro nunca aparece como lista vazia.**
8. **Botão de ícone:** sempre com nome (o efeito).
   - Em botão novo, use `IconActionButton`.
   - Os 202 que já existiam ganharam `aria-label` + `title` na Fase 3.4 e migram pro `IconActionButton` tela a tela na fase 4.
   - **Excluir não é lixeira solta ao lado da ação principal:** vai pro menu "…" e pede confirmação.
9. **Selo de situação** (`BaseStatusBadge`):
   - verde = funcionando;
   - cinza = desligado;
   - laranja = precisa de atenção;
   - vermelho = erro, falhou ou não entregou.

**As telas de referência são Configurações → Conta e Automações → Lembretes.** Foram as duas pilotos, já na base.

## A trava do build

`scripts/conferir-padrao.mjs` conta, na tela do cliente, estas categorias:
- termo técnico, palavra fora do glossário e palavra sem acento;
- Maiúscula Em Toda Palavra e plural com parênteses;
- formatação fora do módulo, chave feita à mão e botão só-ícone sem nome.

O build reprova se alguma passar do teto em `scripts/conferir-padrao.tetos.json`.
- **Ver onde:** `node scripts/conferir-padrao.mjs --listar <categoria>`.
- **O teto só desce.** Se precisar subir, suba junto com a razão, no mesmo PR.
- **Exceção** (texto que não aparece na tela, ou valor que vai pra API) mora em `scripts/conferir-padrao.excecoes.json`, sempre com `motivo`.
- **Ponto cego:** frase montada em variável (ou em tupla) antes de ir pra tela e texto devolvido por função não são lidos pela trava. Contagem 0 não prova tela limpa: a revisão de PR confere esses casos.
