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

As peças 11 a 22 (e os acréscimos em 6, 7 e 9) são as **escolhas do dono em 10/10/2026**, feitas olhando as variações que existiam no app lado a lado (registro em `LM FLOW/specs/registros/pecas-da-casa-2026-10-10/`, na pasta do Tony). **Todas já são componente ou regra do ajuste da casa, com trava no build em teto 0** (11/10/2026). Tela nova usa a peça; a montagem reprova o desenho feito à mão. O que a régua pega e não é a peça mora em `scripts/conferir-padrao.excecoes.json`, sempre com `motivo`.

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
6. **Abas** (`Abas`): sublinhado, ícone opcional, contagem opcional, nome da aba igual ao título do que ela abre, **no máximo um nível**.
   - Com `para` em todas as abas, a faixa é navegação (e guarda a saída).
   - Sem `para`, é aba de estado: setas esquerda/direita andam e trocam, Home/End vão às pontas, só a ativa entra no Tab. Não precisa do roteador (serve em janela). Em janela, `useAbaDaJanela(aberta, inicial)` faz a aba voltar pra primeira ao abrir.
   - Não usar como aba: pílula do pacote base (`Tabs`/`TabsList`), pílula roxa cheia nem botão fazendo papel de aba.
   - **Filtro rápido não é aba.** O segmentado cinza de Conversas e Contatos (Todas · Minhas · Sem resposta · Arquivadas) continua como está.
   - **Categoria é aba, mesmo dentro de painel ou janela** (Tony, 12/10/2026). Se cada opção mostra *outro tipo de coisa*, é `Abas`: Textos · Áudios · Mídias · Funis nas Mensagens prontas, Meus funis · Da equipe. Ícone da categoria e contagem quando ajudam e cabem; "Tudo" primeiro quando existe a visão junta. **Aba não rola de lado:** se não cabe numa linha, encurte o nome ou tire ícone/contagem antes (a lateral de 384 px comporta umas cinco abas curtas, sem ícone nem contagem).
   - **Como escolher entre as peças parecidas** (pergunte nesta ordem):
     1. Muda a *forma* de ver a mesma coisa (cartões, lista, mapa, calendário)? → `AlternadorDeVisao`.
     2. Cada opção mostra *outra coisa* (outro tipo, outra seção, outra tela)? → `Abas`.
     3. *Recorta* a mesma lista (situação, dono, período: Todas · Minhas · Sem resposta, Mês · Semana · Dia)? → segmentado cinza / `BotoesDeEscolha`.
     4. É um *valor* de formulário ou configuração, de 2 a 5 opções curtas? → `BotoesDeEscolha`; com frase de explicação, `CartoesDeEscolha`; lista comprida, `Seletor`.
     5. Liga/desliga com efeito na hora? → `Chave`.
   - **Trava:** `abaForaDaCasa` conta o `Tabs` do pacote em JSX e o sublinhado copiado (`border-b-2` + `-mb-px`) fora de `Abas.tsx`.
7. **Estado vazio** (`EmptyState`): os tipos nunca se confundem.
   - `vazio` explica pra que serve, dá o botão de criar e um **exemplo imobiliário**.
   - `semResultado` oferece limpar filtros.
   - `erro` oferece tentar de novo.
   - Sem acesso é o `NoAccessState`.
   - **Erro nunca aparece como lista vazia.** A carga é uma função `carregar` (`useCallback`), chamada pelo efeito e pelo "Tentar de novo", com contador que ignora resposta antiga; duas cargas na mesma tela têm erros separados (o erro de uma não apaga a outra).
   - **Formulário que grava configuração não aparece quando a carga falha** (só o erro com "Tentar de novo"): salvar em cima do formulário vazio apagaria a configuração real (Pixel/Conversões, Quem não respondeu).
   - **Duas medidas:** `tamanho="grande"` (padrão: ícone, título, explicação, botão) na lista principal da tela; `tamanho="compacto"` dentro de bloco, aba do card, painel ou janela (caixa tracejada, ação em link roxo ao lado da frase). Os três tipos valem nos dois. `title`/`description` aceitam texto com link.
   - **Nunca "Nenhum…" solto.** **Trava:** `vazioSolto` conta texto entre tags começando com "Nenhum"/"Nenhuma" fora do `EmptyState` (ponto cego: texto vindo de variável ou de `t()`).
8. **Lista de escolha** (`Seletor`): toda lista de escolha usa ele, nunca `<select>` cru.
   - Recebe o mesmo que o `<select>`: `value`, `onChange` com `e.target.value`, `<option>`/`<optgroup>`. Trocar uma tela é trocar a tag.
   - No computador abre a lista do produto; no celular, a do sistema.
   - Opção vazia ("Todos") e valor numérico funcionam sem truque.
   - `bare` deixa a caixa só com a `className` de quem chama (status colorido, filtro com ícone).
   - A trava do build (`selectNativo`) está em zero e vale para o app inteiro, painel raiz inclusive. Só o widget de chat e o portal público ficam com a lista do sistema.
9. **Botão de ícone:** sempre com nome (o efeito).
   - Em botão novo, use `IconActionButton`.
   - Os 202 que já existiam ganharam `aria-label` + `title` na Fase 3.4 e migram pro `IconActionButton` tela a tela na fase 4.
   - **Excluir não é lixeira solta ao lado da ação principal:** vai pro menu ⋮ e pede confirmação.
10. **Selo de situação** (`BaseStatusBadge`):
   - verde = funcionando;
   - cinza = desligado;
   - laranja = precisa de atenção;
   - vermelho = erro, falhou ou não entregou.
11. **Caixa de aviso** (`Aviso`): translúcida, com ícone. Um desenho só.
   - `<Aviso tom="atencao" titulo="WhatsApp desconectado.">Reconecte pra voltar a receber mensagens.</Aviso>`
   - Tons: `info` (azul, `Info`), `atencao` (âmbar, `TriangleAlert`), `erro` (vermelho, `CircleAlert`, anunciado na hora pro leitor de tela), `sucesso` (verde, `CircleCheck`), `neutro` (cinza, recado sem urgência).
   - `titulo` vai em negrito: abre a frase quando o texto é simples, vira a primeira linha quando o conteúdo é montado. `acao` põe botões embaixo. `icone` troca o ícone (`null` tira). `compacto` pra dentro de campo, cartão ou painel lateral.
   - **Nunca** a caixa pastel (`bg-orange-50 border-orange-200`, `bg-blue-50`…), nem borda à esquerda, nem o `Alert` do pacote base com cor por cima.
12. **Faixa no topo** (`Faixa`): a mesma família do `Aviso`, atravessando a tela com linha embaixo.
   - `<Faixa tom="atencao" icone={Clock} acao={<Button variant="outline" size="sm">Ver ofertas</Button>}>2 leads esperando você aceitar</Faixa>`
   - Mesmos tons. A ação é botão de contorno pequeno à direita (no celular desce pra baixo do texto). Nada de faixa pastel com botão âmbar cheio nem faixa vermelha cheia.
   - Exceção: a faixa de acesso como administrador (`ImpersonationBar`, só a equipe vê).
   - **Trava:** `avisoAMao` no `conferir-padrao` conta linha com fundo colorido + borda da mesma família (fora de `Aviso.tsx` e `Faixa.tsx`). Teto só desce.
13. **Carregando** (`Carregando`): esqueleto cinza com a forma do que vai chegar.
   - `variante`: `lista` (bolinha + 2 linhas), `cartoes`, `texto`; `linhas` (3) e `rotulo` ("Carregando…" pro leitor de tela). Para quando o sistema pede menos movimento.
   - O `Skeleton` de `components/ui/ds` já é cinza. A tela de partida (guarda de rota) é o `LoadingScreen`.
   - Rodinha (`Loader2 h-4 w-4 animate-spin`) só dentro de botão ou ação pequena.
   - **Nunca tela em branco.** Janela carregada sob demanda pode ter `fallback={null}` (o esqueleto apareceria fora dela).
   - **Trava:** `rodinhaCentral` e `telaEmBranco` (`fallback={null}`).
14. **Botões:** o `Button` de `components/ui/ds`, sempre (ele marca `data-variant`; **nunca** importar de `@evoapi/design-system/button`).
   - Variantes: `default` (principal, com o degradê roxo), `outline` (secundário), `ghost` (discreto), `destructive` (Excluir). Tamanhos `default` (36 px) e `sm` (32 px).
   - **O degradê é só do principal:** a regra do `globals.css` vale pra `[data-slot='button'][data-variant='default']` sem `aria-pressed`. Botão de selecionar (`variant={ativo ? 'default' : 'outline'}`) leva `aria-pressed={ativo}` e fica roxo liso.
   - **Nunca** `<button>` pintado à mão com `bg-primary`, cor fixa (`bg-[#…]`) nem botão menor que 32 px. Exceções de significado: Ganho verde no card, área do administrador.
   - Botão só-ícone: `size="icon"` com `className="size-8"` no mínimo. A ação da `Faixa` é `size="sm"`. Barra apertada: compense no espaço em volta, nunca encolha o botão.
   - **Trava:** `botaoPintado` e `botaoPequeno` (`h-4`…`h-7`/`size-4`…`size-7` na tag do `<Button`; ponto cego: componente que embrulha o `Button`, como o `IconActionButton`).
15. **Menu de ações:** `DropdownMenu` com gatilho `BotaoMaisAcoes` (⋮ em pé, `ghost`, 36 px, nome "Mais ações"), dentro de `<DropdownMenuTrigger asChild>`; `compacto` (32 px) só onde não cabe; `contorno` (40 px, com contorno) só ao lado de botões grandes de contorno, como o Ganho | Perdido no topo da página do card.
   - Itens com ícone `h-4 w-4` antes do texto.
   - Excluir por último, depois de `DropdownMenuSeparator`, com `variant="destructive"` do pacote. Nunca `text-red-*` à mão.
   - **Trava:** `menuDeitado` (⋯ deitado na tela).
16. **Ações sempre à vista.** Botão que só aparece ao passar o mouse não existe no celular.
   - Ação de cartão ou linha fica visível, apagada (`opacity-70`), e acende no mouse ou no foco (`group-hover:opacity-100 focus-within:opacity-100`). Em cima de foto, o botão leva fundo (`bg-background/80 rounded-md`) ou vai pra uma faixa embaixo da foto.
   - **Trava:** `soNoMouse` (`opacity-0`/`invisible`/`hidden` + `group-hover` na mesma linha); brilho decorativo vai pras exceções.
17. **Janela** (`Dialog` de `components/ui/ds`): nunca importar do pacote base nem montar `div fixed inset-0`.
   - **Topo e rodapé fixos, só o meio rola**, quando a tela usa `DialogHeader`/`DialogFooter` (rodapé feito à mão rola junto: ao mexer na tela, troque). O X de fechar ("Fechar") mora no topo; o foco de abertura vai pro primeiro campo.
   - Topo e rodapé grudam em `-(--janela-p)`, nunca em 0: o navegador mede o grudar por dentro do respiro da caixa, e com 0 os dois cobriam 8 px do miolo em cada ponta (rótulo do 1º campo e último item cortados). Barra grudada dentro de caixa com respiro segue a mesma conta.
   - Rodapé: os botões finais ficam no `DialogFooter`, *Cancelar* (contorno) à esquerda e a ação à direita. Ação do outro lado (Desconectar, Excluir): `className="sm:justify-between"` com os dois grupos dentro. Janela de formulário com rolagem própria: o `<form>` envolve o miolo que rola + o `DialogFooter`.
   - Janela com trabalho em andamento (assistente de página de captura, roteamento de lead, avisar os clientes da Academia): Esc e clique fora **não** fecham (`onEscapeKeyDown`/`onInteractOutside` com `preventDefault`); fecha pelo X ou pelo Cancelar.
   - **Quatro larguras:** pequena 448 px (`max-w-md`: confirmação, pergunta curta), padrão 512 px (sem largura), grande 672 px (`max-w-2xl`: formulário longo), larga 1400 px (`size="wide"`: duas colunas, tabela, editor, prévia). Nenhuma outra.
   - **No celular a janela sobe de baixo**: largura inteira, cantos de cima, alcinha, botões do rodapé empilhados (o principal em cima). Vale também pra confirmação. Tudo mora no ajuste da casa (`ds.tsx`).
   - **Topo à esquerda:** título e frase alinhados à esquerda, em todas as janelas (`text-left!` no topo da casa).
   - **Trava:** `larguraDeJanela`, `janelaDireta`, `janelaAMao`, `topoCentralizado` e `rodapeAMao` (arquivo com mais `DialogContent` que `DialogFooter` e com `<Button`; pontos cegos: rodapé dentro de componente filho, e a exceção vale para o arquivo inteiro, então janela nova num arquivo com exceção passa sem a trava).
18. **Confirmação:** `useConfirmacao`. Vermelho só com `destrutivo: true` (arquivar, executar e mover não são vermelhos).
   - Janela com conteúdo a mais (lista do que vai ser apagado, campo, escolha) fica `Dialog` da casa, título simples, sem círculo com ícone, botão `variant="destructive"`.
   - "Digite o nome pra confirmar" só em excluir canal e excluir conta.
   - Pergunta com campo é `usePergunta`. Nunca `window.confirm`/`prompt`.
   - **Trava:** `confirmacaoForaDaCasa` (`<AlertDialog` e import de `@evoapi/design-system/alert-dialog`, no app inteiro).
19. **Alternador de visão** (`AlternadorDeVisao`): só ícones, colados num contorno, o selecionado em roxo liso (sem degradê).
   - `<AlternadorDeVisao valor={visao} aoEscolher={setVisao} opcoes={[{ valor: 'cards', icone: Grid3X3, nome: 'Ver em cartões' }, { valor: 'table', icone: List, nome: 'Ver em lista' }]} />`
   - Ícones: `Grid3X3` cartões, `List` lista, `Map` mapa, `CalendarDays` calendário, `Kanban` quadro. `nome` é o efeito e vira `aria-label` + `title`. 40 px no celular, 32 no computador.
   - Período (Mês/Semana/Dia) e filtro não são visão: são `BotoesDeEscolha`. Categoria também não é visão: é `Abas` (ver "Como escolher" no item 6).
   - **Trava:** `alternadorAMao` (ícone de visão em tag fora do componente).
20. **Cartão:** `Card` de `components/ui/ds` (é o que tem o anel violeta e a sombra da marca).
   - Bloco dentro de um cartão: `rounded-lg border bg-muted/30 p-4`. Tela de configuração continua em `Secoes`/`Secao`.
   - Cartão clicável = link ou botão com o `Card` dentro (o efeito do mouse vai no `group-hover`). Cartão com `ring-*` perde o anel (a sombra do Card ganha): pra destacar, `outline-2 outline-primary`.
   - O Painel mantém o cartão de vidro dele (tela com padrão próprio).
   - **Trava:** `cartaoAMao` (`rounded-lg/xl` + `border` + `bg-card`, ou `bg-sidebar` + `border-sidebar-border`).
21. **Gráficos:** o desenho do Painel (recharts), com medidas e cores em `components/base/grafico.ts` (`CORES_DO_GRAFICO` = `--chart-1..5`, `EIXO_DO_GRAFICO`, `CANTOS_DA_BARRA`, `DICA_DO_GRAFICO`).
   - Sem grade; barras na cor do tema com cantos de 4 px no topo; eixo cinza de 11 px, sem linha; dica com borda e cantos de 10 px.
   - Barra de progresso: `h-2 rounded-full bg-muted` com o preenchimento `bg-primary`.
   - **Trava:** `corFixaEmGrafico` (`fill`/`stroke`/`stopColor` com hex direto; ponto cego: hex guardado numa constante).
22. **Ícones:** só `lucide-react`, em três tamanhos.
   - `h-3.5 w-3.5` em aba, etiqueta e filtro; `h-4 w-4` em botão e menu (dentro de `Button` é sempre 16 px); `h-5 w-5` em título. Ilustração de estado vazio fica com o tamanho dela, em classe.
   - Nada de `size={N}` em pixel. **Trava:** `tamanhoDeIcone`.

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
