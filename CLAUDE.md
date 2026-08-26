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

## Follow-up: decisões já tomadas (não reabrir sem o dono pedir)

- **Uma tela só manda no follow-up** (*Automações → Follow-up*): os funis, quem entra
  sozinho e o histórico. O antigo item **Robô Sem Resposta** saiu do menu e virou a
  seção *"Quem não respondeu"* dentro dela; `/automations/no-reply-robot` redireciona.
- **A Central de Notificações** saiu de *Automações de Lead* e vive em
  **Configurações → Conta**, que é onde alguém procura os próprios avisos.
  Desde 2026-08-25 ela mostra a **mesma lista** da Área do Admin — ver a seção
  *"Notificações: uma lista só"* abaixo.
- **Automações de Lead continua existindo** — é o motor. As telas amigáveis são
  atalhos que escrevem regras nele. Regras gerenciadas (`[Sistema] *` e as da Central)
  aparecem com selo **"gerenciada por"** e **sem botão de editar**: editar à mão
  desalinha da chave que as criou, e a chave passa a mentir.

Ao mexer aqui, lembrar que o backend tem as travas correspondentes — uma chave não
desliga a regra da outra, e o estado exibido vem da regra, não do config gravado.

### Marcador de progresso (desde 2026-08-12)

O editor de funil tem a chave **"Marcar no card em que mensagem o lead parou"**,
ligada por padrão em funil novo. Ela existe porque a retomada depende dela: o card
fica com **uma etiqueta só**, trocada a cada envio, e é o número dessa etiqueta que
faz o lead que volta pro funil continuar da mensagem seguinte em vez de receber tudo
de novo.

Duas coisas a respeitar ao mexer nesse editor:

- **A chave vem com explicação embaixo, em bloco próprio** — separada de "parar
  quando responder" e "só em horário comercial". Sozinha ela não diz o que faz, e
  quem lê "marcar no card" não adivinha que está decidindo sobre retomada.
- **O exemplo da etiqueta vem do backend**, não é montado aqui. O nome real é
  derivado do identificador interno do funil; inventar o exemplo na tela mostraria
  uma etiqueta diferente da que o card vai receber.

## Notificações: uma lista só (desde 2026-08-25)

O dono do produto pediu "uma correção definitiva" porque dava para ligar e
desligar aviso em lugares demais, e os lugares não se falavam. Eram **três donos
para o mesmo aviso**:

1. a lista de avisos da Área do Admin (*Central de Push → aba Notificações*)
2. uma regra de push com público **"Para os usuários do cliente"** (*aba Regras*)
3. a *Central de Notificações* dentro do app do cliente, que criava regra de
   automação por baixo

Um lead novo chegava a tocar o celular do corretor **duas vezes**, e desligar o
aviso na tela do cliente não calava a regra de push. Pior: o filtro *"quem causou
a ação nunca é avisado"* só existe no caminho 1 — então quem movia um card
recebia aviso do próprio movimento pelos caminhos 2 e 3.

Decisões tomadas (não reabrir sem o dono pedir):

- **Uma lista só, exibida em duas telas.** A Área do Admin e a Central de
  Notificações do cliente leem e gravam a MESMA configuração. Mexer numa aparece
  na outra. No frontend as duas usam o MESMO componente de lista, de propósito.
- **Público "Para os usuários do cliente" está aposentado.** Regra assim não
  entrega mais nada; continua visível e editável, com selo *"não dispara mais"* e
  o nome do aviso que assumiu. O push que chega para a Leal Mídia (*"Para mim"*)
  não mudou — responde outra pergunta. Disparo manual continua livre.
- **Perfil → Notificações virou "silenciar pra mim".** A tela existia e não fazia
  nada. Agora é camada de CIMA: a empresa decide quais avisos existem, cada
  pessoa cala os que não quer. **Só tira, nunca acrescenta.**
- **Reunião agendada, lembrete de 1h e lead esfriando entraram no catálogo.** Eram
  exclusivos da Central antiga.

Cinco armadilhas, todas com cicatriz:

1. **Aviso novo nasce DESLIGADO.** Ligar por padrão faria toda imobiliária que
   nunca pediu começar a receber — mudança de comportamento por efeito colateral
   de refatoração.
2. **`lead_novo` da Central antiga NÃO migra para `lead.novo_organico`.** A chave
   avisava de qualquer chegada, inclusive estranho escrevendo no número pessoal
   do corretor. É o incidente da APTO PREMIUM (04/08/2026). Migra só para anúncio
   e formulário.
3. **O silêncio pessoal é opt-OUT.** Ausência = recebe tudo que a empresa ligou.
   Fazer opt-in silenciaria quem nunca abriu o Perfil — foi esse bug que tirou o
   portão antigo do `NotificationBuilder` em 2026-07-31.
4. **"Quem recebe" SUBSTITUI o papel, não cruza com ele.** Interseção com
   `User.gestores` faria escolher um corretor devolver lista vazia, e o aviso
   sumiria sem ninguém entender.
5. **Não guardar a escolha do cliente em outro lugar "porque é mais fácil daqui".**
   A política mora em `saas_tenants.settings['notification_policy']`, no `public`.
   Um segundo armazenamento é exatamente como voltam a existir duas verdades.

Ainda **não** consolidado, e é dívida conhecida: a tela da **Roleta** tem quatro
chaves de aviso próprias (corretor, gestor, grupo, grupo no repasse) que valem
*junto* com a lista — as duas precisam estar ligadas para a mensagem sair. Não
está quebrado, mas são dois lugares para procurar.

### O aviso acompanha o responsável (desde 2026-08-25)

Um corretor recebeu *"Fulano agora é seu"* sem lead nenhum ter caído. A barreira
de origem (o que pode entrar no funil) decidia só se o CARD nascia — os avisos
corriam por fora dela. E a chegada avisava **todos os gestores** em paralelo à
roleta: um lead sorteado para um corretor fazia o aparelho da diretoria inteira
tocar junto.

O que mudou na tela:

- **Avisos de lead ganharam a linha "Só avisa depois que o lead entra no funil"**,
  logo abaixo da descrição. A regra fica à vista de propósito: quem liga o aviso,
  manda uma mensagem de teste de um número qualquer e não recebe nada conclui que
  está quebrado — quando é a barreira dele funcionando.
- **Os quatro avisos de CHEGADA nascem desligados.** Quem conta que o lead chegou
  é *"Lead virou seu"*, que vai só para o dono.
- **Aviso novo: "Lead entrou e ficou sem responsável"**, por WhatsApp de fábrica
  (não push — push passa batido, e este é o aviso que ninguém está esperando).
- **"Você foi sorteado para um lead" passou a chegar no app.** A chave de Push
  dessa linha existia e **não entregava nada**: a oferta saía só no WhatsApp da
  roleta. Enquanto a chegada avisava os gestores isso não aparecia; agora que o
  aviso é só do responsável, corretor sem WhatsApp cadastrado ficaria sem nada.

**Ainda aberto:** *Mencionaram você* e os quatro de *Tarefa* podem avisar quem
não consegue abrir o que foi avisado (corretor marcado numa conversa de outro, ou
com tarefa num card que não é dele). Ali o conserto certo é o inverso — dar
acesso a quem foi deliberadamente envolvido, não calar o aviso.

## Bolsão de Leads (desde 2026-08-25)

A lista de leads **sem dono** que o gestor abastece por planilha e o corretor se
serve. Duas telas, dois cargos: *Bolsão → Pegar leads* (corretor) e
*Bolsão → Listas e regras* (gestor), no grupo **Principal** do menu.

Decisões (não reabrir sem o dono pedir):

- **O contato fica escondido até o corretor puxar.** O cartão mostra primeiro
  nome, cidade, interesse e há quanto tempo o lead espera; telefone e e-mail
  aparecem com **cadeado**, não em branco — campo vazio faria parecer que o lead
  não tem telefone. Quem mascara é o servidor: os campos completos **não chegam**
  na tela antes da retirada. Não tente escondê-los no CSS; o ponto é impedir
  copiar o número e atender por fora do CRM.
- **O contador "pode pegar mais N / libera em MM:SS" fica SEMPRE visível**, não
  só quando trava, e o botão desabilita mostrando o tempo. Ver o limite antes de
  clicar é o que faz a regra parecer regra, e não castigo.
- **A cota vem sempre do servidor.** A tela só faz o relógio andar entre uma
  resposta e outra. Calcular aqui faria a tela mentir no primeiro ajuste de regra.
- **A lista se atualiza sozinha a cada 30s**, para o corretor não clicar num lead
  que outro acabou de levar. O polling silencioso **não** emite toast de erro:
  rede oscila, e um toast a cada 30s viraria cachoeira.
- **Nada entra no Bolsão antes de o gestor conferir o mapeamento** das colunas,
  com as primeiras linhas já lidas ao lado. Sem a coluna de telefone o botão de
  importar não libera.

Armadilhas:

1. **A visibilidade tem DUAS metades, em repositórios diferentes.** Aqui o menu
   usa `clientToggleKey: 'bolsao'`; no backend, `bolsao` precisa estar em
   `ClientInstance::DEFAULT_OFF_FEATURES`, porque o endpoint público resolve
   chave AUSENTE como `true`. Só com as duas o Bolsão fica desligado para quem
   não foi liberado. Mexeu numa, confira a outra.
2. **`featureKey` e `clientToggleKey` são opostos.** `featureKey` esconde só
   quando a chave vale `false` (ausência = LIGADO); `clientToggleKey` mostra só
   quando vale `true` (ausência = desligado) e a Leal Mídia sempre vê. Trocar um
   pelo outro por engano estreia a funcionalidade para todo cliente.
3. **A rota `/bolsao` é gateada só por cargo**, como `/ia-vendedora`: quem digitar
   a URL alcança a tela (vazia). É o padrão da casa — não é esquecimento.
4. **O arquivo enviado vai para o servidor**, não é lido no navegador como o
   importador antigo do funil (`ImportLeadsModal`). Aquele faz uma requisição por
   linha e cria os contatos na hora — no Bolsão o lead só vira contato quando
   alguém puxa.

### Depois de puxar: o card, o histórico e a saída da lista (desde 2026-08-25)

O dono do produto: "abrir card no pipeline, não conversa; histórico no card;
origem bolsão no card; poder apagar listas". As quatro tinham o mesmo tema —
depois que o corretor puxava, o lead sumia de vista.

O que mudou na tela:

- **Puxar leva direto para o card no funil.** O botão antigo dizia "Abrir
  conversa" e caía na caixa de conversas com **nada selecionado** — e não havia o
  que selecionar: o Bolsão cria contato e card, **nunca** conversa. Agora a tela
  abre o card recém-criado, com telefone e e-mail à mostra. O endereço é o mesmo
  que o botão *Copiar link do card* monta, e o quadro do funil já sabe abrir o
  card sozinho ao recebê-lo.
- **O cartão verde "Fulano agora é seu" virou plano B.** Ele só aparece quando o
  lead não virou card (cliente sem funil configurado) — é o único lugar onde o
  telefone revelado aparece, então sumir com ele deixaria o corretor sem o
  número. O botão dele agora abre a **ficha do contato**, não a caixa de conversas.
- **O card conta que o lead veio do Bolsão.** Na aba *Origem*, selo próprio e a
  linha *Lista do Bolsão* com o nome da planilha. No painel *Histórico*, a linha
  **"Puxado do Bolsão"** com a lista, quem puxou e quanto tempo o lead esperou.
- **A lixeira das listas virou *Arquivar*.** Ela quase nunca funcionava: o
  servidor recusava apagar qualquer lista que já tivesse tido retirada — quase
  todas — para não levar junto o *Quem pegou o quê*. Arquivar **não apaga nada**:
  a lista para de oferecer leads, desce para a seção recolhida **Arquivadas** no
  fim da aba *Listas*, e volta pelo botão **Reabrir**.
- **Reabrir traz a lista PAUSADA, não ao ar.** Lista arquivada há meses voltando
  a distribuir leads velhos sem o gestor confirmar é a surpresa que o resto do
  Bolsão evita — quem religa a torneira continua sendo *Voltar ao ar*.

Armadilhas desta leva:

5. **A tela precisa do FUNIL, não só do card.** O endereço do card é
   `/pipelines/<funil>?card=<card>`; a resposta do "puxar" devolve os dois. Sem o
   funil não dá para montar o endereço, e o corretor cai no plano B sem motivo.
6. **Não existe mais apagar lista** — o `deleteBatch` saiu do serviço junto com a
   rota no backend. Uma saída só, senão voltam a existir duas verdades sobre
   "tirar a lista da frente".
7. **`archived` é estado da lista, não campo novo.** No backend ele entrou na
   lista de estados válidos e nada some do banco. Se aparecer estado novo por lá,
   o rótulo dele precisa entrar no mapa de estados desta tela, senão o selo da
   lista sai em branco.

## Landing Pages de anúncio (desde 2026-08-26)

O construtor de página de anúncio a partir do imóvel **já existia inteiro** e
nunca foi desligado por chave nenhuma: ele só não tinha porta de entrada. Os dois
botões no topo da tela de *Imóveis* estavam travados com *"em breve"* e sem ação
por trás, e não havia item de menu. Quem digitava o endereço chegava numa tela
funcionando.

Decisões (não reabrir sem o dono pedir):

- **A porta é a aba *Landings de anúncio* dentro do Site Builder**, não item de
  menu próprio. A landing é uma página do site do cliente, e o Site Builder é
  onde o site nasce — foi isso que fez o *"nenhum site configurado"* deixar de
  ser beco sem saída: hoje a aba mostra o mesmo estado vazio das outras, com
  botão para a aba *Configurações*, onde o botão já se chama **Criar site**.
- **Estreia liberada cliente a cliente.** A aba usa a semântica do
  `clientToggleKey` (só aparece com a chave valendo `true`; a Leal Mídia sempre
  vê, com o olho cortado). O gate mora na ABA, **nunca na rota**: quem digita o
  endereço alcança a tela, como em `/bolsao` e `/ia-vendedora`.
- **Os dois botões *"em breve"* saíram da tela de Imóveis.** O megafone do
  cabeçalho ficaria a poucos pixels do megafone de cada cartão, que faz outra
  coisa (a landing DAQUELE imóvel). E o template da página de imóvel é do SITE,
  não do imóvel: virou botão na aba *Portal* do Site Builder.
- **Dá para publicar de dentro do editor.** Antes o *Publicar e gerar link* só
  existia na lista, então a landing montada a partir do card do imóvel nascia
  rascunho e nunca ia ao ar. O botão **salva antes de publicar**: o Salvar é
  outro botão, e publicar com alteração pendente entregaria ao cliente um link de
  anúncio apontando para a versão anterior da página.
- **Excluir pede confirmação** e avisa, com todas as letras, quando a landing
  está publicada — apagar derruba o link que já está rodando no anúncio.

Armadilhas:

1. **A chave do gate é escrita LITERAL na chamada do `useClientToggle`.**
   `scripts/sync-feature-catalog.mjs` varre o código por REGEX e **remove do
   catálogo toda chave que não aparece**; `scripts/audit-feature-catalog.mjs`
   **quebra o build** quando uma chave usada não está no catálogo. Trocar o
   literal por uma constante tira a chave do catálogo no deploy seguinte, o
   painel de Funções deixa de oferecer o botão de liberar, e ninguém é avisado.
   Os dois scanners foram ensinados a enxergar o `useClientToggle` — se renomear
   o helper, atualize os dois.
2. **`useFeature` e `useClientToggle` são OPOSTOS.** `useFeature` = ausência
   LIGA; `useClientToggle` = só liga com `true`. Trocar um pelo outro estreia a
   funcionalidade para todo cliente.
3. **A metade do backend é obrigatória e vem PRIMEIRO.** `landing_pages` precisa
   estar em `ClientInstance::DEFAULT_OFF_FEATURES` no `lm-flow` (branch
   `saas-multitenant`), porque o endpoint público resolve chave AUSENTE como
   `true`. Mexeu numa metade, confira a outra.
4. **A aba *Páginas* do Site Builder filtra `page_kind !== 'ad_landing'`.** Sem o
   filtro, a landing aparecia lá junto das páginas do portal e o botão *Editar*
   abria o editor simples de título/HTML, que **salvava por cima** do que o
   construtor de blocos montou. Isso já acontecia antes desta leva.
5. **O conversor de nome em endereço mora num arquivo só**
   (`src/features/landing/manage/landingUrl.ts`) porque é a string que vai
   **colada num anúncio pago**: lista, editor e assistente têm que mostrar
   exatamente o mesmo resultado. E o intervalo de acentos é escrito como
   `\u0300-\u036f`, não com os caracteres combinantes literais — a versão antiga
   tinha os literais no fonte, que qualquer normalização de editor apaga em
   silêncio.
6. **A aba fica no endereço (`?tab=landings`) e grava com `replace`.** Sem o
   `replace`, o botão Voltar do navegador passa a percorrer as abas em vez de
   sair da tela.

Ainda **não** resolvido, e é dívida conhecida:

- **Salvar e reusar template só funciona para o administrador da conta.** A
  permissão nova não chega em cargo que já existe, no backend — gestor e corretor
  tomam erro de acesso. O botão só aparece para a Leal Mídia por enquanto.
- **A landing pública e a captura do lead não têm teste automatizado no
  servidor.** É o caminho por onde a verba de anúncio entra.

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
