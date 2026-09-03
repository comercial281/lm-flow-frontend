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

### Seções mais ricas, textos editáveis e margens (desde 2026-08-27)

O dono do produto montou uma landing de verdade no editor novo e listou seis
limites. Nenhum deles tinha metade de backend: o servidor guarda as seções como
lista livre e não valida tipo de seção, então tudo é tela.

O que mudou:

- **Seção *Texto*** (grupo novo **Conteúdo**, primeiro na lista de adicionar),
  com negrito, itálico, lista e link.
- **A *Galeria de Fotos* aceita foto enviada na hora.** Ganhou o seletor *De onde
  vêm as fotos*: as do imóvel (como sempre) ou as que o gestor enviar ali mesmo,
  com legenda e reordenação. É o caminho para landing de imóvel que não está
  cadastrado, que não tinha foto nenhuma pra puxar.
- **O *Mapa* passa a mostrar mapa.** Dois campos: *Endereço mostrado na página*
  (o que o lead lê) e *Região do mapa* (o que o mapa busca).
- **Espaçamento acima, abaixo e nas laterais em cada seção**, com o padrão da
  página como sugestão no campo.
- **O *Simulador* ganhou o campo *Valor do imóvel*** (mais reforços e chaves em
  %). Sem imóvel cadastrado, a simulação inteira saía zerada, calada.
- **Todos os textos fixos viraram campo** — formulário inteiro, simulador, e os
  títulos de Ficha Técnica, Galeria e Progresso de Obra. O *Botão sobre a capa*
  do Hero também passou a existir de fato.
- **O selo da seção selecionada na prévia** é preto com borda branca, sempre.
  Usava a cor da landing e sumia nos temas claros, que são a maioria.

**Duas mudanças aparecem em landing JÁ PUBLICADA, e são de propósito:**

1. **A tela de obrigado passa a mostrar o texto gravado.** Os campos *Quando o
   lead é aprovado* e *Mensagem* não faziam nada: a tela tinha o texto escrito
   por dentro e ignorava o que estava salvo. Quem preencheu aquilo algum dia vai
   ver o próprio texto aparecer agora.
2. **A seção de mapa passa a mostrar o mapa**, onde antes havia só uma linha de
   endereço.

Todo o resto nasce com o texto e o espaçamento de hoje como padrão.

Armadilhas desta leva:

7. **O mapa busca SÓ a região, nunca a rua com número** — mesmo quando a rua é o
   único campo preenchido. É a mesma decisão de privacidade que a página de
   imóvel do site toma, e existe teste para ela. Quem "consertar" isso passando o
   endereço completo para o mapa entrega o endereço exato a quem só viu o anúncio.
8. **O editor de texto é COMPARTILHADO com o compositor do chat** e com os
   artigos do Site Builder. Ele recebe o conjunto de formatações por parâmetro, e
   o padrão é o do chat: o link só existe onde a landing pede. O botão de link
   nem se desenha quando o conjunto em uso não tem a marca — no chat o texto vira
   mensagem de WhatsApp, onde link formatado não existe.
9. **A margem mora na SEÇÃO, não na configuração de cada tipo de seção.** É o que
   faz o recurso valer para as 19 de uma vez e nascer junto com toda seção nova.
   Medida em branco = usa o padrão; gravar zero por engano cola a seção na de cima.
10. **A capa usa a margem como espaço EXTERNO**, e não interno: ela é sangrada de
    ponta a ponta, e recuo interno deixaria uma faixa de fundo por cima da foto.
    O botão fixo não tem margem nenhuma — ele flutua.
11. **Texto novo tem de nascer com o texto de hoje como padrão.** Um padrão
    diferente muda a página de quem nunca pediu nada.
12. **O campo de texto com formatação é não-controlado.** Ele é semeado uma vez e
    depois só lido. Quem montar painel com ele precisa trocar a identidade do
    campo ao mudar de seção, senão a caixa continua mostrando o texto da anterior.

Ainda **não** resolvido, e é dívida conhecida:

- **Salvar e reusar template só funciona para o administrador da conta.** A
  permissão nova não chega em cargo que já existe, no backend — gestor e corretor
  tomam erro de acesso. O botão só aparece para a Leal Mídia por enquanto.
- **A landing pública e a captura do lead não têm teste automatizado no
  servidor.** É o caminho por onde a verba de anúncio entra.

## Aviso de aula nova da Área de Membros (desde 2026-08-31)

Saiu aula nova no Tutorial e agora dá para avisar os clientes no WhatsApp, pelo
número operacional da Leal Mídia, sem sair da aula.

O que aparece na tela:

- **Botão *Avisar clientes*** na barra de ações da aula (ao lado de *Editar aula*
  e *Excluir aula*), só para a Leal Mídia. Ele abre uma janela com quatro coisas:
  a mensagem, como ela vai chegar no grupo, por qual número sai e para quais
  grupos vai.
- **A mensagem é editável e tem trechos entre chaves** ({aula}, {curso}, {link}…)
  que são preenchidos na hora do envio. O botão *Salvar como padrão* guarda o
  texto, o número e os grupos para a próxima aula — a janela já abre preenchida.
- **A lista mostra só os grupos dos CLIENTES.** Ela vem do WhatsApp do número
  escolhido, filtrada pelo NOME: entra o grupo que termina em *Leal Mídia*, que é
  como os grupos das imobiliárias são batizados. Tem busca e marcar/desmarcar, e
  onde o grupo também está no cadastro do cliente aparece o nome da imobiliária e
  qual grupo dele é (lembretes ou logs internos). Embaixo da lista, o aviso de
  quantos grupos daquele número ficaram de fora: sem esse número, "meu grupo não
  está aqui" vira chamado de suporte.
- **Depois de enviar, cada grupo mostra *enviado* ou *falhou*** na própria lista, e
  o rodapé *Ver os últimos avisos* conta o que já saiu, quando e para quantos.

Decisões (não reabrir sem o dono pedir):

- **A prévia (*Como vai chegar no grupo*) vem do servidor**, não é montada aqui.
  Quem monta a mensagem de verdade é ele, e cada grupo recebe o link da aula no
  endereço da imobiliária DELE — uma prévia montada na tela mostraria um texto que
  ninguém vai receber, e um texto já pronto mandaria todo mundo para o app de um
  cliente só.
- **A janela avisa quando a aula JÁ foi avisada**, com a data. Não bloqueia: às
  vezes o reenvio é de propósito. Mas ninguém manda duas vezes sem saber.
- **A quantidade de grupos escolhidos fica no botão de enviar.** Disparo para
  grupo de cliente é irreversível; o número precisa estar embaixo do dedo.
- **Filtrar pelo cadastro do cliente NÃO funcionou** e foi trocado no mesmo dia:
  escondia grupo de cliente real que ninguém tinha cadastrado — a maioria,
  incluindo o do APTO PREMIUM. O cadastro virou rótulo; quem decide quem aparece
  é o nome do grupo.
- **Grupo já salvo como destino continua na lista mesmo fora do padrão de nome**,
  com o aviso de que ele foi escolhido antes. Os selecionados são derivados da
  lista exibida: escondê-lo o tiraria do disparo e do padrão calado.

- **Cada grupo mostra PARA ONDE o link dele vai** ("abre em fulano.lmflow.com.br"),
  e grupo de que não se sabe a imobiliária **não pode ser marcado**. Foi assim que
  o primeiro disparo quebrou: quem não tinha grupo cadastrado recebia um endereço
  fixo, o app da Leal Mídia, onde o cliente não tem conta — e tomava erro ao
  entrar. Destino invisível é destino que ninguém confere.

Armadilhas:

1. **O texto guardado tem VARIÁVEIS dentro, e é assim que ele é enviado.** Colar
   na caixa um texto já resolvido (com o link pronto) manda todos os clientes para
   o app de um só.
2. **A metade do backend é obrigatória.** O botão fala com o servidor da API
   (`lm-flow`, branch `saas-multitenant`); sem ela a janela abre vazia e não envia.
3. **A janela existe dentro da experiência de curso**, que é a mesma usada pela
   aba *Aulas* do Tutorial e pela tela cheia da Área de Membros. Mexeu ali, vale
   para as duas.

## Levar um funil de follow-up de um CRM pro outro (desde 2026-08-31)

O dono do produto pediu para montar UM funil — com foto, vídeo, áudio, figurinha
e texto — e plugá-lo em todos os clientes. Cada cliente é um CRM separado, então
não existe "o mesmo funil" visível de dois lugares: o que atravessa é um arquivo.

O que aparece na tela:

- **Botão *Exportar*, em cada funil** da tela de Follow-up (ao lado de *Histórico*
  e *Testar*). Ele baixa um arquivo com as mensagens, os tempos, as opções e **a
  mídia junto** — a foto, o vídeo, o áudio e a figurinha vão dentro do arquivo.
- **Botão *Importar funil*, no topo da mesma tela.** Escolhido o arquivo, abre uma
  janela que mostra o que vai entrar **antes** de criar qualquer coisa: o nome do
  funil, quantas mensagens, quantas mídias, quantas entradas e de qual cliente ele
  saiu. Só depois de confirmar é que o funil é criado.
- **No painel raiz, *Aplicar funil de follow-up nos clientes*** (o ícone ao lado
  do *Comunicado*). Escolhe a origem — um funil de qualquer cliente, ou um arquivo
  — marca os clientes de destino e aplica em todos de uma vez, com *criado* ou
  *falhou* em cada linha.

Decisões (não reabrir sem o dono pedir):

- **O funil chega DESLIGADO em todo cliente que recebe.** Quem liga é uma pessoa
  que abriu o CRM e leu as mensagens. As portas de entrada vêm junto, do jeito que
  estavam: com o funil desligado nada dispara, então sobra **uma chave só** a virar
  depois da conferência.
- **A prévia antes de importar é obrigatória**, pelo mesmo motivo da prévia do
  modelo pronto: o arquivo pode ter vindo de qualquer lugar, e ninguém deve
  descobrir o que entrou depois de já estar no CRM.
- **O que não coube vira lista, não silêncio.** Coluna que não existe neste
  cliente, mídia que não pôde ser trazida: tudo aparece numa janela própria no fim
  da importação — e no painel raiz, agrupado por cliente. Toast some antes de
  alguém anotar; isto é uma lista de coisas a fazer.
- **Nenhum cliente vem marcado no painel raiz.** O *Comunicado* marca todos porque
  aviso a mais é barulho; aqui cada marca cria um funil que alguém teria que
  apagar à mão se foi engano.
- **O cliente de origem nunca aparece como destino.**

Armadilhas:

1. **A metade do backend é obrigatória.** Exportar, importar e aplicar em massa
   falam com o servidor da API (`lm-flow`, branch `saas-multitenant`); sem ela os
   botões existem e não fazem nada.
2. **O arquivo é lido no navegador com `FileReader`, nunca com `File.text()`.**
   O segundo não existe em todo ambiente (nem no que roda os testes), e a falha
   dele é indistinguível de "arquivo corrompido" — o que manda a pessoa procurar
   problema no arquivo certo.
3. **O funil lido fica guardado, e o arquivo não é lido duas vezes.** Reler na
   hora de enviar é a chance de a prévia mostrar uma coisa e o envio mandar outra.
4. **O campo de arquivo é limpo a cada escolha.** Sem isso, escolher o MESMO
   arquivo de novo depois de cancelar não dispara evento nenhum e o botão parece
   morto.

## O bloco de Follow-up dentro do card (desde 2026-08-31)

Queixa do dono do produto: o card mostrava *"Ativar follow-up"* — desligado —
logo acima de uma linha do tempo com uma mensagem enviada e sete agendadas.

As duas metades do bloco liam fontes diferentes. O botão olhava a **etiqueta**
`follow-up` da conversa; a lista olhava a **fila de disparos**. A etiqueta é um
dos gatilhos de ENTRADA, não o estado: quem entra arrastando o card, ou pela
etiqueta de tráfego pago, nunca a recebe — e quem responde a perde, com a fila
ainda cheia. Fora isso, *Pausar* só punha outra etiqueta que ninguém lia, e
*Desativar* também: o lead seguia recebendo o que alguém tinha mandado parar.

O que aparece na tela hoje:

- **Selo do estado** — *Rodando*, *Pausado*, *Funil concluído* ou *Sem
  follow-up* —, o nome do funil, *"3 de 8 mensagens"* e a data da próxima.
- **Pausar, Retomar, Parar e Iniciar follow-up**, no lugar do antigo par
  ativar/pausar. *Retomar* avisa que os horários são empurrados pelo tempo
  parado, para ninguém esperar um despejo de mensagens vencidas.
- **Iniciar não aparece com funil rodando**: começar por cima cancela a fila e
  reagenda tudo. O caminho é *Parar* e começar. Com mais de um funil ativo, a
  tela pede qual.
- **Passos cancelados saem da lista**, atrás de um contador que os reabre. Lead
  re-enrolado acumulava fila cancelada e empurrava o que importa para baixo.

Decisões (não reabrir sem o dono pedir):

- **Estado, botões e linha do tempo são UM componente, com UMA fonte.** Enquanto
  o botão morava no painel do card e a lista aqui, as duas metades discordavam na
  cara do corretor. Não separar de novo.
- **Quais botões existem quem diz é o servidor**, não a tela. Botão que aparece e
  não faz nada é exatamente o que este bloco tinha.
- **A prévia troca `{{nome}}` pelo nome do lead — e é SÓ prévia.** Cru, o card
  mostrava "Oi {{nome}}, tudo bem?" e parecia mensagem quebrada. Quem substitui
  de verdade, no envio, é o servidor: montar a mensagem final aqui é o mesmo erro
  do exemplo de etiqueta do editor de funil, que passou a vir pronto do backend.
- **Erro de acesso aparece como erro de acesso.** Engolir o 403 e mostrar "sem
  passos de follow-up" era indistinguível de lead sem follow-up — e era o que
  corretor e gestor viam em cliente antigo, com a fila cheia.
- **O bloco não depende de haver conversa de WhatsApp.** Lead de formulário e de
  anúncio pode não ter uma, e o follow-up é do LEAD. O aviso *"disponível apenas
  para leads com conversa"* escondia o bloco de quem mais precisa dele.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o estado, os quatro comandos e as permissões
   reaproveitadas moram lá. Sem ela o bloco abre vazio.
2. **As permissões do servidor são REAPROVEITADAS de propósito** (as do quadro e
   as do card). Chave nova não chega a cargo que já existe, e era por isso que a
   linha do tempo subia 403 para corretor e gestor — só o administrador via.
3. **Estado novo do disparo precisa de rótulo aqui.** *Pausado* entrou junto com
   esta leva; se aparecer outro no servidor sem rótulo nesta tela, o selo do
   passo sai em branco. Mesma armadilha do estado das listas do Bolsão.
4. **Não voltar a derivar estado de etiqueta**, nem "só para não fazer uma
   chamada". É a origem dos quatro defeitos desta leva.

## A porta de entrada da Área de Membros (desde 2026-08-31)

A Área de Membros **não é um site separado**. Ela é uma tela dentro do app de
cada imobiliária, atrás do login de sempre — o que é compartilhado é só o
conteúdo das aulas. Por isso o link da aula muda de cliente para cliente.

Quem abre o link da aula num endereço que **não é de cliente nenhum** (o app da
Leal Mídia, o apex) via a tela de login e tomava erro: ali a conta dele não
existe. Era o "erro ao entrar na conta" relatado por quem clicou no aviso de
WhatsApp. Agora essa pessoa vê a **porta de entrada**: uma tela que pede o e-mail
de acesso, descobre o app da imobiliária dela e a encaminha para a MESMA aula lá
dentro. O aparelho lembra, então da segunda vez o link abre direto — com um
"não é você?" para trocar.

Decisões (não reabrir sem o dono pedir):

- **Não foi criado endereço novo.** A porta é o próprio endereço que os links já
  enviados usam, então todo link que já está nos grupos passou a funcionar
  sozinho, sem reenviar nada.
- **Quem decide "estou fora de um cliente" é o HOST aberto**
  (`getSubdomainSlug()` devolve null no apex e nos subdomínios reservados, `app`
  incluído), não uma variável de build. É o que faz a correção valer para
  qualquer link antigo.
- **Dentro do app de um cliente nada mudou**: quem não está logado continua indo
  para o login com o destino preservado.
- **Pede o e-mail, não mostra uma lista de imobiliárias.** A lista exporia a
  carteira de clientes para qualquer um que abrisse o link.

Armadilhas:

1. **A guarda geral do roteador (`RouterGuard`) roda ANTES das rotas** e manda
   para o login todo endereço que não esteja na lista de públicos. Foi ela que
   engoliu a porta de entrada na primeira tentativa: o `AcademiaRoute` nunca
   chegava a ser desenhado, e o link continuava caindo no login. Hoje há uma
   exceção estreita ali — `/academia` com host sem cliente — e um teste que
   reprova se ela sumir. Rota nova que precise ser vista por quem não tem conta
   NESTE endereço tem que passar por lá também.
2. **Quem manda para o login por último é o `RouterGuard`**, no efeito do PAI —
   depois do `<Navigate>` das rotas filhas. Um `/login` sem `returnUrl` ali APAGA
   o destino que `PrivateRoute`, `CustomerRoute` e `AcademiaRoute` acabaram de
   preservar: era por isso que quem abria o link da aula logava e caía na aba de
   conversas. Hoje ele leva o destino na query como os outros, e há teste.
3. A tela do "abrindo em..." fica ~1,6s no ar de propósito, com o "não é você?"
   à mostra. Sem essa pausa, quem usasse o aparelho de outra pessoa ficaria
   preso no app errado sem chance de trocar.

## Excluir cliente: paralisa antes de apagar (desde 2026-08-31)

O botão *Excluir definitivamente* devolvia um erro de banco na tela
("deadlock detected") e o cliente continuava na lista. O motivo é do servidor —
apagar o CRM do cliente exige que ninguém esteja usando aquele banco, e uma
mensagem chegando no WhatsApp dele no mesmo segundo já derrubava a exclusão.

O que mudou na tela:

- **A janela de confirmação avisa que o cliente é paralisado antes**
  (automações e webhooks desligados) e que, se a exclusão não terminar, ele fica
  em **Arquivados** para tentar de novo. Antes o texto só falava do apagar.
- **Quando a exclusão não conclui**, a janela fecha, a lista recarrega e o aviso
  fica mais tempo no ar. Manter a janela aberta com a lista velha fazia parecer
  que nada tinha acontecido — quando na verdade o cliente já tinha saído da lista
  ativa e ido para Arquivados.

Armadilha: **o cliente que "falhou ao excluir" NÃO está intacto** — ele está
paralisado, na aba Arquivados. Quem quiser desistir da exclusão religa pelo
*Reabrir*, e a lista volta pausada, como qualquer arquivado.

## A IA Vendedora responde em várias mensagens (desde 2026-08-31)

A IA mandava uma mensagem só, e quando se estendia o lead recebia um parágrafo
grande de uma vez. Agora ela responde em até 3 mensagens curtas, com
*digitando...* entre elas e uma pausa proporcional ao tamanho da próxima.

O que aparece na tela:

- **Chave *Responder em várias mensagens*** em *IA Vendedora → Configuração →
  Recepção inicial*, colada no campo *Tempo de espera antes de responder*. Os
  dois falam de ritmo: aquele é o tempo de ESPERA (juntar o que o lead mandou),
  este é o ritmo da RESPOSTA (espalhar o que a IA vai mandar). Separá-los faria
  procurar em dois lugares a mesma coisa.
- **Campo *No máximo quantas mensagens por resposta*** (2 a 4, padrão 3), que só
  aparece com a chave ligada.
- **A aba *Testar* empilha uma bolha por mensagem**, igual ao que o lead recebe.
- **Na caixa de conversas nada mudou** — ela já desenha uma bolha por mensagem, e
  passou a mostrar as mesmas que o lead viu, sem nenhuma alteração de código.

Decisões (não reabrir sem o dono pedir):

- **Estreia LIGADA em toda imobiliária.** A chave existe para DESLIGAR em quem não
  quiser, não para liberar aos poucos. Não é `clientToggleKey` nem `featureKey`:
  é campo do agente, não módulo — os scanners do catálogo de funcionalidades não
  entram nesta história.
- **Se o lead escreve no meio, a IA termina de mandar** e responde depois.
- **O teto de 4 não é enfeite.** Rajada de mensagens é a assinatura que mais faz o
  WhatsApp tratar um número como robô, e a abertura já manda print e áudio junto.

Armadilhas:

1. **Os dois campos PRECISAM estar na lista do `saveAgent`.** Ela monta o PATCH
   campo a campo, e o que não estiver ali é descartado sem erro nenhum: a tela
   mostra o valor, o toast diz *Salvo*, e nada foi salvo. É o que já acontece com
   os dois campos do book do imóvel.
2. **A aba *Testar* mostraria UMA bolha** se lesse só o texto inteiro da resposta.
   Quem ligasse a chave e testasse ali concluiria que não funciona — por isso ela
   lê a lista de mensagens, com o texto inteiro como reserva.
3. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a tela lê a chave e o teto de lá. Sem ela, a chave aparece
   no padrão e não guarda nada.

## Mensagem automática não leva nome de gente (desde 2026-08-31)

Queixa do dono do produto: o follow-up disparado sozinho aparecia na caixa de
conversas como se uma PESSOA tivesse escrito e mandado — o selo *Atendente* com o
nome de um corretor (na prática, o primeiro administrador da conta) ao lado.

A tela já sabia esconder esse nome desde que a mensagem chegasse marcada como
automática. O que faltava era do lado do servidor: a marca nunca era gravada.
Corrigido lá; aqui sobrou uma consequência de exibição.

O que mudou na tela:

- **Disparo automático aparece só como *Atendente*.** Vale para o follow-up, para
  as automações de lead e para o disparo agendado — a IA Vendedora já era assim.
- **O selo deixou de aparecer duplicado.** Sem nome, o texto de reserva ao lado do
  selo era a MESMA palavra dele, então a linha saía *"Atendente Atendente"*. Hoje,
  sem nome, fica só o selo.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem grava a marca de automática é o servidor. Sem ela a
   tela volta a mostrar o nome de quem não escreveu.
2. **Mensagem JÁ enviada continua mostrando o nome antigo.** A marca só existe nas
   mensagens novas; o histórico não é reescrito.
3. **Não voltar a derivar "quem escreveu" do autor gravado.** O autor de uma
   mensagem automática é um detalhe de como ela foi criada, não a assinatura dela.

## Aviso de permissão é para o CLIQUE (desde 2026-08-31)

Queixa do dono do produto: todo corretor que entrava no CRM levava uma sequência de
avisos vermelhos de permissão no canto superior direito, **sem ter clicado em nada**.

O servidor passou a conferir o cargo em TODA a API, e aqui qualquer recusa virava
aviso vermelho — inclusive a dos pedidos que a própria tela dispara sozinha para se
montar. Só de abrir o app, a busca dos *aplicativos do painel* (aqueles atalhos do
menu lateral, permissão que só o Administrador tem) já pintava um vermelho por cima
de uma tela que estava funcionando. Abrir uma conversa pintava mais dois.

Decisões (não reabrir sem o dono pedir):

- **Leitura recusada não grita.** Quando o cargo não alcança algo que a tela buscou
  sozinha, aquele pedaço simplesmente não aparece — é o que o app já faz com item de
  menu e com os blocos de gestão do dashboard.
- **Escrita recusada continua avisando.** Sem o aviso, o botão bloqueado "não faz
  nada" e vira chamado de suporte. Foi escolha explícita do dono.
- **A regra é por VERBO, num lugar só**, e não uma marca em cada chamada. O cargo
  Corretor é uma lista FIXA no servidor (o Gerente herda chave nova sozinho, ele
  não), então toda tela que ganha um botão nasce com uma chave que ele não tem —
  marcar chamada por chamada consertaria as de hoje e a próxima tela recriaria o
  problema.
- **As duas ações que a tela dispara ao abrir uma conversa** (marcar como lida e ler
  o estado da IA) foram consertadas no servidor, reaproveitando permissão que o
  Corretor já tem. Calá-las aqui deixaria a bolinha de não-lida voltando para sempre
  e o cabeçalho mentindo que a IA está desligada.

Armadilhas:

1. **Não voltar a emitir aviso em leitura de fundo**, nem "só nesta tela". É a
   origem exata do problema, e existe teste que reprova.
2. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`). Sem ela, marcar como lida continua recusado — calado, mas
   recusado.
3. **As guardas que perguntam antes** (se o cargo lê instâncias e equipes, no boot e
   no popup de filtros) continuam valendo: elas evitam a requisição inútil, não só o
   toast.
4. **Ainda há ~38 permissões que faltam no cargo Corretor** — silenciar conversa,
   marcar como não lida, ver anexos, prioridade, reenviar mensagem que falhou, mandar
   o book, anotação no card, prévia de resposta rápida, seletor de lead na visita, e
   o **Assumir lead** do modo leilão. Todas continuam recusadas; a diferença é que
   agora só avisam quando alguém clica. Ficou para depois, por decisão do dono.

## A IA Vendedora move o card no funil (desde 2026-09-01)

A IA já sabia, a cada mensagem, em que pé a conversa estava — e isso não saía da
conversa. O card ficava parado na coluna de entrada até alguém arrastar, então o
quadro mostrava "leads novos" que já tinham visita marcada.

O que aparece na tela:

- **Chave *Mover o card no funil***, em *IA Vendedora → Configuração*, logo abaixo
  de *Quem vai pro CRM*. As duas respondem à mesma pergunta — o que a IA faz
  dentro do CRM: a de cima decide quem entra, esta decide para onde vai depois.
- Ligada, ela pede **em qual funil** e, para cada momento da conversa
  (*Descobrindo o que o lead quer*, *Qualificando*, *Pronto para visita*,
  *Combinando dia e hora*, *Visita agendada*, *Passou pro corretor*), **qual
  coluna**. Momento em *— não mover —* é momento em que a IA não mexe no card.
- **No histórico do card, o movimento aparece como *Por: IA Vendedora***, com a
  coluna de onde saiu, para onde foi e o motivo.

Decisões (não reabrir sem o dono pedir):

- **Estreia DESLIGADA em toda imobiliária.** Cards andando sozinhos no quadro de
  quem nunca pediu é mudança de comportamento por efeito de deploy.
- **Quem escolhe a coluna é o gestor, não a IA.** Cada imobiliária batiza as
  colunas do jeito dela; deixar a IA adivinhar pelo nome faria o card parar de
  andar em silêncio no dia em que alguém renomeasse uma coluna.
- **A IA só empurra o card pra frente.** Se o corretor já levou o lead para uma
  coluna mais adiantada, ela não puxa de volta — senão ele arrastaria o mesmo card
  todo dia. A tela diz isso embaixo do mapa, porque é a primeira dúvida de quem
  liga a chave.
- **Trocar o funil limpa o mapa.** As colunas escolhidas são de outro funil e o
  servidor as recusaria uma a uma: o gestor veria as escolhas guardadas e nenhum
  card andando.

Armadilhas:

1. **Os campos PRECISAM estar na lista do `saveAgent`.** Ela monta o PATCH campo a
   campo, e o que não estiver ali é descartado sem erro nenhum: a tela mostra o
   valor, o toast diz *Salvo*, e nada foi salvo. O mapa entra com `in` e não com
   `??` — tirar a última coluna deixa o mapa vazio, que é escolha legítima.
2. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a chave, o mapa e quem move o card moram lá. Sem ela a
   chave aparece no padrão e não guarda nada.
3. **O histórico do card mostra só as TRÊS primeiras informações da linha.** Foi
   por isso que o servidor passou a mandar *De / Para / Por* antes do nome do
   funil — com o funil na frente, o "Por" caía fora e a linha não dizia quem
   moveu.
4. **Não é `featureKey` nem `clientToggleKey`**: é campo do agente, não módulo. Os
   scanners do catálogo de funcionalidades não entram nesta história.

## O follow-up da IA sem gastar IA (desde 2026-09-01)

Cada cutucada de follow-up escrita pela IA é uma chamada paga ao modelo, e a
cadência nasce infinita: o lead que nunca mais responde custa a cada 2 ou 3 dias,
pra sempre. As mensagens do funil de follow-up já estão escritas e custam zero.

O que aparece na tela, em *IA Vendedora → Configuração → Follow-up automático*:

- **Um bloco novo, *Quando o lead sumir***, com três opções:
  - **A IA escreve a mensagem** (como sempre foi, e a única que consome IA);
  - **Mover o card para uma coluna** — a IA leva o card e sai de cena; quem manda
    a mensagem é o funil que aquela coluna dispara;
  - **Disparar um funil pronto** — coloca o lead no funil escolhido sem mexer no
    card, pra quem não usa o quadro.
- Na opção do card, dois seletores: **Coluna para o lead que sumiu** e **Quando ele
  voltar a responder, o card vai para** (que já vem em *Primeira coluna do funil*).
- **O teto de follow-ups some** nas duas opções sem IA: entregando ao funil ela age
  uma vez e sai; quem tem número de mensagens dali em diante é o funil.
- O texto ao lado dos dias muda junto: com IA é *"espera um tempo aleatório entre
  cada follow-up"*; sem IA é *"quanto tempo de silêncio até entregar o lead"*.

Decisões (não reabrir sem o dono pedir):

- **Estreia em "A IA escreve"**, que é como sempre funcionou. Qualquer outro padrão
  mudaria o comportamento de quem já tem follow-up ligado por efeito de deploy.
- **As colunas saem do funil já escolhido em *Mover o card no funil***, logo acima
  no mesmo painel. Um segundo seletor de funil aqui criaria duas verdades sobre
  onde a IA age no quadro, e trocar um sem o outro deixaria o card num funil e a
  coluna no outro. Sem funil escolhido, o bloco aponta pra lá em vez de mostrar
  uma lista vazia.
- **A tela avisa que a coluna precisa ter entrada de funil** (*Card entrou numa
  coluna*, em Automações → Follow-up). Sem ela o card muda de lugar e ninguém fala
  com o lead — e isso é indistinguível de "quebrou".
- **A trava "a IA só empurra o card pra frente" fica escrita ali**, porque é a
  primeira dúvida de quem escolhe uma coluna do meio do funil.
- **Não é `featureKey` nem `clientToggleKey`**: é campo do agente, não módulo. Os
  scanners do catálogo de funcionalidades não entram nesta história.

Armadilhas:

1. **Os quatro campos PRECISAM estar na lista do `saveAgent`**, e as três colunas/o
   funil entram com `in`, não com `??`: limpar a escolha manda `null`, e o `??`
   trocaria o null pelo valor antigo — a tela mostraria "não escolhido", o toast
   diria *Salvo*, e o servidor continuaria com a coluna velha.
2. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a escolha, o movimento do card e a devolução moram lá. Sem
   ela a opção aparece no padrão e não guarda nada.
3. **A opção de funil lista só os ATIVOS.** Funil desativado escolhido aqui viraria
   um follow-up que não dispara nada, calado — o servidor recusa e o motivo aparece
   no Diagnóstico, mas a tela nem deve oferecer.

## O follow-up vai aos poucos (desde 2026-09-01)

Antes de ligar o follow-up sem IA nos clientes, apareceu a conta: a varredura de
lead calado não tem data de corte. Ligar a chave num cliente que já roda há meses
deixa todo lead parado dos últimos 120 dias vencido no mesmo instante — dava mais
de mil mensagens por hora saindo do mesmo número, que é como o WhatsApp derruba um
número. E os limites da aba Limites não valem para o follow-up.

O que aparece na tela, dentro de *IA Vendedora → Configuração → Follow-up
automático*:

- **Chave *Ir aos poucos, como gente***, logo abaixo do bloco *Quando o lead sumir*.
- Ligada, uma frase editável: **"Pega de 2 a 3 leads por vez, esperando de 3 a 5
  minutos entre um e outro."** Os quatro números são campos.
- **A conta de padeiro embaixo**: *"dá cerca de N leads por dia, das 9h às 20h"*,
  recalculada enquanto o gestor digita.
- Desligada, um aviso em âmbar do que acontece: até 200 leads entregues de uma vez.

Decisões (não reabrir sem o dono pedir):

- **Estreia LIGADA em toda imobiliária.** Exceção consciente à regra da casa, a
  mesma da quebra de mensagem: ir aos poucos só atrasa entrega, nunca manda mais.
  A chave existe para DESLIGAR em quem quiser o comportamento antigo.
- **A espera é SORTEADA dentro da faixa, não fixa.** Ritmo certinho denuncia robô
  tanto quanto rajada — e é por isso que a tela pede uma FAIXA e não um número.
- **A conta de padeiro não é enfeite.** Sem ela o gestor escolhe "2 a 3 leads a
  cada 3 minutos" achando que é pouco, quando são ~400 leads por dia num número só.

Armadilhas:

1. **Os cinco campos PRECISAM estar na lista do `saveAgent`.** Entram com `??`
   (nenhum deles é limpável para null), diferente das colunas do bloco de cima.
2. **A chave é lida com `!== false`**, e não `=== true`: cliente cuja coluna ainda
   não chegou do servidor precisa aparecer LIGADO, senão a tela mostra desligado e
   o gestor "liga" algo que já estava ligado.
3. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem goteja é o relógio do servidor.
4. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente, não módulo.

## A IA aponta melhorias e manda o relatório da semana (desde 2026-09-01)

Duas abas novas dentro de *IA Vendedora*: **Sugestões** e **Relatórios**. Estreiam
invisíveis e são liberadas imobiliária por imobiliária.

**Sugestões** — a IA relê as conversas que ela atendeu e aponta o que se repete:
a objeção que derruba lead, a pergunta que ela não soube responder, onde a conversa
morre. Botão *Analisar agora* com período de 7/30/90 dias, e uma chave opcional de
rodar sozinha toda semana. Cada sugestão é um cartão com selo de categoria, o que a
IA observou, **em quantas conversas** aquilo apareceu e as frases reais como prova.

**Relatórios** — o resumo da semana em dois blocos (o que a IA entregou e o que o
time fez), o texto que vai no WhatsApp editável antes de mandar, os destinos, o
botão *Enviar agora* e a chave de *Enviar toda semana*. Sai pelo número operacional
da Leal Mídia.

Decisões (não reabrir sem o dono pedir):

- **Quem decide se existe o botão *Aplicar* é o SERVIDOR**, não a tela. Sugestão
  sobre o time mostra o selo *Recado para o time* e **não desenha o botão**: a lição
  é injetada no comando da IA, e um recado de time virando lição faria ela repetir
  *"o corretor demora a responder"* para o **lead**.
- **A análise roda no botão**, e a chave de automático nasce desligada: cada análise
  é uma consulta paga.
- **O rodapé mostra quantas lições a IA tem ativas contra o teto que ela de fato lê.**
  Sem isso, quem aplica trinta sugestões e não vê nada mudar conclui que a
  funcionalidade não funciona — quando é o comando dela que só comporta as mais
  recentes.
- **A aba Relatórios NÃO recebe o agente.** O relatório é do cliente e é o mesmo em
  qualquer IA que você abrir; duas IAs no mesmo cliente fariam o gestor receber a
  semana duas vezes.
- **Prévia e envio são a mesma coisa.** O texto que você leu e editou é o que sai no
  WhatsApp. Relatório já enviado não é editável — o que está ali é o que chegou.
- **A contagem de destinos fica DENTRO do botão Enviar.** Disparo em grupo de cliente
  é irreversível; o número precisa estar embaixo do dedo. Depois do envio, cada
  destino mostra se recebeu ou falhou, com o motivo.
- **Semana FECHADA** (segunda a domingo anteriores), para uma semana poder ser
  comparada com a outra.

Armadilhas:

1. **A chave `ia_insights` vai LITERAL na chamada do `useClientToggle`.** Os dois
   scanners do catálogo varrem o código por regex: trocar o literal por uma constante
   tira a chave do catálogo no deploy seguinte, o painel de Funções deixa de oferecer
   o botão de liberar, e ninguém é avisado. Mesma armadilha das Landings.
2. **`useFeature` e `useClientToggle` são OPOSTOS.** `useFeature` = ausência LIGA;
   `useClientToggle` = só liga com `true`. Trocar um pelo outro estreia as duas abas
   para todo cliente — e aqui isso gasta IA paga e manda mensagem.
3. **O gate fica na ABA, nunca na rota.** Quem digita o endereço alcança a tela — é o
   padrão da casa (`/bolsao`, `/ia-vendedora`, as Landings).
4. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`). O auditor do catálogo **quebra o build** enquanto
   `ia_insights` não existir no catálogo servido pela API — então o merge aqui só
   depois de o backend estar no ar. Foi exatamente o que aconteceu no primeiro build
   deste PR, e o auditor estava fazendo o trabalho dele.

   ⚠️ E o sincronizador **não roda neste projeto Vercel**: falta o token, então todo
   build loga `LM_FLOW_SYNC_TOKEN não configurado neste projeto Vercel — pulando
   sync` e segue. Isso travou a estreia destas abas por um dia: a cópia do catálogo
   no servidor estava congelada desde 26/08 e substituía o arquivo versionado, então
   chave nova não entrava de jeito nenhum. **Desde 2026-09-01 o arquivo do servidor é
   PISO** e a chave nova entra sozinha — ver *"Nenhuma funcionalidade nova conseguia
   estrear"* no CLAUDE.md do `lm-flow`. Configurar o token continua valendo, para a
   cópia seguir refletindo o menu real; os dois se somam.

5. **Nenhum campo novo passa pelo `saveAgent`.** A chave da análise automática e a
   configuração do relatório têm endpoints próprios, de propósito: campo fora daquela
   lista campo-a-campo é descartado em silêncio — a tela mostra o valor e o aviso diz
   *Salvo*.
6. **Só o grupo DESTA imobiliária aparece na lista de destinos.** Quem filtra é o
   servidor; a tela nunca recebe a lista completa. A lista inteira ali entregaria a
   carteira de clientes da Leal Mídia para qualquer imobiliária que abrisse a aba.
7. **Leitura de fundo não grita.** As duas abas buscam sozinhas ao abrir; recusa ali
   só esconde o pedaço. Quando a pessoa clicou, o motivo em português vem do servidor.

## Botão que chama a IA não espera a IA (desde 2026-09-02)

No primeiro clique em *Analisar agora*, na estreia das abas da IA, deu **"Não
consegui analisar agora"** — que é o texto de reserva DESTA tela, não uma
explicação do servidor.

A causa é do servidor e está contada por lá: ele derruba qualquer requisição que
passe de 15 segundos, e a IA lê as conversas em 30 a 90. Requisição derrubada assim
volta **sem motivo dentro**, então a tela mostrava a frase genérica como se fosse o
diagnóstico — e mandava procurar o problema no lugar errado.

O que mudou na tela:

- **O botão agora acompanha.** Ele começa a análise e fica em *Analisando...*
  perguntando ao servidor de 4 em 4 segundos até terminar. Só então aparece
  "N sugestão(ões) nova(s)", "Nenhum padrão novo desta vez", ou o motivo real.
- **O mesmo vale para *Gerar prévia*** na aba Relatórios: montar o texto também é
  uma consulta à IA e estava na mesma parede.
- **Erro de cargo passa a aparecer como erro de cargo.** A API tem dois formatos de
  resposta de erro e esta tela só lia um; "seu cargo não permite esta ação" chegava
  como a frase genérica.

Decisões (não reabrir sem o dono pedir):

- **Quem diz se terminou é o servidor**, não um cronômetro na tela.
- **A espera tem teto** (~4 min na análise, ~2 min na prévia) só como rede para o
  servidor que reinicia no meio. Passando disso, a tela pede para recarregar em vez
  de girar para sempre — a reserva do lado de lá expira sozinha em 10 minutos.
- **Oscilação de rede no meio da espera não cancela nada.** O trabalho continua no
  servidor; a tela tenta de novo no ciclo seguinte, calada.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem enfileira e quem responde "ainda estou rodando" mora
   lá. Sem ela, o botão volta na hora dizendo que terminou sem ter feito nada.
2. **Botão novo que dispare consulta à IA nasce com o mesmo problema.** Se a ação
   pode passar de 15 segundos, ela não cabe numa requisição — precisa da mesma
   mecânica de começar e acompanhar.
3. **Não voltar a ler só `error.message`** ao mostrar o motivo de uma falha: é isso
   que faz a recusa por cargo virar frase genérica.

## O follow-up da IA ganhou horário próprio (desde 2026-09-02)

Preocupação do dono do produto: *"imagina eu deixar lá 24h, o follow-up vai
começar a mandar sempre 2 da manhã pra um lead mensagem, aí não dá"*.

O medo estava certo, o diagnóstico não: o follow-up **já** tinha horário — 9h às
20h —, só que ele era fixo no servidor. **Ninguém escolhia e ninguém via.** Ele
também não olhava dia da semana: domingo 9h da manhã saía cutucada igual a terça.
E a chave *"Seguir também o horário de atuação"* nunca funcionou — o servidor não
devolvia o valor, então ela marcava, salvava e **reabria desmarcada**, sem jeito
de desmarcar de volta.

O que aparece na tela, em *IA Vendedora → Configuração → Follow-up automático*:

- **Bloco *Quando o follow-up pode sair***, entre *Quando o lead sumir* e *Ir aos
  poucos, como gente*. Ordem de leitura: primeiro o que a IA faz, depois quando
  ela pode fazer, e só então o ritmo — cuja conta de padeiro cita a janela logo
  acima.
- **Faixa de horário e dias da semana**, no mesmo editor de pílulas do *Horário de
  atuação* e da *Roleta*. Aceita mais de uma janela (a pausa do almoço) e a que
  vira a meia-noite.
- **Link *Aplicar o padrão (09h às 17h, seg a sáb)***.
- **A chave *"Seguir também o horário de atuação"* sumiu.** Virou o próprio
  horário.
- **A conta *"dá cerca de N leads por dia"* passou a citar a janela real.** Antes
  dizia sempre "das 9h às 20h" e calculava em cima de 11 horas fixas, mesmo com
  outro horário configurado.

Decisões (não reabrir sem o dono pedir):

- **O bloco NÃO tem chave de liga/desliga.** A faixa sempre existe. Um toggle
  criaria o terceiro estado ("desligado = 24h? = padrão?") que esta tela veio
  matar.
- **A faixa escolhida MANDA.** Não há piso por baixo no servidor: configurou
  madrugada, sai de madrugada. É escolha explícita do dono — a alternativa
  produziria o pior defeito possível, a tela mostrando um horário e o follow-up
  saindo em outro.
- **Padrão de fábrica 09h às 17h, de segunda a sábado**, com os dias marcados de
  verdade nas pílulas. Domingo calado.
- **A tela avisa que são DOIS relógios** nos modos *Mover o card* e *Disparar um
  funil pronto*: este horário decide quando a IA **entrega** o lead; as mensagens
  dali em diante saem no horário do **funil** (a chave *Só enviar em horário
  comercial*, em Automações → Follow-up, que continua com janela fixa e
  invisível). Sem esse aviso, "configurei madrugada e a mensagem saiu de manhã"
  parece defeito.

Armadilhas:

1. **`followup_hours` PRECISA estar na lista do `saveAgent`**, com `??` e não com
   `in`: ele nunca é limpável — o servidor devolve sempre resolvido e o editor
   garante ao menos uma janela. Vazio ali não é escolha, é o padrão de fábrica.
   (Diferente das colunas do bloco de cima, onde `null` significa "não escolhi
   coluna nenhuma".)
2. **O `idPrefix` do editor é `fu_win`, nunca `ia_win`.** O *Horário de atuação*
   usa esse último e as duas seções vivem na MESMA aba — prefixo repetido faz o
   rótulo *Das* de uma focar o campo da outra.
3. **`00:00`–`00:00` não é 24 horas, é NADA** — o intervalo é `[início, fim)` e o
   servidor fecha o dia inteiro. A tela mostra aviso em âmbar no lugar da conta de
   padeiro quando isso acontece; sem ele, "configurei e o follow-up parou" vira
   chamado de suporte com a configuração parecendo certa. O dia inteiro se escreve
   `00:00` às `23:59`.
4. **A janela sai de um arquivo só** (`src/features/salesAgents/followupHours.ts`).
   Ela estava escrita TRÊS vezes — o texto "das 9h às 20h", a descrição da chave
   de horário e um `11 * 60` dentro do cálculo. Bastava mudar uma para o gestor
   ler um horário e receber a conta de outro.
5. **O padrão de fábrica da tela tem que bater com o do servidor.** Divergir faz a
   tela mostrar um horário e o follow-up sair em outro, calado, em todo cliente
   que ainda não salvou o campo.
6. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a coluna, o padrão e quem obedece ao horário moram lá. Sem
   ela o bloco aparece no padrão e não guarda nada.
7. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente, não módulo. Os
   scanners do catálogo de funcionalidades não entram nesta história.
## Roleta: o aceite define o responsável (desde 2026-09-03)

O dono do produto quer que o lead só vire do corretor quando ele ACEITA: o
sorteio cria o card sem dono, oferta com prazo, e é o aceite que grava o
responsável e leva o lead para o número dele — "um corretor, um número". A
mecânica mora no servidor (ver o CLAUDE.md do `lm-flow`); aqui está o que a
tela ganhou, em quatro fases num PR só (#300) para testar tudo de uma vez.

O que aparece na tela:

- **Selo *Aguardando seu aceite · N min* com *Aceitar* / *Recusar*** onde o lead
  aparece para o corretor ofertado: no card do funil (no lugar do responsável,
  que ainda não existe), na linha da lista (no lugar de *Sem responsável*), no
  card aberto (acima de *Roleta de atendimento*) e na conversa (no lugar da
  faixa do Leilão). Só quem tem oferta em aberto vê; para os outros, nada muda.
  A faixa amarela do topo continua, lendo da mesma lista.
- **A tela de aceite diz o que o aceite faz**: "você vira o responsável e o
  atendimento sai pelo seu número".
- **Cada número da roleta é *Exclusivo* ou *Compartilhado***, gravado. Na roleta
  de um número só, dois botões abaixo do seletor da instância; na de vários
  números, um botão por linha (*Exclusivo · 1 corretor* / *Compartilhado*). Os
  dois cartões da criação (*Número compartilhado* / *Um número por corretor*)
  viraram atalho que grava a marca de cada número. O atalho *+ Criar roleta* do
  card deduz do que foi marcado (mais de um corretor = compartilhado).
- **O peso do número saiu.** A roleta sorteia entre os corretores pelo peso de
  cada um; a *Distribuição real* é a fatia do corretor entre todos os ativos.
  O texto do bloco de números explica: exclusivo entrega direto, compartilhado
  sorteia entre os corretores daquele número.
- **A conferência "número exclusivo com dois corretores"** barra o salvamento
  com a mesma frase do servidor: "marque-o como compartilhado".
- **A tela da roleta deixou de oferecer quem só tem acesso automático** ao
  número; *Liberar e adicionar* não promove mais os acessos automáticos.

Decisões (não reabrir sem o dono pedir):

- **Uma lista de ofertas para o app inteiro** (`PendingOffersContext`, montado no
  layout principal): a faixa, o card, a lista, o card aberto e a conversa
  perguntam "tenho oferta para este lead?" a UMA resposta.
- **O casamento oferta↔lead é pelo CONTATO primeiro** (`pendingOffersMatch.ts`),
  porque o lead de formulário/anúncio não tem conversa.
- **Aceitar/Recusar reaproveitam as duas chamadas da tela de aceite.** Não existe
  segunda porta.
- **Sem oferta minha, a conversa sem dono mostra a faixa do Leilão** como antes
  (`fallback` do `OfferActions`).
- **Sem chave de funcionalidade no front.** A UI deriva das ofertas pendentes e
  vale nos dois modos; o interruptor do fluxo novo é do servidor e do painel
  raiz (`roleta_aceite_define_dono`, ausente = ligado).
- **`shared` é campo da instância, não módulo**: nem `featureKey` nem
  `clientToggleKey`; os scanners do catálogo não entram nesta história.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`). Sem ela: o selo não casa com o card do lead de
   formulário, e a marca exclusivo/compartilhado é descartada (o servidor
   antigo não conhece `shared`).
2. **`shared` vai SEMPRE no payload da instância.** Chave ausente faz o servidor
   deduzir pela contagem de corretores (regra de compatibilidade para tela
   antiga) — a escolha do gestor só vale se viajar.
3. **O prazo mostrado é medido no aparelho contra o `deadline` do servidor**
   (`minutesLeft`), não o `minutes_remaining` que chegou.
4. **Os cliques do selo param a propagação**: o card inteiro é clicável.
5. **`usePendingOffers` funciona sem provider** (lista vazia, nada desenhado).
6. **`auto_granted` na lista de membros separa explícito de automático.**
   `instanciasComAcesso` ignora `auto_granted === true`.
7. **A marca padrão de um número NOVO depende de onde ele nasce**: o número
   único da roleta nasce compartilhado; a linha adicionada em *Números que
   atendem* nasce exclusiva; os cartões da criação regravam todas as linhas.
   Roleta antiga que chega sem instâncias deduz pela contagem de corretores.

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
