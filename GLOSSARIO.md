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

As peças 11 a 22 (e os acréscimos em 6, 7 e 9) são as **escolhas do dono em 10/10/2026**, feitas olhando as variações que existiam no app lado a lado (registro em `LM FLOW/specs/registros/pecas-da-casa-2026-10-10/`, na pasta do Tony). Parte delas ainda não virou componente: até virar, **tela nova copia o desenho escrito aqui**, classe por classe, e não inventa outro. Cada peça vira componente com trava no build, uma por vez, com teto descendo até zero.

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
   - Não usar como aba: pílula do pacote base (`Tabs`/`TabsList`), pílula roxa cheia nem botão fazendo papel de aba. Abas feitas à mão (Funis, Tarefas, Disparos, Automações de lead) passam pra `Abas`.
   - **Filtro rápido não é aba.** O segmentado cinza de Conversas e Contatos (Todas · Minhas · Sem resposta · Arquivadas) continua como está.
7. **Estado vazio** (`EmptyState`): os tipos nunca se confundem.
   - `vazio` explica pra que serve, dá o botão de criar e um **exemplo imobiliário**.
   - `semResultado` oferece limpar filtros.
   - `erro` oferece tentar de novo.
   - Sem acesso é o `NoAccessState`.
   - **Erro nunca aparece como lista vazia.**
   - **Duas medidas:** a grande (ícone, título, explicação, botão) na tela inteira; a compacta dentro de bloco (card do lead, painel, lista curta): caixa tracejada `rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground` com a ação em link roxo ao lado da frase. A medida compacta ainda não está no `EmptyState`; até entrar, tela nova usa a caixa tracejada.
   - **Nunca "Nenhum…" solto** num `<p>` cinza.
8. **Lista de escolha** (`Seletor`): toda lista de escolha usa ele, nunca `<select>` cru.
   - Recebe o mesmo que o `<select>`: `value`, `onChange` com `e.target.value`, `<option>`/`<optgroup>`. Trocar uma tela é trocar a tag.
   - No computador abre a lista do produto; no celular, a do sistema.
   - Opção vazia ("Todos") e valor numérico funcionam sem truque.
   - `bare` deixa a caixa só com a `className` de quem chama (status colorido, filtro com ícone).
   - A trava do build (`selectNativo`) está em zero e vale para o app inteiro, painel raiz inclusive. Só o widget de chat e o portal público ficam com a lista do sistema.
9. **Botão de ícone:** sempre com nome (o efeito).
   - Em botão novo, use `IconActionButton`.
   - Os 202 que já existiam ganharam `aria-label` + `title` na Fase 3.4 e migram pro `IconActionButton` tela a tela na fase 4.
   - **Excluir não é lixeira solta ao lado da ação principal:** vai pro menu "⋮" e pede confirmação.
10. **Selo de situação** (`BaseStatusBadge`):
   - verde = funcionando;
   - cinza = desligado;
   - laranja = precisa de atenção;
   - vermelho = erro, falhou ou não entregou.
11. **Caixa de aviso:** translúcida, com ícone. Um desenho só, quatro tons.
   - Desenho: `flex items-start gap-2 rounded-md border border-<cor>-500/40 bg-<cor>-500/10 p-3 text-sm text-<cor>-700 dark:text-<cor>-400`, ícone `h-4 w-4 mt-0.5 shrink-0`.
   - Tons: informação = `sky` + `Info`; atenção = `amber` + `TriangleAlert`; erro = `red` + `CircleAlert`; sucesso = `emerald` + `CircleCheck`.
   - Título, quando tem, vai em negrito no começo da frase ("**WhatsApp desconectado.** Reconecte pra…").
   - **Nunca** a caixa pastel (`bg-orange-50 border-orange-200`, `bg-blue-50`…), nem borda à esquerda, nem o `Alert` do pacote base com cor por cima.
   - Embrião do componente: `Aviso` do configurador da IA (`pages/Customer/Automations/SalesAgents/configurar/Aviso.tsx`), que vai pra `components/base/`.
12. **Faixa no topo:** a mesma família da caixa de aviso, atravessando a tela.
   - Desenho: `flex items-center justify-between gap-2 border-b border-<cor>-500/40 bg-<cor>-500/10 px-4 py-2 text-xs text-<cor>-700 dark:text-<cor>-400`, ícone `h-3.5 w-3.5`; a ação é botão de contorno pequeno à direita.
   - Mesmos tons da caixa. Nada de faixa pastel com botão âmbar cheio nem faixa vermelha cheia (a da janela de 24h passa pra essa).
   - Exceção: a faixa de acesso como administrador (só a equipe vê).
13. **Carregando:**
   - Lista, cartão ou tela carregando = **esqueleto cinza** com a forma do que vai chegar: `bg-muted animate-pulse`, linhas `rounded`, a de baixo `bg-muted/70`. Referência: `components/chat/loading-states/ConversationSkeleton.tsx`.
   - Rodinha (`Loader2 h-4 w-4 animate-spin`) só dentro de botão ou ação pequena.
   - **Nunca tela em branco:** `<Suspense fallback={null}>` em tela ou aba não vale.
14. **Botões:** o `Button` do pacote base (`components/ui/ds`), sempre.
   - Variantes: `default` (principal, com o degradê roxo), `outline` (secundário), `ghost` (discreto), `destructive` (Excluir). Tamanhos `default` (36 px) e `sm` (32 px).
   - **Nunca** `<button>` pintado à mão com `bg-primary`, cor fixa (`#00ffa7`, `emerald-600`…) nem botão menor que 32 px.
   - O degradê é do botão principal. Filtro ou alternador selecionado não ganha degradê nem sombra roxa.
15. **Menu de ações:** `DropdownMenu` com gatilho **⋮** (`EllipsisVertical`), botão `ghost` `size="icon"` com nome ("Mais ações").
   - Itens com ícone `h-4 w-4` antes do texto.
   - Excluir por último, depois de um separador, com `variant="destructive"` do pacote. Nunca `text-red-*` à mão.
   - Nunca ⋯ deitado.
16. **Ações sempre à vista.** Botão que só aparece ao passar o mouse (`opacity-0 group-hover:opacity-100`) não existe no celular.
   - Ação de cartão ou linha fica visível, apagada (`text-muted-foreground opacity-70`), e acende ao passar o mouse (`group-hover:opacity-100 group-hover:text-foreground`).
17. **Janela** (`Dialog` do ajuste da casa, `components/ui/ds`): nunca importar direto de `@evoapi/design-system/dialog` nem montar `div fixed inset-0`.
   - **Topo e rodapé fixos, só o meio rola.** Topo `px-6 py-4 border-b` com título e uma frase; ícone no título é opcional. Rodapé `px-6 py-4 border-t`, *Cancelar* (contorno) à esquerda e a ação à direita.
   - **Quatro larguras:** pequena 448 px (`max-w-md`: confirmação, pergunta curta), padrão 512 px (sem largura), grande 672 px (`max-w-2xl`: formulário longo), larga 1400 px (`size="wide"`: editor, prévia). Nenhuma outra.
   - **No celular a janela sobe de baixo**, com a largura inteira. Isso muda no ajuste da casa, uma vez só (ainda a fazer).
18. **Confirmação:** `useConfirmacao`. Vermelho só com `destrutivo: true`.
   - Nunca `AlertDialog` do pacote base (mostra "Excluir" em roxo), círculo com ícone nem `window.confirm`.
   - As duas de digitar o nome (excluir canal, excluir conta) ficam como estão.
19. **Alternador de visão:** só ícones, colados num contorno (`flex items-center border rounded-lg`), o selecionado em roxo.
   - Ícones: `Grid3X3` cartões, `List` lista, `Map` mapa, `CalendarDays` calendário.
   - Cada botão com nome (`aria-label` + `title`: "Ver em lista") e `aria-pressed`. No celular, alvo de toque de 40 px.
   - Vira componente na frente das peças; até lá, copiar o de Funis (`pages/Customer/Pipelines/Pipelines.tsx`).
20. **Cartão:** `Card` do pacote base (é o que tem o anel violeta e a sombra da marca).
   - Bloco dentro de um cartão: `rounded-lg border bg-muted/30 p-4`.
   - Tela de configuração continua em `Secoes`/`Secao`.
   - Nada de caixa `rounded-xl border bg-card` sem sombra fazendo papel de cartão. O Painel mantém o cartão de vidro dele (tela com padrão próprio, como no padrão de telas).
21. **Gráficos:** o desenho do Painel (recharts).
   - Sem grade; barras na cor do tema com cantos de 4 px no topo; eixo com texto cinza de 11 px, sem linha; dica com borda e cantos de 10 px.
   - Cores das séries saem de `--chart-1` a `--chart-5`. **Nunca hex fixo** (`#3b82f6`, `#059669`…).
   - Barra de progresso: `h-2 rounded-full bg-muted` com o preenchimento `bg-primary`.
22. **Ícones:** só `lucide-react`, em três tamanhos.
   - `h-3.5 w-3.5` em aba, etiqueta e filtro; `h-4 w-4` em botão e menu; `h-5 w-5` em título.
   - Nada de `size={N}` em pixel solto.

**As telas de referência são Configurações → Conta e Automações → Lembretes.** Foram as duas pilotos, já na base.

## A trava do build

`scripts/conferir-padrao.mjs` conta, na tela do cliente, estas categorias:
- termo técnico, palavra fora do glossário e palavra sem acento;
- Maiúscula Em Toda Palavra e plural com parênteses;
- formatação fora do módulo, chave feita à mão e botão só-ícone sem nome;
- lista de escolha nativa, que é a exceção: vale para o app inteiro (painel raiz, landing e a sobra do fork também).

O build reprova se alguma passar do teto em `scripts/conferir-padrao.tetos.json`.
- **Ver onde:** `node scripts/conferir-padrao.mjs --listar <categoria>`.
- **O teto só desce.** Se precisar subir, suba junto com a razão, no mesmo PR.
- **Exceção** (texto que não aparece na tela, ou valor que vai pra API) mora em `scripts/conferir-padrao.excecoes.json`, sempre com `motivo`.
- **Ponto cego:** frase montada em variável (ou em tupla) antes de ir pra tela e texto devolvido por função não são lidos pela trava. Contagem 0 não prova tela limpa: a revisão de PR confere esses casos.
