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
- **Número exclusivo tem UM corretor atendendo** (regra do dono, 2026-09-03).
  Quem fica com um lead parado no número exclusivo de outro não ganha acesso ao
  número alheio: a conversa é movida para o número dele, no servidor. Por isso
  a tela de *Colaboradores* de um número exclusivo deve ter só o dono marcado —
  e o acesso automático que já existia nesses números some sozinho nos eventos
  seguintes; o explícito só sai na mão.

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

## A janela de Funções ficou organizada por tema (desde 2026-09-03)

O dono do produto, montando o CRM de um cliente novo: *"podíamos dar uma
organizada nesse menu de funções, separar por tema cada chave pra ficar menos
confuso"*. Eram ~60 interruptores um debaixo do outro, sem título nenhum
separando — *Dashboard*, *Conversas*, *Enviar áudio*, *Emoji*, *Template
WhatsApp*, tudo na mesma pilha.

O que aparece na tela (painel raiz → Clientes → **Funções**):

- **Sete temas recolhíveis**: *Visão geral*, *Atendimento*, *Funil e vendas*,
  *Imóveis*, *Automações e IA*, *Site e captação* e *Extras e configurações*.
  Cada um mostra **"N de M"** ligadas antes de ser aberto.
- **Dentro do tema, um bloco por menu do CRM**: o interruptor do menu vem
  destacado com o selo **menu inteiro** (desligar esconde o menu todo do
  cliente) e as funções daquele menu ficam indentadas abaixo dele.
- **Ligar tudo deste tema / desligar tudo**, dentro de cada tema.
- **Busca no topo**: filtra pelo nome que aparece na tela e também pelo nome
  técnico da chave, e abre sozinha os temas com resultado.

Decisões (não reabrir sem o dono pedir):

- **Quem decide o tema é o SERVIDOR** (`lm-flow`, branch `saas-multitenant`). A
  tela tem um mapa de reserva só para a janela de deploy em que o servidor ainda
  é o antigo — sem ele, o painel voltaria a ser lista corrida logo depois de
  publicar, que é o pior momento para isso.
- **Nada some por causa da arrumação.** Chave de um menu que ninguém mapeou cai
  em *Outras funções*, no fim; função que aponta para um menu inexistente entra
  solta no fim do tema. Interruptor escondido é funcionalidade que ninguém
  consegue liberar para o cliente — bem pior que interruptor fora de lugar.
- **Temas recolhidos por padrão.** Aberto tudo é a parede que esta leva veio
  desfazer; o contador de ligadas responde a pergunta do dia a dia ("liguei o
  Bolsão para esse cliente?") sem precisar abrir.
- **As duas telas de Funções usam a MESMA arrumação** (o painel raiz e a janela
  do painel de Instâncias). Cada uma com a sua viraria duas verdades sobre onde
  uma função mora.
- **Ligar/desligar um tema inteiro é UMA requisição**, não uma por interruptor:
  rede caindo no meio deixaria o cliente meio ligado.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o tema de cada chave mora lá. Sem ela, valem os temas de
   reserva desta tela — e chave nova que o servidor antigo não conhece aparece em
   *Outras funções*.
2. **As chaves escritas no mapa de temas NÃO são gate de funcionalidade.** Os dois
   scanners do catálogo só enxergam `featureKey:`, `clientToggleKey:`,
   `useFeature('...')` e `useClientToggle('...')` — nenhuma linha daquele arquivo
   entra nem sai do catálogo. Não trocar a forma dessas chamadas por lá.
3. **Tema novo no servidor sem rótulo aqui** aparece com o nome técnico
   "humanizado" e vai para o fim da lista. Mesma armadilha do estado das listas do
   Bolsão: quando o servidor ganhar um tema, o rótulo e a ordem dele entram aqui.

## O roteiro da conversa da IA virou tela (desde 2026-09-03)

Queixa do dono do produto: a IA repetia *"você tá procurando pra você e sua família
morarem, ou é mais um investimento?"* no meio da conversa, **mesmo depois de ele ter
configurado diferente em todos os campos que a tela oferecia**.

A pergunta tinha **cinco fontes** e só uma era editável — o campo *Pergunta de
intenção*, em Recepção inicial, que muda a REDAÇÃO e não a existência dela. As outras
quatro viviam dentro do servidor, sem tela nenhuma: a ordem da abertura (*"é a
pergunta mais importante, sempre faça ela"*), o roteiro que ramifica em
moradia/investimento/sondando **em todo turno**, o método consultivo que a traz
literal, e a ficha que a IA preenche a cada resposta.

Ampliando: o comando da IA tem ~32 blocos, ~10 deles texto fixo sem tela. E ele **não
é neutro** — assume lançamento na planta ("empreendimento", "plantão", "decorado",
visita como ápice sempre). Quem vende usado, loteamento ou locação rodava o roteiro
errado.

O que aparece na tela:

- **Seção *Roteiro da conversa***, em *IA Vendedora → Configuração*, logo abaixo de
  *Recepção inicial* — e ali de propósito: é onde mora a redação da pergunta, e o
  seletor que decide SE ela existe tem que estar perto dela. Separados, a pessoa muda
  um e procura o outro em outro lugar.
- No topo dela, **Perguntar se é moradia ou investimento**: *Sempre* / *Só na
  abertura* / *Nunca*. Governa as cinco fontes de uma vez.
- Abaixo, os blocos do comando, cada um já preenchido com o padrão da casa e com selo
  *reescrito* + *Voltar ao padrão* onde alguém mexeu.
- **Aba *Princípios*** no painel raiz, dentro de *IA Vendedora*: as regras que valem
  em toda imobiliária. Editadas ali, valem em todos os clientes.

Decisões (não reabrir sem o dono pedir):

- **ROTEIRO é do cliente, PRINCÍPIO é da Leal Mídia, e são duas telas diferentes.**
  Misturar faria uma melhoria de método sobrescrever a peculiaridade de uma
  imobiliária, e vice-versa. O servidor recusa princípio para chave de roteiro.
- **Estreia FECHADA** (`ia_playbook`), liberada imobiliária por imobiliária: quem
  reescreve um bloco muda como a IA atende TODOS os leads daquele cliente. É a
  configuração de maior alcance do produto. A Leal Mídia sempre vê.
- **Campo em branco VOLTA AO PADRÃO, nunca "desliga"** — a doutrina de toda a
  plataforma. Gravar texto vazio tiraria o bloco do comando, e uma IA sem "regras
  invioláveis" é pior do que uma com as de fábrica.
- **Trocar o modo RECARREGA os blocos.** O modo muda o texto de fábrica de cinco
  deles; sem recarregar, a tela seguiria mostrando o roteiro do modo anterior como se
  fosse o que a IA recebe — a divergência que a seção veio acabar.
- **O modelo de roteiro (escolher de qual partir na criação da IA) fica para depois**,
  e será PONTO DE PARTIDA — cópia na criação, não herança viva.

Armadilhas:

1. **`playbook` entrou na lista campo-a-campo do `saveAgent` com `in`, não com `??`.**
   Objeto vazio é escolha legítima ("voltei tudo pro padrão"), e o `??` o trocaria
   pelo valor antigo. Há spec que reprova as duas coisas.
2. **A chave do gate vai LITERAL na chamada do `useClientToggle`.** Os dois scanners
   do catálogo varrem por regex; uma constante tiraria a chave do catálogo no deploy
   seguinte, calada. Mesma armadilha das Landings. Spec reprova.
3. **Leitura de fundo NÃO grita**: falha ao carregar o roteiro esconde a seção, não
   pinta toast vermelho.
4. **A tela de Princípios lê os DOIS formatos de erro da API** — o padrão
   (`error.message`) e a recusa por cargo (`error` como texto). Ler só o primeiro faz
   a recusa virar frase genérica.
5. **O componente do roteiro mora em arquivo próprio.** A tela do cliente já tem
   ~4.800 linhas e 45 componentes num arquivo só.
6. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`,
   `saas-multitenant`): as três camadas, a chave e os endpoints moram lá. E o auditor
   do catálogo REPROVA este build enquanto `ia_playbook` não existir no catálogo
   servido pela API — foi o que aconteceu aqui, e ele estava fazendo o trabalho dele.

## Os pontos-chave da venda: a IA vira a SUA IA (desde 2026-09-04)

Depois de a seção *Roteiro da conversa* subir, o dono do produto apontou o que
faltava: *"o modelo deve ter a fundação da venda consultiva implantada, mas as
variáveis vão precisar existir e serem consideradas pro agente ser de fato
personalizado"*. O método da casa não tinha um encaixe sequer — todos os exemplos
eram texto fixo, inclusive *"tá procurando pra morar ou investir?"* — e o que a
imobiliária preenchia em *Perguntas de qualificação* entrava em OUTRO lugar do
comando, numa segunda lista. A IA recebia os dois e escolhia.

O que mudou na tela, em *IA Vendedora → Configuração → Roteiro da conversa*:

- **Bloco *Pontos-chave da venda***, logo abaixo do seletor de moradia/investimento:
  *Tipo de venda*, *Próximo passo que a IA busca*, *Perguntas que seus corretores
  fazem primeiro* (uma por linha), *O que dói no seu cliente-tipo*, *Quando o lead
  está pronto pro próximo passo*, e *Objeções e como vocês respondem* (lista de
  pares, com as seis de fábrica como referência). É o caminho NORMAL de
  personalizar. Cada campo entra no lugar de um exemplo de fábrica DENTRO do
  método; vazio = o exemplo da casa.
- **Os blocos do comando passaram a ser mostrados como a IA vai LER** (com os
  pontos-chave já no lugar), em leitura. O botão *Reescrever* abre o texto cru,
  com as pílulas do que aquele bloco aceita entre chaves.
- **Marcador que o bloco não aceita é recusado ao salvar**, com o motivo vindo do
  servidor no aviso — antes ia literal para a IA (`{termo_imovel}` como texto).
- **A aba *Princípios* do painel raiz lista os TREZE blocos**, em dois grupos: *O
  alicerce da venda* (o método, a condução, as objeções, a visita) e *Regras da
  casa*. Editado ali, vale em todo cliente; os encaixes ficam à mostra porque
  apagar um tira o ponto-chave de TODO cliente.
- **Conserto que veio junto:** a seção e as abas *Sugestões/Relatórios* ficavam
  escondidas da própria Leal Mídia sem a chave ligada, ao contrário do que o
  comentário e este arquivo diziam. Agora é `isSuper || useClientToggle(...)`,
  como a aba de Landings. Há spec.

Decisões (não reabrir sem o dono pedir):

- **Os pontos-chave viajam DENTRO do `playbook`** (`vars`), pelo mesmo campo que já
  entra no `saveAgent` com `in`. Nada novo na lista campo-a-campo — e por isso
  mesmo há spec que reprova quem os mover para campo solto.
- **Tipo de venda e próximo passo em `lancamento`/`visita` NÃO são gravados**: são o
  padrão de fábrica, e gravar o padrão faria a tela mostrar "escolhido" onde nada
  foi escolhido.
- **A lista de objeções vazia mostra as seis de fábrica pelo nome**, não um campo
  em branco: campo em branco parece "sem objeção nenhuma", e a IA continua com as
  seis.
- **O texto resolvido vem do servidor.** A tela não monta o comando; mostrá-lo
  montado aqui seria a divergência que a seção veio acabar.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`,
   `saas-multitenant`): o `GET playbook` novo devolve `resolved`, `allowed_markers`,
   `vars` e `slot_defaults`. Contra o servidor antigo, a seção abre com os blocos em
   branco e sem os pontos-chave.
2. **`commitVars` limpa antes de comparar.** Sem isso, sair de um campo sem mudar
   nada gravaria o mesmo hash e recarregaria a seção — e apagar a última objeção
   deixaria `objecoes: []` no banco em vez de tirar a chave (que é o que significa
   "voltei às de fábrica").
3. **O `resolved` de cada bloco é `<pre>` com `whitespace-pre-wrap`**, não Textarea
   desabilitada: o texto tem recuo que importa (as camadas do SPIN) e o campo
   precisa ser visivelmente de leitura.
4. **Objeção sem resposta (ou vice-versa) some ao salvar** — o servidor descarta o
   par incompleto. A tela deixa escrever pela metade, mas não grava.

**Dívida conhecida:** o *Configurar por formulário* ainda tem 6 perguntas e preenche
só persona, tom e perguntas de qualificação — não os pontos-chave. As 20 perguntas
combinadas com o dono são a segunda metade desta leva.

## O assistente da IA Vendedora: tela cheia, por etapas (desde 2026-09-04)

O dono do produto olhou o *Configurar a IA por formulário* — seis perguntas num
modal, tudo gerado pela IA, sete campos aplicados — e disse: *"é horrível; o
ideal seria algo na tela toda, com etapas, mais premium e mais detalhado, para
compor todo esse perfil único da IA"*. E decidiu duas coisas: **grava direto nos
campos** (a IA só entra para redigir texto, a pedido, com revisão) e **abre na
criação, mas tem que dar para criar sem**.

O que aparece na tela:

- **O `+` cria a IA (desligada) e abre o assistente**, em tela cheia, sem o menu
  lateral. Quem quiser configurar na mão sai por *Configurar depois, na mão* e
  cai na tela de sempre com a IA nova selecionada. A IA existe nos dois caminhos.
- **O botão *Configurar por formulário* virou *Abrir o assistente*** e abre a
  mesma tela PREENCHIDA com o que a IA já tem.
- **Seis etapas**, num trilho à esquerda com progresso: *Quem é a IA*, *O que
  vocês vendem*, *O rumo da conversa*, *Limites*, *Operação* e *Revisão*. Rodapé
  *Voltar / Continuar*; a última é *Concluir e gravar*.
- **A IA aparece UMA vez**, no botão *Redigir com IA* da primeira etapa: manda o
  que a pessoa contou (imobiliária, o que vende, tom, diferenciais) e preenche
  só os quatro textos de apresentação, para revisar nos próprios campos. Custo é
  escolha.
- **Rascunho no navegador, por IA.** Fechar a aba no passo 4 não perde os três
  anteriores; ao voltar, a faixa *Retomamos de onde você parou* oferece recomeçar
  do que está gravado. Apagado no *Concluir* e no *Configurar depois*.
- **A Revisão mostra tudo por etapa**, com *Editar* voltando ao passo, e diz o que
  está no padrão de fábrica em itálico. Ao concluir: *"Perfil salvo. A IA continua
  desligada — ligue quando quiser testar."*

Decisões (não reabrir sem o dono pedir):

- **UM PATCH no Concluir, direto no serviço.** O payload é montado por função
  PURA (respostas → campos), testada sozinha, e **não passa pelo `saveAgent`** da
  tela — aquela lista campo-a-campo descarta o que não está nela, e é exatamente
  o que este assistente não pode sofrer.
- **Só viaja o que MUDOU.** Campo igual ao gravado não entra; numa IA nova, campo
  em branco NÃO é gravado (vazio herda o padrão). Apagar um texto que existia
  grava `null` de propósito.
- **O `playbook` vai INTEIRO**, mesclado por cima do que a IA já tem. Só o modo
  da pergunta de intenção, o termo do imóvel e os pontos-chave são trocados;
  bloco reescrito na seção *Roteiro da conversa* atravessa intacto.
- **Tipo de venda `lancamento` e próximo passo `visita` não são gravados**, nem
  o termo que já é o padrão do tipo — mesma regra da seção Roteiro.
- **O assistente não liga ninguém.** Ligar continua sendo o interruptor da tela
  de configuração.
- **A rota fica FORA do layout principal** (só `PrivateRoute > CustomerRoute`),
  como o editor de landing. Não tem chave de funcionalidade: é a porta de
  entrada de uma tela que já existe.
- **O rumo volta pela query `?agent=<id>`**, lida uma vez no mount da tela de
  IAs e apagada da URL com `replace`. As abas daquela tela são estado local, sem
  endereço; sem isso, quem saía do assistente caía na lista sem IA selecionada.

Armadilhas:

1. **Campo novo no assistente entra no mapeamento, não na tela.** Quem adicionar
   uma pergunta escreve a regra "o que vira gravação" em
   `assistente/assistenteMapping.ts` e o caso no spec ao lado — é lá que mora
   "vazio não grava" e "igual não grava".
2. **Os dois editores de horário na etapa de Operação têm prefixos próprios**
   (`as_win` e `as_fu_win`). Prefixo repetido faz o rótulo *Das* de um focar o
   campo do outro. Spec reprova.
3. **Trocar o funil LIMPA o mapa de momentos e as duas colunas do follow-up.**
   São colunas de outro funil; o servidor as recusaria uma a uma e a pessoa veria
   as escolhas guardadas e nenhum card andando.
4. **A carga do roteiro é opcional.** Contra servidor antigo, rótulos, dicas,
   tipos de venda e próximos passos vêm de listas de reserva desta tela — que
   precisam bater com o servidor.
5. **O que a pessoa contou da imobiliária não tem campo próprio na IA.** Se ela
   não redigir nem escrever as Instruções, aquilo vira as Instruções em prosa
   simples na gravação — rede para não perder o que foi contado, não redação.
6. **A conta de padeiro da etapa de Operação usa o ritmo que a IA já tem** (o
   gotejamento não é editado no assistente) sobre a janela que está sendo
   escolhida.

**Fora desta leva, por decisão do dono:** a frase de abertura no modo *Nunca* (o
campo *Como ela pergunta* some e não existe campo para a pergunta aberta — quem
quiser a frase exata reescreve o bloco da abertura na seção Roteiro); e os dois
campos do book do imóvel que a tela mostra e não salva.

## A landing avisa a Meta pelos DOIS caminhos (desde 2026-09-04)

Pergunta do dono do produto: *"nas LPs que a gente cria, o cara preenche o forms
e cai no CRM, mas o Facebook recebe o lead?"* — recebia **só pelo navegador**
dele, e só com o Pixel preenchido em *Destino do lead*. Bloqueador, iOS e aba
fechada no meio do redirecionamento somem com a conversão, e não havia segunda
via: a conversão pelo servidor (API de Conversões) só saía quando o card **muda
de coluna** no funil, então quem não arrasta card nunca teve conversão pelo
caminho confiável. E os cookies do clique que a página já coletava chegavam ao
servidor e ninguém lia — o evento por coluna casa só por telefone/e-mail, sem
atribuição ao anúncio.

O que aparece na tela, no botão **Destino do lead** (no cartão da landing, na aba
*Landings de anúncio* do Site Builder), seção **Rastreio (Pixel Meta)**:

- **Dropdown *Enviar para***, no lugar do campo de ID solto: *Não rastrear esta
  landing* / *Pixel do CRM — <número>* / *Outro pixel (só desta landing)*. O do
  CRM é o cadastrado em *Automações → Pixel e CAPI*, que é onde vive o Token —
  escolhendo ele, não há nada a digitar.
- **Três seletores de evento**, no lugar das quatro caixinhas: ao enviar o
  formulário, quando a régua aprova e quando ela reprova. A lista é a MESMA de
  *Pixel e CAPI* — antes a landing disparava *LeadQualificado* e
  *LeadDesqualificado* (nomes inventados) enquanto o CRM mandava *Qualificado* e
  *Desqualificado*: para a Meta eram quatro coisas diferentes, e o aprendizado se
  dividia em quatro pilhas pequenas.
- **Botão *Testar conexão***, que manda um lead de amostra pelo pixel escolhido e
  responde em português se a Meta aceitou. É a mesma conferência da tela de Pixel
  e CAPI — reaproveitada de propósito.
- A caixinha do PageView continua.

Decisões (não reabrir sem o dono pedir):

- **Cada evento sai pelos DOIS caminhos, sempre**, com o mesmo identificador: a
  Meta junta e conta uma conversão só. Não virou pergunta na tela porque não é
  escolha — o servidor é o que continua chegando quando o navegador falha.
- **Os dois campos de qualificação nascem em *Não disparar nada*.** Marcar ali o
  mesmo evento que o corretor usa no card faz o mesmo lead entrar duas vezes no
  público de semelhantes, e o segundo (que vale mais) se dilui. A tela avisa isso
  embaixo do campo; quem quiser separar usa um nome próprio para o formulário.
- **Landing publicada não muda de comportamento.** Sem os campos novos, o pixel
  preenchido continua valendo como *outro pixel* e as caixinhas antigas viram os
  MESMOS nomes que a página disparava (inclusive o desqualificado desligado, como
  a caixinha nascia). Trocar o nome de um evento em produção zera o aprendizado da
  campanha que roda em cima dele.
- **Campo do pixel vazio continua sendo "não rastreia"**, nunca "usa o do CRM":
  virar isso ligaria rastreio em landing que ninguém configurou.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`,
   `saas-multitenant`): o envio pelo servidor, o rastreio resolvido e o teste
   moram lá. Contra o servidor antigo a página não recebe os nomes de evento e
   **não dispara nada** — o formato que ela lê mudou.
2. **A página NÃO tem mais nome de evento escrito dentro dela.** Quem diz o que
   disparar é o servidor, que é quem manda os mesmos eventos pela API de
   Conversões — nome montado aqui seria a divergência de sempre.
3. **O identificador do envio é gerado uma vez e viaja junto do lead.** Gerar de
   novo, ou esquecer de mandá-lo, faz o mesmo lead contar duas vezes.
4. **Evento personalizado vai por `trackCustom`, evento padrão por `track`.**
   Trocar um pelo outro faz a Meta descartar em silêncio.
5. **A leitura da configuração de Pixel e CAPI é de fundo e não grita**: cargo sem
   acesso a ela só não vê a opção de herdar o pixel — a janela continua inteira.
6. **Isto não é `featureKey` nem `clientToggleKey`** — é configuração da landing.
   Os scanners do catálogo não entram nesta história.

## O corretor vê e religa o número dele (desde 2026-09-04)

O dono do produto: *"o corretor atribuído de verdade e não automático consegue
ver o canal e religar ele, configurar ele — porém com um pouco menos de opção,
pra não ser totalmente zaralhado ali pro corretor"*.

Antes, o item **Canais** não aparecia no menu do corretor, e quem digitasse o
endereço da configuração de um canal caía em `/unauthorized`: a rota exigia a
permissão de **CRIAR** canal. Então o corretor cujo WhatsApp caía não tinha como
nem ver o estado, nem ler o QR code — sendo que o celular é dele.

O que aparece na tela:

- **Canais entrou no menu do corretor**, com os números em que ELE atende. Só
  isso: o vínculo que um gestor concedeu na aba *Colaboradores* daquele canal. O
  acesso automático — o que o sistema dá quando um lead cai no número de outro
  corretor — **não** faz o número do colega aparecer para ele.
- **Dentro do canal ele vê UMA aba: *Configuração***. Estado do número, QR code,
  *Reconectar*, *Desconectar*, perfil do WhatsApp (nome, recado, foto),
  privacidade e ajustes do aparelho. Com uma aba só, a barra de abas nem se
  desenha.
- **Ficam de fora**: *Colaboradores* (quem atende no número é decisão do
  gestor), *Horário de atendimento*, *Pesquisa de satisfação*, *Modelos de
  mensagem*, *Moderação*, o nome e a foto do canal no CRM, e a lixeira.
- **A lixeira some do card e da tabela** para quem não pode excluir canal.

Decisões (não reabrir sem o dono pedir):

- **Desconectar o próprio número: PODE.** É o caminho de trocar de aparelho, e
  quem religa lendo o QR é ele mesmo.
- **Quem decide tela cheia × tela enxuta é `can('inboxes', 'update')`** — o MESMO
  sinal que o servidor usa para responder "vejo qualquer canal". Dois sinais
  diferentes fariam a tela oferecer o que a API recusa (ou esconder o que ela
  permite), que é o defeito mais caro deste tipo de recorte.
- **Enquanto o cargo ainda não chegou, vale a versão enxuta.** Mostrar demais e
  recolher depois pisca opções que a pessoa não tem.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`). Sem ela o corretor vê o item de menu e toma recusa em
   tudo: as chaves do cargo, o recorte da lista e a guarda de "este número é
   dele" moram lá.
2. **A aba inicial não pode ser fixa.** O estado nasce em *Configurações
   básicas*, que é a primeira aba do GESTOR e não existe para o corretor — sem a
   correção ele abria a tela com a barra mostrando *Configuração* e o conteúdo em
   branco embaixo, indistinguível de tela quebrada.
3. **A rota da configuração usa `channels.read`, não `channels.create`.** Era
   `create`, e por isso o corretor caía em `/unauthorized` ao clicar no card.
   Criar canal continua sendo do gestor — quem gateia isso é o botão *Novo
   canal*, não a rota da tela de um canal que já existe.
4. **Canal sem aba nenhuma mostra uma explicação**, não uma página em branco:
   acontece com quem só atende num canal que não é de sessão (e-mail com
   provedor, redes sociais), onde não há conexão para ver nem religar.
5. **Não é `featureKey` nem `clientToggleKey`** — é cargo, não módulo. Os
   scanners do catálogo de funcionalidades não entram nesta história.

E o motivo de tudo isto: **quando o número cai, agora o servidor avisa** — por
sininho e push, para quem atende naquele número e para os gestores, cinco minutos
depois da queda (instância que pisca e volta não avisa ninguém), com um segundo
aviso quando ele volta ao ar. O clique do aviso abre exatamente esta tela, na aba
de conexão. Ver o CLAUDE.md do `lm-flow`.

## A automação de lead vale só num funil (desde 2026-09-06)

O dono do produto, montando a automação *Início da IA Clelia*: *"preciso poder ter
um gatilho de automação em cima de um pipeline específico, assim como a IA tem o
filtro"*. O gatilho *Lead criado* valia para todo lead novo do CRM — não dava para
ligar a IA só no funil de lançamento e deixar o de locação quieto.

O que aparece na tela (*Automações → Automações de Lead*, janela da automação):

- **Campo *Funil (opcional)***, no mesmo quadro cinza do filtro de *Origem do
  lead*, logo abaixo dele. Em branco = todo lead do CRM; escolhendo um funil, a
  automação só roda para o lead cujo card está nele.
- Vale em **todos os gatilhos**, menos *Card mudou de etapa* — ali a etapa
  escolhida já diz de qual funil ela é.
- Na lista de automações, a condição aparece como **"Funil: Lançamento"**, e o
  contador de condições passa a contar as duas (a origem e o funil).
- **O *Testar* passou a dizer em que funil o lead-cobaia está**, pelo nome, e
  "nenhum — o lead ainda não tem card". Sem isso a linha do filtro comparava dois
  códigos e não explicava nada.

Decisões (não reabrir sem o dono pedir):

- **É filtro do LEAD, não do gatilho.** Por isso ele fica ao lado da origem em vez
  de no lugar dela: as duas perguntas convivem ("lead de formulário, no funil de
  lançamento").
- **Trocar para um gatilho que não aceita o filtro APAGA o funil escolhido.**
  Gravado e invisível, ele seguiria barrando a automação sem nada na tela dizendo
  por quê.
- **No gatilho *Lead criado*, a tela avisa que a automação espera o card
  aparecer** (cerca de meio minuto). O lead de anúncio e de landing entra no funil
  logo depois de nascer; sem o aviso, "configurei o funil e a mensagem demorou"
  parece defeito. Sem funil escolhido nada muda: dispara na hora.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem publica o funil do lead e quem espera o card nascer
   moram lá. Contra o servidor antigo o campo aparece, salva, e a automação nunca
   dispara — porque o filtro nunca casa.
2. **As duas condições viajam no MESMO array.** Cada editor mexe só na sua: um
   editor que escreva o array inteiro faz escolher o funil apagar a origem. E a
   validação de "esse gatilho exige uma condição" olha só a condição do GATILHO —
   senão escolher um funil faria uma regra de etiqueta subir sem etiqueta nenhuma.
3. **Não é `featureKey` nem `clientToggleKey`** — é campo da automação, não módulo.
   Os scanners do catálogo de funcionalidades não entram nesta história.

## As respostas do formulário da landing aparecem no card (desde 2026-09-07)

Queixa do dono do produto: *"os leads que preenchem formulário ali na landing page
não consigo ver as respostas dos forms deles"*.

A aba *Origem* do card **já tinha** o bloco *Respostas do formulário*, e o servidor
**já mandava** as respostas. O problema era o formato: o formulário do Meta chega
como pares soltos (pergunta → resposta), e a landing manda todas as perguntas
dentro de uma chave só, como lista. A tela imprimia essa lista direto, então saía
uma linha escrita **"[object Object]"** — e, ao lado dela, o identificador do envio
e os cookies do anúncio (*event id*, *fbp*, *fbc*, *link da landing*) listados como
se fossem respostas do lead. Quem abria o card via lixo e nenhuma resposta.

O que aparece na tela agora:

- **Uma linha por pergunta**, com o texto da pergunta à esquerda e o que o lead
  respondeu à direita. Múltipla escolha vira uma linha só, separada por vírgula.
- **O rastreio do anúncio sumiu do bloco.** Ele nunca foi resposta de ninguém —
  serve para a conversão da Meta e continua guardado no servidor.
- **Selo do resultado da régua**, ao lado do selo *Landing Page*: *Qualificado* em
  verde ou *Desqualificado* em vermelho, com a nota. O card já recebia esse
  resultado desde a captura e não o mostrava em lugar nenhum — a única tela que o
  exibiria é uma aba escondida. Sem ele, as respostas contam metade da história:
  dá para ler o que o lead respondeu sem saber se aquilo passou no corte.

Decisões (não reabrir sem o dono pedir):

- **A leitura entende os DOIS formatos**, e isso não é dívida: é o que faz o lead
  **já capturado** voltar a ficar legível. O servidor passou a gravar no formato
  do Meta, mas quem preencheu a landing antes disso está gravado no formato
  antigo — consertar por reescrita mexeria no contato de todo cliente para arrumar
  exibição.
- **Objeto solto nunca vira linha.** É a origem exata do `[object Object]`; a
  normalização descarta em vez de imprimir, e há teste para isso.
- **A normalização mora em arquivo próprio, com teste**, e não dentro da tela do
  card: aquele arquivo tem ~4.800 linhas e o bloco vive dentro de uma função
  anônima no meio do JSX, onde nada é testável.

Armadilhas:

1. **A metade do backend vem PRIMEIRO** (`lm-flow`, branch `saas-multitenant`):
   é lá que a resposta do lead novo passa a ser gravada em pares. Sem ela, valem
   só os leads antigos — que a tela já mostra, porque entende os dois formatos.
2. **Chave de rastreio nova precisa entrar nas DUAS listas** (aqui e no servidor).
   Numa só, ela some do card do lead novo e continua aparecendo como resposta no
   lead antigo — ou o contrário.
3. **Não voltar a imprimir o valor cru com `String(v)`.** Foi o que produziu o
   `[object Object]`, e o defeito é MUDO: nada quebra, a linha só fica ilegível.
4. **O selo do resultado sai do card, não do contato** (o servidor grava a
   qualificação e a nota no card na hora da captura). Lead de outra origem não tem
   isso e o selo simplesmente não aparece.
5. **Não é `featureKey` nem `clientToggleKey`** — é exibição do card. Os scanners
   do catálogo de funcionalidades não entram nesta história.

**Ainda não existe, e é dívida conhecida:** uma lista de "leads desta landing".
A aba *Leads* do Site Builder mostra os leads do site sem dizer de qual landing
vieram, sem as respostas e sem a qualificação — e hoje só o administrador da conta
a alcança.

## O follow-up da IA pode valer só em alguns funis (desde 2026-09-07)

Pedido do dono do produto, olhando a aba de follow-up: poder definir se a IA vai
atrás de **todos os leads daquele número** ou só dos que estão no funil X ou Y.

Antes disto não havia escolha: ligar o follow-up ligava para todo lead calado do
número. Numa imobiliária com um funil por produto (lançamento, locação, o do
Bolsão), quem não queria cutucada no de locação simplesmente não ligava a chave.

O que aparece na tela, em *IA Vendedora → Configuração → Follow-up automático*:

- **Bloco *De quais leads ela vai atrás***, o PRIMEIRO de dentro do follow-up.
  Duas opções: *Todos os leads que ela atendeu* (era *Todos os leads deste número*
  até 29/09 — ver *"O follow-up da IA só vai atrás de quem ela atendeu"*) e *Só os
  leads que estão nestes funis*, que abre a lista de funis do CRM para marcar.
- Marcado ao menos um funil, a tela lembra que vale o funil em que o card está
  **hoje** e que **card arquivado não conta**.

Decisões (não reabrir sem o dono pedir):

- **Nenhum funil marcado = todos os leads.** É o padrão e o comportamento de
  sempre: ninguém muda de comportamento por efeito de deploy. Por isso o aviso em
  âmbar quando a pessoa escolhe *só destes funis* e não marca nenhum — sem ele,
  ela sai da tela achando que recortou, e a IA vai atrás de todo mundo, calada.
- **A ordem do bloco é DE QUEM → o que faz → quando pode → em que ritmo.** Escolher
  o público antes do resto é como a pergunta se faz.
- **Lead sem card fica de fora quando há recorte**, e a tela diz isso: o lead que
  chegou pelo WhatsApp e nunca entrou em funil é exatamente esse caso.

Armadilhas:

1. **`followup_pipeline_ids` PRECISA estar na lista do `saveAgent`**, com `??` e
   não com `in`: lista vazia não é `null` — é a escolha *todos os leads*, e o `??`
   a preserva. (Diferente das colunas do bloco *Quando o lead sumir*, onde `null`
   significa "não escolhi coluna nenhuma".) Há spec que reprova as duas coisas.
2. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a coluna e o recorte da varredura moram lá. Contra o
   servidor antigo o bloco aparece, salva, e a IA continua indo atrás de todos.
3. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente, não módulo. Os
   scanners do catálogo de funcionalidades não entram nesta história.
4. **Nem o spec pode ESCREVER o literal do gate**, nem para negá-lo. Os dois
   scanners varrem todo arquivo `.ts` — o spec incluído — e não sabem que a linha
   é uma negação: o auditor leu `useClientToggle('followup_pipeline` de dentro de
   um `expect(...).not.toContain(...)`, não achou a chave no catálogo do servidor
   e QUEBROU O BUILD. A busca é montada em pedaços; escrita literal, ela vira uma
   chave usada.

## "O que aconteceu": a automação passou a dizer por que não disparou (desde 2026-09-09)

Terceiro relato seguido do dono sobre a mesma automação (*Lead criado* + funil da
landing + mensagem no WhatsApp) não disparar. O problema por trás do ciclo era
não haver ONDE olhar: automação que dispara deixa rastro, automação que falha
deixa rastro, automação que **não casa com o lead** não deixava nada.

O que aparece na tela (*Automações → Automações de Lead*):

- **Botão *O que aconteceu*** (o relógio, ao lado do frasquinho de *Testar*), em
  cada automação. Ele lista os últimos leads que passaram por ela com um dos três
  selos: **Disparou** (e o que saiu), **Falhou** (e o motivo do servidor) e
  **Não disparou** — este com a condição que barrou, em português: *"a regra pede
  funil «Leads LP», e este lead ainda não está em funil nenhum"*.
- Também no card do lead: o bloco **Respostas do lead**, na aba *Detalhes*,
  mostrava uma linha *Form Answers → [object Object]*. Ele imprimia a chave que
  GUARDA as respostas em vez das respostas. Agora usa a mesma leitura da aba
  *Origem* — uma linha por pergunta, e o rastreio do anúncio fora.

Decisões (não reabrir sem o dono pedir):

- **Testar e *O que aconteceu* respondem perguntas diferentes.** O *Testar* força
  a regra contra um lead-cobaia (o último que entrou) e fura os filtros de
  propósito; este responde sobre os leads que entraram sozinhos. As duas
  continuam, lado a lado.
- **A lista é a partir de agora.** Ela não reconstrói o passado — lead que entrou
  antes do deploy não aparece. Para esse, quem responde continua sendo o *Testar*.
- **Recusa por cargo aparece como recusa por cargo.** É clique explícito: aqui o
  motivo do servidor é mostrado, lendo os DOIS formatos de erro da API.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem grava as três linhas e quem serve a lista moram lá.
   Contra o servidor antigo o botão abre vazio.
2. **Selo novo do servidor precisa de rótulo aqui**, senão a linha sai com a
   aparência de "não disparou". Mesma armadilha do estado das listas do Bolsão.
3. **Não voltar a imprimir valor cru com `String(v)` no bloco de respostas do
   card** — é o que produzia o `[object Object]`, e o defeito é MUDO: nada quebra,
   a linha só fica ilegível. A normalização é a mesma da aba *Origem*, num arquivo
   só, com teste.
4. **Não é `featureKey` nem `clientToggleKey`** — é tela de automação. Os scanners
   do catálogo de funcionalidades não entram nesta história.

### O selo *Teste* e o selo *Não entregue* (correção do mesmo dia)

Minutos depois de a tela subir, o dono do produto: *"tá mentindo esse 'O que
aconteceu' — fala que disparou e simplesmente não tem nada da lead"*. Estava
certo, e a causa era do servidor (ver o CLAUDE.md do `lm-flow`): o botão
*Testar*, que **simula** tudo que falaria com o lead, se registrava exatamente
como um envio real — e ele usa o último lead que entrou como cobaia. A lista
mostrava "Disparou" para um lead que nunca recebeu nada.

O que aparece na tela agora:

- **Selo *Teste*** (cinza, com o frasquinho), na linha que veio do botão
  *Testar*, e a descrição começa em *SIMULADO, nada foi enviado ao lead*.
- **Selo *Não entregue*** (vermelho), quando a mensagem saiu do CRM e o WhatsApp
  recusou depois — com o motivo do provedor. É uma linha SEPARADA da do disparo:
  o disparo aconteceu (a mensagem está no chat), a entrega é que não. As duas
  pedem providências diferentes: uma é a regra, a outra é o número do canal.

Armadilha: **selo novo do servidor sem rótulo aqui cai no visual de "Não
disparou"**, que é outra coisa. Hoje são cinco: disparou, falhou, não disparou,
teste e não entregue.

## A landing pode mandar o lead para a roleta (desde 2026-09-09)

Pergunta do dono do produto: *"a nossa roleta não tem como por forms de página,
né, ou tem?"*. Não tinha — e faltava só o campo. A roleta já distribui lead de
formulário sem conversa nenhuma: é o que o formulário do Meta e os portais fazem
há tempos. A landing escolhia funil, coluna e etiqueta, e o lead ficava no card
sem dono até alguém puxar.

O que aparece na tela, no botão **Destino do lead** (no cartão da landing, na aba
*Landings de anúncio* do Site Builder), num bloco novo **Quem assume o lead
(opcional)**, logo abaixo da Tag:

- **Um seletor de roleta**, com *Não distribuir (entra sem responsável)* como
  primeira opção — e é ela que vem marcada em toda landing que já existe.
- Escolhida uma roleta, o texto explica o que passa a acontecer: o lead é
  oferecido a um corretor assim que chega, ele recebe o aviso no WhatsApp e no
  app, e vira o responsável quando aceita. E as duas regras que geram dúvida:
  lead que já tem responsável não volta ao sorteio, e fora do horário da roleta
  quem recebe é o número de plantão dela.

Decisões (não reabrir sem o dono pedir):

- **Vazio = não distribui**, e é o padrão. Nenhuma landing publicada muda de
  comportamento: o lead continua entrando sem responsável para a gestão
  distribuir na mão.
- **A roleta já escolhida continua na lista mesmo desativada**, com aviso em
  âmbar. A lista oferece só as ativas; sem essa exceção, abrir a janela de uma
  landing cuja roleta foi desativada mostraria "não distribuir" e salvar apagaria
  a escolha do gestor sem ele ver. Mesma doutrina do evento de pixel que a
  landing já usa e o CRM não conhece.
- **A leitura das roletas é de fundo e não grita**: cargo sem acesso a elas só
  não vê a opção — a janela continua inteira.

⚠️ **Conserto que veio junto, e é o mais importante desta leva:** esta janela
montava o bloco de configuração da landing DO ZERO e o enviava inteiro, então
salvar apagava tudo o que ela não conhece. O **destino escolhido dentro de cada
pergunta do formulário** — que é gravado pelo editor da landing, no mesmo lugar —
morria aí: sem erro, sem aviso, e só perceptível quando o lead parasse de cair no
funil certo. Agora ela mescla sobre o que está gravado.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem sorteia, quem guarda contra oferta repetida e quem
   registra o veredito moram lá. Contra o servidor antigo o campo aparece, salva,
   e nada é distribuído.
2. **A montagem do que é gravado mora em arquivo próprio, com teste**
   (`src/features/landing/manage/landingRouting.ts`), e não dentro da janela. A
   regra que importa — mesclar, nunca substituir — é invisível na tela, e foi
   justamente ela que faltou por meses.
3. **Não é `featureKey` nem `clientToggleKey`** — é configuração da landing. Os
   scanners do catálogo de funcionalidades não entram nesta história.
4. **A landing não tem mensagem de primeiro contato fora do horário** (aquele
   campo é do formulário do Meta). Com a roleta fechada o lead vai para o número
   de plantão e fica em silêncio até ela abrir, como no portal.

## A lista de etiquetas parava nas 20 primeiras (desde 2026-09-09)

Relato do dono do produto: *"na hora de criar landings não mostra todas as tags"*
— e, ao ver o diagnóstico: *"arruma as outras telas também"*.

A rota de etiquetas é **paginada: 20 por página**, em ordem alfabética. Quem
pedia a lista sem dizer "manda o catálogo inteiro" recebia só a primeira página.
Quem tem mais de 20 etiquetas — que é quase todo cliente, porque o marcador de
progresso do follow-up cria uma etiqueta por mensagem de cada funil — via a lista
cortada no meio do alfabeto. Nada quebrava, nenhum erro aparecia: a etiqueta
simplesmente não estava lá, indistinguível de etiqueta que não existe.

**Esta pegadinha já tinha mordido quatro vezes, e todo conserto foi local** — por
isso ela voltava: a tela de etiquetas (criar uma que já existia fora da primeira
página dava erro de validação), o seletor de etiqueta do painel inicial
("tráfego" sumindo com 37 cadastradas), as três telas da landing de anúncio e os
formulários de macro, automação de conversa e conta.

Onde estava cortando, e foi tudo consertado junto:

- os **três** pontos da landing de anúncio — o passo *Destino do lead* do
  assistente de criação, a janela *Destino do lead* do cartão (nos DOIS
  seletores, o normal e o do ramo desqualificado) e o destino por resposta
  dentro do editor do formulário;
- os formulários de **macro**, de **automação de conversa** e de **conta**;
- a seção de etiquetas do **filtro da caixa de conversas**.

Decisões (não reabrir sem o dono pedir):

- **Existe UMA porta para buscar etiqueta: o serviço de etiquetas.** Ele pede o
  catálogo COMPLETO e carrega o motivo escrito ao lado. O seletor do painel
  inicial, que já pedia a lista grande por conta própria, passou a usar a mesma
  porta — a correção local dele funcionava e era a segunda verdade sobre o mesmo
  assunto, além de usar outro nome de parâmetro.
- **Nada muda para quem tem poucas etiquetas.** A lista é a mesma; só deixa de
  ser cortada.
- **Não houve mudança no servidor.** A rota sempre aceitou o pedido do catálogo
  inteiro — só ninguém o fazia nessas telas.

Armadilhas:

1. **O defeito é MUDO e volta fácil.** Por isso o portão é do REPOSITÓRIO
   INTEIRO, e não de uma tela: existe spec que varre todo o código e reprova
   qualquer arquivo que volte a chamar a rota crua, com o conserto escrito na
   mensagem da reprovação. Ele lê o código-fonte porque não há tipo, render nem
   build que segure isso.
2. **Passar pelo serviço só resolve enquanto ele pedir o catálogo completo.** O
   mesmo spec trava isso: tirar o pedido de lá devolveria as 20 de sempre a
   todas as telas de uma vez.
3. **O serviço devolve `{ data }`, não a resposta crua do axios.** Nos três
   formulários a lista fica fora do `getResultData`, que espera a resposta crua —
   passar por ele devolveria lista vazia, em silêncio.
4. **Não é `featureKey` nem `clientToggleKey`** — é leitura de lista. Os
   scanners do catálogo de funcionalidades não entram nesta história.

## Várias páginas do Facebook por cliente: a lista e o "Adicionar página" (desde 2026-09-12)

Pergunta do dono do produto: *"hoje a gente só consegue colocar uma página do
Facebook por cliente?"*. O servidor aceita várias há tempos (cada página é um
registro, cada formulário sabe de qual página veio, a aba *Formulários* filtra
por página). **O limite era a tela**: a aba *Página do Facebook* era um
formulário genérico com UM Page ID e UM token — digitar a segunda página até
conectava por baixo, mas a tela só mostrava a última, sem lista, sem como
desativar/remover/religar uma página específica, e com um *Desconectar* que
derrubava todas de uma vez. E ele colava todo Page ID na mão.

O que aparece na tela, em *Automações → Origem → Páginas do Facebook*:

- **A lista das páginas conectadas**, com nome, Page ID e os selos *Ativa /
  Desativada*, *Recebimento em tempo real: ok / não ativado* (com o motivo do
  Facebook embaixo), *Token próprio / Token de sistema* e, quando ligada, *Aceita
  qualquer formulário*.
- **Botão *Adicionar página*** (só a Leal Mídia): abre a lista das páginas que o
  acesso da Leal Mídia enxerga, com *Acesso a leads: ok / Sem acesso a leads*, e
  um *Adicionar* por linha — a já conectada aparece como *Já conectada*. Embaixo,
  **"Não está na lista? Informar Page ID e token"**, o caminho de sempre, guardado
  como plano B para página fora do Business Manager da Leal Mídia. Sem token de
  sistema configurado, a janela já abre no manual.
- **Por página**: *Religar recebimento*, *Desativar/Ativar* e *Remover* (com
  confirmação). O cliente vê a lista e não mexe — quem conecta continua sendo a
  Leal Mídia, por decisão do dono.
- **O filtro por página da aba *Formulários* passou a vir das páginas
  conectadas**, não dos formulários sincronizados: página recém-conectada sem
  formulário (ou com token falhando) aparece na pílula em vez de sumir como se
  não estivesse conectada.

Decisões (não reabrir sem o dono pedir):

- **Quem conecta é só a Leal Mídia**, "da mesma forma que eu já conecto hoje". O
  critério da tela é o MESMO do servidor (e-mail do super-admin) — dois critérios
  diferentes fariam a tela oferecer o que a API recusa.
- **A lista é o caminho normal; o manual é plano B.** Página fora do nosso BM
  continua entrando por Page ID + token.
- **O campo *Verify Token* sumiu.** Era decorativo: o webhook lê esse valor de
  variável de ambiente, nunca da configuração.
- **A chave *Aceita qualquer formulário* continua com UM dono**, o bloco *Leads
  ignorados* da aba Formulários (onde a consequência aparece). Aqui é só selo.
- **Sem mudança de comportamento no servidor** (`lm-flow`): os endereços já
  existiam; foi só cobertura de teste do que a janela lê.

Armadilhas:

1. **Leitura de fundo não grita.** O Corretor não tem a permissão de ler
   integrações e a Origem abre para ele: a lista vira um texto discreto, nunca
   aviso vermelho. Há spec.
2. **O formulário genérico de integração foi apagado** junto com a pasta
   `providers` — o único consumidor era a Origem. Quem precisar de "Page ID +
   token" usa a janela nova, que grava na tabela de páginas e não no jsonb antigo.
3. **Conectar não basta: o Facebook só MANDA o lead com a página inscrita no
   app.** Por isso o retorno do *Adicionar* olha `webhook_subscribed` e avisa
   com o motivo quando falhou; a linha ganha *Religar recebimento*.
4. **Não é `featureKey` nem `clientToggleKey`** — é cargo, não módulo. Os
   scanners do catálogo de funcionalidades não entram nesta história.

## O site do cliente mostrava só 60 imóveis (desde 2026-09-14)

Relato do dono do produto: *"a Mais Que Imóveis tem 390 imóveis ativos e ativos
no site, mas apenas 60 aparecem no site"*.

Não era cadastro nem chave: o portal público pedia ao servidor **uma página de
60 imóveis** e parava ali. O catálogo é paginado no servidor (20 por padrão,
100 no máximo), e o site filtra tudo no navegador — cidade, bairro,
dormitórios, código — e monta as listas dos seletores a partir do que carregou.
Com 60 de 390, a busca por bairro mostrava metade dos bairros, o contador
*"imóveis disponíveis"* da home dizia 60, e nenhum erro aparecia em lugar
nenhum. Mesma família do corte das etiquetas em 20 (09/09): lista paginada
lida como se fosse inteira.

O que mudou na tela:

- **O portal carrega o catálogo inteiro**: pede a primeira página com o teto
  do servidor, lê o total e busca as páginas restantes em paralelo. A home, a
  busca, os seletores de cidade/bairro/tipo e o contador passam a refletir tudo
  o que está publicado.
- **A página de busca ganhou *Mostrar mais imóveis*** (30 por vez, com
  *"Mostrando N de M"*). O título continua dizendo o total filtrado — é ele que
  responde "quantos tem"; o botão só evita despejar centenas de cards de uma vez.
  Mudar qualquer filtro volta ao topo da lista.

Decisões (não reabrir sem o dono pedir):

- **A busca do catálogo mora em arquivo próprio, com teste**
  (`src/pages/Public/portalProperties.ts`). Ela recebe o `fetch` por parâmetro,
  então o teste não toca no fetch global — que o setup da suíte proíbe.
- **Repetido entre páginas é descartado por id.** É a rede de segurança para
  ordem instável no servidor (que também ganhou ordem fixa — ver o CLAUDE.md do
  `lm-flow`). Sem as duas metades, a página 2 podia repetir imóvel da 1 e
  esconder outro.
- **Falha numa página do meio não derruba o portal**: o que chegou é mostrado.
- **Teto de 20 páginas por visita** (2.000 imóveis). Catálogo acima disso é
  caso para busca no servidor, não para carregar tudo no navegador.

Armadilhas:

1. **A metade do backend vem PRIMEIRO** (`lm-flow`, `saas-multitenant`): a
   ordem estável da lista pública. Sem ela, a junção das páginas depende da
   sorte do Postgres — o descarte por id segura o repetido, mas não traz de
   volta o que a ordem instável escondeu.
2. **A página de imóvel continua pedindo 8 "recomendados"** pela mesma rota, de
   propósito: ali é vitrine, não catálogo.
3. **Não voltar a pedir "uma página grande" e parar.** 60, 100, 500: qualquer
   número fixo é o mesmo defeito esperando o cliente com um a mais.
4. **Não é `featureKey` nem `clientToggleKey`** — é leitura de lista. Os
   scanners do catálogo de funcionalidades não entram nesta história.

## Portais: catálogo completo, tipo de anúncio por imóvel e plano de anúncios (desde 2026-09-14)

O dono do produto fez engenharia reversa do módulo de portais do Kenlo e pediu a
aba *Configurações → Portais* no mesmo nível: todos os portais que o Kenlo
lista, tipo de anúncio por imóvel, cota por tipo com aviso de estouro, a tela
*Configurar* de cada portal e o histórico de cargas.

O que aparece na tela:

- **Selo de formato** em cada portal: *Formato validado* (ZAP, Viva Real, OLX,
  Imóvel Web) ou *Formato adaptado* (os demais), com a nota do servidor. ZAP,
  Viva Real e OLX viraram três portais, cada um com feed, webhook e plano.
- **Seletor de tipo por imóvel** no lugar da estrela (Padrão, Destaque, Super
  Destaque, Destaque Exclusivo, Destaque Superior, Destaque Triplo no ZAP/Viva
  Real; Simples/Destaque/Home Destaque no Imóvel Web…). Portal de um tipo só
  mostra só a caixa de marcar.
- **Contadores `N / cota` por tipo**, sempre visíveis, em vermelho ao estourar.
- **Plano de anúncios**: cota por tipo (`0 = ilimitado`) e *Valor mensal do
  investimento (R$)*.
- **Estouro avisa e pede confirmação** — decisão do dono, diferente do Kenlo
  (que só pinta de vermelho e deixa passar): *Salvar* continua habilitado; com
  estouro abre a janela *Plano de anúncios estourado* listando os tipos, e só
  envia confirmado. O 422 do servidor (contagem divergente) cai na mesma janela.
- **Configurar o portal**: dados do anunciante, endereço no anúncio, receber
  leads sim/não e destino do lead (funil, coluna, roleta, responsável) — um
  *Salvar configuração* só, uma requisição.
- **Histórico de cargas** e botão *Abrir feed*.

Decisões (não reabrir sem o dono pedir):

- **A regra de contagem/estouro mora num arquivo puro com teste**
  (`src/features/portals/adPlan.ts`); o texto do aviso é byte a byte o do
  servidor — a janela montada na tela e a do 422 dizem a mesma coisa.
- **Contra o servidor antigo (sem `ad_types`) a tela cai no modo estrela**, sem
  quebrar. É o que permite publicar o front antes de o backend estar no ar sem
  tela em branco — mas o merge aqui é só DEPOIS do backend.
- **Leitura de fundo não grita**: cargo sem acesso a roletas/funis/usuários só
  não vê aquele seletor; clique mostra o motivo do servidor (`extractError`,
  os dois formatos de erro).

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): tipos, cotas, configuração e histórico vêm de lá.
2. **`ad_plan` manda `0` para ilimitado**, e `monthly_investment` vai como
   `"3593.45"` ou `null`. Trocar o formato aqui faz o servidor descartar a cota
   em silêncio.
2b. **O tipo padrão é o que o servidor marca com `base: true`**, não o
   primeiro da lista. Desde 2026-09-14 o Imóvel Web tem quatro tipos (Simples,
   Destaque, Home Destaque, Grátis) e o padrão continua Simples por decisão do
   dono. Sem a marca (servidor antigo) vale o primeiro. Voltar a ler `[0]`
   marcaria todo imóvel novo no tipo errado no dia em que o servidor mudar a
   ordem.
3. **Trocar o funil LIMPA a coluna** no destino do lead: coluna de outro funil é
   recusada pelo servidor e a tela mostraria a escolha guardada sem efeito.
4. **Não é `featureKey` nem `clientToggleKey`** — é configuração de portal. Os
   scanners do catálogo não entram nesta história. O item de menu *Portais*
   continua atrás de `properties`.
5. **`npm ci` neste repo exige `--legacy-peer-deps`** (react-leaflet 4 × React
   19 no lockfile). Sem isso a instalação falha com ERESOLVE.
6. **A lista de imóveis do portal vem página a página** (desde 2026-09-29). O
   `GET /properties` corta em 200 por página (`clamp(1, 200)` no servidor): a
   tela pedia `per_page: 500`, recebia 200 calada, e a carteira maior sumia da
   lista e do *Selecionar todos*. Agora `carregarAtivos()` busca de 200 em 200
   até o `meta.total`. Não voltar a pedir "tudo de uma vez".
7. **Só imóvel Ativo conta no portal.** Publicação de um imóvel que saiu de
   Ativo (vendido, alugado, inativo, e também Reservado) continua gravada, mas
   fica fora do *N selecionado(s)*, dos contadores de cota e do envio — salvar
   a pausa. Com a lista ainda carregando ou com erro, vale o que o servidor
   mandou, para não pausar a carteira inteira por uma falha de leitura.

## As respostas do formulário apareciam duas vezes no card (desde 2026-09-16)

Print do dono do produto: no bloco **Respostas do lead** (aba *Detalhes* do card),
cada pergunta do formulário do Meta aparecia **duas vezes** — *"Qual A Renda
Familiar Da Sua Casa?"* e, logo abaixo, *"Qual A Renda Familiar Da Sua Casa"*;
*"Você Deseja Falar Com Um Corretor?"* e *"Voce Deseja Falar Com Um Corretor"*.
Mesma resposta, uma com acento e ponto de interrogação, outra sem.

Não era o lead preenchendo duas vezes, nem defeito da captura: **a mesma resposta
é gravada em dois lugares, de propósito**. O servidor guarda as respostas juntas,
que é o que este bloco lê, e ESPELHA cada uma solta no contato — é do espelho que
a variável de funil lê a resposta do lead nas mensagens automáticas. O bloco
imprimia as duas listas em sequência.

- **O espelho continua existindo.** Tirá-lo do servidor faria as variáveis de funil
  pararem de resolver, calado, em toda mensagem que usa resposta de formulário.
  Quem decide o que aparece é a TELA.
- **Chave espelhada de uma resposta que já está na lista não vira linha.** A
  comparação ignora acento, pontuação e maiúscula, que é exatamente o que muda
  entre as duas versões.
- **Campo do contato que NÃO é espelho continua aparecendo.** O que alguém gravou
  à mão no contato não some — a linha só cai quando a mesma resposta já está ali.
- **Nada muda no servidor e nada é reescrito no banco.** O lead já capturado volta
  a ficar legível sozinho, sem passo de reparo.
- **A aba *Origem* nunca teve o problema**: ela lê só as respostas, sem os campos
  soltos do contato.

Armadilhas:

1. **A regra mora no arquivo da normalização, com teste**
   (`src/components/pipelines/formAnswers.ts`), nunca dentro da tela do card —
   aquele arquivo tem ~4.800 linhas e o bloco vive numa função anônima no meio do
   JSX, onde nada é testável. Mesma decisão da leitura das respostas da landing.
2. **Não voltar a imprimir os campos soltos do contato sem comparar com as
   respostas.** O defeito é MUDO: nada quebra, a lista só dobra de tamanho.
3. **O intervalo de acentos vai escrito como `\u0300-\u036f`**, nunca com os
   caracteres combinantes literais — qualquer normalização de editor os apaga em
   silêncio e a comparação passa a nunca casar. Mesma cicatriz do conversor de
   nome em endereço da landing.
4. **Não é `featureKey` nem `clientToggleKey`** — é exibição do card. Os scanners
   do catálogo de funcionalidades não entram nesta história.

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

## A foto do banner da home pode ser de um imóvel (desde 2026-09-14)

Pergunta do dono do produto: *"preciso poder usar uma foto de um dos imóveis
como banner principal do site. Tem como selecionar do que já existe?"*. Não
tinha: o bloco *Banner da home* da aba *Configurações* só aceitava vídeo, e sem
vídeo o site usava a capa do primeiro imóvel que a lista devolvia, sem escolha
e trocando sozinha.

O que aparece na tela, no bloco *Banner da home*:

- **Três opções de foto**: *Automático* (o de sempre), *Foto de um imóvel* e
  *Enviar uma foto*. O vídeo continua ali embaixo, como *Vídeo (opcional)*, e
  passa por cima da foto quando preenchido.
- **Foto de um imóvel** abre a janela *Foto de qual imóvel?*: só imóveis
  publicados no site e com foto, com busca; clicando num imóvel aparecem as
  fotos publicadas dele e o clique na foto escolhe. A prévia aparece no bloco
  e vale depois de *Salvar*.
- **Aviso em âmbar** quando a escolha deixou de valer (imóvel apagado,
  despublicado ou sem foto publicada): o site já caiu no automático, e a tela
  diz por quê em vez de mostrar uma prévia vazia.
- **Enviar uma foto**: upload (máx 8MB) ou endereço colado, com prévia.

Decisões (não reabrir sem o dono pedir):

- **Quem diz qual imagem o site serve é o SERVIDOR** (`hero_image.url` no
  site). A tela só monta a prévia da foto recém-escolhida até salvar; depois
  passa a mostrar o que o servidor resolveu. Sem isso, a tela mostraria a foto
  escolhida enquanto o site já tinha caído no automático.
- **A janela só oferece o que vai aparecer**: imóvel despublicado ou sem foto
  não entra na lista, porque o servidor o recusaria no banner.
- **Nada muda para quem não escolheu**: toda imobiliária nasce em *Automático*,
  e a home pública continua caindo na capa do primeiro imóvel.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a escolha, a resolução e o `hero.image_url` da home
   moram lá. Contra o servidor antigo o bloco aparece, salva, e nada muda.
2. **A tradução mora fora do JSX** (`src/features/siteBuilder/heroImage.ts`,
   com spec): a escolha gravada vira formulário ali, e o texto dos avisos
   também. A tela do Site Builder tem ~1.100 linhas; nada testável cabe dentro.
3. **Não é `featureKey` nem `clientToggleKey`** — é configuração do site. Os
   scanners do catálogo de funcionalidades não entram nesta história.

## O portal ganhou financiamento e captação de imóvel (desde 2026-09-16)

O dono do produto mandou três referências do site da Mais Que Imóveis e pediu:
cabeçalho mais bonito, uma página de simulação de financiamento com os logos dos
bancos a um clique, e uma seção de *anuncie seu imóvel* com uma ficha que o
proprietário preenche e os donos recebem por e-mail.

O que aparece na tela:

**Cabeçalho (vale em TODAS as páginas do portal)**

- **Barra fina acima do cabeçalho** com o telefone, o e-mail e as redes sociais.
  Eles já eram cadastrados em *Configurações → Contato* e **não apareciam em
  lugar nenhum do site** — ficavam gravados e invisíveis. A barra só se desenha
  quando há o que mostrar.
- **Na home o cabeçalho é transparente sobre a foto de capa** e vira sólido na
  rolagem; nas outras páginas ele é sólido desde o topo, como antes.
- **Logo maior**, e os links novos (*Financiamento*, *Anuncie seu imóvel*) só
  existem quando o gestor ligou aquela página.
- **O botão de WhatsApp deixou de sumir no celular**: ele só existia dentro do
  menu hambúrguer aberto.
- **A página do imóvel passou a usar o MESMO cabeçalho e rodapé.** Ela tinha os
  dela, sem menu nenhum — quem caía nela por anúncio não conseguia chegar ao
  resto do site. É a mudança mais visível da leva, e é de propósito.
- **No rodapé, o link *"Anuncie"* rolava para o formulário de quem COMPRA.** O
  proprietário que queria vender caía no formulário contrário. Agora ele aponta
  para a página de verdade e só existe quando ela está ligada.

**Página *Simule seu financiamento*** — os bancos em círculos coloridos; clicar
abre o simulador do banco em outra aba.

**Página *Anuncie seu imóvel*** — a ficha em dois passos (*O imóvel*, *Seus
dados*) e, na tela de obrigado, o botão **Prefere falar no WhatsApp?**.

**Faixa de atalhos na home** — até três cartões (*Financiamento*, *Anuncie seu
imóvel*, *Imóvel sob encomenda*).

**Site Builder, aba *Configurações*** — dois blocos novos: *Financiamento e
bancos* (liga/desliga, textos, e os cinco bancos com link e logo) e *Anuncie seu
imóvel* (liga/desliga, textos, os e-mails que recebem a ficha e o botão **Enviar
um teste**). Na aba *Leads*, cada ficha mostra o desfecho do envio.

Decisões (não reabrir sem o dono pedir):

- **As duas páginas nascem DESLIGADAS**, e a faixa da home **não tem interruptor
  próprio**: ela aparece quando existe pelo menos um destino de verdade. Como os
  dois destinos novos estreiam desligados, nenhum site publicado ganha faixa
  sozinho no deploy — a doutrina da casa de nada estrear ligado, sem custar mais
  uma chave para o gestor virar. Com menos de dois destinos ela nem se desenha:
  um cartão só repetiria, em outra forma, o bloco de captura logo abaixo.
- **A ficha vai só por e-mail** — não cria contato nem card. Escolha explícita do
  dono.
- **Os cinco já vêm com o simulador oficial de cada banco**, então a página
  funciona assim que a chave é ligada. Trocar o link só é preciso com endereço de
  parceria; **apagar o campo volta ao oficial**, e existe o botão *Voltar ao
  oficial*.
- **Quem tira um banco da página é a chave dele**, nunca o campo de link em
  branco — a tela diz isso, porque apagar o link é o que a pessoa tentaria
  primeiro. O aviso conta quantos bancos estão desligados.
- **O logo de cada banco é ENVIADO pelo botão *Enviar logo***, e vai para o
  armazenamento do CRM. Nada de colar o endereço da imagem no site do banco: ela
  quebra no dia em que ele troca o endereço, e o círculo fica vazio no site do
  cliente. Sem logo, ele sai na cor da marca com o nome escrito.
- **O botão *Enviar um teste* não é enfeite.** E-mail depende de configuração da
  plataforma; sem ele, o gestor só descobriria que nada sai quando o primeiro
  proprietário real preenchesse a ficha e ninguém respondesse.
- **Erro ao enviar a ficha NÃO apaga o que foi preenchido.** Ela é longa; sumir
  com ela faz a pessoa não preencher de novo.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): as duas páginas, os cinco bancos e o envio moram lá.
   Contra o servidor antigo os blocos aparecem, salvam e não guardam nada, e as
   duas páginas públicas abrem vazias.
2. **A tradução mora fora do JSX** (`src/features/siteBuilder/portalPages.ts`,
   com spec): o que o servidor resolveu vira formulário, o formulário vira o que
   é enviado, e os textos dos avisos saem de lá. A tela do Site Builder já tem
   ~1.500 linhas.
3. **Texto igual ao de fábrica NÃO é gravado.** Gravar o padrão faria a tela
   mostrar "escrito por mim" onde ninguém escreveu nada, e travaria o texto no
   dia em que o padrão da casa mudasse. Mesma regra do *tipo de venda* no
   assistente da IA.
4. **Os cinco bancos de reserva desta tela precisam bater com os do servidor**
   (chave, nome, cor, ORDEM **e o link oficial**). Eles existem só para a janela
   de deploy em que o servidor ainda é o antigo — sem eles o bloco abriria vazio
   e pareceria quebrado no pior momento, logo depois de publicar. Quem mudar o
   link de um banco muda nos DOIS lugares.
5. **O cabeçalho FLUTUA na home**, então ele sai do fluxo: quem mexer no espaço
   do topo da capa precisa lembrar que o título precisa daquele espaço de volta.
6. **Não é `featureKey` nem `clientToggleKey`** — é configuração do site, como o
   banner da home. Os scanners do catálogo de funcionalidades não entram nesta
   história e nenhuma chave literal nova foi escrita.

**Dívida conhecida:** a aba *Leads*, onde a ficha fica guardada quando o e-mail
falha, hoje só é alcançada pelo administrador da conta (a chave `sites.leads` não
está em cargo nenhum — dívida registrada em 07/09).

### O logo do banco é subido UMA VEZ, no painel raiz (desde 2026-09-16)

O logo estreou por cliente: cinco arquivos vezes trinta e uma imobiliárias, e a
imobiliária nova nascia sem nenhum. O dono do produto mandou os cinco oficiais e
escolheu subir uma vez só.

O que aparece na tela:

- **Item *Plataforma*** no menu da Área do Admin (só a Leal Mídia), com o bloco
  *Logos dos bancos*: os cinco em lista, *Enviar logo* / *Trocar* e *Tirar*.
  Enviado ali, vale em todas as imobiliárias — inclusive nas que ainda nem
  existem. É o primeiro item de "configuração que vale para todo mundo de uma
  vez"; o que vier depois mora ali.
- **No Site Builder de cada cliente**, a linha do banco passa a dizer **"Logo
  herdado da Leal Mídia"** quando é o caso, e a **lixeira VOLTA A HERDAR** em vez
  de deixar sem logo. Quem tem arte própria de parceria continua enviando a dela,
  e a dela ganha.

Decisões (não reabrir sem o dono pedir):

- **Vazio no cliente = herda**, nunca "sem logo" — a doutrina de toda a
  plataforma. Enviar um logo no Site Builder continua sendo a exceção, não o
  caminho normal.
- **O painel raiz grava o mapa INTEIRO** a cada ação. Gravar banco a banco
  deixaria a tela e o servidor discordando se a rede caísse no meio.

Armadilhas:

1. ⚠️ **Logo igual ao herdado NÃO pode viajar no Salvar do Site Builder.** Sem
   essa regra, bastava um gestor abrir *Configurações* e salvar sem mexer em nada
   para aquele cliente **congelar** o logo de hoje como escolha dele — e no dia em
   que a Leal Mídia trocasse a arte ele continuaria com a antiga, **calado**. É a
   mesma regra que o link oficial já tinha, e há spec dos dois lados.
2. **A tela precisa distinguir *herdado* de *meu***, e quem responde isso é um
   lugar só (`bankLogoSource`, no arquivo de tradução). Sem a distinção a lixeira
   vira "ficar sem logo" e o gestor não entende o que o botão faz.
3. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a configuração da plataforma, o logo resolvido e o
   `default_logo_url` moram lá — e, principalmente, o conserto que faz uma imagem
   da plataforma CARREGAR dentro do site de um cliente. Contra o servidor antigo a
   tela nova salva e nada aparece.
4. **Não é `featureKey` nem `clientToggleKey`** — é configuração de plataforma. Os
   scanners do catálogo de funcionalidades não entram nesta história.

### A barra de contato rola para fora, e o cabeçalho não salta (2026-09-17)

Relato do dono do produto, no dia seguinte à estreia do cabeçalho novo: *"não
curti esse número e esse email que ficam aparecendo fixos ao scrollar a tela"*.
Ele estava vendo DOIS defeitos ao mesmo tempo, no mesmo lugar:

1. **A barra de contato grudava.** Ela era desenhada DENTRO do bloco que prende o
   cabeçalho no topo, então telefone, e-mail e redes ficavam numa faixa escura
   presa na tela a rolagem inteira. Na home era pior: ali o cabeçalho é
   transparente sobre a capa e a barra nem existe — ela **surgia** na primeira
   rolagem, do nada.
2. **A home saltava na primeira rolagem.** O cabeçalho estava fora do fluxo sobre
   a capa e ENTRAVA no fluxo ao rolar, empurrando a página inteira para baixo a
   altura dele mais a da barra, de uma vez.

O que aparece na tela agora:

- **Nas páginas internas** a barra continua no topo, com telefone, e-mail e
  redes, e **rola para fora** com o conteúdo. Ao rolar fica só o cabeçalho.
- **Na home** ela não aparece em momento nenhum: o topo é a capa, e os mesmos
  contatos continuam no rodapé — que é onde já estavam antes desta barra existir.
- **O cabeçalho da home não salta mais**: ele flutua sobre a capa e segue
  flutuando ao rolar, só trocando de transparente para sólido.

Decisões (não reabrir sem o dono pedir):

- **A barra é do TOPO DA PÁGINA, nunca do bloco que gruda.** Ela nasceu em
  16/09 para dar endereço a telefone e e-mail, que eram cadastrados e invisíveis;
  isso continua valendo. O que ela não pode é ocupar uma faixa permanente da
  tela durante a leitura do site inteiro.
- **Na home ela não entra.** Colocá-la no cabeçalho flutuante a faria flutuar
  junto — o defeito de volta com outra roupa — e empurrar o título da capa para
  baixo, que é o espaçamento que o hero compensa na mão.

Armadilhas:

1. **Quem desenhar a barra dentro do bloco que gruda devolve o defeito.** Há spec
   que reprova (`portalHeader.spec.tsx`): ela confere que o telefone não está
   dentro de um bloco preso, que na home ele não aparece nem depois de rolar, e
   que o cabeçalho da home nunca vira `sticky`.
2. **Na home o cabeçalho é `fixed`, jamais `sticky`.** `sticky` o coloca no fluxo
   e traz o salto de volta — e o salto só aparece ao rolar de verdade, nunca numa
   conferência parada.
3. **Não houve mudança no servidor.** É posicionamento de tela, do começo ao fim.

## Roleta sem prazo de aceite (desde 2026-09-16)

Pergunta do dono do produto: *"se tivéssemos essa condicional de não ter prazo
pra expirar, como funcionaria a roleta?"* — e o pedido em seguida: *"faz o plano
pra implementar a roleta SEM PRAZO pra gente"*. A mecânica mora no servidor
(ver o CLAUDE.md do `lm-flow`); aqui está o que a tela ganhou.

O que aparece na tela:

- **Chave *Sem prazo de aceite***, logo abaixo de *Tempo limite para aceite
  (minutos)* na roleta (e, compacta, no atalho *+ Criar roleta* do card).
  Ligada, o campo de minutos some e o texto explica: a oferta fica com o
  corretor até ele aceitar ou recusar; não há repasse automático nem
  "ninguém assumiu" — oferta parada se resolve reatribuindo o lead na mão. No
  Leilão: todos recebem, o primeiro que aceitar leva, e não cai no rodízio.
- **O selo *Aguardando seu aceite*** (card, lista, card aberto, conversa) e a
  **faixa amarela do topo** mostram *sem prazo* no lugar dos minutos.
- **A tela de aceite** perde o cronômetro: cabeçalho *Sem prazo de aceite*, sem
  contagem, sem "prazo esgotado", e o rodapé diz que o lead não passa para
  outro corretor sozinho.
- Nas listas (*Prazo: sem prazo*) e no resumo dos padrões da casa.

Decisões (não reabrir sem o dono pedir):

- **Zero é "sem prazo"**, e só a CHAVE produz o zero. O campo numérico em
  branco continua caindo em 30 (já era assim no `onChange`); a regra mora em
  `timeoutMinutesPayload` (`roletaFormChecks.ts`), função pura com spec — a
  falha aqui é MUDA (a tela diz *sem prazo* e o servidor recebe 30, ou o
  contrário).
- **`deadline` nulo NÃO é "prazo esgotado".** `minutesLeft` passou a devolver
  `null` para oferta sem prazo; antes `new Date(null)` virava NaN → 0 →
  "esgotado" em todo selo. A tradução mora em `offerDeadline.ts`
  (`hasDeadline`, `deadlineLabel`, `timeoutLabel`, `isNoDeadline`), num lugar
  só — nada de comparar zero/nulo no JSX.
- **Roleta existente não muda.** A chave nasce desligada, e a roleta carregada
  com zero abre com ela ligada (e o campo guardado em 30 para reaparecer se
  desligar).

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o servidor antigo recusa zero com "maior que zero" —
   visível, não mudo — e não manda `no_deadline`. Contra ele a chave aparece e
   o salvamento falha com o motivo na tela.
2. **A tela de aceite não pode iniciar o timer sem prazo.** O contador local
   zerava e disparava a releitura "prazo venceu"; com `deadline` nulo isso
   virava "Prazo esgotado" em vermelho numa oferta que nunca expira.
3. **O texto de fábrica do aviso escreve `{{prazo}} min`.** Com a roleta sem
   prazo o servidor resolve `{{prazo}}` como "sem prazo" — em template já
   gravado sai "sem prazo min". Quem tem roleta sem prazo edita o texto.
4. **Não é `featureKey` nem `clientToggleKey`** — é campo da roleta, não
   módulo. Os scanners do catálogo de funcionalidades não entram nesta história.

## O único administrador do cliente pode ser desativado pela Leal Mídia (desde 2026-09-16)

Relato do dono do produto, na tela *Equipe*: *"não dá pra desativar o
administrador"*. Não era cargo — era a proteção do último administrador, que
contava só quem está NA LISTA. A Leal Mídia é administradora de todo CRM e fica
fora da lista de propósito, então no cliente com um administrador só (a maioria)
NINGUÉM conseguia desativá-lo, nem ela. E o botão ainda dizia *"Seu cargo não
permite desativar esta pessoa"*, mandando procurar o problema no cargo.

- **Com a Leal Mídia clicando, a proteção não se aplica**: sempre há outro
  administrador para religar. Para o administrador do cliente a régua continua.
- **O botão diz o motivo certo**: próprio acesso, cargo, ou último administrador
  (*"promova outra pessoa a administrador antes"*).
- **Nada mudou no servidor**: ele nunca teve essa trava; era só a tela.

Armadilha: a régua mora em `deactivationRules.ts`, com spec, e não na tela. A
tela antiga de *Configurações > Usuários* (código morto, redireciona) ainda tem
uma cópia da regra antiga — quem a ressuscitar herda o defeito.

### Excluir cadastro: só o que nunca foi usado, e quem decide é o servidor (desde 2026-09-16)

Pergunta do dono do produto: *"excluir um cadastro não dá, né? pra tipo resetar
ele?"*. Para quem já atendeu, não dá mesmo — o caminho continua sendo
*Desativar*. Para o cadastro criado errado (e-mail digitado errado no convite,
pessoa que nunca entrou) entrou o botão **Excluir cadastro**, ao lado do
*Desativar* / *Reativar* na janela da pessoa.

O que aparece na tela:

- **A janela confere antes de oferecer apagar.** Ela pergunta ao servidor se a
  pessoa já foi usada (leads, conversas, mensagens, ofertas da roleta, cards,
  tarefas, visitas…). Nunca usada: *Apagar cadastro*, sem volta, e o e-mail fica
  livre. Usada: o motivo, com a contagem (*"já foi usado no CRM (3 leads, 1
  conversa)… Use Desativar"*), e só o botão *Fechar*.
- **O botão obedece à mesma régua do Desativar** (quem pode mexer em quem):
  gestor só em corretor, ninguém em si mesmo. Também aparece para pessoa já
  desativada — um administrador desativado por engano não conta mais como "o
  último administrador".

Decisões (não reabrir sem o dono pedir):

- **Sem veredito do servidor, a resposta é NÃO.** Servidor antigo ou prévia que
  falhou: a janela explica e não oferece o botão. Oferecer no escuro contra o
  endpoint antigo apagaria gente com histórico respondendo "sucesso" — era o
  que ele fazia (ver o CLAUDE.md do `lm-flow`).
- **Isto NÃO é a volta do "Remover do time".** A tela não chama o apagar direto;
  o spec de fonte trava que ele só existe dentro da janela que lê o veredito.
- **A tradução do veredito mora em `deactivationRules.ts`** (`eraseVerdict`),
  com spec, e não na janela.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o veredito na prévia e a recusa com motivo moram lá.
   Contra o servidor antigo a janela abre e diz que ainda não sabe responder.
2. **Não é `featureKey` nem `clientToggleKey`** — é cargo, não módulo. Os
   scanners do catálogo de funcionalidades não entram nesta história.

## O aviso da roleta pode sair por uma instância da Leal Mídia (desde 2026-09-16)

Testando a roleta multinúmero, o dono do produto pediu que o campo *Número que
envia os avisos* aceitasse a instância da Sara — que existe no servidor Evolution
compartilhado e não é canal deste cliente. A mecânica mora no servidor (ver o
CLAUDE.md do `lm-flow`); aqui está o que a tela ganhou.

O que aparece na tela, no campo *Número que envia os avisos* da roleta:

- **Seção *Instâncias da Leal Mídia (fora deste CRM)***, no fim da lista, só
  para a Leal Mídia. Traz as instâncias soltas do servidor compartilhado (as
  que não são canal de nenhuma imobiliária — canal do CRM da própria Leal
  Mídia entra), com *(desconectada)* quando for o caso.
- **Seção vazia vem com o motivo embaixo do campo**, em âmbar: o servidor diz
  por que não sobrou instância (não devolveu nenhuma, todas são canal de
  imobiliária, credencial recusada), e a falha da própria chamada vira um
  texto fixo. Na estreia a seção apareceu vazia e muda, e isso é
  indistinguível de defeito.
- Escolhida uma, o texto embaixo diz o efeito: corretor, gestor e grupo
  recebem os avisos vindos dela — e o aviso que chegar num número que também é
  canal deste CRM vira uma conversa na caixa dele (a guarda de chegada só
  descarta mensagem entre números da própria conta).
- **O botão *Testar* sai pela mesma instância.**
- Para o gestor do cliente o campo é o de sempre: só os canais do CRM.

Decisões (não reabrir sem o dono pedir):

- **O seletor guarda canal OU instância num valor só**, e a instância vence.
  A tradução mora em `senderSelectValue`/`senderFields` (`roletaFormChecks.ts`),
  função pura com spec — a falha aqui é MUDA (a tela mostra a Sara e o aviso
  sai pelo canal).
- **A chave da instância só viaja pela Leal Mídia.** O servidor recusa outro
  cargo gravando um nome; omitir a chave deixa em paz o que a Leal Mídia gravou
  quando o gestor do cliente salva a mesma roleta.
- **A instância já gravada aparece mesmo fora da lista** (ou sem a lista, para
  quem não a alcança): sumir com ela faria o próximo *Salvar* apagar a escolha,
  calado. Mesma doutrina da roleta desativada no *Destino do lead* da landing.
- **A leitura da lista é de fundo e não grita**: recusa ou falha só esconde a
  seção.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a coluna, o envio e a lista moram lá. Contra o servidor
   antigo a seção fica vazia e a chave é descartada no salvamento.
2. **`notification_inbox_id` vai NULO quando há instância escolhida.** Os dois
   preenchidos seriam duas verdades sobre o remetente.
3. **Não é `featureKey` nem `clientToggleKey`** — é campo da roleta, não módulo.
   Os scanners do catálogo de funcionalidades não entram nesta história.

## A landing de anúncio deixou de carregar o CRM inteiro (desde 2026-09-17)

Relato do dono do produto, com o PageSpeed na mão: *"as nossas LPs estão muito
lentas... precisamos melhorar o carregamento para parar de perder tráfego"*.
Desempenho 52 no celular, na landing do Bonfiglioli.

**A landing morava dentro do app do CRM.** O endereço `/lp/...` abria o mesmo
`index.html` do CRM: mais de 1 MB de código, 367 KB de estilo, três famílias de
fonte do Google carregadas de forma bloqueante, o service worker, o i18n, o
Sentry — tudo isso ANTES de a página sequer pedir o conteúdo dela ao servidor.
Só depois vinham o texto e as fotos, e a capa vinha na foto ORIGINAL do celular.
Quem clicava no anúncio esperava o CRM inteiro para ver uma página de um imóvel.

O que mudou:

- **`/lp/*` passou a ser servido por um HTML próprio** (`lp.html`), que carrega
  SÓ o que a landing usa: React, os blocos da landing e o estilo deles. Sem
  roteador, sem os contextos do CRM, sem service worker. O Vercel manda todo
  `/lp/*` para ele (`vercel.json`); em dev, um middleware no `vite.config.ts`
  faz o mesmo. Medido no build: **113 KB (gzip) contra 373 KB** da entrada do
  CRM — e o CRM ainda carregava o pedaço da landing por cima.
- **O conteúdo é pedido AINDA NO HTML.** Um script inline no `lp.html` começa a
  busca da landing antes de o código chegar, e a página consome essa resposta
  (`src/features/landing/public/landingLoader.ts`). Antes era uma fila: HTML →
  código → API → fotos, cada um esperando o anterior.
- **A capa tem prioridade e o resto é preguiçoso.** A foto de capa (o maior
  elemento da primeira tela, o LCP) pede `fetchPriority="high"` e usa a versão
  REDIMENSIONADA que o servidor passou a mandar; galeria, foto do corretor,
  selos, plantas e o vídeo carregam só quando se aproximam da tela.
- **Uma fonte só, carregada sem bloquear a pintura.** O texto aparece na fonte
  do sistema e troca quando a Inter chega.
- **Os arquivos de `/assets/` viraram cache imutável** no Vercel (são todos com
  hash no nome). Vale para o CRM também.

Decisões (não reabrir sem o dono pedir):

- **A view da landing NÃO conhece roteador.** `LandingPublicView` e
  `LandingResultView` (em `src/features/landing/public/`) recebem tenant, slug
  e resultado por props. A rota antiga do CRM (`/lp/:tenant/:slug`) continua
  existindo como rede para navegação interna e monta a MESMA view — mas em
  produção ninguém cai nela, porque o Vercel resolve antes.
- **A busca antecipada é consumida uma vez e só quando é da MESMA landing.**
  O corpo de uma resposta só pode ser lido uma vez, e reaproveitar uma que
  falhou repetiria a falha. Sem busca antecipada (rota antiga, placeholder não
  trocado), a página busca do jeito normal — o comportamento de sempre.
- **Os dois lados se somam, mas não dependem um do outro**: contra o servidor
  antigo (sem `hero_url`) a capa cai na original, como era; o HTML enxuto
  sozinho já derruba o carregamento.

Armadilhas:

1. ⚠️ **Nada de `@/components/layout`, `@/contexts`, `@/services` nem design
   system nos blocos da landing ou nas views públicas.** Cada import desses
   puxa o CRM de volta pro pacote da landing, e o defeito é MUDO: a página
   continua funcionando, só volta a ser lenta. Foi por isso que o `BrPhoneInput`
   passou a ser importado pelo ARQUIVO e não pelo índice de `@/components/shared`
   — o índice re-exporta o PhoneInput internacional com o CSS dele, e import de
   CSS é efeito colateral que o empacotador não descarta.
2. **O estilo da landing é gerado só das pastas listadas em `src/lp/lp.css`**
   (`source(none)` + `@source`). Classe nova usada por um componente FORA delas
   vale no editor (dentro do CRM) e NÃO vale na landing publicada. Componente
   novo usado pelos blocos entra na lista.
3. **`%VITE_API_URL%` no `lp.html` só é trocado quando a variável existe no
   build.** Sem ela o texto fica literal; o script inline confere e desiste da
   busca antecipada (a página busca sozinha). Não confundir com `.env.example`:
   não há `.env` no repositório, a variável vem do projeto Vercel.
4. **A rota `/lp/(.*)` no `vercel.json` vem ANTES do curinga.** Invertida, o
   curinga engole tudo e a landing volta a abrir pelo CRM — calada, com o mesmo
   PageSpeed de antes.
5. **Não é `featureKey` nem `clientToggleKey`** — é infraestrutura de carga. Os
   scanners do catálogo de funcionalidades não entram nesta história.

**Dívida conhecida:** a landing continua sendo montada no navegador (não há
HTML pré-renderizado com o conteúdo dentro). O próximo degrau, se o PageSpeed
ainda cobrar, é o servidor devolver o HTML já com o conteúdo — mas isso é outra
arquitetura de hospedagem, não um ajuste.

### A landing chega com o conteúdo dentro, e o Pixel espera a página (desde 2026-09-17)

Segundo PageSpeed do dono do produto, já com a entrada enxuta no ar: a capa
continuava fora do alcance do navegador até o React montar (*"a solicitação
não é detectável no documento inicial"*), a corrente crítica ainda terminava
na chamada à API (mais de um segundo, em outra origem), e o script do Pixel
da Meta (~250 KB, cache de 20 min que é DELA) disputava rede e processador
com a primeira tela.

O que mudou:

- **O middleware do Vercel (`middleware.ts`, na raiz) costura o conteúdo no
  HTML.** Ele busca a landing na API do lado de lá (a um salto), troca o
  marcador `<!--LM_LANDING_DATA-->` do `lp.html` por `window.__lmLanding`
  já resolvido e por um `<link rel="preload">` da capa, e cacheia a resposta
  na borda por um minuto. O visitante não pede nada à API antes da primeira
  tela, e a capa começa a baixar junto com o código. A costura é função pura
  com spec (`src/features/landing/public/landingHtml.ts`); o middleware é a
  casca.
- **O Pixel entra depois da página carregar** (`metaPixel.ts`): `init` e
  `PageView` saem na hora pela fila oficial da Meta; o script é baixado no
  `load` (teto de 3 s). O PageView conta do mesmo jeito.

Decisões (não reabrir sem o dono pedir):

- **O middleware só ACELERA; nunca é o único caminho.** API fora, 404,
  variável ausente, `lp.html` inalcançável, tempo esgotado: tudo cai no
  rewrite de sempre e a página busca sozinha. A busca antecipada do script
  inline continua existindo e pula quando o conteúdo já está na janela.
- **A capa pré-carregada é a MESMA que o bloco vai mostrar** (`lcpImageUrl`
  espelha a regra do bloco de capa: imagem do editor, senão a capa
  redimensionada, senão a original). Divergir baixaria duas fotos e nenhuma
  mais cedo.
- **Cache de UM minuto na borda**, com `stale-while-revalidate`: "publiquei e
  o anúncio ainda mostra o texto velho" dura segundos.

Armadilhas:

1. **O `matcher` do middleware é `/lp/:path*` e NÃO alcança `/lp.html`** — é o
   próprio middleware que busca `/lp.html` da implantação; um matcher largo
   entraria em laço.
2. **JSON dentro de `<script>` vai escapado** (`jsonForScript`): um `</script>`
   digitado numa seção de texto fecharia a tag e executaria o resto como HTML.
   Há spec.
3. **O middleware roda no runtime de borda**: só APIs Web, imports relativos
   (o apelido `@/` é do Vite) e nada de `@vercel/edge` — o "segue em frente" é
   o cabeçalho `x-middleware-next`.
4. **A resposta do middleware leva `x-lm-landing: inline`.** É como se confere,
   de fora, se a costura aconteceu ou se a página caiu no caminho antigo.

## O relatório da semana aparece no clique, e a tela diz o que travou (desde 2026-09-21)

Relato do dono do produto: *"a algum tempo tentamos desenvolver o relatório da IA mas
simplesmente não consigo extrair esse relatório de maneira alguma"*. Na aba
*Relatórios*, dentro de *IA Vendedora*, o botão *Gerar prévia* dava aviso vermelho na
hora — e a frase que aparecia era a de reserva DESTA tela, não uma explicação do
servidor. Ou seja: a resposta voltava sem motivo nenhum dentro, e a tela mandava
procurar o problema no lugar errado.

A causa é do servidor e está contada por lá. O que mudou aqui:

- **O relatório aparece no clique.** O botão devolve os números da semana na hora, e
  a tela já os mostra. O que continua em segundo plano é só a **redação da IA** — o
  aviso passou a ser *"Números prontos. A IA está escrevendo o texto..."*, e depois
  *"Texto pronto"*. Antes a tela dependia do segundo plano para ter QUALQUER coisa:
  um tropeço lá e ela ficava vazia, sem nada explicando.
- **Botão *Por que não está saindo?***, ao lado de *Gerar prévia*. Ele lista o
  caminho inteiro com um sinal por peça — onde o relatório é guardado, os números da
  semana, a redação da IA, o segundo plano, o número que envia e para quem vai — cada
  uma com o motivo em português, vindo do servidor. É clique explícito: a conferência
  é cara do lado de lá.
- **Faixa âmbar com o que não deu certo**, acima dos números. Medição quebrada e
  semana parada produziam a MESMA tela — tudo zero, nenhum aviso.
- **Estado vazio que ensina o caminho**, no lugar do nada que parecia defeito.
- **Sem relatório na tela, a frase mudou**: *"O servidor não respondeu a este pedido.
  Use 'Por que não está saindo?' abaixo."* — e o diagnóstico é disparado sozinho. A
  frase antiga ("Não consegui montar a prévia") afirmava algo sobre a prévia que a
  tela não tinha como saber.

Armadilhas:

1. **Não voltar a esperar o segundo plano para TER o relatório.** É a origem exata do
   relato, e o defeito é MUDO: a aba fica vazia e nada aparece em lugar nenhum. Há
   spec que trava isso (`weeklyReportPreview.spec.ts`): o POST devolve o relatório
   pronto, e falhar a redação não pode custá-lo.
2. **Frase de reserva da tela nunca deve afirmar a causa.** Quando não há corpo de
   erro, o que a tela sabe é só que o servidor não respondeu — dizer mais que isso é
   o que fez este defeito passar semanas apontando para o lado errado.
3. **O diagnóstico é de CLIQUE, nunca busca de abertura.** Do lado do servidor ele
   fala com o WhatsApp operacional; chamado ao abrir a aba, seria uma ida à Evolution
   por visita, em todo cliente.
4. **Situação nova vinda do servidor precisa de cor aqui.** Hoje são quatro: ok,
   alerta, falha e *conferindo*. Sem cor, a linha sai com a aparência de falha — que é
   outra coisa.
5. **Não é `featureKey` nem `clientToggleKey`** — é a aba que já existe atrás de
   `ia_insights`. Os scanners do catálogo de funcionalidades não entram nesta história.

### O diagnóstico chega em duas levas (correção de 2026-09-21, no mesmo dia)

Horas depois de a tela subir, o dono do produto: **"Não consegui rodar o
diagnóstico."** — que é a frase de reserva DESTA tela. O botão *Por que não está
saindo?* caiu na mesma parede de 15 segundos que ele existe para explicar: do lado do
servidor, conferir o número operacional e a lista de destinos são duas conversas com o
WhatsApp que, somadas, esperam mais do que a requisição dura (ver o CLAUDE.md do
`lm-flow`).

O que aparece na tela agora:

- **As quatro primeiras linhas saem no clique** (onde o relatório é guardado, os
  números da semana, a redação da IA, o segundo plano).
- **As duas do WhatsApp aparecem como *conferindo***, com o rodinha no lugar do sinal,
  e são substituídas pelo veredito quando ele chega — a tela pergunta de 3 em 3
  segundos, com teto de ~90 segundos. Passando disso, elas dizem que a conferência
  está demorando, em vez de girar para sempre.
- **Clicar de novo confere de novo.** As perguntas da espera não reiniciam a
  conferência em andamento; só o clique manda refazer — senão, quem arruma o número e
  clica outra vez receberia o veredito de dez minutos atrás.

Armadilhas:

6. **Não voltar a esperar as seis linhas numa resposta só.** É a origem exata do
   relato, e o defeito é MUDO: a resposta volta sem motivo dentro e a tela mostra a
   frase genérica dela. Há spec do lado do serviço.
7. **A espera pergunta SEM `refresh`.** Com ele, cada pergunta reiniciaria a
   conferência e a tela nunca sairia de *conferindo*.

## Para quem a IA passa o lead (desde 2026-09-21)

Pergunta do dono do produto: *"hoje quando a IA passa o lead para um corretor,
como é o processo? ela escolhe um corretor e fodase?"* — e, com a resposta,
*"vou precisar disso para casos onde a IA tem que destinar os leads para pessoas
que estão em outros números"*.

**A IA nunca escolheu nada, e não havia onde escolher.** Ela jogava o lead na
roleta do NÚMERO em que a conversa estava, e ponto. Número sem roleta, roleta em
modo manual, roleta fora do horário, ou duas roletas no mesmo número sem nenhuma
marcada como *atende quem escreve direto*: em todos o lead ficava com a etiqueta
de atendimento humano, **sem dono e sem ninguém avisado**. A landing e o
formulário do Meta escolhem a roleta na tela deles desde sempre — só a IA, que é
quem mais conversa com o lead antes de entregar, não escolhia.

O que aparece na tela, em *IA Vendedora → Configuração*, logo abaixo de
**Quando ela passa para um corretor**:

- **Bloco *Para quem ela passa o lead***, com três cartões:
  - **A roleta deste número** — o que já estava valendo, e o que fica marcado em
    toda imobiliária que já existe;
  - **Uma roleta específica** — abre a lista de roletas; é o caso de a IA atender
    num número e os corretores atenderem em outros;
  - **Um corretor fixo** — abre a lista da equipe; sem roleta nenhuma, para o CRM
    de um ou dois corretores.
- **Escolheu o modo e deixou o alvo em branco → aviso em âmbar**, dizendo que o
  lead vai ficar sem responsável e que a gestão recebe um aviso a cada vez.
- **O cartão do corretor fixo diz que ele recebe com o botão de aceitar e SEM
  PRAZO**: a oferta fica com ele até aceitar ou recusar, porque não há para quem
  repassar.

Decisões (não reabrir sem o dono pedir):

- **O padrão é *A roleta deste número*, e é o primeiro cartão.** Escolha nova não
  muda o comportamento de quem nunca escolheu nada.
- **A roleta já escolhida continua na lista mesmo desativada**, com aviso. Sumir
  com ela faria o próximo *Salvar* apagar a escolha do gestor, calado — a mesma
  doutrina do *Destino do lead* da landing.
- **Trocar de modo limpa o alvo do outro**, e é o servidor que manda nisso
  também: alvo gravado por baixo do modo que não o usa é a segunda verdade sobre
  quem recebe o lead.
- **Leitura de fundo não grita.** Cargo sem acesso às roletas ou à equipe só não
  vê aquele seletor — a seção continua inteira.

Armadilhas:

1. **Os três campos PRECISAM estar na lista do `saveAgent`**, e o modo entra com
   `??` enquanto os dois ALVOS entram com `in`: voltar para "a roleta deste
   número" manda `null` para limpar, e o `??` devolveria a roleta velha por baixo
   — a tela mostrando uma coisa e o lead sendo entregue noutra. Há spec que
   reprova as duas coisas.
2. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): as colunas, quem entrega e os dois avisos moram lá.
   Contra o servidor antigo os cartões aparecem, salvam e nada muda.
3. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente, não módulo.
   Os scanners do catálogo de funcionalidades não entram nesta história, e nem o
   spec pode escrever o literal da chamada deles (o auditor varre todo arquivo
   `.ts` e não sabe que a linha é uma negação — foi assim que o build quebrou no
   PR do recorte por funil).

E o que vem junto, do lado do servidor: **quando a IA passa o lead, agora alguém
fica sabendo.** *"A IA te passou um lead"* vai para o responsável (é o caso do
CRM de um corretor só, onde antes a IA simplesmente se calava) e *"a IA passou um
lead e ele ficou sem ninguém"* vai para a gestão, **com o motivo dentro**. E o
aceite da oferta passou a calar a IA de vez: antes, o corretor que aceitava pelo
link e ia falar com o lead meia hora depois via a IA responder por cima dele. Ver
o CLAUDE.md do `lm-flow`.

## A IA não promete visita que não pode (desde 2026-09-21)

Relato do dono do produto: *"a IA vem prometendo visitas para clientes, às vezes
quando o cliente está no local ela confirma que está lá pra receber ele"*.

A causa é do servidor e está contada por lá: as regras de agendamento existiam e
estavam certas, mas a resposta era entregue ao lead ANTES de o horário ser
conferido — quando ele era recusado, o lead ficava com um *"fechou, te espero
quinta às 15h"* que não existia em agenda nenhuma.

O que aparece na tela, em *IA Vendedora → Configuração → Quando a IA pode marcar
visita*:

- **Chave *Visita para hoje só com o corretor confirmando***, logo abaixo da
  antecedência. Ligada (que é como toda IA nasce), a IA nunca marca visita para o
  mesmo dia por conta própria: ela diz que vai confirmar com o corretor e passa o
  lead na hora. E nunca afirma que alguém está no local esperando — quem confirma
  presença é o corretor.
- **A antecedência mínima ganhou a leitura em português**, embaixo do campo:
  *"Com 24 horas, o primeiro horário que ela oferece é amanhã."* Era um número
  solto, e ninguém lia "24" e pensava "amanhã" — que é exatamente o que ele faz.

E o que muda na conversa, sem campo novo: quando o lead pede um horário que não
cabe na janela, **a IA oferece outro** em vez de confirmar. Ela passou a receber
do servidor que horas são agora e quais horários estão livres, já calculados.

Decisões (não reabrir sem o dono pedir):

- **A chave nasce LIGADA.** Exceção consciente à regra da casa de estrear
  desligado, a mesma do gotejamento do follow-up: ela é a REGRA que o dono pediu,
  e nascer desligada a deixaria decorativa em todo agente que já existe.
- **O campo de antecedência continua em horas.** Trocar por uma lista de opções
  ("mesmo dia / 1 dia / 2 dias") tiraria o valor de quem já configurou um número
  fora da lista; a frase abaixo resolve o que faltava, que era entender o efeito.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a régua de horário, a conferência antes de a resposta
   sair e a chave moram lá. Contra o servidor antigo a chave aparece, salva, e a
   IA continua confirmando visita para hoje.
2. **A chave é lida com `!== false`**, nunca `=== true`: agente cuja configuração
   ainda não tem a chave precisa aparecer LIGADO, senão o gestor "liga" algo que
   já estava valendo. Mesma cicatriz do gotejamento do follow-up.
3. **Ela viaja dentro do `visit_config`**, que já está na lista campo-a-campo do
   `saveAgent` — campo fora daquela lista é descartado em silêncio, com a tela
   dizendo *Salvo*. Há spec de fonte para as duas coisas.
4. **A leitura da antecedência mora fora do JSX**
   (`src/features/salesAgents/visitWindow.ts`, com spec): a tela da IA já tem
   ~4.800 linhas. Mesma decisão da janela do follow-up.
5. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente, não módulo.
   Os scanners do catálogo de funcionalidades não entram nesta história.

## "Processando..." que nunca acaba na Base de Conhecimento (desde 2026-09-21)

Print do dono do produto: três arquivos da Base de Conhecimento da IA Vendedora —
dois de texto pequenos e um book de 8,4 MB — todos em **"Processando..."**, e
*"não acaba o carregamento"*.

A causa e o conserto são do servidor, e estão contados por lá (em resumo: um
arquivo cuja leitura travava era retomado para sempre, a cada passada do relógio,
e ia derrubando junto os arquivos que estavam do lado dele na lista).

O que mudou na tela:

- **O texto passou a dizer há quanto tempo**: *"Processando há 6 min"* no lugar do
  *"Processando..."* fixo, que é idêntico depois de dois segundos e depois de dois
  dias. Quem está olhando não tinha como saber se ainda andava ou se tinha parado.
- **Passados alguns minutos, um aviso em âmbar** embaixo do arquivo: a leitura
  está demorando mais que o normal, o sistema tenta sozinho, e se passar de 20
  minutos ele marca como falha e diz o motivo. A espera passou a ter FIM visível.
- **A mensagem de falha do servidor agora separa as duas causas** — "não chegou a
  começar" (vale clicar em *Tentar de novo*) e "começou e parou no meio" (o
  arquivo é o problema; o envio pelo WhatsApp continua, e para a IA aprender vale
  colar o texto). A tela só mostra o que vem de lá.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem retoma o arquivo preso, quem conta as tentativas e
   quem desiste com motivo moram lá. Contra o servidor antigo a tela mostra o
   tempo e o aviso, e a espera continua a de antes.
2. **A leitura do tempo mora fora do JSX**
   (`src/features/salesAgents/documentStatus.ts`, com spec): esta tela tem ~4.800
   linhas. Mesma decisão da janela do follow-up e da antecedência da visita.
3. **O aviso só aparece depois do tempo normal.** Aviso que aparece sempre vira
   paisagem e ninguém lê.
4. **A lista já se atualizava sozinha a cada 4 segundos enquanto houvesse arquivo
   pendente** — é ela que faz o contador de minutos andar. Quem tirar esse ciclo
   congela o tempo mostrado.
5. **Não é `featureKey` nem `clientToggleKey`** — é exibição de lista. Os scanners
   do catálogo de funcionalidades não entram nesta história.

## A IA só passa o lead depois de arrancar as informações (desde 2026-09-21)

Pergunta do dono do produto, olhando o cenário *"Só quando o lead estiver quente"* já
marcado em *Lead morno ou quente*: como fazer a IA mandar o lead pra roleta ANTES do
agendamento, *"só após pegar as informações mesmo ali do lead"*. E, ao ver que aquele
cenário não garante isso: **"o problema é tipo QUANDO o lead fica morno? precisamos
pelo menos extrair as perguntas iniciais e se certificar disso"**.

Ele estava certo. Aquele cenário é uma **permissão, não um gatilho** — quem decide a
hora continua sendo a IA, e a instrução que ela recebe manda conduzir até oferecer a
visita. E "morno" é palpite dela: uma linha de instrução (*interessado sem urgência*),
sem exigir uma pergunta respondida. Um *"oi, gostei desse aí"* podia liberar a entrega
no primeiro turno, com a ficha em branco. Pior: as *Perguntas de qualificação* que o
gestor escreve **nunca eram conferidas** — entram no comando como recado, e ninguém
olhava se ela tinha descoberto.

O que aparece na tela, em *IA Vendedora → Configuração → Quando ela passa para um
corretor*:

- **Cartão novo *Só depois de arrancar as informações do lead***, entre *Só quando o
  lead estiver quente* e *Só se ela não souber responder*.
- Escolhido, ele abre **a lista das suas *Perguntas de qualificação* com uma caixinha
  em cada**: as marcadas são as que seguram o lead. Ficha incompleta, a IA não passa e
  não promete passar — continua conduzindo.
- **Aviso em âmbar quando nenhuma está marcada**, dizendo que aí TODAS valem e
  sugerindo marcar só as que realmente importam.
- **Pergunta obrigatória que saiu da lista continua aparecendo**, marcada e com o selo
  *(fora da sua lista)*, mais o aviso de que ela ainda segura o lead.
- **A saída de emergência fica escrita embaixo**: lead que pede a visita, quer marcar
  dia e hora ou fala em fechar passa na hora, mesmo faltando pergunta — e o irritado,
  o que pede uma pessoa e o que percebeu que é IA também.
- **Sem pergunta de qualificação escrita**, o cartão diz que não há o que exigir e que
  ali a IA entrega como sempre entregou.

Decisões do dono (não reabrir sem ele pedir):

- **Só as perguntas que ele MARCAR seguram** (contra "todas as que eu escrever"):
  exigir as seis de fábrica travaria quase todo lead no orçamento.
- **A saída de emergência é regra, não exceção tolerada.** Quem quer avançar não fica
  refém do questionário.
- **Nenhum cartão novo muda a IA de ninguém**: o cenário é uma escolha, e toda
  imobiliária continua no que já estava marcado.

Armadilhas:

1. ⚠️ **Lista de obrigatórias VAZIA significa TODAS no servidor, não nenhuma.** Por
   isso as caixinhas aparecem todas MARCADAS nesse caso — desenhá-las desmarcadas
   faria a tela mentir sobre o que está valendo. E desmarcar a partir daí grava as
   outras EXPLICITAMENTE, senão a lista continuaria vazia e a caixinha voltaria
   marcada sozinha. Desmarcar a ÚLTIMA é recusado: gravar `[]` religaria todas.
2. **Obrigatória que saiu da lista NÃO some da tela.** O servidor a mantém segurando o
   lead (afrouxar o portão em silêncio é o pior desfecho aqui); esconder aqui a
   tiraria do portão sem ninguém ver.
3. **O intervalo de acentos vai escrito como `̀-ͯ`**, nunca com os
   caracteres combinantes literais — qualquer normalização de editor os apaga calado e
   a comparação passa a nunca casar, deixando a pergunta desmarcada com o portão ainda
   cobrando. **Este defeito nasceu de fato nesta leva e foi o spec que o pegou**; é a
   terceira vez da mesma cicatriz (o conversor de endereço da landing e a leitura das
   respostas do formulário). Há spec que lê o próprio fonte.
4. **As obrigatórias viajam DENTRO do `transfer_config`**, que já está na lista campo a
   campo do `saveAgent`. Como campo solto do agente seriam descartadas em silêncio, com
   a tela dizendo *Salvo*. Há spec de fonte.
5. **A regra mora fora do JSX** (`src/features/salesAgents/handoffChecklist.ts`, com
   spec): a tela da IA tem ~4.800 linhas. Mesma decisão da janela do follow-up e do
   banner da home.
6. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o cenário, o portão e o checklist que a IA preenche moram lá.
   Contra o servidor antigo o cartão aparece, salva, e a IA entrega como antes.
7. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente, não módulo. Os
   scanners do catálogo de funcionalidades não entram nesta história, e nenhuma chave
   literal nova foi escrita.

**Conserto de bônus, no servidor:** o painel raiz **gravava** o cenário de repasse e
nunca o devolvia — reabrir o agente mostrava "como está hoje" com um cenário ativo por
baixo, e o PATCH campo a campo podia regravar o vazio por cima. Mesmo defeito
write-only-true da chave *"seguir o horário de atuação"* do follow-up.

### Ficha completa passou a ENTREGAR na hora (2026-09-22)

Relato do dono no dia seguinte: *"mesmo arrancando as informações ele ainda continua
insistindo na visita"* — e o diagnóstico dele: *"o problema não é pedir visita, é que o
lead fica morno e ela não repassa mesmo com as informações; o correto seria já jogar na
roleta pro corretor ligar confirmar interesse"*.

Ele estava certo. O cenário nasceu como **portão** (*"não passe antes de a ficha
fechar"*) e nunca como **gatilho** (*"passe quando ela fechar"*): quem decidia a hora
continuava sendo a IA, e o comando dela manda conduzir até a visita. A causa e o conserto
são do servidor (ver o CLAUDE.md do `lm-flow`).

O que mudou na tela:

- **O cartão diz o desfecho**, não só a espera: *"Ela conduz até o lead responder as
  perguntas que você marcar como obrigatórias — e, na resposta da última, ENTREGA o lead
  na hora, sem oferecer visita"*.
- **Uma linha nova embaixo da lista**, antes da saída de emergência: respondida a última
  pergunta marcada, a IA avisa que um corretor vai falar com o lead e **sai de cena** —
  não oferece visita nem puxa outro assunto.
- **Sem pergunta de qualificação escrita, essa promessa NÃO aparece** — ali o servidor
  não dispara nada, e prometer entrega seria mentir na tela.

Armadilhas:

1. **A ordem das duas linhas é a ordem da pergunta que o gestor faz**: primeiro "o que
   acontece quando a ficha fecha?" (é para isso que ele escolheu o cenário), depois "e
   quem não terminou de responder?". Há spec para as duas.
2. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem entrega é o servidor, no fim do turno. Contra o servidor
   antigo o cartão promete a entrega e a IA continua conduzindo — exatamente o defeito
   relatado.
3. **Não é `featureKey` nem `clientToggleKey`** — é texto de tela. Os scanners do
   catálogo de funcionalidades não entram nesta história.


## A visita marcada pela IA avisa o grupo do cliente (desde 2026-09-22)

Pedido do dono do produto: *"quando a IA agenda visita precisamos notificar no
grupo do cliente"*. O grupo é o que temos com cada imobiliária ("APTO PREMIUM x
Leal Mídia") — o mesmo do relatório da semana e do aviso de aula nova —, e as
visitas que contam são **só as que a IA marcou**, não as que o corretor marca à
mão. As duas escolhas foram dele.

O que aparece na tela, no item **Plataforma** da Área do Admin (só a Leal Mídia),
num bloco novo *Aviso de visita da IA*:

- **O texto da mensagem**, editável, com os trechos entre chaves preenchidos na
  hora do envio e um *Voltar ao padrão* quando alguém reescreveu.
- **A lista das imobiliárias**, com busca e o contador de quantas estão ligadas.
  Cada linha tem a chave de liga/desliga e abre mostrando **em qual grupo o aviso
  cairia**.
- **Aviso em âmbar quando não cairia em lugar nenhum**: a imobiliária tem dois
  grupos e ninguém escolheu, ou nenhum grupo dela foi reconhecido.
- **Botão *Mandar um teste***, por imobiliária, que cai no grupo de verdade
  marcado como teste.
- **Os últimos avisos**, no rodapé do bloco.

Decisões (não reabrir sem o dono pedir):

- **Nasce DESLIGADO em toda imobiliária.** A mensagem cai num grupo com gente de
  verdade dentro, pelo nosso número institucional, e não há como desfazer um
  disparo. Ligar é um clique, por cliente.
- **A lista de clientes vem SEM o grupo resolvido.** Descobrir em qual grupo o
  aviso cairia é uma conversa com o WhatsApp mais uma varredura no banco daquele
  cliente; fazer isso para trinta e uma imobiliárias de uma vez não cabe numa
  requisição, e a resposta voltaria **sem motivo nenhum dentro** — a falha que
  este produto já diagnosticou errado duas vezes na aba de Relatórios. O grupo de
  cada cliente só é buscado quando alguém abre aquela linha.
- **Ligar a chave RELÊ o destino na hora.** Ligar sem saber para onde vai é o
  pior desfecho aqui: o motivo aparece junto com a chave virando, não depois.
- **O botão de teste respeita a chave.** Teste é uma mensagem de verdade num
  grupo de verdade; cliente desligado recebe o motivo em português.

Armadilhas:

1. ⚠️ **A gravação manda SÓ a imobiliária que mudou.** O servidor mescla por
   cliente. Mandar o mapa inteiro apagaria a imobiliária criada depois de esta
   tela abrir, **em silêncio** — é exatamente a armadilha da janela *Destino do
   lead* da landing, que montava o bloco do zero e apagava o que não conhecia.
2. **O telefone do lead existe como variável e fica FORA do texto padrão**, de
   propósito: o grupo é compartilhado com a Leal Mídia, e dado pessoal de lead
   ali é escolha explícita de quem edita o texto.
3. **Os marcadores vêm do SERVIDOR** (`vars`), não de uma lista escrita aqui.
   Duas listas divergiriam, e a divergência aparece como "usei o que a tela
   ofereceu e saiu literal no grupo".
4. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o gatilho, o destino, o texto e a entrega moram lá.
   Contra o servidor antigo o bloco abre com o aviso de que não conseguiu
   carregar.
5. **A leitura dos dois formatos de erro da API** está no bloco (o padrão traz
   `error.message`; a recusa por cargo traz `error` como texto). Ler só o
   primeiro faz a recusa virar frase genérica.
6. **Não é `featureKey` nem `clientToggleKey`** — é configuração de plataforma,
   como os logos dos bancos. Os scanners do catálogo de funcionalidades não
   entram nesta história e nenhuma chave literal nova foi escrita.

### A linha mostra os DOIS grupos, e diz qual é qual (2026-09-22)

Print do dono do produto, na linha da Imobiliária Moeda Forte: um grupo só —
**LM FLOW LOGS**, marcado — e *"conseguimos colocar para aparecer o grupo de logs
interno e o grupo que definimos como o do cliente?"*. A causa está contada no
CLAUDE.md do `lm-flow`; aqui está o que mudou na tela.

- **Marcar um grupo deixou de sumir com os outros.** A lista agora é sempre tudo
  o que se reconhece daquela imobiliária: o grupo dela e o de logs internos, lado
  a lado, marcado ou não.
- **Cada grupo leva um selo**: *Grupo do cliente* (verde), *Logs internos*
  (cinza), *Reconhecido pelo nome* ou *Escolhido à mão*. Sem ele a linha mostra
  um nome de grupo solto — e "LM FLOW LOGS" não diz nada sobre para onde a
  mensagem iria, que é a única pergunta de quem está decidindo se liga um
  disparo irreversível.
- **O de logs explica o que é**: grupo da Leal Mídia sobre o cliente, e o aviso
  só sai ali se alguém marcar. O automático nunca o escolhe, e a frase embaixo da
  lista passou a dizer isso — senão "marquei nada e não sai nada" vira chamado de
  suporte.
- **Grupo cadastrado que o número operacional não listou aparece com o aviso**,
  em vez de sumir.

Armadilhas:

7. **O tipo do grupo vem do SERVIDOR (`kind`), nunca do nome dele.** Deduzir pelo
   texto chamaria de interno o grupo de uma imobiliária com "log" no nome — e,
   pior, deixaria o interno passar por grupo do cliente. Há spec.
8. **A regra mora fora do JSX** (`src/pages/SuperAdmin/aiVisitNoticeGroups.ts`,
   com spec). Mesma decisão das outras traduções deste repositório.
9. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o `kind`, o `found` e a lista completa vêm de lá. Contra
   o servidor antigo os selos saem como *Reconhecido pelo nome* e a lista volta a
   ser recortada pelos marcados.

## O grupo de WhatsApp do cliente pode ser definido depois de criado (desde 2026-09-22)

Pergunta do dono do produto: *"onde eu mudo ou defino o grupo de um cliente?"*.
Não havia onde. O servidor reconhece o grupo de uma imobiliária pelo **nome**
("APTO PREMIUM x Leal Mídia") e, acima disso, pelo **cadastro** na ficha do
cliente — mas o cadastro só existia no assistente *Novo cliente*. Cliente já
criado com grupo renomeado, ou com nome fora do padrão, não tinha campo nenhum:
a ficha só REENVIAVA o valor gravado em cada salvamento, para não apagá-lo.

O que aparece na tela, no painel raiz → Clientes → **Funções** de um cliente,
bloco novo **Grupos WhatsApp**, logo abaixo de *O que entra no funil*:

- **Duas linhas**: *Grupo do cliente* (lembretes, avisos, relatório da semana) e
  *Grupo de logs internos* (só a Leal Mídia). Cada uma mostra o que vale hoje:
  o **nome** do grupo quando há cadastro, *"Sem cadastro — reconhecido pelo nome
  do grupo"* quando não há, e em âmbar quando o grupo gravado **não aparece
  mais** entre os grupos do número operacional.
- **Botão *Definir* / *Trocar***, que carrega os grupos do número operacional
  (os que começam com o nome do cliente vêm primeiro) e grava. A primeira opção
  é *sem cadastro*, para voltar a valer o nome.
- **O texto do bloco diz a regra do nome** com o nome daquele cliente já
  encaixado, porque cadastrar é a exceção: quase todo cliente funciona só pelo
  nome, e o cadastro vence.

Decisões (não reabrir sem o dono pedir):

- **Os dois grupos viajam SEMPRE juntos**, em todo salvamento desta janela — o
  servidor apaga a chave que chega vazia, e PATCH parcial já apagou grupo de
  cliente antes. Quem monta esse pedaço do corpo é um lugar só.
- **O valor dos grupos vive em estado da janela, não na ficha que abriu a
  janela.** Os outros blocos (origens do funil, canais, franquia de IA) reenviam
  os grupos em cada salvamento; lidos da ficha velha, trocar o grupo e em seguida
  mexer em qualquer outro bloco devolveria o grupo antigo, calado.
- **O grupo gravado que sumiu da lista NÃO some da tela**: ele fica à vista com
  aviso, e continua escolhível no seletor. Sumir com ele faria o próximo
  *Salvar* gravar vazio sem ninguém ver.
- **A lista de grupos só carrega no clique**, nunca ao abrir a janela — é uma
  conversa com o WhatsApp operacional.
- **Só JID de grupo passa**; número de pessoa vira vazio antes de chegar ao
  servidor, que também recusa.
- **Nada mudou no servidor**: o endereço que grava os dois grupos já existia e já
  era usado pelo assistente de criação.

Armadilhas:

1. **A regra mora fora do JSX** (`src/pages/SuperAdmin/PooledClients/clientGroups.ts`,
   com spec): o painel tem ~1.400 linhas. É a mesma decisão das outras traduções.
2. **O intervalo de acentos vai escrito como `\u0300-\u036f`**, e há spec que lê
   o fonte — na estreia deste módulo a ferramenta de escrita converteu o escape
   nos caracteres literais, e foi o spec que pegou. Quarta vez da mesma cicatriz.
3. **Não é `featureKey` nem `clientToggleKey`** — é ficha do cliente no painel
   raiz. Os scanners do catálogo de funcionalidades não entram nesta história.

## O corretor recebe o lead com o que a IA descobriu (desde 2026-09-22)

Pergunta do dono do produto: *"quando a IA repassar o lead para o corretor, na
mensagem conseguimos colocar o resumo do que ela buscou? o mesmo que fica ali na
aba de conversas?"*.

O dado sempre existiu e aparecia em UM lugar: o bloco *O que a IA entendeu*, na
lateral da conversa. No repasse, o corretor recebia nome, telefone, prazo e o link
no WhatsApp, e a **tela de aceite — onde ele decide** — mostrava nome e telefone.
Ele assumia o lead sem saber que orçamento, região e prazo já estavam anotados, e
perguntava tudo de novo.

O que aparece na tela:

- **Na tela de aceite (o link do WhatsApp), o bloco *O que a IA já descobriu***,
  acima dos botões *Recusar* / *Aceitar*: selo de temperatura, etapa da conversa,
  interesse, como o lead está se sentindo, *Ela já perguntou* com os campos, as
  *Respostas do lead* (as perguntas obrigatórias da imobiliária, que até agora não
  apareciam em tela nenhuma), o resumo da conversa e o motivo do repasse. Lead que
  não passou pela IA — a maioria dos leads da roleta — não ganha bloco nenhum.
- **No WhatsApp do corretor**, três linhas dentro do mesmo aviso de sempre: a
  temperatura, até três campos (orçamento, região, prazo) e uma frase do resumo.
  A ficha inteira fica no link.
- **Chave *Mandar o resumo da conversa junto com o lead***, em *IA Vendedora →
  Configuração → Quando ela passa para um corretor*, abaixo dos cartões de
  cenário. Marcada em toda imobiliária; desmarcar volta ao aviso de antes.

Decisões (não reabrir sem o dono pedir):

- **O que vai no WhatsApp é curto; o que vai na tela de aceite é completo.** Sete
  linhas de ficha mais o resumo em prosa viram um tijolo no celular; e é na tela
  de aceite que a decisão acontece.
- **Quem MONTA o resumo é o servidor**, nos dois lugares. A tela não junta campo
  nenhum: o mesmo texto alimenta a mensagem do WhatsApp, e duas montagens
  divergiriam — "o WhatsApp diz uma coisa e a tela diz outra".
- **A chave estreia LIGADA**, com a mesma doutrina do gotejamento do follow-up:
  ela só acrescenta informação a um aviso que já sai, e existe para desligar em
  quem não quiser.
- **A chave fica FORA dos cartões de cenário**, porque não é de nenhum deles:
  vale em qualquer um.

Armadilhas:

1. ⚠️ **Trocar o cenário de repasse SUBSTITUI o `transfer_config` inteiro** (de
   propósito: a temperatura mínima e as perguntas obrigatórias não podem ficar
   penduradas). A escolha do resumo tem que SOBREVIVER a isso (`keepBriefing`),
   senão o gestor desliga o resumo, troca o cenário depois e ele volta a sair —
   calado. Há spec que confere que TODA escrita do cenário passa por lá.
2. **Ligar REMOVE a chave em vez de gravar `true`**, e a leitura é `!== false`.
   Gravar o padrão congelaria a escolha de hoje se o padrão da casa mudasse —
   mesma regra do texto de fábrica do portal e do tipo de venda no assistente.
3. **A chave viaja DENTRO do `transfer_config`**, que já está na lista campo a
   campo do `saveAgent`. Como campo solto do agente seria descartada em silêncio,
   com a tela dizendo *Salvo*. Há spec de fonte.
4. **O bloco da tela de aceite não desenha cabeçalho sem conteúdo**, e aguenta
   servidor antigo (campo ausente) e listas ausentes — cabeçalho sozinho parece
   tela quebrada.
5. **Rótulo novo de campo do resumo vem do servidor**, não de uma lista escrita
   aqui. Duas listas divergiriam, e a divergência apareceria como campo que existe
   no bloco da conversa e não no do aceite.
6. **A regra mora fora do JSX** (`src/features/salesAgents/handoffBriefing.ts`, e
   o bloco em `src/components/roleta/OfferAiBriefing.tsx`, os dois com spec): a
   tela da IA tem ~4.800 linhas e a de aceite é uma página só.
7. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem monta o resumo, quem o manda no WhatsApp e a chave
   moram lá. Contra o servidor antigo a chave aparece, salva, e nada muda.
8. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente, não módulo.
   Os scanners do catálogo de funcionalidades não entram nesta história e nenhuma
   chave literal nova foi escrita.

## Roleta: modo Fila (desde 2026-09-23)

Pedido do dono do produto: um quinto modo, **Fila**, que entrega sempre na ordem
da lista — Corretor 1 → 2 → 3 → volta ao 1. O Rodízio nunca foi fila: é sorteio
pelo peso, a cada lead. A mecânica mora no servidor (ver o CLAUDE.md do `lm-flow`).

O que aparece na tela (*Distribuição de Leads*):

- **Cartão *Fila*** em *Como o lead é distribuído* (a grade virou 3 colunas no `xl`).
- **Bloco *Ordem da fila***, acima da lista *Quem entra na roleta*, só com a Fila
  escolhida: os marcados numerados (1º, 2º, 3º…) com setas ↑/↓. Pausado aparece
  riscado — ele é pulado e a fila segue.
- **Na Fila o peso some**: nem campo *Peso*, nem *Distribuição real*. O link
  *Ajustar peso* vira *Mais ajustes* porque o mesmo bloco guarda o *Avisar em
  outro número*.
- **Painel da fila**: selo *próximo* no corretor da vez.

Decisões do dono (não reabrir sem ele pedir): **a vez anda a cada oferta** (quem
recusa ou deixa o prazo passar perde a vez) e **indisponível pula e segue**.

Armadilhas:

1. **A posição gravada é o índice no array de membros no Salvar** (`position: i`).
   Por isso reordenar é mover no array (`roletaQueueOrder.ts`, com spec) — não
   existe campo de posição para editar, e criar um seria a segunda verdade.
2. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o servidor antigo recusa `fila` com "modo de distribuição
   desconhecido", visível na tela.
3. **Não é `featureKey` nem `clientToggleKey`** — é modo da roleta. Os scanners do
   catálogo não entram nesta história.

### Sua vez na fila, na Dashboard do corretor (desde 2026-10-02)

Pedido do dono do produto: no modo Fila, o corretor vê na Dashboard a posição dele,
quase em tempo real. Cartão **Sua vez na fila** (`blocos/MinhaVez.tsx`, bloco
`minha_vez` no catálogo), ao lado de *Pendências*, só na visão do corretor.

- **"3º de 8 na fila"** e *"2 corretores na sua frente"*; na vez dele, *"Você é o
  próximo a receber"*. Pausado ou fora do sorteio: sem número, com o motivo e
  *"Fale com o gestor"*. Com oferta aberta: *"Você está com um lead esperando seu
  aceite"* no lugar da posição (a vez já passou por ele).
- **Desenho (pedido do dono, 02/10):** *Pendências* largo e o cartão da fila
  estreito, quase quadrado, à direita (`lateral` na linha do catálogo →
  `.lmfn-linha-lateral`, flex com 260 px; no celular, um embaixo do outro). Número
  grande no meio, nome da roleta em cima, setas embaixo.
- **Mais de uma roleta Fila: um cartão só**, com setas e "1 de 2", e dá para
  **arrastar para o lado** (pointer events, `touch-action: pan-y` para a página
  continuar rolando na vertical).
- **Atualiza a cada 2 minutos**, só com a aba visível, e na hora em que uma oferta
  dele chega ou sai (`usePendingOffers`, que já faz a ronda de 1 min do app).
- Sem roleta Fila, ou contra o servidor antigo, o cartão não desenha nada e a coluna
  some (`.lmfn-coluna:empty`): as *Pendências* ocupam a linha como antes. É por
  isso que a linha lateral é FLEX e não grid: com grid de duas trilhas fixas, a
  trilha do cartão sumido ficaria como buraco à direita.

Decisões do dono (não reabrir sem ele pedir): **só a posição DELE**, nunca a fila
com o nome dos colegas (essa é o *Roleta agora* do gestor); **2 minutos**, não
tempo real de verdade; **sem frase explicando que a posição pode pular** ("ninguém
recusa lead").

Armadilha: **a metade do backend vem PRIMEIRO** (`GET /broker_assignments/queue_position`,
na `saas-multitenant`). Sem ela o cartão simplesmente não aparece.

## O acesso vai por LINK, e a senha é criada por quem usa (desde 2026-09-22)

Relato do dono do produto, com print: uma corretora não entrava pelo iPhone —
*"Credenciais inválidas / Erro ao fazer login"*, com o e-mail e a senha visíveis
e corretos na tela. Ele testou o MESMO acesso no computador, em aba anônima, e
entrou normalmente. E não era uma pessoa: *"já aconteceu com outros corretores
que eu mandei o acesso"*.

Eram **três defeitos empilhados**, e o terceiro é o que fez os outros dois
passarem meses invisíveis:

1. **A senha viajava escrita numa mensagem de WhatsApp, e era copiada no
   celular.** No iPhone, o toque duplo que seleciona uma palavra leva **o espaço
   seguinte junto**, e o teclado acrescenta espaço ao aceitar a sugestão. A senha
   chegava ao servidor com um espaço no fim — visualmente idêntica à certa.
2. **O servidor limpava o e-mail e não limpava a senha.** Um espaço a mais
   bastava para a recusa.
3. ⚠️ **A tela de login mostrava a MESMA frase para toda falha.** Ela procurava o
   motivo do servidor no lugar errado, então nunca o encontrava: senha errada,
   acesso desativado, internet caída, servidor fora do ar e até **login aprovado
   que travou depois** apareciam como *"Credenciais inválidas"*. Foi o que fez
   três rodadas de investigação acusarem a senha de quem estava com a senha certa.

A saída escolhida pelo dono (*"pode ser a B pra justamente eles poderem criar,
faz mt sentido"*): **a senha para de viajar**. A mensagem leva um link; quem abre
cria a própria senha e já entra.

O que aparece na tela:

- **Tela nova de convite** (o endereço que chega no WhatsApp): saudação com o
  primeiro nome, o login da pessoa, dois campos de senha e o botão *Criar senha e
  entrar*. Criada a senha, ela cai direto no CRM — sem passar pelo login.
- **O botão *Enviar acesso* (tela Equipe) não pede mais senha.** No lugar do
  campo, a explicação: o link vale **uma vez só, por 24 horas**, e a senha de
  quem já usa o CRM **não muda**. Passado o prazo, é só enviar de novo.
- **O assistente *Adicionar pessoa* perdeu o campo de senha** — quem a define é a
  própria pessoa, ao abrir o link.
- **A tela de login passou a dizer o motivo de verdade**, quando o servidor manda
  um. E quando ele não manda, ela diz só o que sabe: *"O servidor não respondeu a
  este pedido"*.
- **Aviso novo: "Você entrou, mas este navegador não está guardando sua
  sessão"**, com o caminho de abrir no Safari/Chrome. É o navegador de dentro do
  WhatsApp, onde o corretor abre o CRM: ele recusa o armazenamento, a gravação
  **estourava**, e a exceção subia até a tela — que mostrava *Credenciais
  inválidas* para um login que o servidor tinha APROVADO.

Decisões (não reabrir sem o dono pedir):

- **A tela NÃO entra sozinha ao abrir o link.** O WhatsApp pré-visualiza links, e
  um convite consumido no carregamento seria queimado pela pré-visualização antes
  de a pessoa tocar nele. Abrir é leitura; só o botão consome.
- **Link de uso único, 24 horas.** Reenviar é um clique; link eterno num grupo ou
  num print é uma porta aberta para sempre.
- **A pessoa escolhe a senha dela.** Senha gerada pelo sistema volta ao problema
  de origem: alguém teria que copiá-la de algum lugar.
- **Os campos de senha e o login desligam correção e maiúscula automática.** Com o
  olho aberto, o campo de senha é um campo de texto comum — e o teclado do celular
  o "corrige".

Armadilhas:

1. ⚠️ **A guarda do roteador roda ANTES das rotas**, e manda para o login todo
   endereço fora da lista de públicos. `/acesso` entrou nas DUAS listas dela (a
   de públicas e a de isentas de auth): sem a primeira, o link cai no login — a
   tela onde a pessoa justamente não consegue entrar; sem a segunda, o aparelho
   que já tem a sessão de OUTRA pessoa (o gestor conferindo, o celular
   emprestado) é jogado nas conversas e o convite some. É a mesma cicatriz da
   porta de entrada da Área de Membros. Há spec.
2. ⚠️ **O cliente viaja no cabeçalho da requisição.** A pessoa abre o link no
   endereço da imobiliária dela, mas quem responde é a API — e daquele lado o
   subdomínio é `api`, que é reservado. Sem o cabeçalho, o servidor procura a
   pessoa no apartamento errado e recusa o convite como se fosse de outro
   cliente. O defeito é MUDO: a tela diz "este link não vale mais".
3. **Gravar a sessão NUNCA pode estourar.** Quem precisa saber se ela vai durar lê
   o sinal próprio (`sessionPersisted`), e a leitura na montagem também é
   protegida — com dados de site bloqueados, o simples ACESSO ao armazenamento
   estoura, e isso roda antes de qualquer tela aparecer.
4. **Frase de reserva nunca afirma a causa.** Sem motivo do servidor, o que a tela
   sabe é que o pedido não voltou. Há spec que reprova quem voltar a dizer
   "credenciais inválidas" ali.
5. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): o link, a tela de convite e a mensagem do WhatsApp moram
   lá. Contra o servidor antigo, *Enviar acesso* passa a mandar uma mensagem sem
   senha e sem link.
6. **As regras moram fora do JSX, com spec** (a régua da senha, a leitura do erro
   de login e a gravação da sessão). Mesma decisão das outras traduções deste
   repositório.
7. **Não é `featureKey` nem `clientToggleKey`** — é entrada no CRM. Os scanners do
   catálogo de funcionalidades não entram nesta história e nenhuma chave literal
   nova foi escrita.

## Duplicar a IA para outro número (desde 2026-09-23)

Pedido do dono do produto: *"agora que podemos personalizar bastante a IA, eu
gostaria de poder duplicar ela, para plugar em uma instância e replicar para
outra de forma fácil"*.

O que aparece na tela, em *IA Vendedora*, no topo da IA aberta:

- **Botão *Duplicar***, ao lado da lixeira. Abre a janela *Duplicar IA* com o
  **nome da cópia** (já sugerido como "<nome> (cópia)") e o **número em que ela
  vai atender** (ou *escolher depois*).
- A cópia leva a configuração inteira, as lições do Aprendizado e a Base de
  Conhecimento; **não leva o histórico**. Ao terminar, ela vira a IA selecionada,
  na aba *Configuração*, e o aviso diz o que foi junto.
- **Nasce DESLIGADA**, sempre — a janela e o aviso dizem isso. Escolher o MESMO
  número da original mostra um alerta em âmbar.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): quem copia é o servidor, pelas colunas do banco. Contra o
   servidor antigo o botão responde 404, com o código na tela.
2. **A cópia NÃO passa pelo `saveAgent`**: é um endpoint próprio, e o servidor
   copia tudo — inclusive campo que esta tela ainda nem desenha.
3. **O texto do resultado mora fora do JSX** (`src/features/salesAgents/duplicateAgent.ts`,
   com spec).
4. **Não é `featureKey` nem `clientToggleKey`** — é ação da IA, com a permissão de
   criar IA. Os scanners do catálogo não entram nesta história.

## A IA pode valer só para alguns formulários (desde 2026-09-23)

Pedido do dono do produto: o cliente roda várias campanhas e só quer a IA nos
leads de duas delas; as outras chegam no WhatsApp com origem Facebook e a IA
entrava também.

O que aparece na tela, em *IA Vendedora → Configuração → Gatilhos de ativação*:

- **Tipo novo *Veio de um destes formulários***, com a lista dos formulários
  cadastrados em *Origem → Formulários* (nome e página) para marcar.
- **Aviso em âmbar** quando nenhum está marcado (o gatilho não ativa ninguém), quando
  não há formulário cadastrado, e quando outro gatilho largo (origem, funil, imóvel)
  na mesma lista, em modo OU, continua deixando as outras campanhas entrarem.
- Formulário escolhido que deixou de estar cadastrado **continua à mostra**, marcado,
  com o selo *(não está mais cadastrado)*.

Armadilhas:

1. **A metade do backend vem PRIMEIRO** (`lm-flow`, `saas-multitenant`): quem casa o
   lead com o formulário é o servidor. Contra o servidor antigo o gatilho é salvo sem a
   lista e não casa com ninguém.
2. **A lista viaja DENTRO de `triggers`**, que já está no PATCH do `saveAgent`. Campo
   solto seria descartado em silêncio. Há spec de fonte.
3. **A regra mora fora do JSX** (`src/features/salesAgents/formTrigger.ts`, com spec).
4. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente.

## O Modo Plantão não some mais do celular (desde 2026-09-24)

Relato do dono do produto: *"o modo plantão ficou oculto no celular"*. Nada
tinha quebrado: o botão **sumia de propósito** quando o navegador não recebe
notificação — e sumir calado é indistinguível de defeito. Os casos reais são
dois, e os dois ficaram mais comuns depois que o acesso passou a ir por link no
WhatsApp (2026-09-22):

- **iPhone fora do app instalado.** A Apple só libera notificação de site para o
  app adicionado à Tela de Início; no Safari solto não existe push.
- **Navegador de dentro do WhatsApp/Instagram**, onde o corretor cai ao tocar no
  link de acesso. Ali não há push em aparelho nenhum.

Hoje o sino fica **apagado** no topo e, no toque, diz qual dos casos é e o que
fazer (instalar na Tela de Início / abrir no Chrome ou Safari).

Armadilhas:

1. **Não voltar a devolver nada quando não há suporte.** É o defeito relatado.
2. **O navegador de dentro de outro app vence o caso do iPhone**: instalar dali
   não funciona, o primeiro passo é sair dele. A regra mora em
   `plantaoSupport.ts`, com spec.
3. **Não é `featureKey` nem `clientToggleKey`**, e não há metade de backend.

## Imóvel que entrega os leads direto ao responsável (desde 2026-09-24)

Pedido do dono do produto: *"temos 3 imóveis no The House que precisam ser
direcionados pro Bruno e 2 imóveis no Collinas pro Rene"* — e o desenho foi dele:
*"uma chave onde você liga falando esse responsável deve receber todos os leads…
o imóvel que está lá anunciado, por padrão, cai na roleta ou no destino do portal;
e se essa chave estiver ligada no imóvel X, aí ele direciona especificamente para
o responsável"*.

Antes disto o campo *Corretor responsável* do imóvel era **cadastro e nada mais**:
ele não decidia nada. O lead que chegava por um anúncio de portal seguia a regra
configurada no portal (roleta ou responsável fixo), e o da landing de anúncio
seguia a roleta escolhida ali — não havia exceção por imóvel.

O que aparece na tela:

- **Chave *Leads deste imóvel vão direto para o responsável***, na ficha do imóvel,
  **colada embaixo do seletor de Corretor responsável**. Ligada, o lead que chegar
  por este imóvel (portal ou landing) nasce com aquele corretor, sem passar pela
  roleta. Desligada — que é como todo imóvel nasce — nada muda.
- **Aviso em âmbar quando a chave está ligada e não há responsável escolhido**, e o
  *Salvar* recusa antes de bater na API: o servidor rejeita o cadastro inteiro
  assim, e descobrir isso no clique transformaria um deslize em erro na cara de
  quem cadastrou.
- **No cartão do imóvel, a linha *Leads vão para <nome>***, em violeta. Sem ela, o
  filtro abaixo mostraria quais imóveis têm regra e não para quem — que é a outra
  metade da pergunta.
- **Filtro *Só com destino próprio*** na barra de filtros de *Imóveis*. É o que
  responde "quais dos 900 têm regra?" — sem ele, achá-los exigiria abrir um a um.
- **Na janela de *Desativar* uma pessoa, o aviso em âmbar** *"os leads de 3 imóveis
  (TH302, TH303…) vão direto para ele; desativado, esses leads passam a cair na
  regra do portal"*. É o silêncio mais caro desta chave: o anúncio continua no
  portal, o lead continua chegando, e ninguém liga uma coisa à outra.

Decisões do dono (não reabrir sem ele pedir):

- ⚠️ **A chave é por IMÓVEL, e é essa a peça central.** Uma chave por cliente
  ("lead de imóvel vai pro responsável do imóvel") redirecionaria os ~900 da Mais
  Que Imóveis de uma vez: o campo *Responsável* está preenchido no cadastro há
  meses e ninguém sabe o que há nele numa base grande (o dono da imobiliária, um
  corretor que saiu, quem cadastrou). Por imóvel, cada exceção é decisão explícita
  de alguém e os outros 895 não mudam de comportamento.
- **A pessoa NÃO é campo novo**: é o *Corretor responsável* que já existe. Um
  segundo seletor de corretor criaria duas verdades sobre quem é o corretor do
  imóvel.
- **O aviso da desativação é AVISO, não bloqueio.** O servidor já protege a entrega
  (corretor desativado não recebe o lead — ele cai na regra do portal, com o motivo
  registrado na trilha da roleta); o que faltava era a gestão SABER, no segundo em
  que decide desativar.
- **Marcar vários imóveis de uma vez ficou de fora**: a lista de Imóveis não tem
  seleção em lote, e para 5 imóveis abrir os 5 é aceitável.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`): a chave, a entrega ao responsável nos dois caminhos e a
   lista de imóveis na prévia da desativação moram lá. Contra o servidor antigo a
   chave aparece, é descartada no salvamento, e o aviso da desativação não aparece.
2. **A regra da chave mora fora do JSX** (`src/features/properties/leadDestination.ts`,
   com spec) e a frase do aviso da desativação em `deactivationRules.ts`. A tela de
   Imóveis tem ~2.000 linhas; mesma decisão das outras traduções deste repositório.
3. **A chave só vale quando o portal manda o CÓDIGO do anúncio e ele bate com o
   cadastro.** Sem isso o lead segue o caminho de sempre, **em silêncio** — é limite
   estrutural, não defeito. Antes de prometer a um cliente, conferir que os anúncios
   daqueles imóveis saem com o código do CRM.
4. **Trocar ou apagar o responsável NÃO desliga a chave.** A tela avisa; desligar
   por conta própria faria a escolha sumir sem ninguém ver.
5. **Não é `featureKey` nem `clientToggleKey`** — é campo do imóvel. Os scanners do
   catálogo de funcionalidades não entram nesta história e nenhuma chave literal
   nova foi escrita.

## A IA pode falar como o próprio corretor do número (desde 2026-09-25)

Relato do dono do produto: no WhatsApp de uma corretora, a IA dizia *"deixa eu
passar tudo pro meu colega do time"*. E quando acertava a voz (*"deixa eu confirmar
e já te passo as opções"*), não passava o lead. As duas causas eram do comando do
servidor (ver o CLAUDE.md do `lm-flow`).

O que aparece na tela, em *IA Vendedora → Configuração → Quando ela passa para um
corretor*, abaixo de *Mandar o resumo da conversa junto com o lead*:

- **Chave *Ela fala como o próprio corretor deste número***. Ligada, ela nunca fala
  em colega, equipe ou "vou te passar": diz que vai verificar e já retorna, e é
  nessa hora que o lead é passado. Se perguntarem se é robô, ela não nega.

Armadilhas:

1. **A escolha mora DENTRO do `transfer_config`** (`voice: 'first_person'`), como
   o resumo. Campo solto seria descartado pelo `saveAgent`. Há spec.
2. **Trocar o cenário e concluir o assistente montam o `transfer_config` do zero**:
   os dois passam por `keepBriefing`, que carrega a voz e o resumo. O assistente
   passou a carregar também as perguntas obrigatórias do checklist, que ele
   zerava — e lista vazia no servidor é TODAS valem.
3. **A metade do backend vem PRIMEIRO** (`lm-flow`, `saas-multitenant`). Contra o
   servidor antigo a chave salva e nada muda.
4. **Não é `featureKey` nem `clientToggleKey`** — é campo do agente.

## Cargos: o menu e a tela respondem o mesmo que o servidor (desde 2026-09-26)

Fase 1 do programa de usabilidade. O menu conferia a funcionalidade da
imobiliária, não o cargo: gestor e corretor recebiam os mesmos itens, e o
gestor abria *IA Vendedora* e lia "Nenhuma IA criada" com duas IAs ligadas —
o servidor tinha recusado a leitura, e a tela mostrou vazio. A metade do
servidor está no CLAUDE.md do backend (seção de mesmo nome).

O que aparece na tela:

- **O que o cargo não pode some** — do menu (todo item declara a permissão),
  das abas de *Automações* e dos botões: *Importar*, *Exportar* e *Disparo em
  massa* (quadro do funil e Contatos); criar e apagar em IA Vendedora,
  Disparos, Funis de mensagem e Imóveis. Cada botão responde pelas chaves que
  o servidor confere no que ELE faz: o *Importar* do quadro cria contato e card
  (`contacts.create` + `pipeline_items.create`, `boardActions.ts`) — o Corretor
  tem as duas e continua importando; o *Importar* de Contatos é o importador de
  planilha (`contacts.import`).
- **Conectar/Desconectar portal** chamam `POST /portals/:portal_key/connect|disconnect`
  (`portals.update`), não mais `/integrations` — o Gerente, que opera Portais
  sem as outras integrações, tomava 403 no botão. Os avisos de erro são os de
  antes ("Erro ao conectar portal" / "Erro ao desconectar portal").
- **Permissões que não chegaram** (rede, 5xx em `/permissions`) mostram "Não
  consegui carregar as permissões." + *Tentar de novo* no lugar da tela — nunca
  o aviso do cargo. 403 de verdade e lista lida (vazia ou não) seguem como
  antes.
- **Login com teto estourado** (429, 10 tentativas em 15 min por e-mail) diz
  "Muitas tentativas com este e-mail. Espere alguns minutos e tente de novo." em
  vez da frase de conexão (`loginFeedback(error, { login: true })`; o convite
  de acesso não passa a opção e fica como era).
- **Endereço digitado sem permissão** mostra "Seu cargo não tem acesso a esta
  tela. Quem libera é o administrador da conta." no lugar da tela — nunca mais
  a página genérica de não autorizado. Automações com todas as abas
  escondidas pelo cargo mostra o mesmo aviso (o "neste plano" continua só
  para função desligada no cliente).
- **Lista recusada pelo servidor** mostra o mesmo aviso, nunca "crie o
  primeiro": IA Vendedora, Disparos, Portais, Funis, Imóveis, Agenda de
  Visitas, Propostas, Contratos, Captação, Interesses, Lembretes WhatsApp,
  Follow-up e Regras de Lead.
- **Esqueci minha senha** manda o link de criar senha no WhatsApp do cadastro,
  com a frase fixa "Se esse e-mail tiver conta aqui, mandamos um link pro
  WhatsApp cadastrado." — exista o e-mail ou não, e também no teto de pedidos.
- **Copiar link de acesso** na *Equipe* e, no painel raiz, *Enviar/Copiar link
  de acesso* no lugar do "revelar senha". Senha legível não existe mais em
  tela nenhuma, e o convite em massa mostra cada e-mail que o servidor recusou
  com o motivo dele ("Este e-mail é reservado à equipe da Leal Mídia").
- **Área do Admin → Equipe** ganhou, no fim da página, a conferência do
  critério novo de suporte (`SUPPORT_BY_TEAM_LIST`, no servidor), cliente a
  cliente: os @lealmidia.com.br fora da Equipe (deixam de ser suporte quando
  ele ligar; *Colocar na Equipe* entra SEM acesso ao painel de admin) e as
  "Contas que passam a ser suporte quando o critério ligar" (e-mail que está
  na Equipe numa conta do cliente que não é @lealmidia.com.br). A mesma
  leitura mostra senhas legíveis restantes e clientes sem cargos gravados.

Decisões do dono (não reabrir sem ele pedir):

- **Suporte vem do servidor** (`is_support` do boot; `useIsSuperAdmin`), não do
  e-mail. O DONO (atalho da Área do Admin) é outra pergunta: `useIsOwner`.
- **O *Exportar* do quadro some para o Corretor.** Ele gera o CSV no
  navegador e não chama o servidor — é o único ponto em que o Corretor perdeu
  algo que funcionava, e foi escolha explícita (26/09/2026).
- **Tutoriais fica sem cargo** (`MENU_FREE_BY_DESIGN`): o servidor não confere
  cargo nele. Item novo sem permissão reprova o spec do menu. (O Espaço também
  era livre; saiu do CRM em 30/09/2026.)
- **"Toda a imobiliária" é do servidor** (`available_modes`); a tela só mostra
  o que ele oferece. O `ScopePicker.spec` é trava desse contrato.
- **Um leitor só de 403** (`services/core/forbidden.ts`). Só o 403 é recusa de
  cargo; rede caída continua sendo erro — culpar o cargo por queda de rede
  mandaria a pessoa pedir permissão que ela já tem. Vale também para a leitura
  das PRÓPRIAS permissões: o `permissionsService` engole a falha de
  `/permissions` e devolve lista vazia (outros chamadores dependem disso), mas
  deixa a marca (`getPermissionsLoadFailure`); o `PermissionsContext` a expõe
  como `loadFailure`, e o `PermissionRoute` decide por `permissionGate`
  (`retry` só com `'failed'`, e vence `redirectTo`/`fallback`).

Armadilhas:

1. **O backend vem primeiro.** Sem `is_support` no boot, a tela cai no critério
   antigo; sem `portals.*`, Portais some de quem só tinha a chave nova.
2. **Chave de tela = mesma chave no menu, na rota e no botão.** A fonte é
   `src/routes/permissionRoutes.ts` (toda rota que confere cargo), e o menu
   LÊ dela (`permissionFromRoute`) em vez de copiar. O
   `permissionRoutes.source.spec.ts` reprova o mapa e o `index.tsx`
   divergindo nos dois sentidos; o `menuItems.spec.ts` reprova menu e mapa
   divergindo. Rota nova com `<PermissionRoute>` entra no mapa, senão o spec
   reprova. `permissionFromRoute` LANÇA para href fora do mapa — o spec do
   menu pega isso no CI, antes de chegar a alguém.
3. **Rota compartilhada fora do padrão** (`ChatRouteElement`, de `/conversations`)
   está listada à mão no spec de origem. Um segundo elemento compartilhado
   precisa entrar lá, senão escapa da trava.
4. **`useCan` não esconde nada sem provider** — é de propósito, para os specs de
   tela isolada; no app sempre há provider. Carregando, `ctx.can` devolve
   `false`: é isso que impede o botão de piscar antes das permissões chegarem
   (o `contactsHeaderGates` recebe o `ready` explícito; os outros dependem
   disso).
5. **O cache de permissões é apagado na troca de pessoa** (`user.id` muda,
   inclusive para vazio no logout), e resposta atrasada da pessoa anterior é
   descartada. Quem mexer no `PermissionsContext` não pode voltar a
   reaproveitar a lista "se já tem alguma".
6. **Na recusa, só a leitura PRINCIPAL da tela vira aviso.** Chamada auxiliar
   (canais em Disparos, caixas em Lembretes, filtros) continua como era: um
   403 ali derrubando a tela inteira esconderia a lista que o cargo pode ver.
7. **O "revelar senha" não volta.** `plain_password` não existe em tipo
   nenhum, e há spec de origem que reprova a volta.
8. **A marca de falha das permissões é zerada na troca de pessoa** (junto com as
   listas, no corpo do render) e no `clearCache`. Quem mexer no reset do
   `PermissionsContext` inclui `userLoadFailure`/`accountLoadFailure`, senão o
   *Tentar de novo* de uma pessoa aparece para a próxima.
9. **Portal liga/desliga pela porta de Portais** (`portalsService.connect/disconnect`).
   Voltar a chamar `/integrations` daqui reprova o `PortalDetailPage.spec` (a
   API crua está dublada para acusar qualquer chamada direta).

**Fora desta fase, de propósito:** os botões das outras telas (fora das áreas
da fase) continuam sem conferir cargo — viram 403 quando clicados; o texto de
erro da aba *Esqueci minha senha* ainda fala em "e-mail de recuperação".

## A aba Números do painel raiz: de quem é cada número (desde 2026-09-26)

Fase 2a do programa de usabilidade. Antes de a fase 2b fazer do dono do número a
única verdade, o painel raiz ganhou uma LEITURA de como os números de WhatsApp de
cada cliente estão ligados hoje. Só a Leal Mídia vê, e nada é corrigido daqui.

O que aparece na tela, no painel raiz → Clientes → aba **Números**:

- No topo, **"X clientes migram sozinhos · Y precisam conferir · Z não consegui
  ler"**, e o botão **Atualizar**.
- Uma linha por cliente em uso, com quantos números, quantos têm dono claro,
  quantos são compartilhados, quantos precisam conferir e o selo: **Migra
  sozinho**, **Precisa conferir (N)** ou **Não consegui ler** com o motivo. A
  linha mostra "lendo…" até a leitura dela chegar. Quem precisa conferir vem
  primeiro.
- Clicando na linha: **número por número** (nome, telefone, conectado ou não pelo
  estado gravado, Responsável, roletas e se é Exclusivo ou Compartilhado em cada
  uma, liberados à mão, dono sugerido e de onde veio, "celular bate", conflito em
  português) e **pessoa por pessoa** (números sugeridos; "corretor sem número").

Decisões (não reabrir sem o dono pedir):

- **O servidor decide, a tela só mostra.** Dono sugerido, conflitos e veredito
  vêm prontos (`Numbers::OwnershipDiagnosis` no backend); aqui só se escolhe
  palavra, cor e ordem, em `NumberOwnership/numberOwnershipRules.ts`, com spec.
- **Um cliente por pedido, em lotes de 4** (`loadInBatches.ts`, com spec). Tudo
  num pedido só estouraria o limite de 15 s do servidor. Cliente cujo pedido
  falha vira "Não consegui ler: o servidor não respondeu a este cliente" e os
  outros seguem.
- **Atualizar lê de novo sem cache** (`?refresh=1`); abrir a aba usa a leitura
  guardada de até 5 minutos. Leitura antiga que chega depois do Atualizar é
  descartada.
- **Linguagem:** "número de WhatsApp", nunca instância, inbox ou canal (há spec).

Armadilhas:

1. **Não é `featureKey` nem `clientToggleKey`** — tela só do painel raiz. Texto
   literal em pt-BR, como o resto do hub de Clientes: o `conferir-i18n` só olha
   chave de `t()`.
2. **A metade do backend vem PRIMEIRO** (`lm-flow`, `saas-multitenant`, PR #336). Contra o
   servidor antigo a aba mostra "Não consegui carregar a lista de clientes".
3. **A regra é do servidor, e tem duas escolhas que a spec não fixava:** "Sem
   roleta e N corretores liberados: de quem é?" só aparece quando o número NÃO
   tem Responsável (o Responsável é o dono, por decisão do dono do produto), e há
   um conflito a mais, "O Responsável gravado é uma pessoa que não existe mais
   neste cliente". A tela não recalcula nada disso — só mostra o texto que vem.

## Roleta: o telefone do lead só chega depois do aceite (desde 2026-09-28)

Relato do dono do produto: *"se temos 10 corretores na fila com prazo de 10
minutos, o primeiro recebe os dados do lead logo na mensagem, e isso nunca é
apagado mesmo que expire os 10 minutos e outro corretor seja atribuído. Além de
quebrar nosso sistema, não é justo"*. No Leilão era pior: os dez recebiam o
número ao mesmo tempo.

A regra mora no SERVIDOR (`Roleta::LeadPrivacy` e `Roleta::WinnerNotice` no
backend, PR na `saas-multitenant`). Aqui só muda o que a tela explica.

Decisões do dono (não reabrir sem ele pedir):

- **A oferta vai SEM o telefone** (rodízio, leilão, por disponibilidade e o
  corretor fixo da IA), com a linha *"O telefone do lead chega aqui assim que
  você aceitar."*. **No aceite sai uma segunda mensagem, só para quem aceitou**:
  *"✅ O lead é seu"*, com nome, telefone e o link da conversa.
- **O Aviso do gestor e o do grupo continuam com o número.** O grupo de avisos,
  em geral, não tem corretor dentro.
- **A tela de aceite (o link da mensagem) mostra o número MASCARADO** enquanto a
  oferta está aberta — `(11) •••••-••34`. É o servidor que manda mascarado; a
  página continua lendo `lead_phone` sem saber da regra.

Armadilhas:

1. **`{{telefone}}` no *Aviso do corretor* sai mascarado**, não vazio: texto já
   gravado com "Telefone: {{telefone}}" não pode ficar com a linha em branco. O
   texto de ajuda embaixo do campo diz isso.
2. **Desligar o *Aviso do corretor* cala também o "O lead é seu"** (mesma chave
   no servidor). O aviso amarelo de "desligado" conta isso.
3. **Dentro do app, o corretor ofertado ainda alcança a conversa antes de
   aceitar** (o acesso automático da oferta, desde 2026-09-03), e ali o contato
   aparece inteiro. Dívida conhecida, fora desta leva.

## A automação do aceite pode valer só para alguns corretores (desde 2026-09-28)

Pedido do dono do produto: IA Vendedora ligada no número de três corretoras, com
a mensagem de abertura saindo pela automação *Corretor aceitou o lead* e a IA
assumindo quando o lead responde. Mas o formulário e a roleta são os MESMOS de
todo o time — funil e roleta não separam nada, e com o número da regra em branco
ela disparava no aceite de qualquer corretor.

O que aparece na tela, em *Automações de Lead*, no gatilho *Corretor aceitou o
lead*:

- **Campo *Só quando quem aceitou for (opcional)***, com a equipe para marcar.
  Nenhum marcado = qualquer corretor, como sempre foi. A mensagem continua saindo
  pelo número de quem aceitou, então uma regra só serve as três (e `{{corretor}}`
  já traz o nome de quem aceitou).
- **Desativado some da lista, a não ser que já esteja marcado**; marcado que saiu
  da conta continua à mostra com *(não está mais na conta)*.
- **Na lista das automações**, a condição aparece como *Só quando quem aceitou
  for: Ana, Bia*; no *Testar*, a linha diz *Quem aceitou* com os nomes.

Armadilhas:

1. **Não tem metade de backend.** O aceite já manda `assigned_user_id` no contexto
   do gatilho (`Roleta::DetectAcceptanceService#notify_automation!`) e o servidor
   compara qualquer campo do contexto (`LeadAutomationRule#context_value`). O PR do
   backend desta leva só traduz o campo no *O que aconteceu*; sem ele, a regra
   filtra igual.
2. **Lista vazia vira condição NENHUMA, nunca `in []`**: `in []` não casa com
   ninguém e a regra pararia calada.
3. **Trocar de gatilho descarta a condição do gatilho antigo**
   (`conditionsOnTriggerChange`). Antes ela era levada junto: uma etiqueta de
   *Etiqueta adicionada* ia para o aceite, ficava gravada sem campo na tela e
   barrava a regra para sempre. O filtro de funil continua atravessando.
4. **A regra mora fora do JSX** (`acceptedByFilter.ts`, com spec).
5. **Não é `featureKey` nem `clientToggleKey`** — é condição da regra.

## O dono do número (desde 2026-09-28)

Fase 2b.1 do programa de usabilidade. O número de WhatsApp não tinha dono visível:
o *Responsável da instância* dizia um corretor, a roleta dizia outro, e nenhuma
tela mostrava telefone, conexão e dono juntos. A regra nova mora no servidor
(ver *"O dono do número"* no CLAUDE.md do `lm-flow`) e vale **só nos clientes em
que o painel raiz a ligou**. Aqui está o que a tela ganhou.

O que aparece na tela:

- **Para todos (renomeação pura):** *Responsável da instância* virou **Dono do
  número** (Canais → Colaboradores); o campo "WhatsApp" da pessoa virou **Celular
  para avisos** (Equipe e Perfil); a coluna e a seção de acesso da Equipe falam
  **Números liberados**; e os textos tocados não dizem mais "instância" — exceto o
  que ficou de propósito para a fase 3 (ver Armadilhas).
- **Cartão do número**, no topo da configuração de todo número de WhatsApp em
  Canais: nome, telefone de verdade, conectado ou não, o dono, em qual roleta está
  e qual IA atende nele. Canal que NÃO é WhatsApp nunca busca nem mostra o cartão
  nem a explicação do dono — só herda o RÓTULO "Dono do número" (custo aceito,
  ver Decisões).
- **Com a regra ligada no cliente:**
  - Canais explica o dono ("Quem escreve neste número vai direto pro dono. Sem
    dono, o número é da imobiliária e quem escreve entra na roleta."), a opção
    sem dono vira **Da imobiliária (compartilhado)**, dono desativado aparece como
    "Da imobiliária (compartilhado) — o cadastro de Fulano está desativado", e em
    Colaboradores o dono EFETIVO fica sempre marcado, com o selo *Dono do
    número* — dono desativado, ou dono de um número que o servidor devolveu como
    compartilhado (conta da Leal Mídia), não trava a caixinha nem ganha o selo.
  - Equipe: a coluna vira **Números** ("(11) 91234-1234 · Principal") e a janela
    da pessoa ganha **Números de atendimento**, com *Tornar principal* e *alterar
    em Canais*. O Perfil ganha o mesmo bloco.
  - Roleta: some a escolha Exclusivo/Compartilhado; cada número diz "Número de
    Fulano: quem escreve nele vai direto pra Fulano" ou "Número da imobiliária:
    quem escreve entra na roleta"; outro corretor num número com dono trava com
    "Este número é de Fulano. Pra dividir, tire o dono em Canais." — a MESMA
    frase da recusa do servidor, sem o nome do número ao lado (era a versão
    errada da rodada 1, corrigida antes do fim da leva).
- **Painel raiz → Clientes → aba Números:** o detalhe de cada cliente ganha a
  barra da regra (ligada/desligada, o último Ligar/Desligar com quem, quando e
  quantos donos) e o botão **Ligar dono do número** / **Desligar dono do número**,
  com confirmação pelo Dialog da casa. Cada conflito ganha a dica de como
  resolver.

Decisões (não reabrir sem o dono pedir; a tabela completa está no plano
`LM FLOW/plans/2026-09-28-fase-2b1-dono-do-numero.md`):

- **A frase da regra só aparece com a regra.** Dita num cliente desligado ela
  mentiria: lá o Dono do número ainda só muda o avatar.
- **A regra vale quando o servidor diz** (`number_owner_rule` nas respostas de
  Canais, Equipe, Perfil e Roleta) e, na falta dele, pela chave do cliente. O eco
  cobre os 5 minutos de cache das funcionalidades logo depois do Ligar.
- **Ligar só no "Migra sozinho", sem conflito nenhum.** "Precisa conferir" mostra
  o botão desligado e o caminho; quem resolve cada conflito é o gestor, em Canais
  e na Roleta. Defesa a mais da tela: se o próprio "Migra sozinho" vier com algum
  número marcado em conflito, o *Ligar* também fica desligado — o servidor já não
  deveria mandar isso, mas a tela não confia cegamente.
- **O dono não se desmarca em Colaboradores** com a regra, e a trava é só do dono
  EFETIVO: o servidor não deixa o dono ATIVO de um número NÃO-compartilhado sair,
  e caixinha que desmarca e volta marcada sozinha é a cicatriz desta tela — dono
  desativado, ou dono de um número que a regra tratou como compartilhado, NÃO
  trava nada e pode ser desmarcado e salvo sem ele.
- **Trocar o dono pergunta pelo ANTERIOR, não tira sozinho.** Com a regra ligada,
  depois que a troca dá certo no servidor e havia um dono anterior diferente do
  novo, Colaboradores pergunta ("O número era de Fulano. Tirar Fulano dos
  Colaboradores também?", Dialog da casa) — nunca com dono anterior vazio, nem
  quando o "novo" é a mesma pessoa, nem com a regra desligada. A escolha é de
  quem troca: "Tirar" remove só o anterior, "Manter liberado" não faz nada.
- **A trava da roleta no navegador é cortesia**; quem recusa é o servidor, com a
  mesma frase, sem nome de número junto.
- **Neutro de gênero:** "Número de Fulano", "é de Fulano".
- **Canais não-WhatsApp também leem o rótulo "Dono do número"** (o campo
  renomeado é um só, não um por tipo de canal) — custo aceito: a palavra aparece
  onde o conceito de dono do número não existe de verdade; mais barato que
  duplicar o campo por tipo de canal.

Armadilhas:

1. ⚠️ **A chave `numero_dono_unico` só aparece em
   `src/features/numbers/useNumberOwnerRule.ts`, LITERAL na chamada do
   `useClientToggle`.** Os scanners do catálogo a acham por regex; constante no
   lugar dela tira a chave do catálogo no deploy seguinte, calado. Há spec que
   reprova a chave em qualquer outro arquivo.
2. **`useClientToggle`, nunca `useFeature`.** A chave nasce desligada; `useFeature`
   a estrearia para todo cliente.
3. **Os textos novos são literais em `src/features/numbers/numberTexts.ts`.**
   Chave nova de `t()` não entra; só se trocam VALORES de chaves que já existem no
   pt-BR (foi o que se fez com o Dono do número e o Celular para avisos).
4. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`). O auditor do catálogo REPROVA este build enquanto
   `numero_dono_unico` não existir no catálogo servido pela API — é o portão
   funcionando.
5. **Ligar/Desligar usa o Dialog da casa (`useConfirmacao`)**, nunca `confirm()`;
   o `conferir-caixinhas` reprova caixinha nova.
6. **A recusa do Ligar vem como `{ error: 'texto' }`** (painel raiz), e a recusa
   por cargo como `{ error: { message } }`. `ruleErrorMessage` lê os dois, em
   qualquer status — inclusive 500.
7. **Não é `featureKey` de menu** — a regra muda texto e comportamento de telas
   que já existem. O painel de Funções mostra a chave (é do catálogo), com o
   aviso de que ela se liga pela aba Números: ligar por lá pula a gravação dos
   donos. E **salvar o mapa de Funções com uma leitura velha pode DESLIGAR a
   regra** sem ninguém ter clicado em *Desligar* — o painel de Funções grava o
   mapa inteiro de volta. Ligar e desligar sempre pela aba Números; reabrir
   Funções só depois de confirmar o estado por lá.
8. **`number_card` é buscado só na tela de configuração de UM número** (efeito em
   `ChannelSettings.tsx`), nunca por item de uma lista — N números na lista de
   Canais nunca viram N requisições.
9. **"instância" que sobrou nos textos tocados fica para a fase 3.** Só dois
   pontos foram trocados nesta leva (`roletaFormChecks.ts` e `RoletaConfig.tsx`);
   o resto do vocabulário "instância" espalhado pelo app não foi tocado — não é
   esquecimento desta leva, é escopo.

## O follow-up da IA só vai atrás de quem ela atendeu (desde 2026-09-29)

Pedido do dono do produto: *"follow-up automático precisa ter o mesmo gatilho de
formulário que a IA tem de ativação"* — e a regra dele, escolhida entre as opções:
**"follow-up automático apenas nos leads que a IA atendeu e que ainda não foram
roletados"**.

Com a IA ativando só nos formulários X e Y, o follow-up continuava cutucando todo
lead calado do número: os das outras campanhas (com quem ela nunca falou) e o que
já estava com um corretor. A regra nova mora no servidor (ver o CLAUDE.md do
`lm-flow`) e vale para TODA IA, sem chave.

O que mudou na tela, em *IA Vendedora → Configuração → Follow-up automático*, no
bloco *De quais leads ela vai atrás*:

- **Uma frase fixa no topo** dizendo o público: ela só vai atrás de quem ela mesma
  atendeu e que ainda não foi para a roleta — lead de campanha que não ativa a IA,
  lead já entregue a um corretor e lead em que o corretor desligou a IA ficam de
  fora.
- **A primeira opção virou *Todos os leads que ela atendeu*** (era *Todos os leads
  deste número*, que passou a ser promessa falsa). O recorte por funil continua,
  por cima desse público.

Decisões (não reabrir sem o dono pedir):

- **Não há segunda lista de formulários no follow-up.** Ele segue a marca que o
  gatilho de ativação grava quando a IA entra na conversa: trocou o formulário na
  ativação, o follow-up acompanha.
- **Não é escolha na tela.** O público é regra do servidor; a tela só o descreve.

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, branch
   `saas-multitenant`). Contra o servidor antigo a tela descreve o público novo e
   a IA continua indo atrás de todo lead do número.
2. **Não voltar a escrever *Todos os leads deste número*.** Há spec que reprova.
3. **Não é `featureKey` nem `clientToggleKey`** — é texto de tela. Os scanners do
   catálogo de funcionalidades não entram nesta história.

## Enviar pelo número, nome fixo no texto e a bolha pelo celular (desde 2026-09-29)

Fase 2b.2 do programa de usabilidade, escopo enxuto (decisão do dono do produto,
29/09): só a ação *Enviar mensagem WhatsApp* das Automações de Lead e os funis de
Follow-up. IA Vendedora, landing e formulário do Meta ficam para a fase 4.

O que aparece na tela:

- **Campo *Enviar pelo número*** na ação *Enviar mensagem WhatsApp* e em cada
  funil de Follow-up (logo abaixo de *Parar quando o lead responder*).
  - Na automação: *Automático (como sempre foi)*, *O número do responsável pelo
    lead* ou um número.
  - No funil: *O número do responsável pelo lead (padrão)* ou um número. O padrão
    do funil MUDOU (E37): sem responsável, ou responsável sem número, sai como antes.
  - Cada número aparece como "Loja · (11) 91234-1234 · desconectado · de Ana". O
    dono só aparece com a regra do dono ligada.
- **Ao salvar**, avisos amarelos (10 s) quando o número está desconectado ou é de
  outra pessoa. O salvar acontece mesmo assim.
- **Número que sumiu** aparece como *Número que não existe mais — escolha outro*,
  ainda selecionado. **Lista que não carregou** diz isso e mantém a escolha.
- Com um número (ou o do responsável) escolhido, o campo *Instância de envio
  (admin)* some da ação.
- **Chip *Corretor* (`{{corretor}}`) no follow-up.** Sem corretor, o servidor
  tira a frase inteira.
- **Aviso de nome fixo**: se o texto da mensagem (automação) ou do passo (funil)
  tem o primeiro nome de alguém da equipe, aparece "O texto cita "Gabriela", que é
  da equipe… use {{corretor}}". Não barra.
- **Bolha "Atendente · pelo celular"**: mensagem digitada no celular de número sem
  dono, com a regra do dono ligada. Antes saía com o nome do 1º admin.

Armadilhas:

1. **Toda automação nasce no automático**, e o servidor só muda o caminho quando
   há escolha. **O funil, não**: o padrão dele é o número do responsável (E37).
   `valueForScope` mostra `'owner'` gravado no funil como o padrão.
2. **As regras e os textos moram em `src/features/numbers/`**:
   `sendFrom.ts`, `teamNameWarning.ts` e `messageAuthor.ts`, todos com spec. O
   campo é `src/components/numbers/SendFromField.tsx`. Chave nova de `t()` não entra.
3. **Quem decide o número, o aviso e o `{{corretor}}` é o servidor**
   (`Numbers::SendFrom`, `Followup::CorretorVariable`, no `lm-flow`). A tela só mostra.
4. **A lista vem de uma rota por tela** (`/lead_automation_rules/send_numbers`,
   `/followup_sequences/send_numbers`), com a chave de leitura de cada tela.
5. **Escolher número tira `sender_instance` da ação** (`applySendFrom`).
6. **O aviso de nome fixo usa `/users` (primeira página).** Equipe maior que a
   página pode escapar do aviso.
7. **O nome ao lado de "Atendente" vem SÓ de `agentDisplayNameFor`.** A prévia do
   card e as respostas em fio ainda leem `sender.name` direto (item 13 da
   verificação, fora desta leva).
8. **A metade do backend vem PRIMEIRO.**

## Roleta: leads que esgotaram a roleta e o "Sortear de novo" (desde 2026-09-30)

Relato do dono do produto: três leads da madrugada rodaram por dez corretores
cada (prazo de uns 5 minutos, roleta sem horário de funcionamento) e *"simplesmente
não andaram mais"*. Não era trava: era o **esgotamento**, que é regra. Passou
por todo mundo e ninguém assumiu, o lead fica sem responsável, o gestor recebe um
aviso no WhatsApp e o lead **não volta sozinho**. O furo era que, fora aquele
aviso das 3h28, o único rastro era uma linha no Diagnóstico misturada a todo o
resto. Pedido: *"pode acontecer mesmo que esteja no horário de funcionamento.
Precisamos ter isso"*.

O que aparece na tela, em **Distribuição de Leads → Atribuições Recentes**:

- **Bloco amarelo no topo, *Esgotaram a roleta e estão sem responsável (N)***.
  Some quando não há nenhum. Cada linha traz o lead, a roleta, quando esgotou e
  *Passou por 10 corretores: Ana, Bruno, Carla e mais 7* (a lista inteira no
  passar do mouse), mais *Abrir conversa* e **Sortear de novo**.
- **Contador amarelo na própria aba**, carregado ao abrir a tela: é ele que faz
  o gestor entrar na aba.
- **Sortear todos de novo (N)**, com confirmação, quando há mais de um. Um lead
  de cada vez; o que não sair ganha o motivo em vermelho na linha dele, e o
  resumo sai num aviso só.

Decisões do dono (não reabrir sem ele pedir):

- **Entra na lista** o lead que esgotou nos últimos 30 dias, **não recebeu
  oferta nova depois** (de roleta nenhuma) e **continua sem responsável**.
  Atribuído na mão ou sorteado de novo, ele sai sozinho. Um lead aparece uma
  vez só, pelo esgotamento mais recente.
- **Sortear de novo = o lead volta para a MESMA roleta como se tivesse acabado
  de chegar**: rodada 1, a lista de quem já recebeu zerada, no modo Fila a partir
  do próximo da vez.
- **Não sorteia de novo sozinho.** Sem horário configurado, isso vira um loop de
  madrugada acordando o time inteiro a cada hora. O conserto da madrugada é o
  *Horário de funcionamento* da roleta.
- **Gerente e Diretor podem sortear de novo**, e o Administrador também. Chave `roleta_configs.assign`, a
  mesma do *Atribuir por uma roleta* do card. Antes da leva, o Gerente de cargo
  editado à mão e o Diretor tomavam 403 no card, e a tela dizia *"sem membros
  ativos?"*. Quem não tem a chave vê a lista sem os botões, com a linha *Seu
  cargo não permite sortear de novo*.

Armadilhas:

1. **O botão trava ANTES do clique, com o motivo na linha**, quando a roleta
   está fora do horário (*Ela abre em 01/10 às 08:00*), desativada ou em modo
   Manual. Fora do horário o motor mandaria o lead pro plantão, que pode
   reenviar a mensagem inicial ao LEAD, a cada clique.
2. **Não é o `assign` do card**: é `POST /roleta_configs/exhausted/:contact_id/redistribute`,
   que confere de novo se o lead ainda está na lista (entre abrir a tela e
   clicar, alguém pode ter atribuído) e devolve 409 se não estiver.
3. **Quando ninguém é sorteado**, a mensagem é a mesma frase que o motor gravou
   na trilha (ex.: *"A roleta não tem nenhum corretor ativo para sortear."*).
4. **Os textos moram em `exhaustedText.ts`** (com spec); o bloco é
   `components/roleta/ExhaustedLeadsPanel.tsx`, e a página só passa a lista.

## A IA Vendedora manda fotos e vídeo do imóvel (desde 2026-09-30)

Pedido do dono (29/09/26): a mídia chegava "incongruente". A capa do imóvel saía sozinha, com o link, no momento em que o sistema reconhecia o imóvel, sem ligação com o que a IA estava falando. E só ia a capa, mesmo com 20+ fotos na galeria.

Como ficou:
- **A IA escolhe a hora.** Ao apresentar um imóvel, ela manda um **pacote de até 5 fotos**: a capa primeiro, depois a ordem da galeria. Vão como foto no WhatsApp, com "Título — Preço" na primeira. **Sem link.** Se o lead pedir mais, vão as próximas 5, sem repetir. Acabou a galeria, ela oferece a visita.
- **Vídeo: 1, e nunca junto das fotos.** Pode ser o vídeo da galeria do imóvel ou um vídeo subido nos arquivos da IA (**só MP4, até 16 MB**; a tela recusa outro formato ou vídeo maior). Vídeo pesado não vira link: a IA não oferece.
- Foto marcada como **Ocultar** em *Gerenciar fotos* nunca vai pro lead. É assim que o corretor segura uma foto ruim.
- O **link da página** do imóvel só vai quando o lead pede ("tem site?", "me manda o anúncio").
- A opção do agente virou **Mandar fotos e vídeo do imóvel**. Desligada, nada de foto nem vídeo.
- No **Testar**, digite o código do imóvel: aparecem as miniaturas exatas do pacote. (Ali não há conversa, então "mais fotos" mostra de novo as primeiras.)

Por que a ordem da galeria e não "foto da cozinha, da área de lazer": numa amostra de 30 imóveis de um cliente com 412, as 614 fotos estavam todas com o tipo "Principal" (a importação não preenche e a tela só deixa escolher no upload), e nenhum imóvel tinha vídeo. As 5 primeiras da galeria eram boas. **Não reabrir sem o dono pedir:** classificação por ambiente e "foco" só entram se ficar provado que o lead pede ambiente específico.

## "Mandar pra mim": teste de envio da mídia da IA Vendedora (desde 2026-09-30)

O painel **Testar** só MOSTRA o que a IA mandaria — nunca deu pra conferir como
a foto, o vídeo ou o arquivo chegam de verdade no WhatsApp (tamanho, ordem,
como o app comprime). O botão **Mandar pra mim** fecha essa lacuna: manda a
mídia pro WhatsApp do próprio dono, pela MESMA rota que o lead real recebe.

Onde aparece:
- **Testar**, embaixo de cada bolha de foto/vídeo/arquivo que a IA mandaria.
- **Base de Conhecimento**, na ficha *Como a IA deve usar este arquivo*, num
  bloco **Ver como chega**, logo abaixo do interruptor *A IA pode enviar este
  arquivo pro lead* — só aparece com o interruptor ligado.

Como funciona:
- Primeiro clique pede **Seu WhatsApp (com DDD)**; o navegador guarda o número
  e não pergunta de novo — um link *trocar* reabre o campo.
- Vai pelo número do PRÓPRIO agente (o WhatsApp configurado na IA), não por um
  número da Leal Mídia.
- **Não cria** contato, conversa nem card no CRM, e **não marca** a mídia como
  "já enviada" pro lead — é teste, roda fora do fluxo real.
- **Limite: 10 testes por hora, por agente.** Passou disso, o botão mostra o
  aviso vindo do servidor e destrava sozinho depois.
- Sob o botão, sempre o aviso: *"Não responda essa mensagem pelo seu WhatsApp.
  A resposta (inclusive a automática do WhatsApp Business) entra no CRM como
  lead."* Se o seu WhatsApp Business tiver resposta automática, ela volta como
  lead — é só uma mensagem chegando naquele número, o CRM não diferencia bot
  de pessoa.
- **Quem pode editar a IA manda de verdade** (mesma permissão que salva o
  agente). Quem só lê **também vê o botão** — a tela não esconde — mas o
  clique volta recusado, com o aviso de permissão.

**Não reabrir sem o dono pedir:** o teste sai pelo número do PRÓPRIO agente, não
por uma instância à parte da Leal Mídia — foi escolha do dono em 30/09/26,
justamente pra ver a mídia chegando como o lead real veria, no mesmo número.

## Venda e locação: destinos separados no portal e no site (desde 2026-09-30)

O dono do produto pediu o que o Kenlo faz: o lead de quem quer alugar e o de quem
quer comprar vão para lugares diferentes, no portal e no site. E o site passou a
distribuir pela roleta, como o portal.

O que aparece na tela:

- **Portal → Configurar → Destino do lead**: abas **Venda** e **Locação**. Locação
  começa em **Mesmo destino da venda** ligado; desligado, tem funil, coluna, roleta
  e responsável próprios.
- **Site Builder → Destino do lead** (antes "Roteamento de leads"): as mesmas abas,
  com etiqueta, e agora **Roleta** e **Responsável**.
- **Site público**: o formulário "Não achou? A gente encontra pra você" pergunta
  **Quero comprar / Quero alugar**, marcado pela aba da busca. Na página do imóvel,
  a pergunta só aparece em imóvel de **Venda + Locação**, marcada pela aba de onde a
  pessoa veio (`?finalidade=locacao`).
- **Busca do site**: a aba **Alugar** passou a mostrar Temporada e Venda + Locação;
  **Comprar** deixou de mostrar Temporada.
- Todo lead de portal e site ganha a etiqueta **venda** ou **locação**.

Decisões (não reabrir sem o dono pedir):

- **O imóvel decide.** Venda → venda; Locação e Temporada → locação. Venda + Locação
  e lead sem imóvel: o que o portal informar ou o que a pessoa escolher; sem nada,
  venda.
- **Locação separada vale inteira**: sem roleta NÃO herda a roleta da venda.
- **Página com destino próprio vence** o destino do site (funil/coluna/etiqueta);
  quem atende (roleta/responsável) é sempre o do site.
- **O imóvel com "leads vão direto para o responsável" vence** também no site.

Armadilhas:

1. **O bloco é um só** (`LeadDestinationFields` + `SaleRentDestination` +
   `useLeadDestinationOptions`, em `src/components/pipelines/`). Portal e site
   usam o mesmo; regra nova de destino entra ali, não numa tela.
2. **Só viaja o que a pessoa pôde ver.** Seletor escondido por recusa de cargo não
   manda a chave, e o servidor grava parcial. Mandar `null` "por completude"
   apagaria a roleta que outra pessoa escolheu.
3. **Servidor antigo = sem abas.** O portal sabe pela presença de
   `rent_same_as_sale` no `settings`; o site pela presença de `lead_routing`. O
   merge aqui é só DEPOIS do backend.
4. **Não é `featureKey` nem `clientToggleKey`**: é configuração de portal e de site.
5. **Item aberto:** a landing de anúncio tem cópia própria da regra de quem atende
   no backend; convergir para `Leads::Distribution` quando alguém mexer nela.

## O Espaço saiu do CRM (desde 2026-09-30, Fase 4)

Decisão do dono (30/09/26): o **Espaço** (o "Notion dentro do CRM": bases, páginas, tarefas, comentários, link público) não era usado por ninguém. Pro cliente ele já nascia desligado (chave `espaco` nas Funções); quem via sempre era a equipe da Leal Mídia, e só como item a mais no menu.

Como ficou:
- Sumiu do menu, e a tela foi apagada (`src/features/espaco`). `/espaco` e `/espaco/:token` (link compartilhado) levam pro início.
- A chave `espaco` sai sozinha do catálogo de Funções no deploy (o `sync-feature-catalog.mjs` remove chave que o código não usa mais).
- **O backend não mudou.** Controllers, models e as tabelas `espaco_*` continuam lá, sem ninguém chamando. Dado que existir fica guardado. Apagar as tabelas é outro PR, no backend, só com o ok do dono (a migration roda em todos os clientes e não tem volta).
- As bibliotecas que só o Espaço usava (`@blocknote/*`, `@mantine/*`, `@dnd-kit/*`, `@tanstack/react-query`, `yjs`, `y-protocols`) ficaram no `package.json` por enquanto: o repo tem três lockfiles (pnpm, npm, yarn) fora de sincronia, e limpar dependência pede resolver isso antes. Como ninguém importa, não entram no pacote.

**Não reabrir sem o dono pedir.** Tarefa do corretor já tem lugar: Ações agendadas, Follow-up e Lembretes.

## Base de design e linguagem (desde 30/09/2026, Fase 3) — não reabrir sem o dono pedir

Spec e plano: `LM FLOW/specs/2026-09-29-fase-3-base-de-design-e-linguagem-design.md` e `LM FLOW/plans/2026-09-30-fase-3-base-de-design.md` (pasta do Tony, fora deste repo).

- **Régua de linguagem:** [GLOSSARIO.md](GLOSSARIO.md). "Número de WhatsApp", funil, etapa, etiqueta, Ligar/Desligar, Excluir × Remover, Salvar/Criar. Termo técnico só em tela de conectar outro sistema.
- **Formato:** tudo que aparece na tela sai de `src/lib/formato.ts`. Vazio vira `—`, hora é sempre 24h. "2026-09-30" puro é dia de calendário (não vira 29/09 em São Paulo). `utils/dateUtils` e `numberTexts.formatPhone` só repassam pra ele.
- **Trava do build:** `scripts/conferir-padrao.mjs --tetos scripts/conferir-padrao.tetos.json`.
  - Ela lê as telas com o compilador do TypeScript. Texto de tela é o que está entre tags, em atributo de texto (inclui `hint`/`text`), em toast, em confirmação, nas palavras de `plural()`, na mensagem de reserva de `apiErrorMessage()` e em mapa `*_LABELS`; nome de variável, rota, tipo e chave de i18n não contam.
  - **Ponto cego:** frase montada em variável ou tupla e texto devolvido por função não são lidos. Contagem 0 não prova tela limpa: a revisão de PR confere.
  - Fora do escopo: o painel raiz, as páginas públicas, as landings, o widget e a **sobra** do Evolution (listas `SOBRA`/`NAMESPACES_SOBRA`). A fase 4 decide se a sobra some.
  - **Teto só desce.**
- **Decisões do Tony (30/09):**
  - **D1:** cada tema num PR pequeno, com prévia (`?tenant=lealmidia`) e antes/depois, e merge um por vez com o ok dele.
  - **D2:** chave desligada é cinza.
  - **D3:** o glossário acima.
  - **D4:** as telas piloto são Conta e Lembretes.
- **Nunca muda nesta frente:** texto que sai pro lead ou pro corretor por WhatsApp (modelos, `{{variáveis}}`, instruções da IA, mensagens padrão).
- **Testes com Node 26+:** `NODE_OPTIONS=--no-experimental-webstorage npx vitest run`. Sem isso, o `localStorage` experimental do Node tapa o do jsdom e ~29 arquivos falham na `main` limpa.

### Peças da casa (Fase 3.5)

As regras estão em [GLOSSARIO.md → As peças da casa](GLOSSARIO.md#as-peças-da-casa). O resumo pra quem mexe no código:
- **`Chave`** é ligar/desligar com efeito na hora.
  - `aoMudar` devolve `false` pra desistir (volta sem aviso). Se lançar erro, volta e avisa; 403 culpa o cargo.
  - Trava o duplo clique.
  - Desligado é cinza no CSS global (`chaveCinza.spec.ts` impede o vermelho de voltar).
- **`useAlteracoesNaoSalvas(temAlteracao)` + `BarraSalvar`:** a tela declara se tem alteração, compara com `mesmoConteudo(atual, carregado)`, e a barra aparece.
  - `useGuardaDeSaida` é usado no `Sidebar` (o `<nav>` do menu e o rodapé), no `Header` (menu do celular) e nas `Abas`.
  - Deixam passar: Ctrl/Cmd/Shift/Alt ou botão que não é o esquerdo, e `data-abre-submenu`. Desde o menu novo (fase 4) nenhum item produz esse atributo: o cabeçalho de seção é `<button>`, não link, e todo item leva a uma página. A guarda continua aceitando o atributo.
  - Não aninhe um `<nav>` guardado dentro de outro.
  - **O "voltar" do navegador NÃO é coberto:** `<BrowserRouter>`, sem `useBlocker`. Migrar pro roteador de dados é outra frente.
- **`Abas`:** com `para` em todas as abas vira navegação com guarda; sem `para`, é tablist. Estreou em `AutomationsLayout`; desde o menu novo, quem a usa nas páginas do menu é a `PaginaComAbas`. `exata` faz a aba só acender no endereço exato. O modo tablist **ainda não tem navegação por setas**: o primeiro consumidor acrescenta.
- **`EmptyState`:** `tipo` pode ser `vazio`, `semResultado` ou `erro`. Erro nunca vira lista vazia.
- **Telas de referência:** `Settings/Account/AccountSettings.tsx` e `Settings/WhatsappReminders/WhatsappReminders.tsx`. Os specs `*.base.spec.tsx` delas são a régua.
  - Em Conta, ligar a resolução automática pergunta o tempo e já grava; os ajustes esperam a barra.
  - Ligar/desligar a resolução atualiza só os campos dela, e alteração não salva de outro campo não se perde. Não chame `loadAccountData()` depois de uma chave: ele apaga o que está na barra.
  - Em Lembretes, a chave da lista grava só o `enabled`, e o Excluir fica no menu "…".
- **Botões só-ícone:** os 202 que existiam ganharam `aria-label` + `title` (3.4). Botão novo usa `IconActionButton`, e a trava reprova botão sem nome.

## Origem do lead: Portal e Site (desde 2026-09-30)

Relato do dono do produto: na rosca *de onde vêm os leads* da Dashboard, o lead de
portal aparecia como "desconhecida". O backend (`lm-flow` #352) passou a gravar as
origens **`portal`** e **`site`** no lugar do `unknown`, corrigiu os leads antigos e
manda o rótulo da rosca já em português.

Nesta tela só muda a aba **Origem** do card: os selos *Portal* e *Site*, e o nome
de qual portal ou site trouxe o lead (`raw_data.portal` / `raw_data.site`).

- **O rótulo da rosca vem do servidor** (`sources.items[].label`). Não traduzir de
  novo aqui: duas tabelas de nome de origem é o que deixava a rosca em inglês.
- **`reclassificado` fica escondido** na aba Origem: é a marca da correção de dados
  do backend, não informação para quem atende.

## Menu novo: seções, uma aberta por vez (desde 2026-10-01)

Fase 4, primeiro PR. O menu tinha 18 itens soltos, rótulos que não ajudavam
("Inteligência" com Canais e Configurações dentro), cortava itens em tela de
900px, Configurações abria uma segunda coluna e Automações juntava 7 abas de
assuntos diferentes. Modelo do dono: a Lais, em que cada item é uma página.
Spec: `LM FLOW/specs/2026-10-01-fase-4-menu-novo-design.md`.

O que aparece na tela:

- **Seções que abrem e fecham, uma por vez.** Principal (Dashboard, Conversas,
  Funil de vendas, Visitas) fica sempre aberta, sem cabeçalho. Depois vêm
  Imóveis, Leads, Vendas e automação e Minha imobiliária. A seção da página
  atual abre sozinha. Seção sem item que o cargo veja não aparece.
- **Todo item leva direto a uma página.** O terceiro nível virou **abas no topo
  da página** (Integrações: WhatsApp, Facebook, Pixel, Portais · Bolsão: Pegar leads,
  Listas e regras · Fluxos de mensagem: Editor de funis, FlowBuilder ·
  Automações: Regras de lead, Lembretes · Campos personalizados: Atributos,
  Variáveis). A segunda coluna ao lado do menu acabou.
- **Automações deixou de ser uma página de 7 abas**, sem mudar endereço:
  Follow-up, Roleta de leads e Formulários são páginas sozinhas. `/automations` puro
  manda pra primeira tela que a pessoa vê.
- **Como a Lais:** cartão no topo com o nome da imobiliária e o cargo de quem
  usa (`lm-redact`, some no modo demonstração); divisor depois do Principal e
  antes do rodapé; o rodapé vem logo depois do último bloco, e a coluna inteira
  rola se passar da tela. Abrir e fechar seção desliza (grade de `0fr` a `1fr`,
  200 ms); com "reduzir movimento" no sistema, sem animação. Seção fechada fica
  no DOM com `inert` + `aria-hidden`, fora do Tab e do leitor de tela.
- **Recolhido:** um ícone por seção, que abre a lista da seção ao passar o mouse (ver "Menu recolhido por seção e Conversas recolhe o menu", mais abaixo).
- **Nome da conta na barra do topo** (computador): só com o menu recolhido. Com
  o menu aberto o cartão já mostra o nome, e o selo no centro do topo repetia
  (pedido do dono, 01/10/2026). No celular o nome continua embaixo da logo: lá
  não tem cartão.
- **Cartão da conta** (topo do menu): "vidro roxo", gradiente da marca vazado
  com borda e sombra roxas suaves, pra não ficar apagado (pedido do dono,
  01/10/2026). Mais fraco que o item ativo (gradiente cheio) de propósito.
- **Rodapé:** Guia do LM Flow e Falar com o suporte. Saíram o © e o link
  "Documentação" (era a documentação da Evolution).
- **Avatar:** Meu perfil, **Meus números**, Sugestões/Bugs, Sair. Meus números
  leva para `/channels` (o corretor religa o WhatsApp em que atende).
- **Corretor sem número** vê, na tela de WhatsApp, "Você ainda não tem um número
  de WhatsApp. Peça ao gestor da sua imobiliária para criar o seu." O "Novo
  canal" só aparece para quem tem `channels.create`.
- Nomes: Funil de vendas, Visitas, Meus imóveis, Meu site, Roleta de leads,
  Campos personalizados, Guia do LM Flow.

Decisões do dono (não reabrir sem ele pedir):

- **O menu do corretor sai do cargo, não de um segundo menu.** Com o Corretor de
  fábrica ele vê Principal, Imóveis (Meus imóveis) e Leads (Contatos,
  Bolsão). (A tela Books, que aparecia aqui, saiu do menu em 04/10/2026: ver a seção "Book dentro do cadastro".) O `menuItems.spec` trava essa lista.
- **Telas de gestão pedem, no menu, a chave da rota + uma de escrita** (`gestao()`
  em `menuItems.ts`): WhatsApp (`inboxes.update`), Etiquetas (`labels.create`),
  Variáveis (`canned_responses.create`), Meu site (`sites.update`). O Corretor lê
  essas coisas para usar no chat e ganharia a seção Minha imobiliária inteira. A
  rota continua aberta para quem lê; só o menu não oferece. A primeira chave é
  sempre a da rota, e o spec confere.
- **Saíram do menu, para todo mundo (inclusive a Leal Mídia)**, e abrem só pelo
  endereço: Propostas, Contratos, Captação (voltam quando prontas); Interesses,
  Ações agendadas, Marketplace (sem plano). A lista está no topo de
  `menuItems.ts`, e o spec impede que voltem por engano.
- **Saiu o "Personalizar menu"** (esconder, favoritar, reordenar): com seções
  fixas ele quebrava os rótulos. O que estava salvo no navegador é ignorado.
- **A Página do Facebook é integração** (desde 01/10/2026, a pedido do dono):
  Integrações → Facebook, em `/settings/facebook` (`FacebookPages`, que embrulha o
  `MetaPagesPanel`). A antiga tela Origem virou só **Formulários**, no mesmo
  endereço `/automations/origem`. Os links que mandavam revisar a conexão da
  página (aviso de erro dos Formulários e o Marketplace) apontam para a aba nova.
  Ela tem as mesmas travas da antiga Origem: `hideOnRoot` (não aparece no painel
  raiz nem na prévia da Vercel) e `client_manage_automations`.

Como funciona por dentro:

- `getCustomerMenuSections()` devolve as seções; `filterMenuSections` aplica o
  filtro de sempre (cargo, função do cliente, arquivamento) seção a seção.
- **Item com abas** (`abas`): aparece se alguma aba sobrevive ao filtro, e o
  `href` dele vira o da primeira que sobreviveu.
- **`MenuContext`**: o `MainLayout` entrega o menu já filtrado. A
  **`PaginaComAbas`** (rota-moldura sem endereço em `routes/index.tsx`) acha o
  item dono do endereço (`donoDoEndereco`, casamento mais longo) e desenha título
  + `Abas` a partir dele. Menu e abas leem a MESMA lista e não têm como discordar.
  Com menos de duas abas visíveis ela não desenha nada (a tela de dentro já tem
  título): é o corretor no Bolsão e em Meus números.
- O `AutomationsLayout` virou: redirecionamento de `/automations` + `PaginaComAbas`.
  O "vazio pelo plano × vazio pelo cargo" continua igual.
- `hideOnRoot` saiu da aba de Automações para o item do menu (Formulários e a
  aba Facebook somem no painel raiz).

Armadilhas:

1. **Item novo com abas:** a rota de cada aba tem que estar dentro de uma
   `<Route element={<PaginaComAbas />}>` em `routes/index.tsx`, senão a página
   abre sem a fileira de abas.
2. **Tela interna** (`/channels/new`, `/settings/portals/:portalKey`) fica FORA da
   moldura: tem título e "voltar" próprios. Já `/automations/flow-builder/:id`
   fica dentro, porque é filha de `/automations`.
3. **Aba cujo endereço é começo do de outra** (`/bolsao` e `/bolsao/listas`)
   precisa de `exata: true`, senão as duas acendem.


## Menu recolhido por seção e Conversas recolhe o menu (desde 2026-10-02)

Três ajustes de Conversas no mesmo PR. O menu recolhido mostrava todos os itens
como ícones soltos (uma coluna comprida); o painel do lead de Conversas precisava
de mais largura; e o "visto" das mensagens não parecia o do WhatsApp.

O que aparece na tela:

- **Visto azul como o WhatsApp.** Enviada: 1 visto cinza. Entregue: 2 vistos
  cinza. Lida: 2 vistos azuis. Para o leitor de tela:
  *Enviado*, *Recebido*, *Visto*.
- **Menu recolhido, um ícone por seção.** Ficam os itens da seção Principal
  (Dashboard, Conversas, Funil de vendas, Visitas) e, abaixo, um ícone para cada
  outra seção (Imóveis, Leads, Vendas e automação, Minha imobiliária). Passar o
  mouse abre uma caixinha com os itens da seção; clicar num item vai para a
  página e fecha a caixinha. O ícone da seção da página atual fica destacado. A
  caixinha demora 150 ms para fechar, para dar tempo de levar o mouse até ela.
- **Conversas recolhe o menu sozinho**, para o painel do lead caber. Quem abre
  o menu pelo botão em Conversas fica com ele aberto até sair de Conversas.
  Ao ir para qualquer outra tela, o menu volta ao que a pessoa deixou salvo.
- **Mensagens antigas continuam com 1 visto.** O servidor só passa a marcar o
  status certo daqui para frente (PR #363 do backend).

Decisões do dono (não reabrir sem ele pedir):

- **Conversas recolhe o menu para o painel do lead caber, e essa escolha não
  fica salva.** Recolher ali não troca a preferência da pessoa: quem deixou o
  menu aberto o encontra aberto no Dashboard.
- **Recolhido = um ícone por seção**, não um ícone por item.
- **Vistos do WhatsApp:** 1 cinza enviada, 2 cinza entregue, 2 azuis lida.
- **Mensagem antiga não é corrigida.** Fica com 1 visto.

Armadilhas:

1. **A regra mora em `src/components/layout/menuRecolhidoEm.ts`** (função pura, com
   spec). No `MainLayout`, `salvo` é a preferência gravada em
   `localStorage['sidebar-collapsed']` e `escolhaNaVisita` é o clique da visita,
   que nunca é gravado. O botão do menu em Conversas mexe só em `escolhaNaVisita`.
2. **O botão do topo e o `Sidebar` recebem o MESMO valor** (`menuRecolhido(...)`).
   Não calcule "recolhido" em outro lugar.
3. **`MenuRecolhido` usa o mesmo filtro e o mesmo `itemAtivo` do menu aberto**
   (as `secoes` já filtradas por cargo, função do cliente e arquivamento).
   Item que o cargo não vê não aparece na caixinha; seção vazia não ganha ícone.
4. **A rota de Conversas é `/conversations` e `/conversations/:id`**, a mesma regex
   do botão de Sugestões/Bugs (`/conversations-old` não conta).
5. **Voltar para Conversas começa recolhido de novo**: a escolha da visita zera
   ao sair.
6. **O azul do visto é cor própria**, não a cor primária da marca, para não
   mudar quando o cliente troca o tema.
7. **O hover não pode puxar o foco** (Conversas tem o campo de mensagem); abrir por
   clique ou teclado pode. Abrir por hover tem atraso de intenção (150 ms), pra
   passar o mouse pela barra não abrir caixa por cima da lista.
8. **O menu abre e fecha com movimento (pedido do dono em 02/10/2026: "um movimentozinho dela fechando, e quando trocar de aba dela abrindo").** O container do `Sidebar` anima só a largura (`transition-[width] duration-200 ease-out motion-reduce:transition-none`) e o conteúdo ao lado segue sozinho por ser irmão flex. O bloco da esquerda do `Header` (alinhado com o menu) usa o MESMO tempo e curva; o nome da conta que aparece no topo com o menu recolhido entra com fade de 200 ms. **Cobre/revela:** ao RECOLHER, o conteúdo aberto continua na tela até a largura terminar de fechar (200 ms) e só então troca para os ícones (fade curto); ao ABRIR, troca na hora e é revelado enquanto a largura cresce. Quem decide é `useMenuRecolhidoAtrasado` (`src/components/layout/menuRecolhidoAtrasado.ts`): a largura segue `isCollapsed`, o conteúdo (cartão, seções, rodapé) segue o valor atrasado. Com "reduzir movimento" tudo é instantâneo nos dois sentidos. Para o rótulo não quebrar de linha no meio do movimento, o `overflow-hidden` fica no container e o `nav` tem largura fixa do estado final (`w-[calc(4rem-1px)]`/`w-[calc(15rem-1px)]`, o -1px é a borda do container); rótulos longos terminam em reticências (`min-w-0 truncate`). Não troque o `nav` para `w-full`: voltam as quebras de linha durante a animação.

## O logo novo do LM Flow (desde 2026-10-01)

O dono do produto trouxe o logo novo (o símbolo de dois "L" encaixados + "LM Flow")
como imagem com fundo. Ele foi redesenhado em vetor e entrou no lugar do texto
"LM FLOW" que o sistema desenhava, e o símbolo virou o ícone do app e da aba.

O que aparece na tela:

- **O logo com símbolo** em todo lugar que já tinha logo: barra do menu, login,
  cadastro, convite de acesso, troca de senha, carregamento e as telas de retorno
  das integrações. A grafia passou de "LM FLOW" para **"LM Flow"**.
- **No tema escuro, o "LM" e a metade azul-marinho do símbolo viram branco**; o
  roxo não muda.
- **Ícone da aba, do celular e do app instalado**: o símbolo branco e roxo sobre
  azul-marinho. Era o "LM" com a casinha, que o Giovani tinha mandado.
- **Login, cadastro e convite de acesso mostram sempre o logo da versão escura.**
  Essas três telas têm fundo escuro fixo, e o logo seguia o tema da pessoa: no
  tema claro o "LM" azul-marinho sumia no fundo. O defeito já existia com o logo
  antigo.

Decisões (não reabrir sem o dono pedir):

- **O texto é desenho, não fonte.** As letras são da Figtree (Google, licença
  livre), convertidas em curvas: o logo não depende de fonte carregada e sai igual
  em qualquer aparelho.
- **Fonte de verdade: `public/brand/`** (logo claro, logo escuro, símbolo e
  símbolo escuro, em SVG). Esses arquivos também servem para uso fora do sistema.
  O `AppLogo` carrega os mesmos traços, escritos no próprio componente.

Armadilhas:

1. **Tela nova com fundo escuro FIXO passa `forceTheme="dark"`** no `AppLogo`.
   Sem isso o defeito do login volta, e ele é mudo: só aparece para quem usa o
   tema claro.
2. **Mudou o desenho, muda nos dois lugares**: `public/brand/` e os traços dentro
   do `AppLogo`. Os ícones PNG e o `favicon.ico` são gerados a partir do símbolo e
   precisam ser refeitos junto. O `generate-icons.mjs` da raiz é antigo (gera
   quadrados de cor sólida) e NÃO deve ser rodado.
3. **Não é `featureKey` nem `clientToggleKey`** e não tem metade de backend. Os
   scanners do catálogo de funcionalidades não entram nesta história.

## Links da Dashboard e as telas que abrem filtradas (desde 2026-09-30)

Fase 4, jornada 1. Todo número da Dashboard nova leva a algum lugar. As telas de
destino passaram a ler o filtro do endereço.

- **`src/features/dashboard/links.ts` é a fonte única**: a Dashboard MONTA o
  link e a tela LÊ com as mesmas funções. Filtro novo entra nos dois lados de
  uma vez, lá.
- **Imóveis** (`?recorte=`, `&desde=`, `&ate=`, `&meus=1`), **Agenda** (`?situacao=`,
  `&desde=`, `&ate=`, `&visita=`), **Propostas** (`?desde=`, `&ate=`) e **Funil**
  (`?etapa=`, além do `?card=` que já existia).
- **O chip "Da Dashboard: …"** (`ChipDaDashboard`) aparece sempre que a lista
  abriu filtrada por link, e tira o filtro. Sem ele, quem chega vê 3 de 415 e
  acha que sumiram.
- **Agenda: o calendário pede só o mês visível** e o contador conta o que a
  pessoa vê naquele mês ("7 visitas suas em setembro"), sem as canceladas
  (`meta.active_total`); as canceladas continuam desenhadas na grade. Antes era
  a história inteira, de todos os corretores.
  - `active_total` só vale no mês inteiro (calendário, sem filtro do link, sem
    aba de situação). Lista e abas contam `meta.total`: a aba Canceladas não
    pode dizer "0 visitas". Regra em `features/visits/contagem.ts`.
  - O mês só entra no rótulo quando o servidor manda `active_total`. Servidor
    antigo devolve a história toda, e o rótulo fica "415 visitas".
  - Agendar e cancelar recarregam a lista; o contador nunca é somado na mão.
- **Agenda: `?visita=` MOSTRA a visita, não age sobre ela** (busca por
  `GET /visits/:id` se não estiver carregada; não achou → "Visita não
  encontrada"). Sem filtro do link, o calendário vai pro mês dela; com filtro,
  fica na lista. O card ou a pílula ganha contorno por 2 s. Exceção (além da
  Realizada, abaixo):
  visita que já passou e segue Agendada/Confirmada abre o diálogo de realizada.
  Nunca abrir "Confirmar realização" para visita futura: grava e dispara
  automação. Trocar para Calendário tira o filtro do link: o calendário é
  sempre o mês na tela.
- Visita Realizada abre *Dar retorno* (nota e comentário, `POST /visits/:id/feedback`, sem disparar automação; comentário apagado não apaga o salvo); o link `?visita=` de uma Realizada abre a mesma janela.
- **Imóveis: escolher um Status no menu tira o filtro do link** (o link manda
  o próprio status; os dois juntos mostrariam "Vendido" no menu e ativos na
  lista).
- **Ganho/Perdido seguem o `final` que o servidor manda em cada etapa**
  (`etapaFinal.ts`). O nome só vale com servidor antigo, e nome ambíguo
  ("Venda perdida") vira perda, como no servidor. A etapa marcada como
  Concluída/Cancelada (`stage_type`) vem antes de uma que só bate pelo nome.

Armadilha: **`stage_type` é palavra na API desde 2026-09-30** (era número). Tipo
novo que o descreva usa `string`.

## Dashboard nova (desde 2026-09-30)

Fase 4, jornada 1. Spec: `LM FLOW/specs/2026-09-30-fase-4-jornada-dashboard-design.md`.

- **Desde 01/10/2026, para todos; a DashboardV2 foi apagada.** `/dashboard`
  abre a `DashboardNova` direto (`routes/lazyPages.ts`), sem chave por cliente.
  O que a nova aproveitava da antiga mora em `DashboardNova/base/` (tipos do
  payload, `primitives`, `Heatmap`, os seletores, `CampoFiltro` e o `lmf.css`).
  Pedido a `GET /dashboard/metrics` sempre leva `blocks=`: sem ele o servidor
  devolve só período e recorte.
- **Duas visões saídas do recorte do servidor**: `scope.mode === 'mine'` é a do
  corretor. O gestor em "Só os meus" vê exatamente a tela do corretor, com aviso.
  Os modos do seletor vêm de `available_modes` (regra da casa).
- **Catálogo de blocos** (`catalogo.ts`): cada bloco declara quem vê, o que pede
  à API e se nasce ligado; as linhas dizem onde. Mapa de calor existe desligado.
  É daqui que o editor da Dashboard vai sair.
- **Dois pedidos, com `blocks=`.** Um com todos os blocos, sem o funil escolhido;
  outro só do Funil (`blocks=pipeline` com o `pipeline_id`), para trocar de funil
  sem refazer o resto. O servidor tira `team` e `results` do corretor. Bloco que
  nenhum cartão lê não é pedido (`response` saiu).
- **Todo número leva a algum lugar**, e só vira link se o cargo abre o destino
  (`usePodeAbrir`). Destino de tela: `features/dashboard/links.ts`. Destino que
  não existe ou é caro (conversas, pendências): a lista rápida (`ListaRapida`,
  `GET /dashboard/list`), das mesmas fontes que o número.
- **Número sem link quando o recorte não bate com o destino.** A Agenda,
  Propostas e o funil não recebem time, corretor, número, etiqueta nem IA pelo
  link. Então Visitas agendadas, Propostas e as etapas do Funil só levam ao
  destino na imobiliária inteira sem filtro, ou para o corretor travado sem
  filtro (o destino já recorta por ele, mas não por Número, Etiqueta nem IA:
  com um desses ligado, o corretor travado também fica sem link):
  `recorteBateComDestino` em `visao.ts`. Em "Meu
  time", "Só os meus" destravado ou com filtro, viram texto, para nunca mostrar
  3 na Dashboard e 48 na Agenda. A lista rápida e Imóveis não entram nessa regra
  (a lista usa os mesmos filtros do servidor; Imóveis do corretor vai com
  `meus=1`). O conserto de vez é o servidor aceitar `owner_ids` nas telas de
  destino; aí os links voltam.
- **O corretor não vê Propostas na Dashboard** (decisão do dono, 01/10/2026):
  os números dele são três (leads recebidos, conversas, visitas agendadas).
- **Pendências = abertas agora**, não seguem o período.
- **Roleta agora** reaproveita `GET /roleta_configs/queue`, a cada 30 s com a aba
  visível; some para quem não tem `roleta_configs.queue`. **Compacto (pedido do
  dono, 02/10):** uma linha por corretor (nome, detalhe discreto à direita, selos);
  na Fila a lista começa pelo próximo da vez e numera quem está na disputa (1º, 2º…;
  pausado e sem acesso ficam sem número). Fechada mostra 4 e esmaece o 5º
  (`.lmfn-lista-esmaecida`, `mask-image`), com *Ver os N corretores*; com só um a
  mais, mostra todos. Ofertas esperando aceite: 3 com a lista fechada. Trocar de
  roleta fecha a lista.
- **Período padrão: últimos 7 dias.** Um seletor só. O resto dos filtros fica em
  *Filtros*, recolhido. Os filtros de origem e de funil da spec não estão no
  painel: origem não tem filtro na API, e o funil se escolhe no próprio bloco.
- **A linha de cima diz de quem são os números**, pelo recorte da resposta: "A
  imobiliária", "Meu time", o nome do corretor escolhido (ou "Um corretor") ou
  "Seus números". O botão do aviso de "Só os meus" diz para onde leva: "Voltar
  para a imobiliária" ou, para o gerente, "Voltar para o meu time".

Regras de tela que vieram das revisões (o que quem usa vê):

- **O aviso "Você está vendo a Dashboard como um corretor vê"** só aparece para
  quem tem cargo de gestão (`dashboard.team`: Administrador e Gerente) em "Só os
  meus". Num cliente com o isolamento do corretor desligado, o corretor de
  verdade também chega em "Só os meus" sem trava, e ele nunca vê esse aviso.
- **Antes da primeira resposta, um esqueleto neutro.** Sem a resposta não se sabe
  a visão, e desenhar a do gestor por um instante mostraria ao corretor blocos
  que não são dele.
- **Erro nunca mostra número velho calado.** Com uma resposta anterior na mão,
  aparece em cima dos blocos "Não deu para atualizar. Os números abaixo são da
  última vez." com *Tentar de novo*. Sem resposta nenhuma, o estado de erro da
  Fase 3 com *Tentar de novo*.
- **O seletor de Corretor não pisca "Todos"** logo depois da escolha: enquanto a
  resposta em mãos não é a dos filtros pedidos (`pendente` do
  `useDashboardNova`), vale a escolha.
- **Lista rápida:** pendência no teto (ex.: "500+") abre a lista com o total e o
  "Mostrando N de T" também com +. Fechar não apaga a lista enquanto o painel
  desliza para fora; só abrir (ou trocar de pendência/filtro com ele aberto)
  busca de novo.
- **Um desenho de cartão só** (01/10/2026): todo bloco, inclusive os quatro
  números, usa a superfície do `GlassCard` (`lmf-glass lmf-card`: fundo, borda,
  raio, sombra e 20 px por dentro), título no estilo `lmf-card-title` e 18 px
  entre cartões. O painel de Filtros também. Os quatro filtros (Corretor, Número
  de WhatsApp, Etiqueta, Atendimento) têm o mesmo campo: rótulo visível em cima e
  caixa de 40 px com ícone à esquerda e seta à direita (`CampoFiltro`, ligado
  pela prop `rotulo` dos seletores). Em Atendimento do time,
  "Visitas com feedback" é o quarto item do resumo, com a frase como legenda.
- **Análise do período:** "De onde vêm os leads" conta contatos captados no
  período pela primeira origem, com o total em cima; seis meses sem lead nenhum
  dizem "Nenhum lead nos últimos 6 meses" em vez de um gráfico zerado; cada
  gráfico tem um resumo de uma linha para leitor de tela; a faixa do horário
  comercial tem cor própria, diferente da área dos leads.

Não reabrir sem o dono pedir: as duas visões, o que cada uma vê, o período de 7
dias, pendências abertas agora, "Visitas boas" = nota 4 ou 5 de realizadas, e o
mapa de calor desligado.

Pendências registradas: Propostas aparece sem link e em zero onde o menu está
escondido (liga sozinho quando voltar); os cliques de conversa passam a abrir a
tela de Conversas filtrada na jornada de Conversas; o espaço do banner
(`data-slot="banner"`) é preenchido pela spec do banner.

## Agendar visita: só os seus clientes, sem horário duplicado (desde 2026-09-30)

Pedido do dono do produto: *"o corretor tem que clicar e já abrir com o nome dele
[…] só pode marcar visita para os contatos dele"* e *"aparecer apenas datas
disponíveis"*. Spec: `specs/2026-09-30-fase-4-agendar-visita-design.md` (pasta LM FLOW).
Ajuste de 2026-10-01 (corretor em botões, cliente pelo nome, lista paginada, modal
maior): `specs/2026-10-01-fase-4-agenda-do-corretor-design.md`, parte 0.

O que aparece na tela, no **Agendar visita** da Agenda:

- **Duas colunas, modal largo** (`max-w-5xl`, colunas com `gap-8`, campos com
  `space-y-5`). *Quem*: Cliente, Corretor responsável, Observações e Imóvel
  (opcional, por último). *Quando*: dia (Hoje / Amanhã / Sábado / outra data),
  duração (30 min / 1 h / 1h30 / 2 h), horário (grade de 4 colunas no computador,
  `max-h-64`) e a frase por extenso. No celular, uma coluna só, com rolagem
  (`max-h-[90dvh] overflow-y-auto`).
- **Corretor:** o campo de cliente só encontra os clientes dele, e o responsável é
  ele, sem botões. **Gestor:** escolhe o corretor em **botões**, um por corretor
  (`GET /visits/realtors`: ativos e visíveis, por nome; mesmo padrão dos botões de
  duração, com `aria-pressed`). Com muita gente, a área dos botões rola
  (`max-h-40`). Ao escolher o cliente, o dono do lead vem marcado; cliente sem
  dono desmarca, e dono que não está na lista (desativado) também não fica
  marcado. Salvar sem corretor: "Escolha o corretor responsável". Enquanto o
  modal confere o cargo, os botões não aparecem (o corretor não vê a equipe
  piscar).
- **Cliente pelo nome, lista que carrega mais.** O servidor manda o nome limpo
  (nunca o número cru do WhatsApp); o campo, depois de escolhido, mostra
  `nome · telefone formatado` (`telefone()`). Cliente sem nome de verdade (o
  servidor manda o telefone no lugar: nome igual ao `phone_number` ou só dígitos,
  `+` e espaços) aparece pelo **telefone formatado**, sem repetir o telefone na
  linha de baixo, e o campo escolhido mostra só o telefone (`nomeDoCliente` /
  `textoEscolhido` no `LeadCombobox`). A lista vem de 50 em 50 e pede a
  próxima página ao rolar até perto do fim; o rodapé diz "Mostrando 50 de 1.240 —
  digite para buscar" (sem mais páginas, só "Mostrando 2 de 2"). Nova busca volta
  à página 1 e resposta de busca antiga é descartada.
- **Horário ocupado aparece riscado, só com a hora** (o nome do cliente estourava a
  grade de 3 colunas) — vai pro `aria-label`/`title` do botão, e o nome completo
  aparece embaixo, na lista das visitas do corretor naquele dia: para o corretor
  travado, "Suas visitas nesse dia" / "Nenhuma outra visita sua nesse dia."; para o
  gestor, com o nome do corretor escolhido. Se mesmo assim bater, o aviso diz com
  quem.
- **422 na hora de salvar** (corrida: alguém marcou esse horário enquanto o modal
  estava aberto) recarrega a lista de visitas do dia, reusando o efeito e o guarda
  de corrida dele (contador `recarregarDia` nas deps) — o horário que acabou de ser
  ocupado aparece riscado sem precisar fechar e reabrir o modal.
- **Sem cadastro de cliente no modal** (decisão do dono). Em Propostas, continua.
- **As observações passam a ser gravadas** (antes sumiam, aqui e no cartão do Funil).
- Dia que já passou no calendário não abre o modal.
- **O resumo da visita** ("Sexta, 2 de outubro, das 13h às 14h" + as visitas do
  corretor naquele dia) fica num bloco próprio **embaixo de Imóvel**, na coluna da
  esquerda, que sobrava vazia (pedido do dono, 01/10). No celular, como as colunas
  viram uma, ele vem depois dos horários (ordem do DOM; a grade usa
  `md:row-start`/`md:row-span-2` para encaixar no computador).
- Corretor e gestor (não administrador) voltam a conseguir escolher o cliente na
  visita e em Propostas: desde a mudança de permissões a lista aparecia vazia.

Decisões (não reabrir sem o dono pedir):

- **Quem decide é o servidor** (`Visits::Booking`). A tela trava o corretor pelo
  `meta.only_mine` do seletor, nunca pelo cargo (a conferência pede
  `leadPickerPage('', 1, 1)`: só o meta interessa).
- **Corretor em botões, não em busca** (decisão de 2026-10-01): a busca por nome
  listava usuários desativados e escondia quem existia.
- **Horários fixos, de 30 em 30, das 07h às 21h, em 24 h — só com a agenda
  desligada no servidor.** O campo de hora do navegador vira AM/PM em
  celular em inglês. Com a agenda ligada, os horários vêm do horário de visita da
  Agenda (seção "Agenda do corretor", abaixo), continuam de 30 em 30 e em 24 h.
- **Nada sobre WhatsApp no modal.** A confirmação para o cliente é função futura,
  ligada por imobiliária no admin (spec da agenda do corretor).

Armadilhas:

1. **O backend vem PRIMEIRO** (`lm-flow` **#350**, empilhado sobre o #349). Contra o
   servidor antigo o modal abre como de gestor, sem trava nem recorte.
2. **A lista de horários e o "ocupado" moram em `src/features/visits/daySlots.ts`**,
   com spec, fora do JSX. A conta é a mesma do servidor: encostar não é conflito.
3. **`LeadCombobox` é compartilhado com Propostas**: `allowCreate` nasce `true` e
   `paginated` nasce `false` (Propostas segue com `leadPicker(q, 20)`, sem rodapé).
   Só a visita liga `paginated`.
4. **A paginação do cliente e o `/visits/realtors` vêm do servidor**
   (**comercial281/lm-flow#356**, mergear ANTES deste). Contra o servidor antigo,
   o rodapé de total não aparece (sem `meta.total`) e os botões de corretor dão
   erro de carregamento. Os botões usam o mesmo nome que a visita mostra
   (`Visits::Booking.user_ref`), em ordem por ele.

## Agenda do corretor: horário de visita e folgas (desde 2026-10-01)

Pedido do dono do produto: a IA prometia horário que o corretor não tinha, a visita
marcada à mão não tinha regra nenhuma e ninguém registrava folga. *"Mesmo que
limitado, é o que dá menos problema"*: um horário de visita da imobiliária, com
folgas por corretor. Spec: `specs/2026-10-01-fase-4-agenda-do-corretor-design.md`
(pasta LM FLOW), partes 1 a 3.

**A tela segue o `enabled` do servidor (`GET /visit_settings`); a chave
`agenda_do_corretor` saiu (01/10/2026).** Um gancho só,
`src/features/visits/useAgendaLigada.ts`, pergunta uma vez (resposta guardada por
30 s, um pedido para a página inteira) e devolve `ligada`: `null` enquanto não
respondeu, `false` com `enabled: false`, 403 ou erro, `true` só com
`enabled: true`. Desligada ou sem resposta, a tela é a de antes. Salvar o
*Horário de visita* chama `esquecerAgendaLigada()`.

O que aparece na tela, com a agenda ligada no servidor:

- **Agenda de Visitas → *Horário de visita*** (só gestor e administrador): dias da
  semana, início e fim (listas de 30 em 30, em 24 h) e *Feriados e datas
  fechadas*. Texto do efeito: "Vale para a IA e para quem marca à mão. Fora disso,
  nenhuma visita é marcada." Se o horário nasceu de uma IA e havia outras com
  horário diferente, avisa qual foi usada.
- **Agenda de Visitas → *Folgas*** (gestor, com o corretor escolhido em botões) /
  ***Minhas folgas*** (corretor, só as dele): período com data de início e fim, dia
  inteiro ou uma faixa de horas (a faixa vale em cada dia do período) e motivo
  opcional. "Excluir" confirma na própria linha.
- **Agendar visita:** os horários do dia vêm do servidor
  (`GET /visits/availability`), só os de dentro do horário de visita. Ocupado e
  folga aparecem **riscados, só com a hora** (`aria-label` "15:00 · ocupado,
  Fulano" / "15:00 · folga"). Dia fechado (dia da semana sem visita, data fechada,
  folga de dia inteiro do corretor escolhido) fica com o atalho desabilitado e o
  motivo no `title`; em *Outra data*, o campo leva o motivo e, no lugar dos
  horários, vem a frase do servidor ("Domingo não tem visita"). O gestor que ainda
  não escolheu o corretor vê o horário de visita sem ocupação; ao escolher, a grade
  é recalculada com as visitas e as folgas dele.
- **IA Vendedora → *Quando a IA pode marcar visita*:** somem dias, faixa e datas
  bloqueadas; no lugar, "Usa o horário de visita da Agenda — editar" (link para
  `/visits`). Ficam antecedência, máx. de dias, *Visita para hoje só com o
  corretor confirmando*, *Evitar dois leads no mesmo horário* e a duração.
- **Assistente da IA**, etapa *O rumo da conversa*: sem dias e horário da visita
  (diz que vêm da Agenda), e a revisão mostra "no horário de visita da Agenda".

Decisões (não reabrir sem o dono pedir):

- **Um horário de visita por imobiliária, mais folgas por corretor.** Não existe
  horário próprio por corretor.
- **Regra dura para todos.** Ninguém marca fora do horário de visita: nem a IA, nem
  o gestor, nem o corretor. Sem "Outro horário". Quem decide é o servidor
  (`Visits::Agenda`, usado pela trava da marcação à mão e pela IA); a tela só
  mostra a mesma conta.
- **Que corretor a IA confere, em camadas:** (0) o corretor da visita que ela está
  remarcando (o lead já tem visita marcada); (1) o dono do lead; (2) o corretor
  fixo da IA; (3) o dono do número quando ela fala como o corretor; senão nenhum
  (só o horário da imobiliária).
- **Quem liga é o servidor; a tela só obedece ao `enabled`.** Ao ligar, o
  horário nasce copiado da IA principal; sem IA, 8h às 20h, de segunda a sábado.
- **Na IA e no assistente, os valores antigos de dias/faixa/datas continuam
  gravados em `visit_config`** e voltam a valer se a agenda desligar: a tela não
  apaga, só deixa de mostrar, e o assistente não grava `days/start/end`.

Armadilhas:

1. **O backend vem PRIMEIRO**: **comercial281/lm-flow#358** (tabelas, chave, a
   conta única e os endpoints) e **comercial281/lm-flow#359** (a IA).
2. **A tela sem a chave entra ANTES do servidor que liga a agenda para todos.**
   Sozinha não muda nada: o servidor ainda responde `enabled: false` para todo
   cliente, e a tela fica a de antes. Como o front não usa mais
   `useClientToggle('agenda_do_corretor')`, o catálogo de funções
   (`sync-feature-catalog.mjs` / `audit-feature-catalog.mjs`) deixa de vê-la; o
   que liga ou desliga a agenda é só o servidor.
3. **Quem muda a regra é o gestor do servidor** (administrador, suporte ou quem vê
   todas as conversas), não "quem não é isolado". A tela decide pelo
   `meta.only_mine`: no cliente com o isolamento desligado o corretor vê os botões
   de gestor, mas o servidor recusa salvar o horário (403) e grava a folga no nome
   dele.
4. **Não voltar a ler a chave na tela.** Agenda, modal, IA e assistente usam
   `useAgendaLigada()`; o "ligada" é sempre `=== true` (o `null` do carregando
   conta como desligada, sem piscar a tela nova).
5. **`src/features/visits/daySlots.ts` continua sendo o caminho da agenda
   desligada** (servidor respondendo `enabled: false`, erro ou ainda sem
   resposta, e o `/visits/availability` respondendo `enabled: false`). Não apagar
   nem trocar a grade 07h–21h enquanto o servidor puder responder desligado.
6. **As contas puras da agenda** (motivo do dia fechado com as mesmas frases do
   servidor, rótulo da folga, horas de 30 em 30) moram em
   `src/features/visits/agenda.ts`, com spec; os pedidos ao servidor, em
   `src/services/visits/agendaService.ts`.


## Novo canal: só WhatsApp, com o ícone do WhatsApp (desde 2026-10-01)

Pedido do dono do produto: em *Canais → Novo canal* tem que aparecer **só o
WhatsApp** para a pessoa conectar, e a Evolution API precisa de um ícone mais
bonito — inclusive para quando o canal aparece na lista de Canais.

O que aparece na tela:

- **A grade *Selecione um tipo de canal* mostra só o cartão WhatsApp.** Widget
  Web, Instagram, Facebook Messenger, Telegram, SMS, Email e API saíram da
  criação, para todo mundo (inclusive a Leal Mídia).
- **A opção Evolution API usa o ícone do WhatsApp** no lugar do logo "evo api"
  (preto e verde). Vale em todo lugar que desenha o ícone do canal: o cartão do
  provedor, a lista de Canais, a conversa e o *Iniciar conversa*.
- **Selos dos provedores do WhatsApp:** o *WhatsApp Business API (nuvem)* perdeu
  o selo *Recomendado* (aparecia apagado, sem configuração, recomendando o que a
  pessoa não consegue usar) e a **Evolution API ganhou o selo *Mais usado***. O
  cartão de provedor passou a desenhar o `popular`, que existia no tipo e nos
  textos e nunca aparecia; *Recomendado* vence quando os dois estão marcados.

Armadilhas:

1. **Os outros tipos continuam em `getChannelTypes()`.** Canal antigo de outro
   tipo ainda lê nome e ícone de lá; o recorte é só na tela de criação
   (`NewChannel`). Não apagar os tipos da constante.
2. **Não tem metade de backend.** O servidor continua aceitando criar os outros
   tipos pela API; só a tela deixou de oferecer.
3. **Não é `featureKey` nem `clientToggleKey`.** Os scanners do catálogo de
   funcionalidades não entram nesta história.

3. **`LeadCombobox` é compartilhado com Propostas**: `allowCreate` nasce `true`.

## Área do Admin: o que saiu na limpeza (desde 2026-10-01)

Primeiro passo da refatoração da Área do Admin (spec `specs/2026-10-01-fase-4-area-do-admin-design.md` na pasta LM FLOW).

- **Modo Cliente saiu.** O *Entrar* do cartão do cliente faz o mesmo. A cópia do "aplicar funil em vários clientes" que morava nele (sem a regra de o funil chegar desligado) saiu junto. A chave `lm_client_mode` que ficava no navegador é apagada na abertura do app: **nenhuma requisição troca mais de cliente por conta própria.** `getTenantSlug()` é só o subdomínio.
- **Formulários de onboarding saíram** (ninguém usava). O link público `/formulario/...` cai na entrada do app. As respostas continuam no banco, sem tela.
- **A tela antiga de instâncias (`/super-admin/clientes`) saiu**, com o "revelar senha". Os dois endereços dela levam para Clientes. **O "revelar senha" não volta** (decisão da fase 1).
- **A aba Dashboard de Clientes saiu.** Ela lia o modelo de junho (um projeto do Railway por cliente) e não enxergava os clientes de hoje. A Visão Geral nova ocupa o lugar dela num PR próprio.
- **Sync Todos saiu.** Ele publicava de novo o frontend próprio de cada instância de junho; os clientes de hoje usam o frontend único, que publica sozinho no merge.
- Monitoramento e Servidores MCP eram código sem rota: saíram.
- Teto das caixinhas do SuperAdmin: 7 → 5.


## Área do Admin em 8 itens, com abas no topo (desde 2026-10-01; 7 itens até 04/10, quando entrou o Suporte)

Segundo passo da refatoração da Área do Admin (spec `specs/2026-10-01-fase-4-area-do-admin-design.md` na pasta LM FLOW). Só mudança de lugar: nenhuma tela foi refeita.

O que aparece na tela, no menu da Área do Admin:

| Item | Abas |
|---|---|
| Visão Geral | Dashboard · Leads ao vivo |
| Suporte | — |
| Clientes | Clientes · Números conectados · Custos |
| Usuários | Usuários (lista de todos os clientes + ficha) · Logs · Mensagem de acesso |
| Comunicação | Avisos na tela · Push · WhatsApp |
| Plataforma | Academia · Menus arquivados · Site |
| IA Vendedora | Agentes · Dashboard · Conhecimento · Aviso de visita |
| Equipe | — |

- **Suporte** (desde 04/10/2026) é o 8º item, o 2º do menu (logo depois de Visão Geral): os chamados do chat de suporte. Ver "Chat de suporte".
- **Mesmo padrão do menu novo do CRM:** cada item é uma página, as subdivisões são abas no topo, sem terceiro nível. A moldura (`AdminPaginaComAbas`) lê as abas do próprio menu (`adminMenuItems.ts`): menu e abas não têm como discordar. **O nome do item é o único h1**; o título de cada tela de dentro é h2.
- **Cada aba é uma rota.** Aba que já tinha endereço manteve (`/admin/push`, `/admin/academia`, `/admin/plataforma`). O item aceso no menu é o DONO do endereço (`donoDoEnderecoAdmin`), não o prefixo.
- **Link antigo continua valendo.** `?tab=` de Clientes e da IA Vendedora leva pra aba nova (`adminEnderecosAntigos.ts`); `/admin/uso` vira `/admin/usuarios` (a lista nova não lê `?client=`; o botão "Uso detalhado" dos Logs abre a lista inteira, e o filtro de cliente é pelo seletor).
- **Logs e Atividade viraram uma tela só** (já eram o mesmo componente). `/admin/uso` era cópia de Métricas de Uso: virou Usuários.
- **Conhecimento** junta Cérebro Universal, Princípios e Aperfeiçoamento, um embaixo do outro.
- **Aviso de visita** saiu de Plataforma e foi para IA Vendedora → Aviso de visita, sem mudar comportamento (decisões de 21/09 mantidas).
- **Mensagem de acesso** saiu da janela e virou aba; a variável `{senha}` saiu da lista (a senha é criada pela pessoa, pelo link, desde a fase 1).
- **WhatsApp** é o Comunicado. Neste passo a escrita continua na janela de sempre, com todos os clientes marcados (decisão). Confirmação e tela própria entram no PR de Comunicação.
- **Push** ainda tem três abas por dentro (Regras, Disparo manual, Histórico): viram seções no PR de Comunicação. É a única exceção ao "sem terceiro nível", e é temporária.
- **Custos** é a tela nova de 03/10 (ver seção "Custos do admin").
- **Banner** ainda não tem aba: entra com a spec própria.

## Número que envia os avisos: vazio = número da Leal Mídia (desde 2026-10-01)

Decisão do dono do produto, depois de o Rycco (Pinote) receber "Lead respondeu o
follow-up!" saindo do WhatsApp da Cher: **aviso para pessoa nunca sai do número
de um cliente**. Na tela da roleta, o *Número que envia os avisos* vazio deixou
de ser "Mesmo número da roleta" e passou a ser **"Padrão (número da Leal Mídia)"**:

- corretor e gestor recebem pelo Operacional da Leal Mídia;
- o **grupo** de avisos continua recebendo pelo número da roleta (nada garante
  que o Operacional esteja no grupo da imobiliária);
- quem escolheu um número deste cliente ou uma instância da Leal Mídia continua
  com a escolha.

A regra mora no backend (`RoletaConfig#person_notice_default?`, PR do backend
"Avisos para pessoa"); a tela só descreve. Não reabrir sem o dono pedir.

## Conversas avisa quando o número não está no ar (desde 2026-10-02)

Pergunta do dono do produto, com print da caixa de Conversas vazia: quem não tem
número conectado abria a tela e via *"Nenhuma conversa encontrada — Não há
conversas disponíveis no momento"*, sem saber se era tela quebrada ou falta de
alguma coisa. A ideia de um botão que criasse o número pelo próprio corretor foi
descartada nesta leva (permissão nova no servidor, cota de números do plano e o
WhatsApp pessoal dele entrando no CRM): ficou o aviso.

O que aparece na tela, na lista de Conversas (aba *Ativas*, sem busca e sem
filtro além do de sempre):

- **Corretor sem número**: *"Você ainda não tem um número de WhatsApp — Peça ao
  gestor da sua imobiliária para criar o seu."* A MESMA frase da tela de WhatsApp.
- **Gestor num cliente sem número**: *"Nenhum número de WhatsApp conectado"*, com
  **Conectar WhatsApp** levando ao *Novo canal* (só para quem pode criar).
- **Número existe mas não está no ar** (nunca leu o QR code, caiu, ou está no
  meio da leitura) e a lista está vazia: *"Seu WhatsApp não está conectado"*, com
  **Conectar agora** abrindo a configuração do número na parte da conexão. Vários
  números fora do ar viram uma lista, um botão por número.
- **Já tem conversas e o número caiu**: faixa âmbar em cima da lista, *"O número
  X está desconectado. Mensagens novas só chegam depois de reconectar."*, com
  **Reconectar**.

Decisões (não reabrir sem o dono pedir):

- **Quem diz se o número está no ar é o servidor** (`connection_status`, a mesma
  palavra do selo da tela de Canais). Número criado e nunca pareado já vem como
  desconectado. Canal sem sessão (status nulo) conta como funcionando.
- **A faixa do gestor só fala dos números de que ele é o Dono do número.** A lista
  dele é a imobiliária inteira; um número largado de propósito viraria faixa
  permanente na caixa de todo gestor. A queda dos outros já chega no sininho.
- **Lista vazia por busca, filtro ou na aba *Arquivadas* não culpa o número**:
  ali continua o texto de antes.
- **Sem resposta da lista de números (ou cargo que não lê números), não diz
  nada.** Melhor o texto genérico do que acusar o número errado.

Armadilhas:

1. **A regra e os textos moram em `src/features/numbers/avisoConversas.ts`**, com
   spec; o desenho em `src/components/chat/empty-states/AvisoNumero.tsx`. Textos
   literais: chave nova de `t()` não entra.
2. **A lista de números é a MESMA que a barra de Conversas já buscava** para o
   filtro de número (`InboxesService.list`, atrás de `inboxes.read`). Nenhuma
   requisição a mais.
3. **O estado é o da hora em que a tela abriu.** Quem reconecta e volta para
   Conversas vê a tela montar de novo; quem fica parado nela não vê a faixa
   sumir sozinha.
4. **O filtro `status=open` é o de sempre** (`FiltersContext.DEFAULT_FILTER`) e
   não conta como filtro; qualquer outro desliga o aviso da lista vazia.
5. **Não tem metade de backend e não é `featureKey` nem `clientToggleKey`.**

## Conversas: o lead ao lado da conversa (desde 2026-10-02)

Relato do dono do produto (Fase 4, jornada 8): o que o corretor precisa saber
do lead ficava escondido. Etapa, etiquetas, notas e o que a IA entendeu só
apareciam clicando no nome, e o painel era uma pilha de 12 cards fechados,
metade repetida ou sem uso, com um botão vermelho de excluir o contato no meio
do atendimento. No topo da conversa, o nome técnico do número e "Status: Aberta".

O que aparece na tela:

- **O painel do lead abre sozinho** em tela de 1280px ou mais, a cada conversa
  aberta. O X fecha, e ele reabre ao trocar de conversa. Abaixo de 1280px, como
  antes: abre no clique no nome do lead, e trocar de conversa não abre nem fecha
  (no celular, igual antes).
- **Topo:** foto, nome, telefone com copiar, e-mail, o lápis (a mesma janela de
  edição de Contatos) e o X. Embaixo, a **faixa de selos** (ver abaixo) e
  **"Também conversou pelo número X · abrir (+N)"** quando o lead tem outra
  conversa que a pessoa pode abrir (leva a mais recente).
- **Faixa de selos (Proposta B, 02/10)**, uma linha que quebra se precisar, cada
  selo com o fundo claro da sua cor, nesta ordem: **etapa** em cada funil (o nome
  da etapa com a cor que o gestor deu a ela; um selo por funil; fora de funil,
  nenhum), **temperatura da IA** (Quente vermelho, Morno âmbar, Frio azul; só
  quando a IA disse; "unknown" não vira selo), **origem** (o antigo "Veio de",
  azul; com link de anúncio o próprio selo é o **Ver anúncio**) e **espera**
  ("sem resposta há X", laranja, a mesma régua da lista, anda a cada 60 s). A
  linha de texto "Veio de: …" saiu.
- **Conversão Meta numa linha logo abaixo do topo:** "Meta" em verde + Qualificado,
  Desqualificado e Venda. A explicação longa virou o ⓘ (balão); quando e quem
  enviou aparece ao passar o mouse no botão já enviado (dica nativa, `title`).
  Continua sumindo quando o cliente não usa Pixel/CAPI; ao trocar de conversa a
  linha guarda o lugar enquanto carrega (nada pula), e a resposta atrasada do
  lead anterior é descartada. No card do lead, o bloco completo de antes
  (`variante`).
- **Seções simples, uma embaixo da outra, com um ícone colorido pequeno no
  título** (Funil azul, O que a IA entendeu roxo, Etiquetas rosa, Notas laranja):
  Funil (uma linha *nome do funil · Etapa [▾]* por funil, que move o lead na
  hora, e **Abrir card do lead**; fora de funil, só **Colocar no funil**), O que
  a IA entendeu (só se a IA atendeu; **o resumo primeiro, à vista**, em 3 linhas
  com **Ver mais**; "Histórico e próximos passos" continua fechado; a
  temperatura não se repete ali, está no selo), Etiquetas (**só as do lead**,
  com ✕ pra tirar, e **+ Etiqueta**, que abre a busca no catálogo da conta;
  Enter aplica a etiqueta de nome exato ou a 1ª sugestão e só cria quando não
  há sugestão, e o botão **Criar "x"** cria de propósito; sem etiqueta, só o
  "+ Etiqueta"), Notas (campo, as 3
  últimas e **Ver todas**) e **Respostas do formulário** (a única que abre e
  fecha, começa fechada, sem ícone, e só existe com dado).
- **Topo da conversa:** *"Número Guatemala · (11) 98235-3462 · Responsável:
  Marina"* (ou *"Sem responsável"*). Saiu o "Status: Aberta". O cabeçalho continua
  verde.

Decisões do dono (não reabrir sem ele pedir):

- **O painel abre a cada conversa**, em tela larga. Fechar vale até a próxima troca.
- **Saíram do painel:** Nome do atendente, Informações da conversa, Origem do
  Anúncio, Origem (dados crus), Conversas anteriores (virou a linha do topo), a
  repetição de Informações Básicas, Histórico e Excluir contato. E o "Online"
  verde do topo, que era fixo no código e aparecia pra todo lead.
- **Histórico só no card do lead** (Funil → Abrir card do lead), onde já existia.
- **Excluir contato só em Contatos.**
- **O verde fica** (cabeçalho e botão de enviar): reconhecimento com o WhatsApp.
- **Telefone mascarado na oferta da roleta:** com a oferta aberta para quem está
  vendo (o mesmo estado da faixa "assuma o lead"), o topo mostra
  `(11) •••••-••34`, sem e-mail, sem copiar e sem o lápis (a janela de edição
  mostraria o número). As **Respostas do formulário somem** (formulário de lead
  costuma trazer telefone e e-mail) e **"Abrir card do lead" some** (o card
  mostra telefone, e-mail e respostas; o seletor de etapa fica). **Nome que é o
  telefone** (o Evolution não manda o nome no 1º evento) sai mascarado também,
  no painel e no topo da conversa. Ao aceitar, aparece tudo. Enquanto a lista
  de ofertas ainda não chegou (logo depois de abrir o app), lead sem dono já
  aparece mascarado.
- **O nome do número é o que o gestor deu** (`display_name` da lista de
  números), no topo da conversa e na linha "Também conversou". O `inbox.name`
  que vem com a conversa é o identificador interno
  ("whatsapp-horizonte-imveis") e só aparece se a lista não tiver o número.
- **"Remover do funil" saiu do painel**: fica no quadro do funil.
- **O painel não coloca o lead num segundo funil.** "Colocar no funil" só existe
  para lead fora de qualquer funil; o segundo funil é pelo quadro.
- **Proposta B, "resumo no topo" (02/10), com cor só onde informa:** etapa,
  temperatura, origem e espera nos selos; nas seções, só o ícone pequeno do
  título. Nada de card dentro de card. Na oferta da roleta os selos aparecem
  (não têm dado pessoal); o resto da máscara segue igual.
- **Etiquetas mostra só as do lead.** O catálogo da conta sempre aberto embaixo
  de "Nenhuma etiqueta" fazia parecer que o lead tinha todas.

Armadilhas:

1. **A máscara é da tela.** O servidor continua mandando o contato inteiro pro
   corretor ofertado: é a dívida de 28/09 ("Roleta: o telefone do lead só chega
   depois do aceite", armadilha 3), aberta para o backend. Na tela, durante a
   oferta, a seção Respostas do formulário SOME inteira (não há máscara campo a
   campo) e o card do lead não abre pelo painel.
2. **`SOURCE_META` mora em `src/features/leadOrigin/origem.ts`**, usado pela aba
   Origem do card e pelo selo de origem (o antigo "Veio de"). Origem nova entra lá, uma vez. No painel o
   emoji do rótulo sai; `unknown` não vira selo; sem origem gravada, cai no
   anúncio da conversa ("Anúncio no Instagram/Facebook"). **"Ver anúncio" só
   aponta pra anúncio**: o link do `ad_referral` da conversa, ou o da origem
   gravada quando ela é `whatsapp_ctwa`, `meta_lead_ads` ou `anuncio`. Landing,
   site e portal não ganham link ali.
3. **A linha "Também conversou" depende do recorte de permissão do servidor**
   (`GET /contacts/:id/conversations`, que passa pelo
   `Conversations::PermissionFilterService`). A tela não filtra de novo.
4. **As regras e os textos moram em `src/features/conversas/painelDoLead.ts`**
   (com spec; os selos são `selosDoLead`, desenhados por `painel/FaixaDeSelos.tsx`);
   a linha do topo da conversa, em `topoDaConversa.ts`
   (`linhaDoTopo`), na mesma pasta. Textos literais: chave nova de `t()` não
   entra. As seções ficam em `src/components/chat/contact-sidebar/painel/`.
5. **A origem e a etapa dos selos vêm dos funis que o painel já busca**
   (`getPipelinesByConversation`: a etapa é a que tem o item do lead; a origem,
   o `lead_origin` do item). A temperatura é o `sales_agent_temperature` da
   conversa (a mesma fonte do "O que a IA entendeu") e a espera é o
   `esperaDoLead` da lista. Nenhuma requisição a mais por conversa. Lead fora de
   funil usa o `ad_referral`.
6. **`ContactHeader`, o `ContactDetails` do painel e `ConversationPipelineItem`
   foram apagados.** A edição do contato é `useEditarContato`.
7. **"Nome que é telefone" é uma régua só:** `isPhoneLikeName` em
   `src/lib/nomeDoContato.ts`, usada pelo card do funil (`pipelineItemHelpers`
   reexporta), pelo card aberto (`EditItemModal`) e pela máscara da oferta
   (`nomeNaTela`, no painel e no `ChatHeader`, que recebe `emOferta` do `Chat`).
8. **Abrir/fechar o painel mora em `usePainelDoLeadAberto`** (com spec). O
   fechamento ("endereço sem conversa fecha") depende SÓ do endereço. Ao abrir
   uma conversa a partir de /conversations, a seleção muda antes do endereço (o
   `navigate` roda em transição); se o fechamento também olhasse o "aberto",
   fecharia o painel que a seleção acabou de abrir. Não junte as duas regras.
9. **O nome do número vem da lista que a tela já busca** (`useNumerosDaConversa`,
   `display_name`), no topo e no painel. Nenhuma requisição a mais.
10. **O catálogo de etiquetas vem do store** (`useAppDataStore.labels` +
    `fetchLabels()`, com cache e busca única). O painel remonta as Etiquetas a
    cada contato: buscar direto no serviço fazia uma requisição por troca de
    conversa, até com o painel fechado.
11. **Foto do lead em branco (02/10): o Avatar do Radix guarda "a foto
    carregou" no Root** e só desenha as iniciais quando ela NÃO carregou. Quando
    a imagem sai (o lead novo não tem foto), esse estado não volta, e o círculo
    fica vazio. O painel do lead (que agora abre sozinho e fica montado de uma
    conversa pra outra) e o topo da conversa não remontam ao trocar de conversa:
    bastava passar por um lead com foto antes de um sem foto. O `ContactAvatar`
    remonta o `Avatar` por `key` (contato + endereço da foto). Não tire a `key`.
12. **Temperatura e resumo da IA podem estar velhos na tela.** A IA grava
    `sales_agent_*` com `update_columns` (backend, `ConversationRunner#persist_attributes`),
    que não dispara `conversation.updated`; a tela lê a conversa da lista, que só
    se atualiza com esse evento ou recarregando. Resultado: lead que a IA
    atendeu depois de a lista carregar aparece sem selo de temperatura e sem
    resumo (só o "Histórico e próximos passos", que é buscado na hora). A
    correção é no backend (avisar a conversa atualizada depois de gravar, ou
    mandar temperatura e resumo no `sales_agent_status`); fica em aberto.
13. **Turno "Nenhuma IA vinculada a este canal" não conta como histórico** (02/10).
    O backend grava um `agent_missing` a cada mensagem do lead em número sem IA,
    e a seção *O que a IA entendeu* aparecia só com essas linhas repetidas. Elas
    saem da lista e da contagem, e o "por quê" sozinho só segura a seção quando
    há IA no canal (`state.status !== 'none'`). Há spec.

## Conversas: pílulas, hora certa e campo enxuto (desde 2026-10-02)

Relato do dono do produto (Fase 4): a lista de Conversas tinha duas pílulas que
pouco ajudavam (Ativas/Arquivadas), uma faixa vermelha que gritava, hora que
mudava com qualquer evento do histórico e um campo de mensagem cheio de coisa
que o corretor não usa. O histórico também mostrava "adicionou demo-0001" em
texto puro.

O que aparece na tela:

- **Pílulas no topo da lista: Todas · Minhas · Sem resposta · Arquivadas**
  (no lugar de Ativas/Arquivadas). A pílula e o popover **Filtros** se somam.
- **Item da lista sem faixa colorida.** Quando o lead é quem falou por último e
  a conversa está esperando, aparece **"sem resposta há X"** (atualiza a cada
  60 s). A hora do item é a da última mensagem de verdade; avisos do histórico
  ("Tony adicionou ...", criados ou atualizados) não mexem na hora nem na prévia.
- **Painel direito vazio** ("Selecione uma conversa") mostra o aviso de número
  desconectado sempre que houver um.
- **Campo de mensagem:** a barra tem só **negrito e itálico**; sumiu a dica do
  "/"; o Alt+P saiu. A frase de fundo diz o bloqueio real: número desconectado
  -> "Seu WhatsApp está desconectado. Reconecte o número para responder."; janela
  de 24 h fechada -> "Faz mais de 24 h que o lead não escreve. Envie um modelo
  de mensagem para retomar."; sem bloqueio, o campo mostra "Escreva uma
  mensagem..." (`chatArea.messageInput.defaultPlaceholder`, do `ChatArea`). Dicas dos ícones: **Funis de mensagem**, **Enviar
  book**, **Modelos de mensagem**.
- **Histórico:** etiquetas citadas ("adicionou visita-agendada, demo-0001")
  aparecem como etiquetas coloridas, e o nome sai do texto.

Decisões do dono (não reabrir sem ele pedir):

- **"Sem resposta" usa a mesma régua das Pendências da Dashboard, sem o limiar
  de 1 h:** o lead está esperando e a IA não está atendendo.
- **A pílula nunca é salva.** Só os filtros do popover vão pro localStorage. Ao
  voltar pra Todas, volta o Responsável do próprio popover.
- **Nota interna fica fora do campo** (02/10): sem botão Resposta/Nota e sem Alt+P.
- **A barra do chat é só negrito e itálico.** Landings e Site Builder mantêm
  todas as formatações.
- **O aviso de número (PR #398) só acusa em Todas + filtro padrão + sem busca.**
- **Sem faixa colorida no item.** O sinal é o texto "sem resposta há X".

Armadilhas:

1. **"Minhas" filtra pelo id do usuário** (`assignee_id`), não por `'me'`: o
   `POST /conversations/filter` coloca o valor cru no SQL. Só cai em `'me'`
   quando a tela ainda não sabe o id do usuário.
2. **`waiting` mora no servidor** (backend lm-flow #364): `waiting_since`
   preenchido e IA fora do atendimento. Vai no GET e no POST e na rolagem
   ("carregar mais"). Não recalcule no front.
3. **Pílula e filtros do popover vivem na página** (`usePilulaEFiltros`); por isso
   o Responsável do popover volta ao sair de Minhas.
4. **O aviso do painel vazio vem de `useAvisoDeNumero`**; a regra de quando
   acusar na lista é outra (item 5 de "Decisões").
5. **Hora e prévia do item ignoram mensagem de atividade** (criada ou
   atualizada). Tempo relativo: `tempoDesde` em `@/lib/formato`.
6. **`acoes` do editor é por tela.** O `RichTextEditor` é compartilhado: o chat
   passa só negrito/itálico; sem `acoes`, todas as formatações aparecem. Desfazer
   e refazer (atalhos) ficam sempre ligados. O editor reaplica a frase de fundo
   a cada mudança (`classeDoEditor`).
7. **Janela de 24 h fechada** = não pode responder + restrição de janela + canal
   que não é de texto livre (baileys, evolution, evolution_go, zapi, notificame
   são de texto livre e nunca mostram a frase).
8. **A etiqueta no histórico casa por título inteiro** (ou UUID), separado por
   espaço/vírgula, e só na lista depois de "adicionou"/"removeu" ("Tony
   adicionou visita-agendada, demo-0001"); o resto do texto nunca é editado, então
   "Atribuído a Ana por Bia" não vira etiqueta mesmo existindo etiqueta "Ana".
   Número solto não casa. O catálogo vem do store (`useAppDataStore.labels` + `fetchLabels()`),
   sem requisição a mais. O texto do servidor usa o slug como título.
9. **Lista colada no campo do chat sai achatada** (já era assim; não é desta leva).
10. **Responder em "Sem resposta" não tira a conversa da lista.** Ela perde só a
    linha "sem resposta há X" e sai quando a lista recarrega. É de propósito:
    não some debaixo do corretor no meio do atendimento.
11. **A lista é ordenada pelo horário mostrado** (`ordemDaLista`, por
    `horaDoItem`, fixadas primeiro), mas o servidor pagina por última atividade.
    Mensagem de atividade bumpa a atividade no servidor e não muda a ordem na
    tela; um item de uma página mais pra frente pode aparecer depois num ponto
    diferente do que a paginação sugere.
12. **Troca rápida de pílula:** `handleApplyFilters` ignora resposta de pedido
    superado (contador em `useFilterHandlers`). "Resolver em massa" e "Tentar de
    novo" recarregam com a pílula e os filtros em uso, não com a lista crua.

## O card do lead em tela única (desde 2026-10-02)

Queixa do dono do produto: o card escondia informação. A aba Detalhes era um
formulário que rolava, e quem não sabia que dava pra descer não achava etapa,
roleta, follow-up nem Ganho/Perdido. Spec: `LM FLOW/specs/2026-10-02-fase-4-card-do-lead-design.md`.

O que aparece na tela hoje:

- **Janela quase tela cheia por cima do funil** (fechar volta pro funil; o link
  `?card=` continua valendo). Duas colunas.
- **Esquerda, fixa, sem rolagem:** foto, nome, telefone, e-mail (só leitura) e
  selo da origem; Etapa (seletor colorido, muda na hora); Responsável + "veio
  pela Roleta X"; aviso de sorteio em aberto; **Agendar visita · Conversa ·
  IA**; etiquetas; follow-up numa linha (a lista abre em "Ver mensagens");
  Conversão Meta numa linha; **Ganho | Perdido** no rodapé.
- **Menu "⋯":** Copiar link, Trocar roleta, Remover do funil (com confirmação).
- **Direita, Abas da casa** (`components/base/Abas`, sublinhado com ícone — não
  o Tabs de pílula do kit): Detalhes · Conversa · Origem. Detalhes em duas
  colunas de caixas: à esquerda o que a IA entendeu, Respostas do formulário (4 e
  "ver todas") e Imóveis de interesse; à direita **Histórico em cima,
  Observações embaixo**. Conversa ganhou o relógio **Agendar envio**, que leva o
  texto digitado para o agendamento.
- **Tamanho (pedido do dono, 02/10, num Mac de 13"):** coluna de 380px, nome em
  `text-xl`, Visita/Conversa/IA em botões quadrados com ícone em cima, etiqueta
  como "Adicionar etiqueta" visível, e a origem como selo colorido junto de
  telefone/e-mail (solta no meio parecia subtítulo sem dono).
- **Imóveis de interesse rola por dentro (pedido do dono, 02/10):** a lista para
  em ~3 imóveis (360px) e rola dentro da caixa; com muitos imóveis o Detalhes não
  cresce pra baixo.
- **Sem botão Salvar.** Tudo grava na hora.

Decisões do dono (não reabrir sem ele pedir):

- **Nome, telefone e e-mail não se editam no card.** O lápis de telefone/e-mail
  só aparece com `identity_correctable` do servidor (gestor, lead cadastrado à
  mão); a correção vai pro Histórico. O formulário de Contatos e o "Editar
  contato" da conversa seguem a mesma trava (`ContactForm`).
- **Histórico e Observações ficam separados.** Um o sistema escreve sozinho, o
  outro é o comentário que o corretor escolheu deixar.
- **Aba Retorno saiu** (nenhum cliente tinha um retorno sequer, 02/10). **Aba
  Imóveis saiu** e virou bloco em Detalhes.
- **Agendar visita usa o modal da Agenda** (`ScheduleVisitDialog` com
  `leadInicial`), não a janelinha antiga do card, que ignorava horário de visita
  e folgas.
- **Follow-up compacto é o MESMO `FollowupTimeline`** (prop `compacto`): estado,
  comandos e lista com uma fonte só, como na decisão de 31/08.

Armadilhas:

1. A coluna esquerda não pode crescer: bloco novo ali tem que caber em
   1366×768. Coisa que cresce (listas, textos) vai pra direita.
2. `onSubmit` do `EditItemModal` não é mais chamado; os três lugares que abrem o
   card ainda passam a prop (opcional).
3. Regras puras do card em `src/features/cardDoLead/cardDoLead.ts` (com spec):
   contato/conversa do card, lápis, respostas, origem curta, lead para visita.
4. A aba **Visitas e propostas** entrou depois, na seção abaixo.

## Card do lead: aba Visitas e propostas (desde 2026-10-02)

Entrega 3 da spec do card. Propostas existia e estava parada por falta de uso:
o corretor teria de sair do card para registrar.

O que aparece na tela hoje:

- **Aba "Visitas e propostas"** (entre Conversa e Origem), duas caixas:
  - **Visitas** do lead, mais recente primeiro: data, status, imóvel, corretor,
    nota e comentário. Visita que já passou, não foi cancelada nem remarcada e
    não tem nota nem comentário mostra **"Sem feedback"** (`visitaSemFeedback`).
  - **Propostas** do lead: valor, status, imóvel, tipo, contraproposta.
    **Registrar proposta** abre a janela da tela de Propostas com o lead e o
    imóvel de interesse já preenchidos. **Abrir em Propostas** leva para a tela
    filtrada pelo lead (`?contact_id=&nome=`), com selo para tirar o filtro.

Decisões do dono (não reabrir sem ele pedir):

- **Registrar proposta não move o card de etapa** (fica para uma segunda versão).

Armadilhas:

1. A janela de proposta é **uma só**: `src/components/proposals/ProposalFormDialog.tsx`,
   usada na tela de Propostas e no card. Não copiar de novo para dentro de uma tela.
2. Sem permissão de ver propostas (403), a caixa de Propostas some e a de Visitas
   fica. O botão de registrar exige `proposals_create` (chave do cliente) e o
   cargo com `proposals.create`.
3. As visitas vêm do mesmo `GET /visits` da Agenda, com o recorte do servidor:
   corretor vê só as visitas dele.

4. Ficou pra próxima entrega: aba **Visitas e propostas** (spec, entrega 3).

## Lista de escolha: o Seletor (desde 2026-10-02)

Relato do dono do produto, com print do filtro *Tipo de negócio* de Imóveis: metade
das listas de escolha abria a lista cinza do sistema operacional — no Windows, a
lista do Windows. Ninguém tinha decidido isso: o fork usa o Select do design system,
e as telas escritas aqui usaram `<select>` cru porque ele aceita a opção vazia
("Todos"), que o Select do design system recusa com erro.

O que aparece na tela: no computador, toda lista migrada abre a lista do produto;
no celular e no tablet, a do sistema (a rodinha do iPhone). No PR 1: Imóveis
(lista, cadastro e mapa), Roleta, ficha do contato, card do lead (interesses e
follow-up), Agenda (folgas e horário), destino do lead, desativar usuário, portais
e o formulário da landing. No PR 2: Dashboard nova (filtros e Funil), Conversas
(filtros rápidos), IA Vendedora (inclusive o assistente), Follow-up, Formulários de
anúncio, Automações de lead, Boas-vindas, Pixel e CAPI, Academia, Variáveis, número
que envia, Agendar mensagem, linha do tempo do contato, Site e a landing (roteamento
de lead, assistente e editor). No PR 3: painel raiz (Clientes e as janelas roxas,
Mural de leads, Push, Avisos na tela, Mensagem de acesso, Resultados da IA,
Agentes, Refinamento, Logs), primeiro acesso, `FormSelect` e os formulários de
canal e de agente herdados do fork. Não sobrou lista nativa fora do widget de chat
e do portal público (spec no fim desta seção).

Decisões (não reabrir sem o dono pedir):

- **Computador = lista do produto, celular = lista do sistema.**
- **O widget de chat e o portal público continuam com a lista do sistema**: outro
  público, outro visual, e o widget vive num iframe que mede a própria altura.
- **Uma peça só (`Seletor`), com a mesma entrada do `<select>`.** Migrar é trocar
  a tag; nenhuma tela reescreve lógica.

Armadilhas:

1. **A trava `selectNativo` (`conferir-padrao.mjs`) está em zero e vale para o app
   inteiro** (painel raiz, landing, primeiro acesso e a sobra do fork também; as
   outras categorias da catraca seguem só na tela do cliente). `<select>` novo em
   qualquer `.tsx` reprova o build. Use o `Seletor`. Fora da conta: o `Seletor`, o
   `SeletorComAbas`, os testes e as duas exceções da decisão
   (`SELECT_NATIVO_PERMITIDO`: `widget/PreChatForm.tsx` e `Public/portalShared.tsx`).
   Não entra exceção nova sem o dono pedir.
2. **A altura do Select do design system é presa por `data-size`.** O `Seletor`
   manda `data-size="livre"` e põe `h-9` como classe comum, para `h-7` da tela
   valer. Não tire.
3. **Sem `matchMedia` (testes) ele é nativo.** É o que mantém os specs com
   `selectOptions` valendo. O modo do computador tem testes próprios
   (`Seletor.spec.tsx`), com `matchMedia` simulado e os polyfills de ponteiro do
   Radix.
4. **A lista abre em `z-[1200]`**, acima dos modais próprios (`z-[200]`) e do mapa
   (`z-[1000]`). Janela nova com camada maior que isso esconde a lista.
5. **Import pelo arquivo** (`@/components/base/Seletor`), nunca pelo índice.
6. **Não é `featureKey` nem `clientToggleKey`**, e não tem metade de backend.
7. **No celular é um `<select>` só, com a seta desenhada no fundo e sem largura
   padrão:** tela que quer largura cheia passa `w-full`.
8. **Caixinha que fecha em clique fora precisa saber da lista.** No computador a
   lista do produto abre num portal, fora da caixinha. Quem fecha no `mousedown` de
   fora ignora alvo dentro de `[data-slot="select-content"],
   [data-radix-popper-content-wrapper]`, e no Esc olha `defaultPrevented` (o Radix
   fecha só a lista). Com a lista aberta o Radix desliga os cliques no body, então
   o clique de fora chega no `<html>`: quem fecha no `mousedown` também ignora alvo
   igual a `document.documentElement` (como o `QuickFilters`), senão qualquer clique
   fecha a caixinha junto com a lista. Modelo: `chat/filters/QuickFilters.tsx`, com spec.
9. **Componente com `Seletor` declarado dentro do render fecha a lista aberta**: é
   um componente novo a cada redesenho, e o React desmonta e monta de novo. Declare
   no escopo do módulo e passe o que ele usa por prop (`LeadRoutingModal`,
   `CreateLandingWizard`, com spec).
10. **No computador a caixa mede o rótulo escolhido (`w-fit`).** Lista que enchia o
    espaço pede `w-full`; lista em linha ou de filtro pede largura fixa pelo maior
    rótulo (gatilhos da IA Vendedora, dia e hora do relatório, unidade de espera,
    Período da Dashboard), senão a linha pula a cada escolha. E o `tailwind-merge`
    fica com a ÚLTIMA classe: `${inputCls} w-44` com `w-full` dentro vira `w-44`,
    enquanto no CSS do Tailwind o `.w-full` vencia. Em Pixel e CAPI a largura morta
    saiu para o desenho continuar o mesmo.
11. **`bare` com fundo colorido:** o `Seletor` repete o último fundo da `className`
    como `dark:hover:`, para o hover escuro do design system não apagar a cor do
    status. CSS fora de camada (o `lmf.css` da Dashboard) vence qualquer utilidade
    do botão; regra escrita para `<select>` ou para `button` precisa olhar
    `[data-slot='select-trigger']`. Na Dashboard o liga/desliga é
    `[aria-pressed]` (não `button[data-active]`) e o `.lmf-select` traz de volta a
    seta do design system.
12. **`assistente/steps/Campos.tsx` já tem um `Seletor` próprio** (o campo do
    assistente, usado nas etapas). A peça da casa entra lá como `SeletorDaCasa`.
13. **Tela pintada de escuro à mão passa `escuro`** (primeiro acesso, janelas roxas
    do painel raiz): a lista aberta sai no tema escuro mesmo com o app no claro
    (classe `dark` na própria lista). E tira o `style` das `<option>`: fundo ou cor
    inline na opção vence o realce do mouse e, no tema claro, deixa texto escuro em
    fundo roxo. O primeiro acesso é `bare` + `escuro`: a caixa e a seta são as da
    tela, e o `onFocus` que pinta `e.target.style` vale igual no botão. Testes:
    `OnboardingPage.spec.tsx`, `ClientBroadcastModal.spec.tsx`.
14. **No celular a seta é imagem de fundo e vai DEPOIS do `style` da tela.** O atalho
    `background` no `style` (janelas roxas) apagava a seta. Não inverta a ordem
    (`Seletor.spec.tsx`, "a seta resiste a style com o atalho background").
15. **Atalho de teclado na janela inteira (`window` keydown) com lista na tela:** no
    Esc, olhe `e.defaultPrevented`, senão o Esc fecha a lista E a tela. Mesma regra
    da armadilha 8. Modelo: modo mural do Mural de leads, com spec.
16. **Tela que manda o foco para outro lugar depois de escolher usa
    `onCloseAutoFocus`** (prop opcional do `Seletor`, repassada ao conteúdo do Radix
    no computador), com `e.preventDefault()` e o foco no campo certo. Nunca um
    `setTimeout`: a animação de fechar devolve o foco ao botão da lista depois dele.
    Modelo: campo "Outro" do primeiro acesso, que aparece com `autoFocus` depois da
    escolha.
17. **Lista comprida rola como qualquer lista** (pedido do dono, 02/10): sem as setas
    do Radix que rolam sozinhas ao passar o mouse, com a barra de rolagem fina à vista
    (o Radix a esconde). Mora em `ROLAGEM_COMUM`, no `Seletor`, e vale para todas as
    listas. As classes levam `!` porque o `<style>` que o Radix injeta não tem camada
    e venceria a utilidade do Tailwind. Não trazer as setas de volta.

Spec e planos: `LM FLOW/specs/2026-10-02-seletor-unico-design.md`,
`LM FLOW/plans/2026-10-02-seletor-unico-pr1.md`,
`LM FLOW/plans/2026-10-02-seletor-unico-pr2.md` e
`LM FLOW/plans/2026-10-02-seletor-unico-pr3.md` (pasta do Tony, fora deste repo).

## Selo *Follow-up automático* nas Conversas (desde 2026-10-02)

Pedido do dono do produto: a mensagem que saiu pelo follow-up automático aparecia
na conversa com o selo *Atendente*, igual a uma resposta da equipe.

O que mudou na tela:

- **Mensagem de follow-up mostra o selo amarelo *Follow-up automático*** no lugar de
  *Atendente*, sem nome ao lado. Vale para os dois follow-ups: o de funil
  (*Automações*) e o da IA Vendedora (*IA Vendedora → Configuração → Follow-up
  automático*). A bolha continua verde, como toda mensagem nossa.
- Resposta normal da IA, automação de lead e disparo agendado continuam como
  *Atendente*.

Armadilhas:

1. **A tela reconhece o follow-up por duas marcas do servidor**: `followup_job_id`
   (funil, gravada desde 31/08, então o histórico já sai com o selo) e `followup`
   (IA Vendedora, só a partir do PR #367 do `lm-flow`). A regra mora em
   `features/numbers/messageAuthor.ts` (`isFollowupMessage`).
2. **A metade do backend vem PRIMEIRO** (`lm-flow` #367, branch `saas-multitenant`).
   Sem ela, o follow-up da IA continua como *Atendente*, e a bolha que o webhook
   grava antes do eco também.

## Contatos: lista enxuta, filtros novos e cadastro curto (desde 2026-10-02)

Pedido do dono do produto (Fase 4): a aba Contatos estava desalinhada, com
colunas que não diziam nada e um cadastro de CRM genérico. Spec:
`LM FLOW/specs/2026-10-02-fase-4-contatos-design.md`.

O que aparece na tela:

- **Topo:** só "Contatos", sem subtítulo. Busca ("Buscar por nome ou celular"),
  pílulas, *Filtros*, **Exportar** com texto e *Novo contato*. O **Importar saiu**
  (planilha entra pelo Bolsão e pelo quadro do funil, que distribuem).
- **Colunas: Nome · Celular · Atendimento · Etiquetas · Atualizado em · ⋯.**
  *Atendimento* = telefone pequeno + nome do número, uma barra e a foto (ou
  inicial) do responsável; sem dono, "Sem responsável". *Atualizado em* =
  `quandoMudou()` ("hoje 14:32", "ontem", "28/09"). Saíram Tipo, Status e
  Pipelines. Ordem continua por nome.
- **Pílulas Todos · Meus · Sem responsável** (só gestor) e **Filtros** fechado:
  com a etiqueta, sem as etiquetas e (gestor) Responsável. Cidade e Empresa saíram,
  e o modal de filtro avançado também.
- **Sem alternador grade/lista.** Computador = tabela; celular = cartões com
  Ligar e WhatsApp (`ContactCartaoMovel`).
- **Novo contato / Editar contato:** Nome (um campo), Celular, E-mail,
  Responsável, Origem (pílulas + "Outra") e Etiquetas; *Outras informações* só se
  o gestor criou campo extra. Salvar fixo no rodapé. Saíram foto, tipo, sobrenome,
  CPF, país, cidade, empresa, descrição e redes sociais (o que já estava gravado
  continua no contato; o formulário só não manda mais).
- **Responsável:** corretor = ele mesmo, travado. Gestor = **SeletorComAbas**
  *Corretores | Roleta*, obrigatório no cadastro. Roleta só no cadastro: o contato
  é **oferecido** a um corretor e só ganha dono quando ele aceita; o aviso diz a
  quem foi oferecido (ou entregue, no cliente sem aceite).

Peça nova da casa — **`components/base/SeletorComAbas`**: lista com abas no topo,
uma escolha só. No celular vira a lista do sistema com um grupo por aba (mesma
regra do Seletor; a trava `selectNativo` libera os dois arquivos). Pedido do dono:
usar a mesma peça no destino dos formulários (Lead Ads, portal, site, landing),
onde hoje Roleta e Responsável são dois seletores (`LeadDestinationFields`).

Armadilhas:

1. **A metade do backend vem PRIMEIRO** (`lm-flow` #372): filtro
   `default_assignee_id`, `roleta_config_id` no cadastro, `updated_at` na lista e
   o corretor sempre dono do que cadastra. Sem ela, *Meus*/*Sem responsável* dão
   erro e *Atualizado em* mostra "—".
2. **"Corretor" na tela = sem `conversations.read_all`** (`useCorretorLogado`). O
   servidor usa `broker_isolated?`, que ainda olha a chave da imobiliária; se a
   chave estiver desligada, a tela trava o responsável nele e o servidor aceita o
   mesmo id, então o resultado é igual.
3. **`roleta.outcome = "distribuido"` não garante oferta** (roleta fechada ou sem
   ninguém elegível volta igual). A tela lê `roleta.offered_to`.
4. **`aoLadoDaBusca` do BaseHeader** liga o `flex-wrap` só em quem usa o espaço;
   as outras 19 telas não mudam.

## Construtor de fluxos: gatilhos das Automações e "Aguardar resposta" (desde 2026-10-02)

Sprint 1 de 4 da unificação das automações (decisões do dono do produto em 02/10,
não reabrir sem ele pedir). Spec:
`LM FLOW/specs/2026-10-02-automacoes-sprint-1-motor-e-aguardar-resposta-design.md`.
O construtor (hoje *FlowBuilder*, em *Fluxos de mensagem*) vira o único motor de
automação; nome e lugar no menu mudam na sprint 2.

O que aparece na tela:

- **Gatilho igual ao das Automações.** O botão do gatilho no topo do canvas e o
  cartão verde do gatilho abrem a janela *Gatilho do fluxo*: a mesma lista, os
  mesmos nomes e os MESMOS filtros da tela Automações (Origem e *Quais
  formulários?*, *Qual anúncio?*, *Só quando quem aceitou for*, palavra-chave,
  etapa, etiqueta e *Funil*), agrupados em Lead chegou · Atendimento · Funil de
  vendas · Visita · Imóvel. Ficam de fora *Inativo há 7/14 dias*, *Sem resposta
  após X minutos* (virou o bloco abaixo) e *Imóvel compatível encontrado*. Em
  *Lead criado* aparece fixo: "Dispara pra todo contato novo, inclusive os que
  entram pela agenda do celular. Use a origem pra limitar." O cartão do gatilho
  mostra os filtros escolhidos.
- **Bloco *Aguardar resposta*:** *Esperar até* (número + minutos/horas/dias) ou
  *Sem limite*. Duas saídas no cartão e nas linhas: **Respondeu** (verde) e **Não
  respondeu** (cinza); com *Sem limite*, só *Respondeu*. Texto de ajuda: "Respondeu:
  o lead mandou qualquer mensagem depois da última que este fluxo enviou."
- **Bloco *Esperar*:** minutos/horas/dias e os três modos (por um tempo; por um
  tempo saindo só em horário comercial; até uma data e hora).
- **Bloco *Mandar WhatsApp*:** campo *Enviar pelo número*, o mesmo das Automações
  (automático, número do responsável pelo lead, um número específico). Chips de
  variável do construtor (*Primeiro nome* etc.).
- **Paleta enxuta:** só Mandar WhatsApp · Esperar · Aguardar resposta · Se / senão ·
  Só continuar se · Aplicar etiqueta · Tirar etiqueta · Mover de etapa, nos grupos
  Mensagem / Controle / Lead. Bloco escondido num fluxo antigo abre e mostra "Este
  bloco volta na próxima versão".
- **Se / senão e Só continuar se:** respondeu nas últimas X horas, tem a etiqueta,
  está na etapa, tem e-mail, tem telefone e **Resposta do formulário** (formulário
  com rótulo *Anúncio*/*Site* → pergunta → opções pra marcar, ou "contém o texto…"
  / "respondeu qualquer coisa"). O cartão mostra a frase pronta. Se o servidor não
  conseguir ler as perguntas, a janela mostra o motivo e deixa digitar pergunta e
  resposta. "Veio de" e o formulário antigo saíram da lista; bloco antigo com eles
  continua mostrando e valendo.
- **Estado vazio** com o exemplo pronto *Primeiro contato com nova tentativa*
  (Lead criado → mensagem pelo número do responsável → Aguardar resposta 30 min →
  Não respondeu: outra mensagem), montado pela tela com as rotas de criar/salvar.
  Saiu o "igual ao editor de automações do Hub".
- **Ligar/desligar** virou a `Chave` da casa e não recarrega o fluxo (antes apagava
  o que não estava salvo); "Alterações não salvas" aparece ao lado do Salvar, e
  fechar a aba ou sair pelo menu pergunta antes (a seta de voltar do canvas não).
- **Automações:** *Aguardar (delay)* saiu da lista de ações (o servidor nunca
  esperou). Regra que já tem a ação continua com ela, e o cartão diz "Esta etapa
  não espera: as ações seguintes saem na hora".

Armadilhas:

1. **A metade do backend vem PRIMEIRO** (`lm-flow`, branch `claude/automacoes-motor`):
   sim/não no `wait_for_reply`, gatilho `{event, conditions}`, `send_from`,
   critério `form_answer` e as rotas `/flow_automations/forms` e
   `/flow_automations/form_questions`. Sem ela o save_flow recusa as duas saídas.
2. **O gatilho grava SÓ `{ event, conditions }`** (`features/flowAutomations/trigger.ts`),
   com os nomes de evento e o formato de condição das regras. O formato antigo
   (`contact_created`, `stage_id` solto) é traduzido pelo servidor ao ler;
   `normalizeTrigger` traduz de novo só por garantia.
3. **Os editores de filtro são os da tela Automações** (`ConditionEditor`,
   `PipelineFilterEditor`, `useAutomationResources`, `formatConditionSummary`, em
   `LeadAutomationsEditors.tsx`). Mexer neles muda as duas telas.
4. **Duas saídas = `branchHandles()`** em `lib/flowAutomationGraph.ts`: condição e
   Aguardar resposta. Desenho, "+", layout, onde a paleta pendura o bloco novo
   (`appendTarget`) e o corpo do save_flow (`buildSaveFlowPayload`) saem todos dele.
   Com *Sem limite* o `next_no_node_id` vai nulo (contrato).
5. **Fluxo salvo antes** com Aguardar resposta de saída única: `normalizeLoadedNodes`
   põe a saída em *Respondeu*.
6. **"Só continuar se" com etiqueta grava também `labels: [título]`** — é o que o
   motor de antes lia nesse bloco. Etiqueta no construtor é sempre pelo TÍTULO.
7. **Resposta do formulário guarda chave E texto de cada opção marcada em `values`**
   (o Meta devolve um ou outro; "é qualquer uma destas" não muda) e
   `value_labels` só pra frase. As rotas aceitam com ou sem o envelope `{ data }`.
8. **As variáveis do construtor são outras:** `{{first_name}}`, `{{name}}`,
   `{{phone}}`, `{{email}}` (`FlowAutomations::VariableInterpolator`). `{{nome}}` e
   `{{corretor}}` das Automações saem VAZIOS aqui. A sprint 2 alinha.
9. **"Enviar pelo número" lista pela rota das Automações**
   (`/lead_automation_rules/send_numbers`): mesma lista de números, mesma regra.
10. **Paleta = `FLOW_VISIBLE_NODE_KINDS`** (`types/flowAutomations.ts`); a sprint 2
    devolve os blocos como ações das Automações.
## Imóveis: Empreendimentos e Revenda (desde 2026-10-02)

Fase 4, entrega 2. Spec: `LM FLOW/specs/2026-10-02-fase-4-imoveis-empreendimento-revenda-design.md` (pasta do Tony, fora deste repo). Protótipo aprovado pelo dono: https://claude.ai/artifact/8h6NVs343WYK4Vsb5ga6yt

O que aparece na tela:

- **Abas Empreendimentos | Revenda**, cada uma com a sua contagem. Abre na aba com mais cadastros (empate: Empreendimentos); a vazia mostra o convite. A aba fica no endereço (`?aba=`), e `?aba=` vence a aba padrão.
- **Busca global (Ctrl+K) abre o imóvel na aba certa:** o link é `linkNaLista(p)` (`/properties?aba=<aba do imóvel>&q=<código>`). Sem a aba, a tela abria na aba com mais cadastros, buscava só nela e um empreendimento achado dava *Nada encontrado* em Revenda. Com a tela já aberta, um `?q=` novo no endereço troca a busca e a aba.
- **Filtro retrátil no topo** (botão *Filtros* com o número de ativos), que rola junto com a página; campos diferentes por aba; etiquetas dos ativos embaixo da busca. A lista atualiza na hora. *Ordenar* e as listas de escolha dos filtros usam o `Seletor`.
- **Finalidade:** *Venda* traz os imóveis de venda e os de *Venda e locação*; *Locação* traz locação, *Venda e locação* e temporada. Um imóvel *Venda e locação* aparece nos dois filtros.
- **Linhas largas** (estilo Kenlo), com visão em Grade e Mapa (`?visao=`). `/properties/map` redireciona para a visão Mapa. *Ver página no site* abre `/imovel/<slug>/<código>` e só aparece para imóvel que está no site (marcado para o site e *Disponível*/*Reservado*). O nome do imóvel só abre o cadastro para quem pode editar.
- **O Mapa mostra a aba inteira:** na visão Mapa somem busca, *Filtros*, *Ordenar*, etiquetas e contador (o mapa não usa nenhum deles), e a lista não recarrega por trás. Ficam as abas e a troca de visão. O mapa tem `isolate`: as camadas do Leaflet (z 400 a 1000) não pintam por cima das janelas.
- **Situação só no menu ⋮**, com janela e efeito escrito. *Mover para Revenda/Empreendimentos* com confirmação. *Força do anúncio* é item do menu ⋮ de cada imóvel (mostra o número depois de calculado). *Gerar descrições com IA* é botão com nome (contorno) no topo, sem menu *Mais ações*. Exclusão é *Excluir imóvel* (glossário: some de vez).
- **O cadastro de hoje abre com o tipo da aba.** Empreendimento fixa *Venda* (também ao editar um cadastro antigo de locação) e mostra *Fase da obra*, *Previsão de entrega* (some em *Pronto para morar*) e *Tipologias*. A previsão é escolhida em duas listas, **Mês** e **Ano** (do ano passado a 8 à frente), que compõem o mesmo `AAAA-MM`: o `<input type="month">` vira texto livre no Firefox e no Safari do computador, o servidor descartava e a previsão salva sumia. Mês sem ano (ou o contrário) é sem previsão. Revenda esconde os três, mas **guarda a previsão que já estava salva**. Situação antiga (*Reservado*/*Alugado* num empreendimento) aparece como opção extra, para não sumir ao editar. O tipo só é enviado na criação: trocar de tipo é só por *Mover para…*.

Decisões do dono (não reabrir sem ele pedir): uma entidade só (IA, portais e site continuam vendo "imóvel"); sem controle unidade por unidade; nomes "Empreendimentos | Revenda"; situações do empreendimento À venda / Esgotado / Inativo / Rascunho.

Armadilhas:

1. **As regras moram em `src/features/properties/listingKind.ts` e `formularioPorTipo.ts`**, com spec, e a tela em `src/pages/Customer/Properties/lista/`. A tela de Imóveis já passa de 2.000 linhas: regra nova não entra nela.
2. **A contagem das abas usa a própria lista com 1 por página** (`contarPorTipo`), só com os parâmetros de recorte. Não troque por `/properties/stats`: ele pede outra permissão e não respeita o recorte.
3. **Servidor antigo (sem `listing_kind`)**: tudo cai em Revenda (`tipoDoImovel`); a contagem de Empreendimentos fica 0 e a tela abre em Revenda. A metade do backend vem PRIMEIRO (`lm-flow`, `saas-multitenant`).
4. **Cada aba guarda os próprios filtros.** Os parâmetros saem de `paramsDosFiltros(kind, ...)`: filtro de uma aba nunca vaza para a outra.
5. **Não é `featureKey` nem `clientToggleKey`.**

## Uma tela só pro cliente: o card do lead abre de Contatos (desde 2026-10-02)

Decisão do dono do produto (Fase 4): a janela "Detalhes do Contato" morreu.
Clicar num contato em Contatos (e o link `/contacts/:id`) abre o **card do lead**.
Spec: `LM FLOW/specs/2026-10-02-fase-4-card-do-contato-design.md`.

O que aparece na tela:

- **Contato em um funil:** o card daquele atendimento, igual ao do quadro.
- **Em mais de um funil** (raro): **abinhas centralizadas no topo do card**, uma
  por funil, com a bolinha da etapa. Abre no mais recente. É o modelo do Kenlo:
  o contato é o cliente, e cada card no funil é um atendimento dele.
- **Em nenhum funil:** o mesmo card, com **"Colocar no funil"** no lugar da Etapa
  (o contato entra na primeira coluna e o card recarrega). Somem Ganho/Perdido,
  Conversão Meta e "Remover do funil". "Copiar link" copia `/contacts/:id`. A aba
  Conversa usa a conversa mais recente do contato.
- **Vieram da janela antiga:** *Juntar com outro contato* (menu ⋯, só gestor) e
  *Outras informações* (campos extras do gestor, bloco na aba Detalhes, editados
  na hora; aparecem também no card do quadro).
- **Morreram:** a "Detalhes do Contato", a ação *Histórico* da lista de Contatos
  (o card tem) e a **Consulta de crédito** (BigDataCorp, nunca usada; a metade do
  servidor sai no `lm-flow`).

Armadilhas:

1. **Card sem funil = o mesmo formato do card do funil sem `id`**
   (`itemSemFunil` em `features/cardDoLead`). Parte nova que dependa do card do
   funil (id, etapa, `custom_fields`) tem que olhar `semFunil(item)`.
2. **O card inicializa por `item.id`.** Quem abre vários cards sem funil precisa
   do `key` (o `CardDoContato` passa `sem-funil-<contato>`), senão o card do
   segundo contato herda o estado do primeiro.
3. **Os atendimentos vêm de `GET /pipelines/by_contact/:id`**, o mesmo de Conversas.
   A ordem (mais recente primeiro) mora em `atendimentosDoContato`.

## Agenda de Visitas: visões Semana e Dia (desde 2026-10-02)

Pedido do dono do produto: visualização de dia e de semana na Agenda de Visitas,
com o calendário da Lais como referência. Até aqui o calendário só tinha o mês.

O que aparece na tela, no *Calendário* da Agenda de Visitas:

- **Barra nova no topo do calendário**: *Hoje*, ‹ ›, o período ("27 de setembro a
  3 de outubro de 2026", "Sexta, 2 de outubro de 2026") e as pílulas **Mês ·
  Semana · Dia**. A escolha fica guardada no navegador.
- **Semana e Dia são grade de horas** (00h–24h, a rolagem abre uma hora antes da
  primeira visita ou do começo do horário de visita). Cada visita é um bloco do
  tamanho da duração, com hora e nome, na cor do status; visitas no mesmo horário
  ficam lado a lado. Linha roxa do "agora" no dia de hoje.
- **Clicar no dia (no topo da Semana) abre o Dia.**
- **Clicar num horário vazio abre o Agendar visita naquele dia, com o horário já
  marcado** (de 30 em 30). Se o horário estiver ocupado, de folga ou fora do
  horário de visita, o modal desmarca sozinho. Dia que já passou não abre, como
  no mês.
- **Com a agenda ligada, o que está fora do horário de visita fica em cinza**
  (dia da semana sem visita, data fechada, antes do início e depois do fim).
- **O contador do cabeçalho segue a visão**: "3 visitas suas nesta semana",
  "1 visita hoje", "2 visitas em 05/10".
- Sem permissão de agendar, clicar no calendário (mês, semana ou dia) não abre o
  modal. Antes o mês abria e só falhava ao salvar.

Decisões:

- **O mês continua sendo a visão padrão** de quem nunca escolheu. Ninguém muda de
  tela por efeito de deploy.
- **Cada visão pede ao servidor só o período dela** (`since`/`until` da lista,
  como o mês já fazia). Não tem metade de backend.

Armadilhas:

1. **As contas moram em `src/features/visits/gradeDoCalendario.ts`**, com spec
   (semana de domingo a sábado, título, posição e sobreposição dos blocos, clique
   em 30 min, faixa do horário de visita, rolagem). Encostar não é sobrepor, igual
   à regra do servidor.
2. **A rolagem automática acontece uma vez por período, e só com a lista daquele
   período na mão** (`carregadoPara`). Recarregar a mesma semana (agendar,
   cancelar) não tira a pessoa de onde ela estava.
3. **O horário marcado pelo clique entra pelo `inicioInicial` do
   `ScheduleVisitDialog`** e passa pela mesma conferência da grade de horários do
   modal; não validar de novo na Agenda.
4. **Não é `featureKey` nem `clientToggleKey`.**

## Campo de telefone: um só, com máscara, no app inteiro (desde 2026-10-03)

Relato do dono do produto: no *Adicionar Lead ao Funil → Criar novo lead* o
Telefone era texto livre e aceitava letra. Pedido em seguida: *"padroniza isso
pra gente"*. Havia 12 campos de telefone de texto livre, cada um com uma
instrução diferente ("com 55 e DDD, só números", "com DDI", "ex: 5543…").

O que aparece na tela: todo campo de telefone do CRM é o mesmo da aba Contatos,
com bandeira (Brasil por padrão), máscara enquanto digita e sem aceitar letra.
Vale para Criar novo lead (funil), Criar contato (Agenda), lead de teste do
Bolsão, Número do gestor (Roleta), Lembretes de WhatsApp, teste de Follow-up e
de Disparo em massa, WhatsApp da landing (Fura a fila, botão fixo e corretor),
Celular para avisos (Equipe e Perfil) e Telefone do assistente de novo cliente
(painel raiz). Fica de fora o site público, que usa o `BrPhoneInput` (sem
bandeira e sem puxar o CRM pro pacote da landing).

Decisões (não reabrir sem o dono pedir):

- **O que chega no servidor não muda.** O campo é um só, e cada tela recebe o
  formato que já gravava: com "+" (`valueFormat` padrão, contato, Bolsão,
  Agenda) ou só dígitos com o 55 (`valueFormat="digits"`, os demais).
- **Número antigo gravado sem país** (10 ou 11 dígitos, só DDD) aparece como
  Brasil e passa a ser salvo com o 55 no próximo Salvar.

Armadilhas:

1. **Campo de telefone novo usa o `PhoneInput`** (`@/components/shared/PhoneInput`,
   import pelo arquivo). Ele já traz o próprio CSS. Tela com fundo próprio passa
   `inputClassName`.
2. **No modo `digits` o campo lembra o que acabou de emitir.** Sem isso,
   "5511987654" no meio da digitação seria relido como DDD e ganharia outro 55.
   A conversão mora em `src/lib/phoneValue.ts`; os dois têm spec.
3. **Não é `featureKey` nem `clientToggleKey`**, e não tem metade de backend.

## Conversa: faixa "automação rodando" acima do campo de mensagem (03/10/2026)

Pedido do Tony: quando um fluxo do construtor ou um follow-up está rodando pra um lead, quem atende precisa ver isso na conversa e conseguir parar. Senão o corretor assume a conversa e o lead recebe a mensagem automática ("Oi de novo!") no meio do atendimento.

- **Onde:** uma faixa fina logo acima do campo de mensagem (`components/chat/banner/AutomacaoRodando.tsx`, encaixada no `ChatArea`). Só aparece quando há algo rodando. Não repete no painel da direita: ele fecha em tela pequena, e o momento que importa é o de digitar.
- **O que mostra:** uma linha por automação. `Fluxo "X" · aguardando resposta até 14:32` / `· esperando até 04/10 às 09:00` / `· em andamento`, e `Follow-up "Y" · próxima mensagem às 15:00` / `· pausado`. Texto montado em `features/conversas/automacaoRodando.ts` (com spec).
- **Botão "Parar", não "Pausar":** encerra aquele fluxo (ou a fila do follow-up) só pra esse lead, com confirmação. Pausar exigiria decidir o que fazer com a espera que vence durante a pausa; ninguém pediu.
- **Dados:** fluxos em `GET /flow_automation_instances?conversation_id=` e `POST /flow_automation_instances/:id/stop` (backend `lm-flow`, PR "Conversa: ver e parar o fluxo"); follow-up reaproveita `/followup_jobs` do card do lead. Relê quando a lista de mensagens muda e a cada minuto. Erro de leitura = faixa some.
- **Ao enviar com automação rodando (decisão do Tony, 03/10):** o envio de mensagem que o lead vê (nota interna não conta) abre a pergunta "Este lead está numa automação", com as linhas da faixa e dois botões: **Enviar e tirar do fluxo** (ou "parar o follow-up" / "tirar das automações") e **Enviar e manter**. Fechar = não envia e o texto fica no campo (`EnvioCancelado`, que o `MessageInput` não trata como erro). Tirar acontece ANTES de enviar. "Manter" vale pra conversa enquanto o mesmo conjunto de automações estiver rodando, pra não perguntar a cada mensagem. Hook `useAutomacaoRodando` (mesmo arquivo da faixa).

## Pacote de marketing do follow-up retirado (03/10/2026)

Pedido do Tony. O botão "Pacote completo de marketing" (Follow-up → modelos) e o "Aplicar template Leads (Marketing)" (Funil de vendas) saíram. O pacote criava, sem a pessoa ver, regras na aba Automações ("Auto: meta-ads → …", "Auto: keyword → …") e dois funis de follow-up com texto genérico ("deixei uma proposta esperando ontem"). Era a origem das automações que ninguém entendia. O backend responde 410 nas rotas antigas e o cadastro de cliente novo também parou de criar as regras "Follow-up: entrada por anúncio / orgânico". Funil novo nasce em Follow-up → Novo funil ou pelos modelos de funil. Não reabrir sem o dono pedir.

## Automações viram o construtor (03/10/2026)

Sprint 2 de 4 da unificação das automações (decisões do dono do produto em 02 e
03/10, não reabrir sem ele pedir). Spec:
`LM FLOW/specs/2026-10-03-automacoes-sprint-2-automacoes-viram-o-construtor-design.md`.
A metade do backend vem PRIMEIRO (`lm-flow`, branch `claude/automacoes-sprint2`):
o bloco `lead_action`, o "uma vez por lead" e as rotas de modelos.

O que aparece na tela:

- **Menu, Vendas e automação:** *Fluxos de mensagem* virou **Funis de mensagem**,
  uma página só com o editor de funis (sem abas). **Automações** abre direto a
  lista de fluxos do construtor, com o título "Automações" (o nome "FlowBuilder"
  sumiu da tela; cada item é um "fluxo"). *Regras de lead* e *Lembretes* saíram do
  menu e abrem só pelo endereço (`/automations/lead-automations` e
  `/automations/whatsapp-reminders`), pro suporte e pros avisos do Follow-up.
  `/automations` puro abre Automações quando a pessoa a vê.
- **Paleta com todas as ações das Automações**, nos grupos Mensagem pro lead ·
  Lead · Avisos · Controle: Mandar áudio, imagem, vídeo, documento, figurinha,
  Mandar resposta rápida, Disparar funil de mensagens, Definir corretor,
  Distribuir pela roleta, Criar tarefa, Iniciar follow-up, Avisar no grupo, Avisar
  pessoa, Avisar corretor, Avisar gestor e Notificação no celular. Cada uma abre
  o MESMO editor da tela de regras e faz exatamente o que a ação faz lá (mesmas
  variáveis `{{nome}}`, `{{corretor}}`…). O cartão mostra a frase da lista de regras.
- **Ação que já tinha bloco da sprint 1 não aparece duas vezes:** ficam os blocos
  Mandar WhatsApp, Aplicar etiqueta, Tirar etiqueta e Mover de etapa da sprint 1.
  Fluxo convertido de regra que traga essas ações como ação das Automações abre e
  edita normalmente (com o nome do bloco), só não é oferecido na paleta.
- **Configurações do fluxo** (botão no topo do canvas): *Pode rodar de novo pro
  mesmo lead* = **Depois de [X] horas** (padrão 24) · **Sempre que o gatilho
  acontecer** · **Só uma vez por lead**. Com "Sempre" e o gatilho *Mensagem
  recebida*, aparece "Com "Mensagem recebida", roda a cada mensagem do lead." na
  janela e numa faixa acima do canvas. Vai pro servidor no Salvar, e conta como
  alteração não salva.
- **Modelos:** botão ao lado de *Novo fluxo* e a lista no estado vazio (substitui
  o exemplo da sprint 1, que a tela montava sozinha). *Usar este modelo* cria o
  fluxo **desligado** no servidor e abre o canvas.
- **O que falta antes de ligar:** bloco com campo obrigatório em branco ganha
  borda amarela e a frase do que falta ("Falta preencher o destino do aviso.");
  com o fluxo desligado, uma faixa no topo diz o primeiro bloco a completar. A
  chave recusa ligar com falta (e com alteração não salva: o fluxo liga como está
  salvo). O play da lista confere o fluxo salvo antes de ligar.
- **A seta de voltar do canvas pergunta antes de sair** com alteração não salva
  (o mesmo "Sair sem salvar?" do menu).

Armadilhas:

1. **Bloco de ação = kind `lead_action`, config `{ action_type, params }`.**
   `params` é exatamente o que a regra grava (`features/flowAutomations/leadAction.ts`
   converte nos dois sentidos pro `ActionEditor`). `wait` ("Aguardar (delay)")
   nunca vira bloco. Ação desconhecida abre com "Este bloco volta na próxima versão".
2. **Os obrigatórios moram em `ACTION_REQUIRED_PARAMS`** (`leadAutomationService.ts`),
   o mesmo mapa do `validateRule` da tela de regras. Mexer nele muda as duas telas.
3. **"O que falta" é uma régua só:** `nodeProblem`/`enableProblem`
   (`features/flowAutomations/readiness.ts`) — a janela do bloco, o cartão, a
   faixa e a chave usam ela. Aplicar/Tirar etiqueta sem etiqueta agora não salva.
4. **Ordem e composição da paleta:** `paletteItems()` em `palette.ts`
   (blocos da sprint 1 do grupo primeiro, depois as ações de `PALETTE_LEAD_ACTIONS`).
   Nome/cor do bloco saem de `blockLabel`/`blockGroup`, nunca direto do
   `FLOW_NODE_DEF_BY_KIND` (o `lead_action` não tem nome próprio).
5. **"Pode rodar de novo":** `reentry_window_hours` (0 = sempre) + `once_per_lead`.
   O servidor guarda `once_per_lead` em `state`: `reentryOf` lê solto ou dentro de
   `state`; a gravação manda solto, no mesmo PATCH do nome e do gatilho.
6. **Modelos:** `GET /flow_automations/templates` e
   `POST /flow_automations/templates/:key/apply`, com ou sem o envelope `{ data }`
   (`features/flowAutomations/templates.ts`). Os modelos são do servidor; a tela
   não monta fluxo sozinha.
7. **Não é `featureKey` novo:** Automações usa as travas que a aba FlowBuilder
   tinha (`lead_automations` + `client_manage_automations`).

## A IA retoma a pergunta antes do follow-up (desde 2026-10-03)

Pedido do dono do produto: quando a IA pergunta e o lead some no meio da conversa,
ela manda outra mensagem pouco depois, e outra mais tarde; sem resposta, o lead
segue pro follow-up automático.

O que aparece na tela, em *IA Vendedora → Configuração → Follow-up automático*:

- **Bloco *Antes do follow-up: reengajamento***, logo depois de *De quais leads ela
  vai atrás*. Chave (estreia desligada) e dois campos: *1ª mensagem depois de [2] h
  sem resposta* e *2ª mensagem [8] h depois da 1ª* (1 a 48).
- Na conversa, a retomada aparece com o selo azul **🤖 Reengajamento** no lugar de
  *Atendente* (o follow-up é o amarelo).
- No Diagnóstico, cada retomada é uma linha do tipo *Reengajamento*.

Decisões (não reabrir sem o dono pedir):

- **Só quem conversou e parou no meio.** Quem nunca respondeu é do *Robô Sem
  Resposta*, em Automações.
- **É uma etapa do follow-up**, não uma automação: só funciona com ele ligado, segue
  o MESMO horário (*Quando o follow-up pode sair*), o mesmo gotejamento e o mesmo
  público. Nada de horário próprio: seriam duas verdades sobre quando a IA toma a
  iniciativa. Com o padrão 9h–17h, a retomada pode escorregar pra manhã seguinte;
  quem quiser no mesmo dia alarga o horário.
- **A 2ª conta da 1ª**, não da pergunta original (espaça mais as mensagens, o que
  protege o número).
- **Mora na IA, não no construtor**: quem escreve é a IA, com o contexto, e o
  construtor não sabe que ela perguntou alguma coisa. Ponto de encaixe na sprint 3
  das automações (Follow-up no construtor).
- **A retomada não puxa visita** (isso é do follow-up): retoma o que ficou no ar; a
  2ª oferece uma saída fácil.
- **Selo só pra retomada.** Automação continua sem selo.
- **O aviso de fora do horário não é resposta.** O lead que escreveu fora do
  horário e só recebeu o aviso não ganha retomada: quem está esperando é ele.
- **Se o lead volta a falar enquanto a retomada é escrita**, ela não sai e a IA
  responde a ele como responde qualquer mensagem (com a mesma espera pra juntar as
  mensagens seguidas). No Diagnóstico a linha *Reengajamento* fica como *Respondeu*,
  porque o texto foi escrito e pago, e mostra embaixo o motivo de não ter saído:
  *O lead respondeu enquanto a retomada era escrita*. No painel da conversa aparece
  o mesmo motivo. Se ele fala no instante do envio, a retomada já saiu, e a IA
  responde a ele logo depois.

Armadilhas:

1. **Os três campos PRECISAM estar no `saveAgent`** (com `??`). Fora da lista, a
   tela diz *Salvo* e o servidor nunca recebe.
2. **O estado não é gravado na conversa**: o servidor lê das mensagens depois da
   última fala do lead (`SalesAgents::ReengagementState`). O estado é a mensagem
   com a marca `content_attributes.reengagement` MAIS as linhas *Reengajamento*
   entregues do Diagnóstico (`sales_agent_runs`, `kind = 'reengage'`): o teto de 2
   retomadas e a liberação do follow-up leem essas linhas, porque a bolha marcada
   pode não ser gravada mesmo com a mensagem entregue. Nenhum dos dois pode ser
   removido nem reaproveitado.
3. **Em *Só follow-up* o reengajamento não age** (a IA não responde ao vivo); o
   bloco avisa em vez de esconder.

## Follow-up vira fluxo (03/10/2026)

Sprint 3 de 4 da unificação das automações (decisões do dono do produto em 02 e
03/10, não reabrir sem ele pedir). Spec:
`LM FLOW/specs/2026-10-03-automacoes-sprint-3-follow-up-vira-fluxo-design.md`.
A metade do backend vem PRIMEIRO (`lm-flow`, branch `claude/automacoes-sprint3`):
`kind` do fluxo, gatilho com `alternatives`, os blocos e opções novos, o
`/flow_automation_instances/start`, a ação `start_followup_flow` e o
`followup_flow_id` da IA.

O que aparece na tela:

- **Aba Follow-up = o construtor.** `/automations/follow-ups` é a MESMA lista das
  Automações (`FlowAutomationsList kind="followup"`), com o título "Follow-up" e
  os fluxos de follow-up; o canvas abre em `/automations/follow-ups/:id` e a seta
  volta pra aba. **"Novo follow-up"** cria o fluxo já montado com o modelo
  "Follow-up padrão" (o servidor monta). Sem Modelos e sem pastas nessa aba.
  O editor de funil antigo, "Quando este funil começa" e "Follow-up iniciado à
  mão" saíram da tela. `/settings/follow-ups` leva pra aba nova.
- **Faixa "Terminando no formato antigo: Follow-up longo — 87 mensagens
  programadas"** no topo da aba: os funis antigos que ainda têm fila
  (`queued_count`), só pra ver.
  Some quando a fila zera.
- **"+ Ou quando…"** na janela do gatilho: outros gatilhos, cada um com o mesmo
  editor (filtro e funil). O fluxo começa quando qualquer um acontece. O cartão
  do gatilho lista cada "ou quando", e o botão do topo e a lista juntam os nomes
  com "ou".
- **Mandar WhatsApp → "Marcar progresso"**: nome da etiqueta + "Mensagem nº". Ao
  sair, o lead ganha `<nome>-msg-N` e perde a anterior. O cartão mostra a etiqueta.
- **"Só em horário comercial (seg–sex 8h–20h, sáb 9h–18h)"**: caixa no Esperar
  (modo Por um tempo) e no Aguardar resposta, e nas Configurações do fluxo
  (nenhuma mensagem sai fora da janela). O modo "saindo só em horário comercial"
  do Esperar virou essa caixa.
- **Bloco "Marcar como recuperado pelo follow-up"** (grupo Lead, sem campos): a
  janela lista os 5 efeitos (etiqueta "recuperado-pelo-follow-up", tira
  "follow-up", histórico do relatório, aviso pra equipe, WhatsApp pro corretor).
- **"Mover de etapa" → "Coluna com este nome no funil do card"**, ao lado de "Uma
  etapa específica".
- **"Iniciar follow-up"** (bloco e ação das regras) escolhe um **fluxo de
  follow-up**. A ação antiga "Iniciar sequência de follow-up (formato antigo)"
  não é mais oferecida; regra/bloco que já tem continua abrindo e valendo.
- **Card do lead:** o bloco Follow-up mostra cada follow-up rodando com a mesma
  linha da faixa da conversa ("Follow-up "X" · aguardando resposta até…") e
  **Parar**; sem nada rodando, **Iniciar follow-up** (escolhe entre os que o
  servidor lista pra este lead).
  A fila de funil antigo aparece com "· formato antigo", só com Parar e o "Ver
  mensagens". Pausar e Retomar saíram.
- **Faixa da conversa:** o fluxo de follow-up aparece como **Follow-up "X"**, e o
  botão da pergunta ao enviar vira "Enviar e parar o follow-up".
- **IA Vendedora** (e o assistente): a opção virou **"Entregar pro follow-up"** e
  escolhe um fluxo de follow-up. IA que só tem o funil antigo mostra o aviso
  amarelo.

Armadilhas:

1. **Tipo do fluxo:** `kind` no fluxo e na instância (`features/flowAutomations/kind.ts`).
   Ausente = automação. A lista das Automações NÃO manda `kind` (o servidor
   devolve só automações por padrão); a aba Follow-up manda `kind=followup`.
2. **Gatilho:** `serializeTrigger` manda SEMPRE `alternatives` (vazia apaga o
   último "Ou quando"). `changeTriggerEvent`/`withTriggerCondition` preservam as
   alternativas; `triggerProblem` confere cada uma ("No "Ou quando": …").
3. **Configurações do fluxo:** `business_hours_only` vai solto no mesmo PATCH do
   "pode rodar de novo"; a leitura aceita solto ou em `state` (`businessHoursOnlyOf`).
4. **Esperar:** o `mode: 'schedule'` antigo é lido como Por um tempo + caixa
   marcada; mexer na caixa grava `mode: 'interval'` + `business_hours`.
5. **Mover de etapa:** `stage_id` OU `stage_name`, nunca os dois. O motor NÃO lê o
   `stage_slug` dos modelos da sprint 2: o cartão mostra o slug como nome e pede
   "Abra o bloco e confirme o nome da coluna"; salvar a janela grava `stage_name`.
6. **Ação nova:** `start_followup_flow { flow_automation_id }`. A antiga
   (`start_followup_sequence`) está em `LEGACY_ACTION_TYPES`: fora da lista e da
   paleta, mas válida (o servidor redireciona o funil convertido pro fluxo).
7. **A IA grava `followup_flow_id`** (no `saveAgent` com `in`, pra limpar com
   `null`). O servidor guarda na coluna do slug com a marca `flow:`; a tela só vê
   os dois campos.
8. **Permissão da aba Follow-up continua `followup_sequences.read`** (rota, menu e
   `permissionRoutes`): o servidor aceita as chaves `followup_sequences.*` em
   `/flow_automations` pra fluxo `kind=followup`. Quem via o Follow-up continua vendo.
9. **Card:** fluxos de `/flow_automation_instances` filtrados por `kind ===
   'followup'`; a lista do Iniciar vem da MESMA leitura, em
   `meta.startable_followups` (o corretor não lê `/flow_automations`, essa rota
   pede só `pipelines.read`). A fila antiga continua vindo de `/followup_jobs`.
   Iniciar = `POST /flow_automation_instances/start` com o contato e a conversa.
10. **Faixa do formato antigo:** `queued_count` de cada funil em
    `GET /followup_sequences` (uma leitura só, sem histórico por funil).

## Imóveis: cadastro em página e Gestão de proprietários (desde 2026-10-03)

Fase 4, entrega 3. Spec: `LM FLOW/specs/2026-10-03-fase-4-imoveis-cadastro-e-proprietarios-design.md` (pasta do Tony, fora deste repo). Depende do backend `lm-flow#377` (campos novos, `property_owners`, aprovação de captação corrigida), que já está no ar.

**Cadastro em página (substitui a janela):**

- **Rotas:** `/properties/new?tipo=empreendimento|revenda[&proprietario=<id>]` e `/properties/:id/editar[?de=lote][&passo=divulgar]`. `/properties/new` respeita a feature `properties_create`, como a lista.
- **Seções por tipo** vêm de `secoesDoCadastro` (`src/features/properties/cadastro/`). Índice fixo ao lado com scrollspy; erro de validação rola até a seção e a marca. Cada seção recebe `{form, setF, editando}`; `setF` aceita objeto ou `(prev) => patch`.
- **O menu recolhe** nessas rotas, como em Conversas (`emConversas` no `MainLayout` cobre as duas).
- **Barra de baixo:** criação = *Cancelar* / *Salvar rascunho* / *Criar e escolher onde divulgar →*; edição = *Cancelar* / *Salvar*. Há trava de "alterações não salvas".
- **Volta ao lote:** revisar um item do lote e salvar volta para a janela do lote com a lista de itens (`importar=1`, chave própria no `sessionStorage`).
- **Campos novos:** Construtora; Obra (total de unidades, torres, andares); Finalidade em pílulas; IPTU mensal/anual; ano de construção; Financiamento / FGTS / MCMV como Sim / Não / Não informado; Padrão; links de vídeo e tour; Comissão; **Dados internos** (só revenda: chaves, placa, matrícula, código do IPTU, cartório, valor de avaliação, comentários). O empreendimento mantém o "Resumo do empreendimento" (quartos, suítes, etc.) dentro de *Tipologias e valores*: o backend não deriva o resumo das tipologias.
- **"Água" saiu das opções** mas continua legível em imóvel antigo (o slug fica no array ao salvar). *Piscina* e *Sauna* do imóvel viraram "privativa".
- **Proprietário (revenda):** busca, cadastro na hora, aviso de telefone repetido e cartão com *Trocar*. Erro que não seja 404 mostra *Tentar de novo* / *Trocar* em vez de travar o cartão.
- **Nada de Dados internos, Comissão ou Proprietário vai para site, portal ou IA.**

**Onde divulgar** (passo depois de criar e cartão na edição):

- Site / IA / Destaque gravam na hora. Cada portal conectado tem chave, tipo de anúncio e contador de cota; vermelho em `count >= limit`, e tipo cheio fica bloqueado para adicionar.
- **A lista do portal é lida de novo logo antes de gravar** (o servidor substitui a lista inteira: snapshot velho despublicaria os outros imóveis). Mudança que não aumenta tipo estourado vai com `confirmOverflow` (decisão do Tony de 14/09: "avisa, não trava").
- Portais não conectados viram uma linha só, com link para `/settings/portals`.
- **Na edição, o *Salvar* da página não manda `featured`, `published_on_site` nem `ai_enabled`:** o cartão é o dono deles.

**Gestão de proprietários** (`/property-owners`):

- **Menu em Imóveis.** O gestor sempre vê; o corretor só com contagem > 0 (recorte do servidor). Bolinha vermelha "Novidade" no menu, no cabeçalho da seção fechada e na aba quando há captação nova.
- **A marca `captacoes_vistas_ate` mora em `ui_settings`** (created_at mais novo dos pendentes + 1 ms: o JSON tem ms e o banco µs). **O servidor substitui `ui_settings` inteiro**, então toda gravação passa por `salvarUISettings` (mescla e manda o objeto completo). Isso corrigiu um bug antigo: o Perfil mandava `ui_settings` parcial e apagava as outras chaves.
- Lista com pílula de status (*Disponível* · *Com alteração* · *Indisponível* · *Sem resposta*), busca e filtro; *Novo proprietário* em janela.
- **Ficha** (`/property-owners/:id`): status, WhatsApp (`wa.me`, prefixo 55 para 10/11 dígitos), *Editar dados* / *Excluir* (só gestor), cartões dos imóveis (gestor vai ao cadastro; **corretor abre uma janela com Dados internos**), *Cadastrar imóvel deste proprietário*, observações (o corretor edita; o rascunho não se perde ao trocar o status), dados e histórico.
- **Corretores autorizados** (só gestor). O captor é implícito.
- **Novas captações** (aba, só pendentes, com busca e *Atualizar*; usa `pending: 'true'`). `/property-capture-requests` redireciona para cá. *Recusar* exige motivo. *Aprovar e cadastrar* abre a edição do rascunho criado; o `property_id` vem do envelope da resposta (o service antigo devolvia o envelope inteiro) e o duplo clique é travado.

Decisões do dono (não reabrir sem ele pedir): cadastro em página e não em janela; seções por tipo; Dados internos só na revenda; proprietário só na revenda; menu com visibilidade dinâmica para o corretor; captação nova entra como rascunho e nunca vai ao ar sozinha.

Armadilhas:

1. **As regras moram em `src/features/properties/cadastro/`** (`secoesDoCadastro.ts` e `formularioDoCadastro.ts`, que traz `errosDoCadastro` e `payloadDoCadastro`), com spec; as telas em `src/pages/Customer/Properties/cadastro/`. Regra nova não entra na tela.
2. **`mascaraReais`:** o PR #421 (máscara de preço dos filtros) cria um `mascaraReais`; `cadastro/secoes/campos.tsx` tem um helper local equivalente. Unificar depois que os dois entrarem.
3. **Pendências conhecidas:** histórico de captações aprovadas/recusadas, abrir WhatsApp dentro do LM Flow, ficha da construtora e funil de captação com IA ficaram fora. O servidor ainda substitui a lista inteira do portal (endpoint por imóvel fecharia a corrida de vez).

## Custos do admin (03/10/2026)

Clientes → Custos (`/admin/clientes/custos`, `src/pages/SuperAdmin/Custos/`). Spec: `LM FLOW/specs/2026-10-03-admin-registro-custos-usuarios-design.md`.

- **Uma régua só pro dinheiro, em R$ por mês.** IA exata (registro de chamadas do backend, `public.ai_calls`) + Railway, Vercel e Evolution lançados à mão em US$ no botão *Lançar faturas do mês*. A conferência com a fatura fica em US$ e os fornecedores aparecem com nome de gente (Anthropic, OpenAI, ElevenLabs).
- **Filtro por cliente:** só a IA dele; a estrutura mostra "não é dividida por cliente" e sai do total; somem o recorte por cliente e a conferência. Margem e divisão da estrutura ficam pra quando o "quanto o cliente paga" existir (decisão do Tony, 03/10). Não reabrir sem ele pedir.
- **Trocou o filtro, a tela recarrega do zero:** durante a carga aparece o esqueleto, nunca os números do filtro anterior; resposta que chega fora de ordem é ignorada; na lista de chamadas as linhas antigas somem até chegarem as novas.
- **Mês sem chamada:** o gráfico dia a dia vira "Nenhuma chamada de IA neste mês" e a conferência diz "Fatura ainda não lançada". Nunca erro, nunca divisão por zero.
- **Sem a palavra token na tela:** a coluna se chama *Tamanho*.
- **Lista de chamadas: 20 por página** (`CHAMADAS_POR_PAGINA` no `costsService`; o servidor aceita até 200 e o padrão dele é 50). A lista fica no fim da tela, embaixo dos cartões e recortes (Tony, 03/10). Se a lista ganhar uso diário, a evolução combinada é virar aba própria (Clientes → Custos | Chamadas).
- **Erro nunca vira vazio** em nenhuma das três cargas (resumo, chamadas, detalhe).
- Conteúdo da chamada só aparece no prazo (7 dias, 30 se falhou); fora dele o painel diz "Conteúdo apagado depois de N dias".
- O endpoint antigo `/super/sales_agents/costs` sai num PR do backend depois que esta tela estiver no ar. A tela antiga (`CustoIA.tsx`) e `superAgentsService.costs()` já foram removidas.

## Meu site virou painel com barra de topo (desde 2026-10-03)

> Pedido do dono (03/10): "um painel mais bonito e mais independente, no estilo do Kenlo, sem tirar a aba lateral". Spec: `LM FLOW/specs/2026-10-03-meu-site-painel-design.md`.

**O que aparece na tela:** barra de topo própria (endereço + selo No ar + Painel · Personalizar ▾ · Marketing ▾ · Configurações ▾ + Ver site). Telas: Painel (visitas, origens, imóveis mais vistos, contatos recentes, "N% pronto" e o Preencher com IA), Aparência, Páginas, Financiamento, Anuncie, Tradução, Blog, Páginas de anúncio, Redes sociais, Rastreamento, Marca d'água, Endereço do site, Dados de contato, Para onde vão os contatos, Aparecer no Google, Contatos do site (aberta pelo Painel, "Ver todos" nos contatos recentes, sem item na barra).

**Decisões (não reabrir sem o dono pedir):**
1. O menu lateral do LM Flow não muda nem recolhe; a navegação do Meu site é a barra horizontal dentro da página (não é segunda coluna).
2. Fonte única das telas: `src/features/siteBuilder/meuSiteMenu.ts`. `?tab=` antigo redireciona (`telaDaUrl`).
3. Um Salvar só (`BarraSalvar` no pai); estado do formulário no pai, listas (páginas, artigos, contatos) dentro da própria tela.
4. GTM e Códigos avançados só carregam em domínio próprio (`isOwnDomain`); GA4 e Pixel em qualquer endereço. Motivo: CRM e site dividem `*.lmflow.com.br` e a sessão fica no localStorage. `isOwnDomain` tira ponto final do host e trata IP como "não é domínio próprio". O rastreamento só é instalado quando há algo para instalar (ID ou código preenchido).
5. Marca d'água é cópia gravada no servidor (`/public/site-photos/...`); a prévia da tela usa `estiloDaMarca`, com a mesma geometria do servidor (40% centro, 22% cantos, margem 3%). O logo aceita só PNG, JPG ou WEBP (o servidor confere pelo conteúdo, não pela extensão), até 5 MB.
6. Editor de blocos da página do imóvel aposentado: `/properties/template-imovel` redireciona para o Meu site. As opções da página do imóvel vêm no projeto C (chaves, jeito Kenlo). A pasta `PropertyTemplateEditor` e `get/savePropertyTemplate` ficam até a limpeza junto da coluna no backend.
7. O `initGA4` (ID do Evolution) saiu do `main.tsx`: mandava a navegação do LM Flow para o Analytics do projeto de origem.
8. O "Preencher com IA" mora no Painel (card "N% pronto"), não numa tela própria.
9. ~~"Ver site" sempre abre `/portal/<slug>`~~ Mudou em 04/10: com domínio próprio ativo, a barra mostra e abre o domínio; em manutenção o botão vira "Ver prévia" (ver "Meu site · domínio próprio, Google e prévia").
10. A marca d'água aparece no "N% pronto" como sugestão, mas **não conta** (`conta: false` em `siteReadiness.ts`): a liberação dela espera a faxina do disco (decisão do dono). Hoje contam 5 itens; quando a faxina sair, volta a contar. A prévia da tela usa a capa de um imóvel publicado (`propertiesService.list`, sem endpoint novo); sem foto, fica o quadro cinza.
11. Botão de idiomas (tradutor do Google): o tradutor reescreve os nós de texto do React (facebook/react#11538) e a navegação seguinte estourava `removeChild`/`insertBefore`, derrubando o site. `features/siteBuilder/public/translateGuard.ts` instala uma vez a proteção conhecida em `Node.prototype` (nó que não é mais filho é ignorado, com 1 aviso no console), só no site público com a tradução ligada; o `new TranslateElement` fica em `try/catch`.
12. Contador de visitas **sem `keepalive`**: numa SPA a página não fecha no meio do envio, e `keepalive` + preflight de CORS falha calado em alguns navegadores. A visita leva `site_host` (hostname da página) para o servidor separar navegação interna de origem.
13. Rastreamento só carrega ID no formato (GA4 `G-…`, Pixel só números, GTM `GTM-…`): valor antigo que nunca passou pela validação da tela é ignorado. A conversão (`trackLead`) só dispara quando o servidor aceitou o contato (`res.ok`).
14. Páginas criadas usam os nomes do servidor: corpo em `content_html`, SEO em `seo_title`/`seo_description` (e volta aninhado em `seo`). Com `content`/`meta_*` o Rails descartava em silêncio e a página ia vazia pro menu.

**Armadilhas:**
1. Backend vem PRIMEIRO (`lm-flow`, `saas-multitenant`): `site_visits`, `/sites/:id/dashboard`, `watermark_logo`, `translate`/`custom_code` no `/site` público.
2. Contador e rastreamento nunca podem derrubar o site: tudo em `try/catch`, storage bloqueado vira id em memória.
3. O stub do `gtag` precisa empurrar `arguments` no `dataLayer`, não um array: o gtag.js ignora array.
4. A exceção do glossário "Google Tag Manager" mora em `telas/TelaRastreamento.tsx`.
5. Não é `featureKey` nem `clientToggleKey`: o Meu site continua no `site_builder`; Páginas de anúncio continua no `useClientToggle('landing_pages')` literal.

## Construtor: bloco Início, painel Blocos e painel lateral (04/10/2026)

Sprint 4 de 4 da unificação das automações, parte A (layout do construtor).
Decisões do dono do produto em 04/10, não reabrir sem ele pedir. Spec:
`LM FLOW/specs/2026-10-04-automacoes-sprint-4-layout-e-funil-do-corretor-design.md`.
Referência visual: o construtor do Leona. Vale pra Automações e Follow-up (e
pros funis de conversa da parte B, que vêm em outro PR). Só frontend.

O que aparece na tela:

- **Bloco "Início"** no canvas, verde, sempre uma coluna antes do primeiro
  bloco: "Quando: Etiqueta adicionada (Etiqueta: follow-up) · ou Visita
  realizada". Clicar abre o painel do gatilho (com "+ Ou quando…"). Não se
  apaga, não se arrasta e não tem entrada: nada vem antes dele. Gatilho
  incompleto deixa a borda amarela com o motivo. **A barra de gatilho do topo
  saiu**, e o "Testar" do topo também.
- **"Blocos"** no canto superior esquerdo do canvas: abre e fecha o painel com
  "Buscar blocos..." e as seções Mensagem pro lead · Lead · Avisos · Controle,
  cada bloco com ícone e nome (a frase do bloco no balão). Clicar põe no fim do
  caminho principal (como antes); **arrastar pro canvas** põe onde soltou. O
  "+ Respondeu" de um cartão abre o painel sozinho. Aberto/fechado fica lembrado
  neste navegador.
- **"Simular"** ao lado de "Blocos": o teste de antes ("Resultado da simulação").
- **Painel do bloco à direita** (420px, o canvas continua visível), no lugar da
  janela: ícone, nome e uma linha do que o bloco faz; campos um embaixo do
  outro; o apelido vai por último; Cancelar e Salvar num rodapé fixo. Clicar no
  cartão (não só no lápis) abre. Cancelar, o X, Esc, outro bloco ou o Início
  com o rascunho mexido perguntam "Descartar o que você mudou?". O rascunho
  conta como alteração não salva (menu e fechar a aba perguntam).
- **Mensagem grande com as variáveis em botõezinhos**: um clique põe
  `{{variável}}` onde o cursor está. Aparecem as prontas (`{{nome}}`,
  `{{corretor}}`, `{{imovel_titulo}}`…) e, em azul, as que a imobiliária criou.
  Isso substitui a aba Variáveis dos Funis de mensagem (a aba sai na parte B).
- **Celular (< 768px):** os dois painéis viram tela cheia por cima do canvas;
  Blocos começa fechado e fecha sozinho ao escolher um bloco; o minimapa some.
- **Configurações do fluxo** continuam numa janela.

Armadilhas:

1. **O Início não existe no banco.** É o nó sintético `TRIGGER_NODE_ID`
   (`flowStart`); a linha que sai dele é o `initial_node_id`, e ligar do Início
   a um bloco muda o primeiro bloco. Posição calculada, nunca gravada.
2. **Variáveis:** a lista mora em `features/flowAutomations/messageVariables.ts`
   e o botão em `components/flowAutomations/VariableChipBar.tsx`, usado TAMBÉM
   pela tela de regras (`ActionEditor`, modo "pôr no fim"). O canvas carrega as
   da imobiliária uma vez (`/tenant_template_variables`) e passa por
   `MessageVariablesContext`; fora do canvas, só as prontas. O Mandar WhatsApp do
   construtor oferece agora as variáveis das Automações: o servidor preenche as
   duas famílias desde 02/10 (`VariableInterpolator` chama o das regras antes),
   então `{{first_name}}` de fluxo antigo continua saindo.
3. **Ícone e frase de cada bloco:** `features/flowAutomations/blockInfo.ts`
   (`blockIcon`/`blockDescription`, pela `blockKey`). Bloco novo na paleta
   ganha linha lá.
4. **Um painel por vez:** `useSidePanel` (painel aberto + rascunho mexido). Os
   painéis avisam o rascunho por `onDirtyChange`; quem troca de painel chama
   `request` (pergunta se precisar) e quem fecha depois de salvar, `replace`.
5. **Arraste:** tipo `BLOCK_DRAG_TYPE` com a `key` do item da paleta; o canvas
   converte a posição com `screenToFlowPosition` (instância do `onInit`).
6. **Pontos de encaixe do guia (parte B, em uso desde a seção abaixo):** o
   canvas aceita `banner` (faixa acima do canvas) e `highlightedNodeId` (o bloco
   do passo atual; `TRIGGER_NODE_ID` destaca o Início); os cartões têm
   `highlighted` (`data-highlighted="true"`, borda que pisca). Sem as props, o
   canvas usa o guia do próprio fluxo.
7. **Teste com React Flow no jsdom:** sem medida, os blocos ficam no DOM com
   `visibility: hidden`; busque por `getByLabelText`/`getByTestId`, não por
   `getByRole` (ver `FlowCanvasLayout.spec.tsx`, que também cria
   `ResizeObserver`/`DOMMatrixReadOnly` de mentira).

## Funis de mensagem viram funis de conversa, com construção guiada (04/10/2026)

Sprint 4 de 4 da unificação das automações, parte B (o funil do corretor e o
guia). Decisões do dono do produto em 04/10, não reabrir sem ele pedir. Spec:
`LM FLOW/specs/2026-10-04-automacoes-sprint-4-layout-e-funil-do-corretor-design.md`.
Depende do backend `lm-flow#388` (tipo `conversation`, dono e "Da equipe",
modo guiado no servidor, passos do guia, modelos e o disparo) e vem DEPOIS do PR
da parte A (o layout do construtor).

**O papel do funil (Tony, 04/10):** é uma **ferramenta individual do corretor**,
e não automação da empresa. Cada funil é um fluxo do construtor com `kind =
'conversation'` e gatilho fixo ("Disparo pela conversa").

O que aparece na tela:

- **Página Funis de mensagem** (`/automations/message-funnels`), sem abas
  internas: busca, **"+ Novo funil"** e as abas **Meus funis** / **Da equipe**
  (selo "Da equipe"). Cada funil mostra o estado: "Termine de montar: passo 2
  de 5" (com "Continuar o passo a passo"), "Pronto pra disparar" ou
  "Desligado". Chave Ligado (quem edita), chave **Da equipe** (só o gestor),
  Duplicar e Excluir. O funil da equipe, pro corretor, abre só pra ver, com
  **"Duplicar pra ter a sua cópia"**.
- **"+ Novo funil"** abre os **modelos** (Apresentação do imóvel, Pós-visita,
  Pedir documentos, Reaquecer lead parado, Primeiro contato): cartão com nome e
  pra que serve; ao escolher, a sequência (cada mensagem e espera) e **Usar este
  modelo**, que cria a cópia de quem escolheu (desligada) e abre o canvas com o
  guia. O gestor (quem tem acesso às Automações) também vê **Começar do zero**.
- **Construção guiada**, em todo fluxo que traz passos (funis, "Follow-up
  padrão" e modelos das Automações): faixa no topo "**Passo 2 de 5:** clique no
  bloco destacado e escreva a mensagem de abertura" com **Abrir o bloco**; o
  bloco do passo pisca, os feitos ganham ✓ e os outros o número; o **checklist**
  "Passo a passo · 1 de 5 feitos" (✓ feito · ● atual · ○ falta), recolhível, no
  canto do canvas. O painel do bloco mostra o passo e a dica no topo. **Salvar
  no painel grava na hora** e o guia avança sozinho; no fim, "**Pronto! Seu
  funil já pode ser disparado nas conversas.**" (o servidor liga o funil
  sozinho). A chave de ligar recusa com "Falta terminar o guia antes de ligar:
  Passo 2 de 3 — …".
- **Modo guiado** (o corretor no funil dele): sem Blocos, Simular e
  Configurações; não arrasta bloco nem ligação; não duplica bloco; **Excluir só
  em mensagem** ("Tirar esta mensagem do funil?"), religando a anterior à
  seguinte e já gravando; sem apelido do bloco. Tudo que ele salva grava na
  hora. O Início mostra "Você dispara o funil numa conversa…" e não abre painel.
- **Mensagem do funil:** "Tipo de mensagem" Texto · Foto · Vídeo · Documento ·
  Áudio · Figurinha · Contato. Arquivo sobe pelo botão (com prévia); texto vira
  legenda na foto, no vídeo e no documento; contato tem nome e telefone. Sai
  pelo número da conversa do disparo (sem "Enviar pelo número"). O **Esperar**
  do funil fala em segundos/minutos/horas.
- **"Disparar funil" no campo de mensagem** (o botão de funil; substitui o
  quadradinho antigo, também na aba Conversa do card): busca, **Meus funis** /
  **Da equipe** com o nome grande; clicar mostra a **prévia** (cada mensagem e
  espera, em ordem) e **Disparar**. Roda no servidor, pelo número da conversa,
  mesmo com a tela fechada; a faixa acima do campo mostra **Funil "X" · em
  andamento** com Parar ("Enviar e parar o funil" na pergunta ao enviar). Funil
  com o guia pela metade aparece com **Termine de montar** (leva pro canvas);
  desligado aparece apagado. Sem funil próprio e com da equipe, abre na equipe.
- **Um painel por vez** no campo de mensagem: emoji, Disparar funil e Enviar
  book; abrir um fecha o outro.
- **Menu:** **Variáveis de mensagem** virou item de Minha imobiliária (era aba
  de Campos personalizados, que ficou só com os atributos; a tela se chama
  "Variáveis de mensagem"). O Corretor de fábrica vê **Funis de mensagem** em
  Vendas e automação (chave `message_funnels.read`, que o `#388` dá a ele).
  `/settings/message-funnels` leva pra página nova.

Armadilhas:

1. **Quem pode o quê vem do servidor**, em `permissions` de cada fluxo
   (`can_edit`, `guided`, `can_mark_team`, `can_create_blank`):
   `features/flowAutomations/guide.ts` (`isGuided`, `isReadOnly`). Sem fluxo na
   lista, "gestor" = `flow_automations.update` (`useCan`), a mesma régua do
   servidor. O servidor recusa o resto em PT-BR (`serverMessage` mostra como veio).
2. **Modo guiado no `save_flow`:** o servidor junta o config que chega POR CIMA
   do gravado. Chave que some não apaga nada: trocar o tipo da mensagem grava os
   campos do tipo anterior com texto vazio (`withMessageKind`). Tirar mensagem
   manda o ponteiro já religado (`removeAndRewire`); o PATCH do cabeçalho vai só
   com o nome, e só se mudou.
3. **Passo do guia:** `node.guide` é só leitura e não volta no `save_flow`
   (`buildSaveFlowPayload` tira). Salvar no painel de um bloco com passo marca
   `guide_done: true` no nó e grava na hora (`persist`); a resposta do
   `save_flow` já é o fluxo atualizado (`applyFlow`, sem recarregar a tela).
   O "Pronto!" só aparece se o guia terminou nesta visita.
4. **Funil de conversa = `kind: 'conversation'`** (`features/flowAutomations/kind.ts`):
   gatilho fixo, o canvas não confere nem manda gatilho (`enableProblem(...,
   kind)`), o Início é `fixed`. O canvas abre em `/automations/message-funnels/:id`
   com a chave `message_funnels.read` (rota, `permissionRoutes` e spec).
5. **Disparar:** `POST /flow_automation_instances/start` com a conversa;
   `started` (201) × "já está no funil" (200, aviso em `toast.info`). A prévia é
   montada dos blocos (`funnelPreview`, a partir do primeiro); a lista não traz
   blocos, então clicar busca o fluxo. Depois de disparar, o campo chama
   `onFunnelStarted` → `useAutomacaoRodando().atualizar`.
6. **Um painel por vez:** `useComposerPanel` (`message-input/composerPanel.ts`).
   `close(painel)` só fecha se for ESSE o aberto: o "clicou fora" do emoji chega
   antes do clique no botão de outro painel.
7. **Esperar em segundos:** `wait.config.seconds` soma com `minutes` no
   servidor. Bloco com segundos (ou no funil de conversa) usa o campo de
   segundos; o resto continua em minutos (`waitTime.ts`).
8. **Os funis antigos** (`message_funnels`, o editor de antes) não aparecem
   mais no campo de mensagem: a conversão (`rake lm_flow:funis:converter_funis_mensagem`
   do `#388`) precisa rodar junto com este PR. A conversão NÃO desativa o
   funil antigo (decisão de 04/10): Disparos, disparo em massa do Funil de
   vendas, agendamento de envio e a ação "Disparar funil de mensagens" ainda
   leem os funis antigos — migrar essas telas é passo à parte. **Feito em
   05/10/2026:** ver "Funis novos em tudo" abaixo.

## Usuários de todos os clientes (03/10/2026)

Usuários → Usuários (`/admin/usuarios`, `src/pages/SuperAdmin/Usuarios/`) e a ficha (`/admin/usuarios/:tenant/:userId`). Spec: `LM FLOW/specs/2026-10-03-admin-registro-custos-usuarios-design.md` (seção 3). Substitui a tela de um cliente por vez (UserMetricsView, removida).

- **Uma lista só, todos os clientes.** Busca por nome, e-mail ou telefone (com ou sem máscara); filtros de cliente, cargo e situação (*Ativo* / *Sumido há 7+ dias* / *Nunca entrou* / *Desativado*). Desativados e a equipe Leal Mídia ficam fora por padrão.
- **A chave da pessoa é cliente + id:** o mesmo e-mail em dois clientes vira duas linhas e duas fichas.
- **Cliente que falha não esconde os outros:** aviso "Não deu para ler: …" acima da tabela.
- **20 por página**, com as mesmas travas da lista de chamadas (linhas velhas somem ao trocar filtro; resposta atrasada é descartada).
- *Enviar link de acesso* pede confirmação (manda WhatsApp). *Copiar* não pede. O principal não tem link.
- **Ficha:** cartões de 30 dias, entradas com aparelho (selo *Aparelho novo*: aparelho que não aparecia antes ou há mais de 90 dias), telas que mais usa e histórico de ações.
- **Aba acesa na ficha:** a aba Usuários tem `tambem` (regex da ficha, dois trechos depois de `/admin/usuarios/`) em `adminMenuItems.ts`; vale pra moldura (`donoDoEnderecoAdmin`) e pra faixa (`Abas`). Logs e Mensagem de acesso têm um trecho só, então não colidem.
- `superLogsService.userMetrics` e `UserMetricsResponse` ficaram até a tela de Logs nova entrar (entrega 4, abaixo): saíram junto com ela. Saíram `userMetricDetail` e `UserMetricDetail`.
- **Notificações** (push, avisos por WhatsApp, avisos na tela): ver a seção *Notificações na ficha do usuário (04/10/2026)*.

## Localização dos imóveis (desde 2026-10-04)

Fase 4, entrega 5. Spec: `LM FLOW/specs/2026-10-03-fase-4-imoveis-mapa-pelo-cep-design.md` (pasta do Tony, fora deste repo). Depende do backend `lm-flow#389` (endpoint `GET /properties/geocode`, `location_source` no JSON e nos params, privacidade por tipo), que já está no ar. Regras puras em `src/features/properties/localizacao.ts` (com spec); a tela é `src/pages/Customer/Properties/cadastro/secoes/SecaoLocalizacao.tsx` + `MapaDoCadastro.tsx` (Leaflet, só baixa quando o mapa aparece).

**Cadastro (seção Localização):**

- **O CEP voltou a preencher o endereço.** O consumo do `cepLookup` lia chaves antigas; agora usa as chaves `address_*` (rua, bairro, cidade, UF). Texto de erro: "CEP não encontrado".
- **O ponto vem do servidor.** Sair dos campos de endereço (cidade + rua, CEP completo ou bairro) chama `propertiesService.geocode`; o Nominatim nunca é chamado pelo navegador. Sair de um campo sem mudar nada não procura de novo.
- **Alfinete arrastável.** Arrastar grava `latitude`/`longitude` e `location_source = 'manual'`; o servidor grava `'auto'` quando o ponto veio da busca. `location_source` vai junto no salvar porque `payloadDoFormulario` espalha o form. A tela **nunca manda `metadata`** (o servidor troca o metadata inteiro e apagaria a origem).
- **Textos por precisão** (`TEXTO_DO_PONTO`): número → "Achamos pelo endereço. Arraste o alfinete se precisar ajustar."; rua → "Não achamos o número exato, mostramos a rua. Arraste até o imóvel."; bairro ou nada → "Não achamos o endereço. Arraste o alfinete até o imóvel."; arrastado à mão → "Posição ajustada à mão.". Sem endereço: "Preencha o endereço para marcar o imóvel no mapa." Na revenda aparece a nota "No site e nos portais aparece só a região, não o endereço exato."
- **Precisão `city` não grava ponto.** Só centraliza o mapa na cidade (igual à tarefa em lote do backend): evita publicar o centro da cidade como ponto exato de empreendimento.
- **O mapa centra na cidade ao abrir** a edição de um imóvel com endereço e sem ponto (sem gravar nada). Ponto salvo abre no zoom 16; sem alfinete no zoom de país.
- **Serviço ocupado:** o servidor devolve `failed`; a tela tenta de novo **uma vez**, em silêncio (1,5 s), e se falhar de novo trata como não achado. A nova tentativa não sai se a busca já foi trocada por outra, e resposta atrasada é descartada (corrida do CEP).
- **O alfinete manual nunca pula.** Só volta a seguir o endereço pelo botão "Reposicionar pelo endereço" (`alfinetePodePular`).

**Privacidade (decisão de 03/10):** **empreendimento** sai com ponto exato; **revenda** sai só com a região, para site, portais, catálogo Meta e landing. Dentro do LM Flow tudo é exato. No site público (`ImovelPublicPage`), a regra mora em `src/pages/Public/mapaDoImovelPublico.ts` (`consultaDoMapa`, com spec): com `latitude`/`longitude` (o servidor só manda para empreendimento) o iframe do Google Maps, sem chave, usa `q=lat,lng` e `z=16`; sem ponto mostra a região (bairro, cidade, UF), `z=14`, como antes; sem nada, sem mapa.

**Pendências conhecidas:** o backend ainda não expõe `metadata.location_precision` no JSON (o aviso de pontos antigos não sabe a precisão real); sem ponto e sem cidade achada, o aviso "Arraste o alfinete" aparece sem alfinete na tela.

**Não reabrir sem o dono pedir:** o alfinete exato só para empreendimento, a revenda só com região, e o ponto manual que não pula.

## Book dentro do cadastro (desde 2026-10-04)

Fase 4, entrega 6 (parte A). Spec: `LM FLOW/specs/2026-10-04-fase-4-imoveis-book-no-cadastro-design.md` (pasta do Tony, fora deste repo). Só frontend, sem mudança no servidor (`propertiesService.uploadBook` / `removeBook` já existiam). Este bloco **substitui** a tela *Books* (aba do menu de Imóveis), que existia desde a importação via book.

**Decisões do dono (não reabrir sem ele pedir):**

1. **A IA Vendedora não lê o book.** O cadastro novo já tem os detalhes; o book é **enviado** no chat, como antes.
2. **Um book por empreendimento.** Sem vários materiais por imóvel.
3. **O book entra no cadastro**, na seção *Fotos e vídeos*: subir, ver, trocar e remover (`BlocoDoBook.tsx`, renderizado por `SecaoMidia`).
4. **"Preencher pelo book" também guarda o book:** um envio só preenche os campos e anexa o PDF.
5. **O book só preenche campo vazio.** Nunca sobrescreve o que o corretor digitou.
6. **A tela *Books* saiu do menu.** `/books` virou `<Navigate to="/properties" replace />` (sem `PermissionRoute`: quem não vê imóveis cai na regra de `/properties`). `PropertyBooks.tsx` foi apagada; `PropertyBookDialog` ficou (a lista e o cadastro usam).
   - **Filtro "Só com book"** (aba Empreendimentos, painel de filtros): substitui a lista da antiga tela. `FiltrosEmpreendimento.comBook` → `has_book=1` na API, etiqueta "Com book". Decidido com o Tony em 05/10.
7. **Captação pelo book no site** (botão *Receber o book no WhatsApp*, gatilho e ação *Enviar o book do imóvel de interesse*) é a **parte C**, junto com as sobras do site. Fora daqui.

**O que o bloco faz:**

- **Quando aparece:** em **empreendimento** sempre. Em **revenda** só quando já tem book (`editando?.has_book`), e aí só *Ver book* e *Remover*: não sobe nem troca. Revenda sem book não mostra o bloco.
- **Criação:** o PDF escolhido fica guardado na página (estado `book`, conta como alteração não salva) e sobe logo depois do `create`, com o andamento num aviso só (*Enviando o book… N%*, *Guardando o book…* no 100%, *Book salvo* no fim). Se o `create` falha, nada sobe e o arquivo continua escolhido (um segundo *Cadastrar* sobe uma vez só). Se o `create` dá certo e o envio falha, o imóvel fica criado, aparece o aviso para subir de novo na edição e a navegação segue.
- **Edição:** subir, trocar e remover gravam na hora, como *Gerenciar fotos*. Remover pede confirmação (`useConfirmacao`). Durante um envio ou remoção os botões ficam travados, aparece *Enviando… N%* (*Guardando o book…* no 100%), sair da tela pergunta antes (`useAlteracoesNaoSalvas`) e o estado mostrado vem do imóvel que o servidor devolveu. *Ver book* abre o `PropertyBookDialog`.
- **Trava do arquivo:** só PDF (`application/pdf` ou `.pdf`), até **200 MB** (a mesma do servidor; há books de 60 a 75 MB, por isso mostra o andamento). Fora disso: aviso e nada sobe (`validarBook`).
- **Preencher pelo book (só na criação, como antes):** o arquivo **PDF** em cadastro de **empreendimento** também vira o book do imóvel, **se ainda não houver um escolhido**; o aviso diz *Book anexado*. Word, foto e .txt não viram book.
- **"Só vazio"** (`PreencherPorTexto.tsx`): um campo é preenchido quando está nulo, em branco ou igual ao valor de fábrica do cadastro novo (`{ ...FORMULARIO_VAZIO, ...formularioNovo(kind) }`). Preço ou quartos que o corretor já digitou não mudam. Características e tipologias **somam** ao que já está marcado: o book nunca desmarca nada.

**Fica:** o *Ver book* no menu ⋮ de cada imóvel da lista e o *Enviar book* do chat.

Armadilhas:

1. **Não recrie a rota `/books` com `PermissionRoute`:** o redirecionamento não pode barrar quem não tem a permissão antes de chegar em `/properties`. `/books` saiu de `permissionRoutes.ts` e do `menuItems.spec`.
2. **O "só vazio" lê o formulário ATUAL depois que a leitura termina** (`formRef` em `PreencherPorTexto`). O OCR pode levar minutos e o corretor segue digitando; comparar com o formulário de quando a leitura começou sobrescreve o que ele digitou nesse meio-tempo.
3. **Características são união, nunca troca.** `patch.features = achadas` desmarcaria o que o corretor marcou. Só entra slug novo e válido; se nada é novo, nada vai no patch.
4. **O book da revenda é exceção só de leitura.** Não abra subir/trocar para revenda sem o dono pedir (decisão 2: o book é do empreendimento).

## Meu site · Personalizar: página inicial (desde 2026-10-04)

> Pedido do dono (03–04/10, varredura do Kenlo): "qualquer pessoa personaliza o site sozinha". Spec: `LM FLOW/specs/2026-10-04-meu-site-projeto-c-personalizar-design.md` (C1). Absorve a entrega 4 dos Imóveis.

**O que aparece na tela:** Personalizar ganha Busca rápida, Vitrines, Chamadas e Mais buscados. No site: abas que somem sem imóvel, Lançamentos = empreendimento, selo da fase no cartão, filtros de preço/suítes/vagas/fase, vitrines por regra, chamadas editáveis (3 de fábrica + 3 livres, 3 visuais), mais buscados automático ou à mão.

**Decisões (não reabrir sem o dono pedir):**
1. Configuração em `sites.settings['home']`, lida só por `Sites::HomeConfig.resolve` (servidor) e `resolverHome` (site). Texto nulo = texto de fábrica.
2. Lançamentos = `listing_kind = development`; Comprar inclui empreendimento; Alugar = só revenda de locação. Fim do "featured como lançamento".
3. Fase é filtro, não aba. Abas: Comprar, Alugar, Lançamentos, com liga/desliga; aba sem imóvel some.
4. Vitrines por regra (nunca imóvel a imóvel); 2 de fábrica sempre existem (só liga/desliga, nome e ordem); teto 6; 6 imóveis cada; vitrine vazia some. "Imóveis em destaque" pega destaque ou exclusivo e some quando não há nenhum (não cai nos mais recentes). O "Ver todos" de uma vitrine some quando a aba dela está escondida (ver também a 13). Na de destaques o botão diz "Ver todos os imóveis" (a busca não tem filtro de destaque).
5. Chamadas: 3 de fábrica editáveis + até 3 livres (página, link http/https, WhatsApp); cartão com destino inexistente some; faixa precisa de 2+. Chamada pra página só aparece se a página está no menu do site (ativa + Exibir no menu). Link que não começa com http(s) é avisado na tela ("Use um endereço que comece com https://") e não é gravado.
6. Mais buscados: automático pelo catálogo (tipo+bairro com 2+ imóveis) ou manual; vai virar "pelas visitas" quando o contador tiver histórico — a busca já grava os filtros na visita.
7. Tudo filtra no navegador, em cima do catálogo inteiro (decisão de 14/09).
8. Filtro de tipo casa pelo NOME (`rotuloTipo`): cobertura/penthouse, terreno/lot etc. são o mesmo tipo na busca, nas vitrines e nos mais buscados; o seletor mostra um item por nome.
9. Faixas de preço prontas são disjuntas por R$ 0,01 (a de cima começa em `200000.01`): o imóvel da divisa cai numa faixa só.
10. A busca manda UMA visita interna por carga de página (com os filtros de quando a URL assentou); GA4/Pixel `page_view` só quando o endereço muda. Mexer nos filtros depois não conta visita nova.
11. `home` só viaja no Salvar se uma tela da página inicial mexeu nele (`homeAlterado` no `SiteBuilder`); depois de salvar, a tela relê o `home` gravado. As telas sempre mandam o objeto `home` INTEIRO pro `setF`.
12. Vitrine livre ganha id curto gerado na tela; o servidor troca se colidir. Cidade e bairro casam sem diferença de maiúscula, acento e espaço nas pontas ("campinas" = "Campinas" = "CAMPÍNAS "), por UMA função (`normalizarTexto`, em `filtros.ts`) usada na regra da vitrine, no filtro da busca, nos atalhos manuais e no seletor de cidade/bairro da busca (que marca a opção equivalente).
13. "Ver todos" da vitrine livre só aparece quando a regra cabe inteira na URL da busca (`buscaDaRegra` devolve null senão): no máximo 1 tipo (pelo nome), 1 cidade, 1 bairro e 1 fase; sem "Só destaques e exclusivos"; finalidade definida; Cadastro compatível com a aba (Empreendimentos → Lançamentos, com finalidade Qualquer ou Comprar; Revenda → só Alugar, porque Comprar inclui empreendimento). Na dúvida, sem o link.
14. Atalho manual (Mais buscados) não tem finalidade "Qualquer": é Comprar ou Alugar. Atalho salvo sem finalidade é tratado como Comprar. Atalho cuja busca dá 0 imóvel não aparece no site. **Sobras do C1, entregues no C2:** o atalho manual some quando a aba dele está escondida (o de Alugar some com Alugar escondida; o de Comprar, ou sem aba, some com Comprar escondida), porque `atalhosDoSite` recebe as abas visíveis (o automático não muda); e no seletor de cidade e bairro da busca, grafias diferentes do cadastro ("Campinas", "campinas ") viram uma opção só, na grafia mais comum (`opcoesSemRepetir`, em `filtros.ts`).
15. Empreendimento exclusivo mostra os dois selos no cartão (fase + Exclusivo); na revenda Exclusivo vence Destaque.
16. Fase é só de empreendimento: o campo some na aba Alugar (capa e busca) e um `?stage=` na URL não filtra nessa aba.
17. Na ficha do imóvel o topo e o rodapé mostram as abas pelo liga/desliga do Personalizar (a ficha não carrega o catálogo para checar aba vazia).

**Armadilhas:**
1. Backend vem PRIMEIRO (`lm-flow`, `saas-multitenant`): `home` no `/site` e os campos `listing_kind/stage/delivery_forecast/sale_price_from/rent_price_from` no resumo do imóvel.
2. `home` no admin é permitido ANINHADO; escalar some sem aviso. `home` está em `DEDICATED_SETTINGS_KEYS`.
3. Nomes de tipo de imóvel: sempre `rotuloTipo`/`pluralTipo` (`tiposDeImovel.ts`), nunca a chave crua.
4. Não é `featureKey` nem `clientToggleKey`.
5. O servidor descarta em silêncio chamada livre sem título, link fora de http(s), página não escolhida e atalho sem rótulo: a tela avisa cada caso antes do Salvar. Avisos âmbar que existem: Chamadas — "Sem título, a chamada não é salva.", "Sem página escolhida, a chamada não é salva.", "Sem um link que comece com http:// ou https://, a chamada não é salva.", página fora do menu, site sem WhatsApp; Mais buscados — "Sem rótulo, o atalho não é salvo."; Vitrines — De R$ maior que Até R$. Enquanto a lista de páginas não chega (ou falha) a tela de Chamadas não afirma nada sobre a página escolhida. Remover chamada, atalho ou vitrine pede confirmação.

## Meu site · arrumação visual do painel (desde 2026-10-04)

> Pedido do dono (04/10): o painel do Meu site estava apertado (uma coluna no meio, campos pequenos e colados, sem dizer o que vai em cada campo), o logo era só um campo de link com miniatura e não havia como enviar o ícone da aba. Referência: tela "Aparência" do Kenlo Sites.

**O que aparece na tela:** cada tela do Meu site é uma caixa só, dividida em faixas. Em cada faixa, à esquerda o título e uma frase dizendo o que é e onde aparece no site; à direita os campos, maiores. Aparência ganhou o bloco Logotipos com duas caixas grandes (Logo do site e Ícone da aba, arrastar ou clicar, Trocar e Remover) e a prévia da aba do navegador. O site público passa a usar o ícone da aba. Dados de contato com máscara de telefone e aviso de e-mail. O painel usa mais a largura da tela (até 1400px).

**Decisões (não reabrir sem o dono pedir):**
1. **L1 · Explicação ao lado.** Faixa da largura toda: título + frase à esquerda (1/3, de `lg` pra cima), campos à direita; abaixo de `lg` empilha. Faixas separadas por divisória dentro de UMA caixa por tela.
2. **L2 · Logotipos = duas caixas grandes, Logo do site e Ícone da aba, sem campo de link.** "Logo clara" (fundo escuro) fica pro C3. Remover grava `null`.
3. **L3 · "Códigos avançados"**, sem o "(para quem entende)". Um spec impede a frase de voltar em `src`.
4. **Padrão obrigatório das telas do Meu site** (pasta `SiteBuilder/ui/`): `Secoes` (a caixa) + `Secao` (`titulo`, `descricao`, `acao`, `id`); `Campo` (rótulo ligado por `htmlFor`/`id`, `ajuda`, `aviso` âmbar, `erro` vermelho), `CampoTexto` e `CampoTextoLongo`; `CLASSE_DO_CAMPO` (`h-11 text-base`) em Seletor, telefone e campo montado à mão; `EnvioDeImagem` para imagem que vai pro formulário (variantes `logo` e `icone`; PNG, JPG e WEBP, **sem SVG**: o armazenamento entrega SVG como download, então ele não apareceria nem como imagem nem como ícone; Remover com `useConfirmacao`; falha de envio em âmbar dentro da caixa). Tela nova ou campo novo no Meu site usa essas peças. Toda frase de bloco é do dia a dia: o que é e onde aparece no site.
5. **Ícone da aba:** `favicon_url` entra no formulário igual ao `logo_url` (carrega de `branding`, viaja no Salvar). No site, `useIconeDaAba` (`features/siteBuilder/public/`) aponta TODOS os `<link rel~="icon">` do `<head>` pro ícone (sem `type`/`sizes`, que eram do LM Flow) e devolve cada atributo ao sair da página; endereço que não é http(s) é ignorado. Ligado em toda página pública que carrega o site (home, busca, ficha do imóvel, páginas, blog, artigo, financiamento, anuncie). O título da aba sai de UMA regra, `tituloDaAba` (o de Aparecer no Google ou "Nome — Encontre seu imóvel"), usada pelo site e pela prévia da aba em Aparência.
6. **WhatsApp do site continua gravado só com dígitos e o 55** (`5511987654321`): o site monta o link do botão verde com eles. O campo é o `PhoneInput` da casa com `valueFormat="digits"`. Número antigo gravado SEM o 55 (10 ou 11 dígitos) aparece no campo como Brasil, mas **não é corrigido sozinho**: a tela mostra o aviso âmbar "Falta o código do país (55)…" e a pessoa confere e salva.
7. **Telefone do site é gravado como aparece no site**, `(11) 3333-4444`: o topo e o rodapé mostram o texto gravado, e o "ligar" usa só os dígitos. O campo é o `BrPhoneInput` com `entrega="mascarado"` (o padrão do componente continua só dígitos, para os formulários públicos). Telefone gravado que **não cabe na máscara** (sobra letra ou barra, dois números, ramal, `0800`/`4004`, DDD começando com 0) vira **campo de texto livre**, com o aviso "Esse telefone tem mais de um número ou ramal. Ele aparece no site do jeito que está escrito."; o modo é decidido pelo valor carregado e não troca enquanto a pessoa digita.
8. **Abrir a tela de Dados nunca grava.** Máscara e `PhoneInput` reescrevem o valor carregado e podem disparar `onChange` sem ninguém digitar: os dois campos só gravam com o foco dentro deles.
9. **A ajuda diz o que o site faz hoje:** a cor de destaque pinta os selos Destaque, Exclusivo e Muito procurado (desde o C3, em todos os sites, inclusive nos que nunca abriram a Aparência; o texto do selo fica branco ou escuro pelo contraste); a faixa de cima (telefone, e-mail, redes) só aparece no computador e fora da página inicial, e o que ela mostra (nome das redes ou só o ícone) e o que o rodapé mostra dependem da Aparência: as ajudas de Dados de contato e Redes sociais saem de `features/siteBuilder/ondeApareceNoSite.ts` (ver "Meu site · Personalizar: aparência, menus e páginas"); as caixas Ativo/Publicado (bloco No ar) põem o site em manutenção quando qualquer uma está desmarcada, e a ficha do imóvel aberta por link continua funcionando (ver "Meu site · site em manutenção"). Mudou o site, muda a frase.

**Armadilhas:**
1. A caixa de imagem só cuida de escolher, conferir, girar e avisar: quem usa passa `enviar` (sobe e grava; erro lançado vira o aviso) e `aoRemover`. O logo continua tirando as cores no envio (`extractLogoColors`).
2. A marca d'água NÃO usa `EnvioDeImagem`: o logo dela é gravado na hora pelo servidor, que só aceita PNG, JPG e WEBP.
3. O endereço do rodapé usa `whitespace-pre-line`: as duas linhas do campo Endereço aparecem em duas linhas no site.
4. Não é `featureKey` nem `clientToggleKey`, e não tem metade de backend (o servidor já aceitava e devolvia `favicon_url`).

## Meu site · site em manutenção (desde 2026-10-04)

> Decisão do dono (04/10): site com **Ativo** ou **Publicado** desmarcado (Meu site › Endereço do site, bloco No ar) mostra a página "Em manutenção". Antes as duas caixas só mudavam o selo do painel e o site continuava abrindo.

**O que aparece na tela:** no site, a página Em manutenção (logo ou nome, cores do site, "Estamos atualizando nosso site. Volte em breve." e, embaixo, "Enquanto isso, fale com a gente:" com WhatsApp, telefone e e-mail, só os que existem). Aba do navegador "<Nome> — Em manutenção" com o ícone do site. No painel, o selo da barra diz "Em manutenção" no lugar de "Fora do ar", e o bloco No ar explica o efeito.

**Decisões (não reabrir sem o dono pedir):**
1. **M1.** Em manutenção = `!site.active || !site.published`. Quem decide é o servidor (`data.maintenance`); o site só lê. `maintenance` ausente (servidor antigo) = no ar.
2. **M2.** A ficha do imóvel aberta por link continua funcionando (o link vai no WhatsApp e no anúncio), com envio de contato, fotos e contagem de visita. Em manutenção o topo e o rodapé dela mostram só o logo/nome (que leva pra raiz, a página de manutenção) e o WhatsApp: sem abas, menu de páginas, blog, busca, "Voltar aos imóveis" nem "Você também pode gostar" (a lista nem é pedida).
3. **M3.** Viram a página de manutenção: página inicial, busca, páginas criadas, blog, artigo, Financiamento e Anuncie. Ela vem antes do erro e da tela vazia: as listas dão 404 em manutenção e isso nunca pode virar "Portal indisponível" nem "Nenhum artigo".
4. **M4.** Páginas de anúncio (`landing/:slug`) não mudam: têm controller próprio.
5. Enquanto a página de manutenção está aberta: `<meta name="robots" content="noindex">` e o título da aba; ao sair, os dois voltam como estavam. O ícone da aba é trocado só pela página que a mostra (`useIconeDaAba`), nunca pela página de manutenção também.
6. **Rastreamento em manutenção:** a ficha do imóvel instala GA4 e Pixel e dispara o Lead (`trackLead`) quando o contato é aceito, porque ela segue recebendo anúncio. GTM e Códigos avançados nunca rodam em manutenção, nem se o servidor mandar (`rastreamentoDoSite`, em `usePortalTracking.ts`, só deixa passar `ga4` e `facebook_pixel`). A página de manutenção não instala nada e não conta visita (as páginas passam `null` pro `usePortalTracking`).

**Contrato do servidor** (`GET /api/public/v1/site`, sempre 200): em manutenção vem reduzido, `{ maintenance: true, id, name, slug, branding: { logo_url, favicon_url, primary_color, accent_color, font_family }, contact: { phone, whatsapp, email, address }, seo: { title }, tracking: { ga4, facebook_pixel } }`, sem `gtm_id`, `custom_code`, `home`, `menu`, `hero`, `sections`, `social_links` nem `translate` (Tag Manager e códigos não rodam). No ar, `maintenance: false` e o resto igual. Em manutenção respondem 404 "Site em manutenção": `site/pages`, `site/pages/:slug`, `site/articles`, `site/articles/:slug`, `site/properties` (lista) e `POST site/anuncie`. Seguem iguais: `site/imovel/:code`, `site/properties/:code`, `POST site/leads`, `POST site/visits` e as fotos.

**Armadilhas:**
1. **O frontend sobe ANTES do backend** (exceção à regra de sempre). Contra o servidor antigo, sem `maintenance`, ele se comporta como o site no ar, então nada quebra. Entre as duas subidas o bloco No ar do painel já fala da página Em manutenção, que só passa a aparecer quando o backend (`lm-flow`, `saas-multitenant`) subir: as duas subidas no mesmo dia.
2. Uma regra só no site: `estaEmManutencao(site)` em `portalShared.tsx`. `PortalHeader`/`PortalFooter` trocam sozinhos pro topo/rodapé enxutos em manutenção, então página nova que usar os dois já nasce certa. Página nova do site que deva virar manutenção: `if (manutencao) return <PaginaManutencao site={site} />` logo depois do "Carregando…", antes do erro.
3. Efeito de página que mexe no título roda DEPOIS do da página de manutenção (efeito do pai roda depois do do filho): precisa de `if (manutencao) return` (ver o título do Blog).
4. `usePortalData` pede o site e a lista juntos; em manutenção a lista que falha (404 ou rede) não derruba a página. Fora da manutenção, falha de rede da lista continua sendo "Portal indisponível".
5. Não é `featureKey` nem `clientToggleKey`.

## Meu site · Personalizar: página do imóvel e lista (desde 2026-10-04)

> Pedido do dono (03–04/10, varredura do Kenlo): "qualquer pessoa personaliza o site sozinha". Spec: `LM FLOW/specs/2026-10-04-meu-site-projeto-c-personalizar-design.md` (C2). Backend no `lm-flow` (`saas-multitenant`), `Sites::PropertyPageConfig` e `Sites::ListingConfig`.

**O que aparece na tela:** Personalizar ganha **Página do imóvel** e **Lista de imóveis**, logo depois das telas da página inicial.
- **Página do imóvel:** abas Imóveis | Empreendimentos, cada uma com as caixinhas dela e uma frase do que aparece no site (Imóveis: Mapa, Selo Muito procurado, Condomínio/IPTU/valor do m², Você também pode gostar; Empreendimentos: Mapa, Selo Muito procurado, Fase da obra e previsão de entrega, Tipologias disponíveis, Construtora, Você também pode gostar). Fora das abas, **Selos de financiamento** (vale pros dois) e **Cópia por e-mail** (até 3 e-mails, aviso âmbar pra e-mail inválido quando a pessoa sai do campo, "Adicionar e-mail" some no 3º, remover pede confirmação).
- **Lista de imóveis:** "Ordem padrão" (Mais recentes, Menor preço, Maior preço, Maior área) e "Visual dos cartões" com duas miniaturas, Grade e Linhas largas.
- **Chamadas:** Financiamento e Anuncie mostram "Página ligada" ou "Página desligada: a chamada não aparece no site…", pelo **último salvo** (`site.financiamento.enabled` / `site.anuncie.enabled`).
- **No site:** selos abaixo do título (Muito procurado, Aceita financiamento, Aceita FGTS, Minha Casa Minha Vida), fase com previsão junto do preço, vídeo e tour virtual, Dados do empreendimento (torres, andares, unidades, padrão e construtora), IPTU mensal quando o cadastro diz. Na busca, "Ordenar por" e os cartões em linhas largas.

**Decisões (não reabrir sem o dono pedir):**
1. Configuração em `sites.settings['property_page']` e `sites.settings['listing']`, no molde do `home`: servidor lê por `resolve` e grava por `normalize`; no navegador, `resolverFicha`/`resolverLista` (`features/siteBuilder/public/`). Servidor velho ou bloco ausente = padrão de fábrica: tudo ligado, `recent`, `grid`, a ficha e a lista de antes.
2. **`email_copy` só no admin.** O `/site` público nunca leva os e-mails (`public_payload` no servidor). No admin, a carga e o retorno do Salvar usam **`resolverFichaDoAdmin`**, o único que traz `email_copy`; com o `resolverFicha` a tela perderia os e-mails ao abrir e os apagaria no Salvar.
3. **Cópia por e-mail:** cada contato da página de um imóvel (`form_type: 'imovel'`) vai também pros e-mails, num job (`Sites::PropertyLeadEmailJob`). O contato sempre entra no CRM e é roteado antes; a cópia nunca derruba o contato. Travas contra disparo em massa (o formulário é público): a mesma pessoa (telefone ou e-mail) no mesmo imóvel em menos de 1 h não gera outra cópia, e o site manda no máximo 30 cópias por hora. O desfecho fica em `lead.form_data['email_delivery']`, como o do Anuncie, e Contatos do site mostra os dois novos (`emailDeliveryLabel`, em âmbar): `ignorado: repetido` → "Sem cópia por e-mail: a mesma pessoa pediu este imóvel há menos de 1 hora"; `ignorado: limite` → "Sem cópia por e-mail: o site já mandou 30 cópias na última hora". A frase da tela diz as duas travas.
4. **Construtora só com nome e site.** CNPJ, telefone e contato da construtora nunca saem no JSON público; o site só vira link se for http(s) (conferido de novo no navegador).
5. **"Muito procurado" (`popular`) só como sim ou não:** mais de 30 visitas à página do imóvel nos últimos 30 dias, numa consulta `count` (sem índice novo). O número nunca sai.
6. **A ordenação mora no navegador**, em cima do catálogo inteiro que o site já carrega: o servidor não ganha `sort`. Preço da ordem = o do aluguel na aba Alugar, o de compra nas outras; sem preço (ou sem área, em Maior área) vai pro fim; empate por `created_at` mais novo e depois pelo código. Filtra, ordena e só então pagina (30 por vez); trocar a ordem volta aos 30 primeiros. `?sort=` na URL vence o padrão do site; escolher o padrão tira o `?sort=`.
7. Vídeo e tour: iframe só pra YouTube, Vimeo e Matterport, sempre remontado a partir de um id validado (`midiaDoImovel.ts`); outro endereço http(s) vira botão "Ver vídeo" / "Fazer o tour virtual"; `javascript:` não aparece. Aparecem sozinhos quando o cadastro tem, sem caixinha no admin.
8. Na foto dos cartões (grade e linha) o link é só de mouse (`tabIndex={-1}`, `aria-hidden`); selos e preço por cima da foto ficam fora dele, pra continuarem lidos. "Ver detalhes" leva o nome do imóvel no `aria-label`.

**Armadilhas:**
1. **Backend vem PRIMEIRO.** O frontend aguenta o servidor velho (sem os blocos ou sem os campos novos da ficha): cai no padrão de fábrica e esconde o que falta.
2. **Colunas novas da ficha sempre por `has_attribute?`** no servidor (`Force*` 294, 295, 240; sem migration). O `schema.rb` está defasado e não serve de referência.
3. **`email_copy` vai SEMPRE como lista.** Texto ou `null` o permit aninhado do servidor descarta em silêncio; com o merge, os e-mails ANTIGOS ficam gravados e a mudança é ignorada, com a tela dizendo "Salvo". O `SiteBuilder` apara e tira campo em branco antes de mandar; o inválido viaja e o servidor descarta (a tela já avisou), e depois do Salvar a tela relê o gravado.
4. Flags `fichaAlterada`/`listaAlterada` no `SiteBuilder`, no molde do `homeAlterado`: o bloco só viaja se a tela dele mexeu; zeram no Descartar e depois do Salvar. As telas sempre mandam o bloco INTEIRO pro `setF`.
5. O "Ordenar por" do site é `<select>` nativo e mora em `portalShared.tsx` (`OrdenarPor`), a exceção de lista nativa do `conferir-padrao`. Não mover pra página de busca: o build reprova.
6. Não é `featureKey` nem `clientToggleKey`.

## Book pelo site (desde 2026-10-05)

> Entrega 6C da fase 4 de Imóveis. Spec: `LM FLOW/specs/2026-10-05-fase-4-imoveis-book-pelo-site-design.md` (pasta do Tony). Backend no `lm-flow` (`saas-multitenant`): gatilho `lead.book_requested`, `Sites::PropertyPageConfig` (`development.book_button`), `GET/PUT /sites/:id/book_flow`, modelo `book_pelo_site`, blocos `hand_to_ai` e `disable_ai`. O backend entra primeiro.

**O que o dono vê, em três pontos:**
- **Construtor:** no bloco "Enviar WhatsApp", o Arquivo ganha **"Book do imóvel de interesse"** (o servidor acha o book sozinho; acima de 16 MB vai como link); o painel Blocos ganha **"Passar para a IA"** e **"Desligar a IA"**; o gatilho novo é **"Pediu o book no site"**; o modelo **"Book pelo site"** vem pronto. As peças servem a qualquer fluxo (`features/flowAutomations/book.ts`: `BOOK_SOURCE`, `BOOK_LABEL`, `BOOK_SUMMARY`, `usesBook`, `withBook`). A prévia do funil e a do modelo mostram a linha "Manda o book do imóvel de interesse" em vez de um balão vazio (o servidor manda `media_source` na prévia desde a entrega 6C).
- **Meu site › Página do imóvel › Empreendimentos:** seção **"Receber o book no WhatsApp"** (`telas/BookPeloSite.tsx`): a chave e, ligada, três campos (**Enviar pelo número**, **Mensagem** com os botõezinhos de variável, **"Depois do book, a IA Vendedora assume a conversa"** Sim/Não, só se há IA ligada) e o link "Ver no construtor". Fluxo mexido no construtor: "Este fluxo foi personalizado no construtor" e a tela só liga e desliga. Fluxo desligado: aviso âmbar + "Ligar o fluxo". Fluxo excluído: aviso + "Recriar o fluxo".
- **Página pública do empreendimento:** o botão **"Receber o book no WhatsApp"** abre o MESMO formulário de nome e telefone, com o título "Receba o book no WhatsApp" (telefone obrigatório), e envia `form_type: 'imovel_book'`. Confirmação: "Pronto! O book vai chegar no seu WhatsApp em alguns minutos." Na prévia do site vale o aviso de sempre (o contato não foi enviado de verdade).

**Decisões (não reabrir sem o Tony pedir):**
1. **Quem manda o book é uma automação, não a IA.** A IA entra quando o lead responde (por isso "Passar para a IA"), e nunca abre a conversa.
2. **A chave fica no Meu site, mas quem trabalha é um fluxo VISÍVEL no construtor** ("Book pelo site"): aparece nas Automações, na faixa "fluxo rodando" da conversa e no histórico do lead. Não existe automação escondida.
3. **Nasce desligado em todo cliente** (`book_button` padrão `false`, ao contrário das outras caixinhas da ficha, que nascem ligadas): ligado, passa a mandar WhatsApp sozinho. Em `resolverFicha`, só o `true` explícito liga.
4. **O botão exige três coisas:** chave ligada (`resolverFicha(site.property_page).development.book_button`), `listing_kind === 'development'` e `has_book === true`. Revenda nunca tem o botão (book em revenda está fora desta entrega); empreendimento sem book também não.
5. O envio é o MESMO `POST /site/leads` do "Tenho interesse", só com `form_type: 'imovel_book'`; o servidor faz tudo o de sempre (contato, interesse, card, distribuição, cópia por e-mail) e dispara o gatilho, que vale a cada pedido (trava de 10 min por contato + imóvel no servidor).

**Contrato com o backend:**
- `has_book` (boolean) vem SÓ no `/site/properties/:code` (que a `ImovelPublicPage` já usa), não no `/site/imovel/:code`. Servidor velho não manda: sem botão.
- `property_page.development.book_button` vem no `/site` público (booleano). O padrão de fábrica do navegador é `false`.
- `GET/PUT /sites/:id/book_flow` devolve `{ existe, fluxo_id, fluxo_ligado, personalizado, ligado, send_from, send_from_inbox_id, mensagem, ia_assume }`; o cliente está em `siteBuilderService.getBookFlow/putBookFlow`.
- **422 do `PUT /book_flow`** (a tela mostra a mensagem do servidor num aviso e a chave fica como estava): mensagem vazia, `send_from` inválido, ou sem número conectado pra mandar.
- **`send_from: ''` = "Automático"** (o número é escolhido pelo servidor). O PUT aceita `''` e o GET devolve `''` quando é automático: a tela manda `''` como está e o seletor mostra "Automático (como sempre foi)". Nunca converter `''` em `'owner'`.
- **"Pediu o book no site" é só do construtor de fluxos.** A tela antiga de Automações de Lead (`LeadAutomations.tsx`) NÃO oferece esse gatilho (o servidor recusa): `FLOW_ONLY_TRIGGERS`, em `leadAutomationService.ts` ao lado de `TRIGGER_LABELS`, filtra a lista; o rótulo continua em `TRIGGER_LABELS` só pra exibição.
- **"A IA assume"** só aparece se há agente ligado que NÃO é só de follow-up (`enabled && !followup_only`); a explicação embaixo: "Vale para o número por onde o book sair: a IA precisa estar ligada nele."
- Contatos recentes do Painel: `form_type: 'imovel_book'` aparece como "Pediu o book".

**Armadilhas:**
1. **`book_button` é do servidor, não da página.** Quem o escreve é o serviço do fluxo (`book_flow`); o Salvar da página nunca o muda no servidor. A tela atualiza o valor local pelo `aplicarSemMarcar` (em `SiteBuilder`), SEM marcar `fichaAlterada`, e ele aceita um **updater** (mescla no `property_page` ATUAL), então um e-mail editado enquanto o PUT da chave voa não se perde e o Salvar seguinte não reenvia a ficha à toa.
2. **A chave grava NA HORA**, não espera o Salvar da página (ligar cria ou religa o fluxo no servidor). Se o servidor recusar (422, sem número conectado), a chave fica como estava.
3. **Só o botão "Salvar o envio do book" manda os campos** (`send_from`, `send_from_inbox_id`, `mensagem`, `ia_assume`). A chave, "Ligar o fluxo" e "Recriar o fluxo" mandam só `{ ligado }`, e o servidor mantém o gravado. Fluxo personalizado nunca tem os nós sobrescritos pelo PUT.
4. **O endereço do PDF NUNCA entra no payload público.** A página só sabe SE o imóvel tem book (`has_book`) e se a chave está ligada. Não "melhorar" mostrando o link, nem o tamanho, nem o nome do arquivo.
5. **A resposta do PUT substitui os rascunhos dos campos** pelo que o servidor gravou: texto editado e não salvo se perde ao ligar, desligar ou "Ligar o fluxo".
6. Depois de enviar, o agradecimento substitui o formulário: o botão do book some até recarregar a página (aceito por ora). Falha do servidor mostra "Não consegui enviar agora. Tente de novo em instantes." e mantém o formulário preenchido; o botão de enviar fica travado durante o envio (sem pedido duplo).
7. O formulário do botão e o de "Tenho interesse" são o mesmo componente e o mesmo estado (nome, telefone): o `pedindoBook` só troca título, botão e `form_type`. Não duplicar o formulário.
8. O `readiness` e a prévia leem o book só por `usesBook`/`BOOK_SOURCE`; nada de escrever `'property_book'` na mão.
9. Link do construtor: `/automations/flow-builder/:id`.

## Meu site · domínio próprio, Google e prévia (desde 2026-10-04)

> Fase 1 do plano `LM FLOW/plans/2026-10-04-meu-site-fase-final.md` (spec `LM FLOW/specs/2026-10-04-meu-site-fase-final-design.md`, pasta do Tony). Backend no `lm-flow` (`saas-multitenant`): tabela global `public.site_domains`, `resolve`/`head`/`sitemap` públicos, CORS pelo domínio ativo, `Sites::GoogleConfig` e o link de prévia.

**O que aparece na tela:**
- **Barra do Meu site:** com domínio próprio ativo, o endereço e o "Ver site" são o domínio. Em manutenção o botão vira **"Ver prévia"**: gera um link de 24 h, abre numa aba e mostra "Esse link vale 24 horas. Pode mandar pro dono aprovar." com o link e "Copiar link".
- **Aparecer no Google:** caixinha "Aparecer no Google", desligada de fábrica ("Liga quando o site estiver pronto. O Google leva alguns dias pra começar a mostrar."). Embaixo, onde o Google lê o site (o domínio, ou `<cliente>.lmflow.com.br`), e o aviso âmbar quando está ligada com o site em manutenção.
- **Endereço do site › Domínio próprio:** "Ativo: o site abre em …" e o que muda (só o site no domínio, endereços curtos, o endereço de hoje continua, os links de imóvel da IA passam a usar o domínio).
- **No site:** na prévia, a faixa "Prévia: o site ainda não está publicado." no bloco que gruda no topo; formulário enviado na prévia mostra "Prévia: o contato não foi enviado de verdade." no lugar do obrigado.

**Decisões (não reabrir sem o dono pedir):**
1. **Domínio só vale ativo pela Vercel.** Só o domínio verificado (ativo em `public.site_domains`) abre o site; cadastrado e pendente, ou removido, mostra "Site não encontrado", nunca o login. **Cliente suspenso dá 404 no domínio** (`resolve`, `head` e `sitemap`): o domínio dele mostra "Site não encontrado". No `/site` público e no admin, `domain` é o ATIVO (ou null); `primary_domain` é o configurado, pode estar pendente, e só muda pela tela de domínio.
2. **Só o site no domínio do cliente.** `src/main.tsx` decide pelo endereço: endereço do sistema (`lmflow.com.br` e subdomínios, `*.vercel.app`, localhost, IP) sobe o CRM (`mainDoSistema`); qualquer outro sobe só o site (`mainDoSite`), sem login, sessão, websocket, service worker, i18n nem "Instalar LM Flow". Tela do CRM aberta no domínio cai no início do site.
3. **Caminhos limpos via `caminhoDoSite`.** No domínio: `/`, `/imoveis`, `/imovel/:codigo`, `/blog`, `/blog/:slug`, `/p/:slug`, `/financiamento`, `/anuncie`, `/lp/:slug`; o resto vai para `/`, e o endereço antigo (`/portal/<c>/…`, `/imovel/<c>/<código>`, `/lp/<c>/<slug>`) redireciona para o limpo. Todo link do site passa por `caminhoDoSite(ctx, rota)` (`features/siteBuilder/public/dominioDoSite.ts`), que no endereço lmflow devolve os caminhos de sempre. Link novo no site: sempre por ele.
4. **O middleware monta o `<head>` e o `robots.txt`.** `middleware.ts` (borda da Vercel) + `middleware/headDoSite.ts` (funções puras): título, descrição, `og:*` (com `og:site_name`), `canonical`, `robots` e, no domínio ativo, `window.__LMF_SITE__` (o site não pergunta o `resolve` de novo); também o `robots.txt` e o `sitemap.xml` de cada endereço. **`og:url` = canonical** (o `url` do servidor é o endereço pedido, que pode ser o app.lmflow.com.br; só sem canonical ele vale). O `head` tem **teto de 1,2 s** (página e `robots.txt`; landing e sitemap, 2,5 s). Qualquer falha devolve o HTML de hoje (`noindex`); o `robots.txt` em falha é `Disallow: /` com `no-store` (**sem cache** na borda, para a falha não ficar guardada).
5. **Google por caixinha, e o subdomínio do cliente pode ser indexado.** `settings['google']['indexable']`, desligado de fábrica. `index,follow` só com a caixinha ligada, o site no ar e fora da prévia; o resto, `noindex`. O site no navegador segue a mesma regra (`robotsDoSite`, em `pages/Public/portalShared.tsx`) e nunca troca o `noindex` do `<head>` por `index` depois de carregar. O Google lê pelo domínio ativo ou, sem domínio, pelo subdomínio do cliente `<cliente>.lmflow.com.br`: o `robots.txt` dele libera só `/portal/<cliente>` e `/imovel/<cliente>/` (mais `/assets/`) e aponta o `sitemap.xml` dele; com domínio ativo o subdomínio fecha tudo e o sitemap dele dá 404 (o mesmo site não é lido em dois endereços). `app`, `www`, `api`, `admin` e o `lmflow.com.br` puro: sempre `Disallow: /`.
6. **Prévia de 24 h.** `POST /api/v1/sites/:id/preview_link` → `{ token, expires_at }`; o painel abre `<endereço do site>?previa=<token>` (`urlDaPrevia`, token codificado). O site guarda o token em `sessionStorage['lmf-previa']` e manda `X-Site-Preview` em TODA chamada pública (`cabecalhosDoSite`, em `features/siteBuilder/public/previa.ts`). Com `preview: true` do servidor: faixa, `noindex`, sem visita, sem GA4, Pixel, GTM nem códigos, e a página de manutenção não aparece. **Formulário na prévia não cria nada:** o servidor responde 200 `{ data: { preview: true } }` (contato da página inicial, da ficha do imóvel e o Anuncie), e a tela mostra "Prévia: o contato não foi enviado de verdade." no lugar do obrigado, sem `trackLead` (`envioFoiPrevia`, ou o site já em prévia). Token vencido, de outro site ou adulterado: o servidor ignora e o site sai normal. As páginas de anúncio (`/lp`) não entram na prévia (M4).
7. **"Ver site"** (`features/siteBuilder/enderecoDoSite.ts`): domínio ativo → `https://<domínio>`; sem domínio → `<endereço do painel>/portal/<cliente>`. A aba da prévia é aberta NO CLIQUE e recebe o endereço quando o servidor responde (aberta depois, o navegador bloqueia).
8. **Entrada que não sobe** (`src/main.tsx`): pedaço sumido depois de um deploy recarrega uma vez (trava anti-laço do `lazyWithRetry`); outro erro, ou a trava segurando, mostra "Não deu para abrir a página agora." com "Tentar de novo", nunca tela em branco nem rejeição solta. Na landing no domínio, falha de rede no `resolve` mostra "Não deu para abrir a página agora" com "Tentar de novo", como o site (`src/lp/LandingApp.tsx`).

**Armadilhas:**
1. **Backend vem PRIMEIRO** (`lm-flow`, `saas-multitenant`). Contra o servidor velho: sem `domain` o "Ver site" abre o lmflow; sem `google` a caixinha aparece desligada e o site sai `noindex`; sem `preview_link` o "Ver prévia" avisa que não deu.
2. **O `$` no `replace`.** Texto do cliente usado como string de troca em `String.replace` vira padrão: `$&` repete o trecho e `` $` ``/`$'` despejam o HTML inteiro no `<title>`. Toda troca com texto dinâmico (middleware, `landingHtml.ts`) usa função: `replace(X, () => novo)`.
3. **O CORS do `resolve` e do domínio do cliente.** O navegador pergunta de quem é o domínio ANTES de saber se ele está ativo; o backend responde `*` sem credenciais inclusive no 404 (bloco próprio no `cors.rb`, antes do `/api/*`). O domínio ativo de um cliente só ganha CORS em **`/api/public/*`, sem credenciais**: o site no domínio nunca chama a API do CRM, e se chamar, o navegador recusa. Sem isso o 404 vira erro de rede e o visitante fica no "Tentar de novo" pra sempre. Falha de rede (`erro`) e 404 (`nao-encontrado`) são estados diferentes em `dominioDoSite`.
4. **A trava de build `scripts/conferir-dominio-limpo.mjs`** (um `import()` novo no `src/main.tsx` não é conferido por ela: o comentário de alerta mora lá) roda depois do `vite build`: segue os imports estáticos, dinâmicos e a pré-carga do Vite a partir do pedaço do `mainDoSite` e reprova se achar `access_token`, `refresh_token`, `validityCheck` ou `ActionCable`. Página pública que importar algo do CRM (service com o interceptor, authStore, sessão, websocket) quebra o build: ache o import. Da entrada (`main-*.js`) só vale o import estático, porque o `import()` do `mainDoSistema` é a decisão pelo endereço. Se os termos sumirem até do CRM, ela reprova como "cega": atualize a lista.
5. **`google` viaja sempre INTEIRO** (permit aninhado) e só se a caixinha mexeu (`googleAlterado` no `SiteBuilder`, molde do `homeAlterado`).
6. **apex × www:** cada host faz o próprio `resolve`, e o domínio confirmado vale só para o host exato. Redirecionamento entre os dois é da Vercel/DNS.
7. Não é `featureKey` nem `clientToggleKey`.

## Meu site · Personalizar: aparência, menus e páginas (desde 2026-10-05)

> Fase 2 (C3) do plano `LM FLOW/plans/2026-10-04-meu-site-fase-final.md` (spec `LM FLOW/specs/2026-10-04-meu-site-fase-final-design.md`, pasta do Tony). Backend no `lm-flow` (`saas-multitenant`): `Sites::AppearanceConfig`, `Sites::MenuConfig`, `Sites::PageHtml` (limpeza ao gravar), `Sites::PageTemplates`, `Sites::TaxDocument` e `POST /sites/:id/pages/from_template`.

**O que aparece na tela:**
- **Aparência** ganha, com miniaturas clicáveis: **Fundo do site** (Claro, Escuro), **Topo do site** (Sobre a foto, Na cor principal, Branco) com a caixa **Logo clara**, **Faixa de cima** (Telefone, e-mail e redes · Telefone e redes (sem e-mail) · Só ícones · Esconder), **Altura e filtro do banner** (Meia tela, Tela cheia, e o controle deslizante do filtro escuro com o valor em % e a prévia) e **Rodapé** (Em colunas, Compacto, e a Frase do rodapé com contador de 200). A frase do Rodapé avisa que o "feito com LM Flow" fica, discreto. Com fundo escuro, logo enviado e sem logo clara: aviso âmbar "Com fundo escuro, envie a logo clara: a logo normal pode sumir no topo e no rodapé."
- **Menus** (tela nova em Personalizar, antes de Páginas): os itens do menu (Comprar, Alugar, Lançamentos, Sobre, Contato, Financiamento, Anuncie seu imóvel, as páginas criadas e Blog) com alça de arrastar, Subir/Descer, caixinha Mostrar e o nome (em branco = o nome de sempre, que é o placeholder); aviso âmbar quando um item ligado não tem destino (aba escondida, faixa de números ou captura desligada, Financiamento ou Anuncie desligados, página desativada). Bloco **Links externos**: até 3, nome e endereço, aviso âmbar pro que não é salvo, Remover com confirmação; "Adicionar link" some no 3º.
- **Páginas:** o conteúdo é o editor de texto (título, subtítulo, negrito, itálico, listas com marcador e numeradas, citação, link e imagem por endereço ou enviada), com 400px de altura mínima; o HTML antigo abre nele. **Nova página** abre a escolha: Em branco, Sobre nós e Política de privacidade (pede o **CPF ou CNPJ**). Excluir página pede confirmação.
- **No site:** ver "O que o site faz" nas decisões abaixo.

**Decisões (não reabrir sem o dono pedir):**
1. **Fábrica = o visual de antes do C3, byte a byte.** Site sem `appearance`/`menu` (servidor velho ou cliente que nunca abriu as telas) sai com o topo, a faixa de cima, o rodapé e o banner de antes. A rede é `src/pages/Public/molduraAntesDoC3.spec.tsx` com os fixtures `__fixtures__/moldura-antes-do-c3.json`, gravados do código do `c72c0c39`. **Fixture nunca é regravado a partir do código novo** (a trava `GERAR_MOLDURA` + `MOLDURA_DO_CODIGO_ANTIGO` recusa); diferença decidida entra explícita no `normalizar` do spec.
2. **Fundo escuro por variáveis**, sem mexer no DOM do claro: a raiz ganha `data-fundo="escuro"` e o bloco "Meu site · fundo escuro" do `globals.css` faz o resto. O texto na cor da marca usa **`--brand-text`**: no claro é a `--brand`; no escuro, a marca clareada até 4,5:1 sobre a caixa escura (uma marca azul-marinho sumiria no quase preto). Logo clara: sobre a foto do banner, no topo na cor principal quando o texto dele sai branco e, no fundo escuro, no topo sólido e no rodapé; sem ela, a normal.
3. **Faixa de cima com o nome do que o site faz.** `two_phones` = "Telefone, e-mail e redes" (a de sempre); `one_phone` = "Telefone e redes (sem e-mail)" (sem telefone cadastrado, mostra o e-mail); `icons` = "Só ícones"; `hidden` = "Esconder". **Nunca "2 telefones"**: o site só tem um telefone (mais o WhatsApp), e a chave ficou com o nome antigo. O rodapé compacto mostra logo, links, WhatsApp, frase e crédito; **não** mostra telefone, e-mail, endereço nem redes, e a tela diz isso.
4. **"feito com LM Flow" fica sempre**, discreto, com link pra `https://lmflow.com.br`, nos dois rodapés. O cliente não tira.
5. **Menu no `/site` público em `menu_config`**, não em `menu`: a chave `menu` do `/site` continua sendo a lista antiga das páginas no menu (o site no ar a lia como lista; trocar quebraria o topo de todos entre o deploy do backend e o do frontend). No admin a chave é `menu` (a mesma do PATCH e do `settings`).
6. **O rodapé repete o menu só depois que o cliente salva a tela Menus.** Quem decide é o `menu_config.saved` do servidor (true quando `settings['menu']` existe): `saved: true` repete o menu, mesmo igual ao de fábrica; `saved: false` fica o rodapé de antes do C3, mesmo que a ordem das páginas pareça diferente. Só quando o servidor NÃO manda o campo (`resolverMenu` devolve `saved: null`) o site decide comparando com a fábrica. A regra é `typeof saved === 'boolean' ? saved : diferenteDaFabrica` (`menuPersonalizado`, em `features/siteBuilder/public/menuConfig.ts`), **nunca `saved || diferente`**: duas páginas na mesma posição bastariam pra mudar o rodapé de quem nunca salvou. O servidor ordena as páginas das duas listas (`menu` antiga e `menu_config`) por `(menu_position, created_at, id)`. A ajuda da tela Menus diz isso.
7. **Página no menu = uma caixinha só, o `in_menu` da página.** O Mostrar de um item `page:` na tela Menus é o "Exibir no menu" da tela Páginas: salvar o menu grava o `in_menu` das páginas na mesma transação. Por isso o item `page:` viaja **sempre com `enabled` explícito** (ausente, o servidor entende ligado e liga a página no menu).
8. **Item `page:<slug>` perde o nome e a posição quando o endereço da página muda**: é outra chave. Ele volta como página nova (depois da última página, antes do Blog). A ajuda do campo Endereço, na edição, avisa.
9. **Limpeza do HTML da página ao gravar, com conversão** (`Sites::PageHtml`): o servidor guarda só `h2 h3 p ul ol li a img strong em blockquote br`; antes de limpar, converte o que veio colado (h1→h2, h4–h6→h3, b→strong, i→em, tabela vira parágrafos com " · ", div/section viram parágrafos), sem grudar palavras. Links: http(s), `tel:`, `mailto:` e `/caminho`; imagem só http(s). O editor da tela Páginas usa o esquema `paginaDoSiteSchema`, que só produz essas marcas.
10. **Teto de 200 KB** no conteúdo da página (medido no que chega). Passou: 422 "O conteúdo da página passou do limite de 200 KB. Divida em mais de uma página."; estrutura que trava a limpeza: 422 "O conteúdo da página tem uma estrutura que não dá pra salvar." Os dois aparecem como aviso âmbar dentro da janela, que continua aberta.
11. **Abrir e salvar uma página sem mexer não manda `content_html`**: o editor reescreve o HTML antigo (h1 vira h2), então a comparação é com `htmlComoOEditorDevolve(gravado)`, não com o gravado.
12. **Política de privacidade aceita CPF ou CNPJ** (numérico ou alfanumérico, com dígito verificador): corretor autônomo sem CNPJ é público central. O campo se chama "CPF ou CNPJ" e viaja como `document`; o erro vem em `error.details.field = 'document'` e aparece no campo. Os dois modelos criam a página **desativada e fora do menu**, e a tela abre a página pra revisão. 409 (duas criações ao mesmo tempo) vira "Outra página acabou de ser criada com o mesmo endereço. Tente de novo em instantes."
13. **A cor de destaque pinta os selos** Destaque, Exclusivo e Muito procurado (o selo da fase continua na cor principal). A ajuda da Cor principal lista o que ela pinta: Tenho interesse, botão de busca, enviar dos formulários, passos do Anuncie, aba da busca, selo da fase, preço das plantas, números da faixa de números, links, barrinha da manutenção e o topo na cor principal.

**Armadilhas:**
1. **Backend vem PRIMEIRO** (`lm-flow`, `saas-multitenant`). Contra o servidor velho a Aparência e os Menus abrem na fábrica, e o que se salva ali o servidor ignora.
2. **Flags `aparenciaAlterada`/`menuAlterado` no `SiteBuilder`** (molde do `homeAlterado`): o bloco só viaja se a tela mexeu, sempre INTEIRO; carga e retorno do Salvar passam por `resolverAparencia` e `menuDoPainel` (o servidor limpa nome, link e texto). O menu viaja por `menuParaGravar` (sem `page_title`, externo inválido fora).
3. **Página criada, salva ou excluída na tela Páginas grava na hora**, fora do Salvar: o `SiteBuilder` ajusta o menu da tela Menus com `menuComPagina`/`menuSemPagina` (`features/siteBuilder/menuDoPainel.ts`) sem acender a barra de alterações. No sentido contrário, salvar o menu sobe `versaoDasPaginas` e Páginas, Chamadas e Menus relêem a lista.
4. **Link externo com domínio acentuado:** o servidor (`URI.parse`) recusa o acento e descarta o link em silêncio. O `menuParaGravar` manda o `new URL(...).href` (punycode, `xn--…`), e é isso que volta na tela depois de salvar.
5. **O editor é o mesmo do chat e das landings** (`components/chat/rich-text-editor`). As ações novas (`heading2`, `heading3`, `orderedList`, `quote`, `image`) só aparecem com `ACOES_DA_PAGINA` E um esquema que tenha o nó (`acaoDisponivel`); a Imagem só com `aoPedirImagem`. O chat continua com negrito e itálico (o `messageInputWiring.source.spec` trava). O HTML abre por `DOMParser` inerte (num `div` da página, um `onerror` gravado rodaria antes do ProseMirror descartar). A imagem entra por um painel na janela, não por caixinha do navegador (`conferir-caixinhas`).
6. **Cores no CSS do editor com `var(--x)` direto**: os tokens são oklch e `hsl(var(--x))` some.
7. Não é `featureKey` nem `clientToggleKey`.

## Notificações na ficha do usuário (04/10/2026)

**O que é:** a ficha da pessoa (Admin → Usuários → nome) mostra se o aviso está chegando, por canal. A lista ganhou a coluna **Notificação** e o filtro **Com problema**.

- **Push:**
  - a permissão do navegador por aparelho (*Ligada / Bloqueada / Não perguntada / Sem suporte*), vinda do heartbeat de 60 s;
  - quantos aparelhos têm Modo Plantão;
  - os últimos 10 envios com *Saiu → Apareceu → Clicou*, ou *Falhou* com o motivo.
- **WhatsApp:** os últimos 10 avisos com *Enviado / Entregue / Lido*, ou *Falhou*. A pessoa é achada pelo número (cadastro ou campo da roleta), com e sem o 55.
  - Só entram avisos para números de pessoas do cliente (cadastro ou roleta); mensagem para lead não é registrada.
- **Na tela:** os últimos 10 avisos do sininho com *Lido / Não lido*.
- **Situação na lista:**
  - *Bloqueada* quando o aparelho visto por último negou o push;
  - *Falhando* quando as 3 últimas entregas de um canal em 7 dias falharam (aparelho com inscrição vencida não conta);
  - *Ok* nos outros casos.

**Como funciona:**
- O `public/push-sw.js` devolve um recibo assinado (vem dentro do push) em `POST /api/v1/push/receipts`, em `text/plain` para não disparar a pergunta prévia de CORS.
- Aparelho com o service worker antigo em cache fica em *Saiu* até recarregar o app. Isso é esperado, não é erro.
- *Entregue/Lido* vem do webhook do número que mandou o aviso.
- Se o registro não puder ser lido, a seção mostra erro com *Tentar de novo* (nunca vira vazio).

**Não reabrir sem o dono pedir:** push sem recibo nunca vira *Falhou*. Só falha o que o servidor de push recusou.

## Logs de todos os clientes (04/10/2026)

Usuários → Logs (`/admin/usuarios/logs`, `src/pages/SuperAdmin/Logs/`). Spec: `LM FLOW/specs/2026-10-03-admin-registro-custos-usuarios-design.md` (seção 4). Substitui a tela de um cliente por vez (`LogsView`, removida, junto com `logClients`, `activity` e `userMetrics` do `superLogsService`). Dados de `GET /super/logs`.

- **Uma lista só, todos os clientes**, mais recentes primeiro. Filtros (todos na URL): busca por pessoa, cliente, tipo de ação, período, *Só sensíveis* e *Incluir equipe Leal Mídia*.
- **Selo *Sensível*** nas ações que o backend marca (exportar, mudar IA/roleta/cargos, dar ou tirar acesso, excluir em massa, aparelho novo, *Entrar* do admin). Ação sensível da equipe aparece mesmo com a equipe escondida.
- **Tipo *Ação no sistema*** = só as ações sensíveis capturadas pela rede; *Mensagem* (WhatsApp) fica escondida até alguém escolher esse tipo.
- **Carregar mais** (30 por vez) pede os anteriores ao último item da lista; trocar filtro recomeça do zero e resposta atrasada é descartada.
- **Cliente que falha não esconde os outros:** aviso "Não deu para ler: …" acima da tabela. Erro geral mostra *Tentar de novo*, nunca lista vazia.
- A página não se embrulha em `AdminConteudo`: a rota já faz isso.
- **A ficha** do usuário marca as ações sensíveis do histórico com o mesmo selo *Sensível*.

## Chat de suporte (desde 2026-10-04)

Pedido do dono do produto, com o print do widget de suporte do site da Lais: o botão "Sugestões/Bugs" abria uma janela de mão única. Virou um **card de suporte** (spec `specs/2026-10-04-chat-de-suporte-design.md` na pasta LM FLOW).

O que aparece na tela:

- **Bolinha no canto** (ícone de chat) com contador de chamados com resposta não lida. Abre o card ancorado no canto, sem escurecer a tela; no celular, tela inteira. Esc, X ou a bolinha fecham.
- **Aba Início:** "Olá, {nome} 👋 / Como podemos ajudar?", **Falar com o time**, busca **Qual é a sua dúvida?** + perguntas do roteiro, **Reportar um bug**, **Dar uma sugestão**, **Falar no WhatsApp**. Busca sem resultado oferece falar com o time com o texto já escrito.
- **Roteiro:** resposta em balões; termina em **Isso resolveu?** (Sim volta ao Início; Não abre chamado com a pergunta como assunto).
- **Aba Mensagens:** chamados da pessoa, situação (**Aberto · Aguardando você · Resolvido**) e bolinha de não lido. O chamado aberto é um chat com prints (até 3, colar com Ctrl+V ou anexar). Resolvido mostra a faixa e deixa escrever de novo (reabre).
- **Menu do avatar:** "Sugestões/Bugs" virou **Ajuda e suporte**.
- **Link do e-mail** (`?suporte=<id>`) abre o card direto no chamado.
- **Fechar não perde o texto:** o card continua montado depois da primeira abertura e só fica escondido; o rascunho volta ao reabrir.

Decisões do dono (não reabrir sem ele pedir):

- Chamado respondido pelo **admin** (item Suporte), não pela tela Conversas da conta da Leal Mídia.
- **Cada pessoa vê só os próprios chamados**; o gestor não vê os do corretor.
- **Roteiro sem texto livre**: a pessoa navega por botões. Texto livre só dentro de chamado.
- Duas abas (Início, Mensagens); a "Ajuda" da Lais é o Guia do LM Flow, como botão nas respostas.

Armadilhas:

1. **O roteiro é dado:** `src/components/support/roteiro.ts`. O `roteiro.spec.ts` trava opção apontando pra passo que não existe, passo inalcançável e fim sem "Isso resolveu?". Texto puro, nome de tela como aparece na tela (conferidos com as telas reais: Reconectar / Dispositivos conectados → Conectar dispositivo; Imóveis → Meu site; "Preencher a partir de um texto"; o botão Plantão).
2. **A bolinha some em Conversas e nas telas de montar** (`escondeBolinha`, em `SupportWidget.tsx`): `/conversations` (`/conversations-old` não conta) e os canvas de `flow-builder`, `follow-ups` e `message-funnels/:id`. Regra herdada do FeedbackWidget antigo: a bolinha cobria o "Salvar". O acesso nessas telas é o menu do avatar (`openSupport`).
3. **Card fechado = `hidden` + `inert` + `aria-hidden`.** Nada nele recebe foco nem é lido por leitor de tela, e a busca de um chamado aberto **pausa** enquanto o card está fechado.
4. **No celular o card respeita áreas seguras e `--keyboard-inset`** (mesma fórmula do `MainLayout`): o teclado não cobre a caixa de texto.
5. **`useChamado` exige `carregar` memoizado por chamado** (`useCallback([id])`): função nova a cada render dispara a busca em loop. Só a requisição mais recente grava estado (resposta atrasada é descartada) e a caixa de texto fica travada enquanto envia.
6. **A conversa e a caixa de texto (`SupportThread`, `SupportComposer`) são as mesmas do admin.** Mexer nelas mexe nos dois lados.
7. **A regra das imagens existe duas vezes de propósito** (`imagensSuporte.ts` e `SupportTickets::Images` no servidor): aqui é pra recusar na hora; quem manda é o servidor (confere os bytes).
8. **Ao vivo (desde 04/10/2026, pedido do dono):** o servidor manda `support.updated` (só o `ticket_id`) pela ligação ao vivo única do app (`useGlobalWebSocket` → `ChatActionCableConnector`), que vira o evento de janela `lmflow:suporte` (`src/components/support/aoVivo.ts`). Escutam: o chamado aberto (cliente e admin, só se for o mesmo id), a lista de Mensagens com o card aberto, a lista do admin, a bolinha e o número de Abertos do menu. Todos recarregam pela API. A checagem periódica continua de reserva, caso a ligação caia: chamado aberto a cada 30 s (era 10 s), contadores a cada 2 min. ⚠️ Com a aba do navegador escondida o sinal fica guardado e só é entregue quando a pessoa volta (`useSinalSuporte`): abrir o chamado pela API marca como lido, e recarregar em segundo plano apagava o "não lido" de mensagem que ninguém viu.
9. **O card abre e fecha com movimento** (pedido do dono, 04/10/2026): no computador cresce a partir do canto da bolinha (`sm:origin-bottom-right`, `scale-95` → `scale-100`) e aparece; no celular sobe de baixo. 200 ms, igual ao menu lateral. Dois estados em `SupportWidget.tsx`: `visivel` tira o `hidden` e `entrou` liga as classes de "aberto". Abrir entra no frame seguinte (com o card já visível, senão o navegador pula a transição); fechar sai na hora e só põe `hidden` depois dos 200 ms. `inert`/`aria-hidden` seguem o `aberto`, sem esperar a animação. Com "reduzir movimento" no sistema, sem animação.
10. **Resposta do time aparece só como "Suporte"** (pedido do dono, 04/10/2026): o cliente nunca vê o nome de quem respondeu (`SupportThread`). No admin, as mensagens do time ficam do lado de quem olha, sem nome.
11. **Envio que falha deixa a frase embaixo da caixa** ("Não foi enviado. Confira a internet e tente de novo."), além do aviso do canto, e o texto fica. Origem: 04/10/2026, o servidor trocava de versão (publicação de outra frente), o envio esperou 15 s e voltou com 502, e o aviso do canto passou despercebido. Some na próxima tentativa.
12. **O "Recebemos!" fica logo abaixo da primeira mensagem** (`SupportThread` → `depoisDaPrimeira`), no lugar dele na conversa. Antes vinha depois da conversa inteira e, com as respostas chegando ao vivo, ficava grudado no fim, abaixo delas (print do dono, 05/10/2026).

**No admin** (item **Suporte**, `/admin/suporte`, 2º do menu da Área do Admin): lista de todos os clientes, abrindo em **Aberto**, com filtros de situação e tipo e **busca com 300 ms de espera** (debounce); destaque pra mensagem do cliente não lida. Ao lado do item no menu, o **número de Abertos** (busca a cada 2 min; 403 é silenciado, quem não pode ver não leva erro). O chamado (`/admin/suporte/:id`) tem a conversa espelhada (a tela rola até a mensagem mais nova), resposta com print (e "Resolver" ao enviar), situação, **nota interna** (o cliente não vê), **Entrar no cliente** (o mesmo SSO do cartão) e Arquivar. Os endereços antigos de Sugestões e bugs levam pra cá. Quem vê: `front_support?` no servidor (hoje o dono e as contas fantasma; a Equipe quando `SUPPORT_BY_TEAM_LIST` ligar). O item **Suporte** some dos dois menus (lateral e horizontal do celular) pra quem não é suporte (`useIsSuperAdmin`, o mesmo `is_support`), e o número de Abertos nem busca; o servidor é a trava de verdade, e se recusar (403) as telas mostram o aviso de acesso restrito.

Armadilhas do admin:

9. **O menu do avatar esconde "Ajuda e suporte" dentro da Área do Admin:** ela não monta o cartão de suporte, então o item não teria o que abrir (prop `semAjudaESuporte` do `ProfileMenu`).
10. **A nota interna só é preenchida quando o chamado muda.** A busca periódica nunca sobrescreve o que o admin está digitando. Entre dois admins editando a mesma nota, vale a última gravação (sem aviso de conflito, de propósito).
11. **`page_url` e o texto do cliente são sempre texto puro**, nunca HTML nem link montado a partir do que o cliente mandou.
12. **A tela antiga "Sugestões e bugs"** (`CustomerFeedbacks.tsx` e `customerFeedbackService.ts`) foi apagada; não recriar.

## Kit de boas-vindas no grupo do cliente (desde 2026-10-04)

Pedido do dono do produto: no onboarding de um cliente, mandar no grupo dele o link, o vídeo de como baixar o aplicativo e as imagens de como conectar o WhatsApp, com o envio disponível depois de o cliente ser criado. Spec: `LM FLOW/specs/2026-10-04-kit-boas-vindas-no-grupo-design.md`.

O que aparece na tela:

- **Área do Admin → Plataforma → aba *Kit de boas-vindas*** (`/admin/plataforma/kit-boas-vindas`): a mensagem (com `{nome}` e `{link}`, e *Voltar ao padrão*), o número que envia (Operacional (LM01) de fábrica), o vídeo (um, MP4 até 16 MB), as imagens (até 6, JPG ou PNG até 5 MB, com legenda e setas de ordem), a prévia com um cliente de exemplo e a barra de *Salvar*. Vale para todo cliente.
- **Clientes → Funções → bloco *Kit de boas-vindas***, logo abaixo de *Grupos WhatsApp*: o último envio (quando, quem, quantas peças e o motivo de cada falha), *Preparar envio* (para onde vai, com selo *Cadastrado na ficha* / *Reconhecido pelo nome*, e a prévia montada pelo servidor), e *Enviar no grupo (N peças)* com confirmação. Durante o envio, "Enviando 3 de 8…" com uma linha por peça.

Decisões do dono (não reabrir sem ele pedir):

- **Só em Funções por enquanto.** O assistente *Novo cliente* não ganhou etapa, e não há envio automático.
- **Um kit para todos**, montado na Plataforma, como os logos dos bancos.
- **Vai para o grupo oficial do cliente**, sem escolha manual: o cadastrado em *Grupos WhatsApp* vence o reconhecido pelo nome; o de logs nunca. Com dois pelo nome ou nenhum, o botão some e o motivo manda definir o grupo no bloco de cima.
- **O link é o endereço do CRM, nunca o link de acesso** (pessoal, uso único, 24h).

Armadilhas:

1. **A metade do backend é obrigatória e vem PRIMEIRO** (`lm-flow`, `saas-multitenant`, PR "Kit de boas-vindas no grupo do cliente (servidor)"). Contra o servidor antigo a aba mostra o erro de carga e o bloco o erro de leitura.
2. **O grupo só é buscado no clique** de *Preparar envio*; ao abrir a janela o bloco lê só o último envio. Buscar o grupo é conversar com o WhatsApp operacional.
3. **O envio roda no servidor**; a janela acompanha de 3 em 3 s (teto de 10 min) e pode ser fechada. Ao reabrir com envio rodando, o bloco volta a acompanhar sem mandar de novo. 409 = já tem envio rodando: o bloco acompanha esse.
4. **Texto igual ao padrão é gravado em branco** (vazio = padrão), para não travar o texto no dia em que o padrão da casa mudar.
5. **As regras moram em `src/pages/SuperAdmin/kitBoasVindasRegras.ts`**, com spec. O nome não é `kitBoasVindas.ts` de propósito: no Mac (sem diferença de maiúscula no nome do arquivo) `./KitBoasVindas` carregaria as regras no lugar da página.
6. **Não é `featureKey` nem `clientToggleKey`** — é configuração de plataforma. Os scanners do catálogo não entram nesta história.
7. **Envio interrompido** (o servidor reiniciou no meio): o servidor fecha como `interrupted` e o bloco mostra "Envio interrompido em … · 3 de 8 peças · 5 não saíram", com *Preparar envio* de volta. Peça que nem chegou a sair não conta como falha.
8. **O envio leva o grupo que a confirmação nomeou** (`expected_jid`). Se o grupo mudou desde a prévia, o servidor recusa e o bloco volta para *Preparar envio*.
9. **Kit nunca salvo mostra a barra de Salvar sem mexer**: quem só quer o texto padrão precisa conseguir salvar, senão Funções segue dizendo que o kit não foi montado.

## Conversa: menu "⋮" enxuto, Agendar mensagem e Agendados no painel (04/10/2026)

Pedido do Tony: o "⋮" do topo da conversa tinha 17 itens soltos, e não dava pra
agendar uma mensagem de dentro da conversa (só pelo card do lead). E quem abre a
conversa não via que havia mensagem agendada pra sair.

O que aparece na tela:

- **O "⋮" do topo da conversa**, nesta ordem: **Agendar mensagem** · **Ativar IA
  pra este lead** · **Marcar como não lida** (ou lida) · **Marcar como resolvida**
  (resolvida: **Reabrir conversa**) · **Status ▸** Pendente · Pausar conversa (✓
  no atual; pendente ou pausada, o submenu também tem **Reabrir conversa**) ·
  **Prioridade ▸** Urgente · Alta · Média · Baixa (✓ na atual; com prioridade,
  **Remover prioridade**) · **Fixar conversa** · **Arquivar conversa** ·
  **Atribuir ▸** Atendente · Time · Desvincular corretor / Desvincular equipe (só
  com vínculo) · separador · **Excluir conversa**.
- **Saiu "Atribuir etiqueta"**: a seção Etiquetas do painel do lead já faz isso.
- **Agendar mensagem abre a MESMA janela do "Agendar envio" do card do lead**
  (`ScheduleActionModal`, com o contato da conversa). Some na oferta da roleta (a
  janela mostra o telefone) e quando a função `card_schedule_action` está
  desligada pro cliente (a mesma chave do card).
- **Seção "Agendados" no painel do lead**, logo depois do Funil, com ícone verde.
  Só existe quando o lead tem mensagem agendada que ainda não saiu. Cada linha:
  quando sai ("Amanhã às 09:00", "14/10 às 14:30") e o começo da mensagem (~60
  letras; mídia vira "Imagem", "Áudio"...; sequência ganha "(+N)"), com o lápis
  (abre a mesma janela em modo edição, já preenchida) e o ✕ (pergunta "Cancelar
  esta mensagem agendada?" e cancela). A tela **Ações agendadas** continua fora
  do menu.

Decisões do dono (não reabrir sem ele pedir):

- Menu com submenus, não lista longa. Etiqueta só pelo painel.
- Agendar reaproveita a janela do card; não existe uma segunda janela de agendar.
- Agendados só aparece com agendamento pendente (sem "Nenhum agendamento").

Armadilhas:

1. **O "⋮" de verdade está no `ChatHeader`.** O `ConversationActionsDropdown`
   não é renderizado por nenhuma tela (órfão; ver o comentário no topo do
   `ChatHeader.spec`). Mexer nele não muda nada pro corretor.
2. **Submenu precisa do `DropdownMenuPortal`** em volta do
   `DropdownMenuSubContent`: o conteúdo do menu tem animação (transform) e
   `overflow-hidden`, e o submenu sem portal fica recortado dentro dele.
3. **As travas de cada item continuam nos handlers da página de Conversas**
   (`useConversationHandlers`/`useAssignmentHandlers`: permissão de excluir,
   desvincular, a pergunta de excluir). O menu só chama.
4. **Dados dos Agendados:** `GET /scheduled_actions?contact_id=&status=scheduled&action_type=send_message`
   (o índice do backend já filtra por contato, status e tipo; a janela cria por
   contato, sem `conversation_id`). Cancelar = `DELETE /scheduled_actions/:id`
   (vira `cancelled`); editar = `PATCH`. Regras de texto em
   `src/features/conversas/agendados.ts` (com spec); a seção em
   `painel/SecaoAgendados.tsx`.
5. **Quando relê:** ao trocar de lead, quando a conversa mexe
   (`last_activity_at`: a mensagem agendada que saiu some), a cada minuto, e no
   aviso `lmflow:agendados-mudaram` (`avisarAgendadosMudaram`), que o "⋮" e o
   "Agendar envio" do card disparam ao fechar a janela. Header e painel são
   irmãos na página; o aviso no `window` evita subir estado até o `Chat.tsx`.
   Só busca com o painel aberto e fora da oferta.
6. **Data na edição:** a janela lê `scheduled_for.slice(0, 16)`. Funciona porque
   o backend serializa no fuso de São Paulo (`-03:00`); navegador em outro fuso
   veria a hora de São Paulo.

## Visão Geral nova (04/10/2026)

Entrega 6 da Área do Admin (spec `LM FLOW/specs/2026-10-04-admin-visao-geral-entrega-6-design.md`). A Visão Geral tem três abas: **Atenção** (`/admin`, padrão), **Números** (`/admin/numeros`) e **Leads ao vivo**. A tela antiga (`Admin/Area/Overview.tsx`) saiu.

- **Situação do cliente é uma regra só, no servidor** (`Tenants::Situation`): arquivado vence; `error` = com erro; `suspended` = congelado; `trial` com menos de 15 min = provisionando; o resto = ativo. A lista de Clientes e os contadores da Atenção leem `situation` — não recalcular na tela. A lista ainda escreve "Suspenso" (trocar por "Congelado" é da entrega 3). Na lista de Clientes, ver arquivados mostra o selo "Arquivado".
- **Atenção** (`GET /super/overview/attention`, sem cache): número caído (régua `connection_status`, "desde" = `provider_connection.disconnected_at`), erro na criação, IA falhando (3+ falhas em 24 h), custo da IA fora do normal (24 h > 3× média de 14 dias **e** > R$ 10), aviso que não chega (`Notifications::Health`), chamado sem resposta. Vermelho primeiro. Cortes em `Overview::Attention`; texto e botão em `VisaoGeral/formatoAtencao.ts`. Cliente arquivado nunca aparece. Quando algum cliente não pôde ser lido e ninguém tem problema, a frase é "Nenhum problema nos N clientes conferidos" (nunca "Tudo em ordem").
- **Números** (`GET /super/overview/numbers?periodo=&tenant=&refresh=1`, cache de 5 min só quando todos os clientes foram lidos): leads = `contacts.created_at`; conversas = `conversations.created_at`; usuários ativos = sessão vista no período, sem equipe e sem desativado; sumidas = régua da lista de Usuários; IA = régua do Resultados; custo = mesma fórmula de Custos (o total soma todos os schemas, então bate com Custos → Todos). Comparação com o período anterior de mesmo tamanho ("Hoje" contra ontem até a mesma hora). Estrutura só em mês inteiro e sem cliente filtrado. No cartão Custo da IA a variação fica em cor neutra (custo subindo não é boa notícia). O gráfico usa as variáveis CSS direto (`var(--primary)`, `var(--border)`...) — os tokens são oklch, `hsl(var(--x))` fica invisível.
- **Erro ≠ vazio:** cliente que não deu pra ler aparece como "não deu pra ler" (nunca zero nem "em ordem"); falha geral é `EmptyState tipo="erro"`.
- Custos passou a aceitar `?tenant=&so_erros=1` (o botão "IA falhando" chega filtrado). O `so_erros` do endereço vale só na primeira carga: desmarcado, trocar o mês não liga de novo.
- O total do Custo da IA inclui gasto de clientes que não aparecem na tabela (arquivados, congelados), por isso a soma das linhas pode ser menor que o cartão — é proposital, bate com Custos → Todos.
- 'Pessoas que não recebem aviso' conta só quem aparece na lista de Usuários (sem equipe Leal Mídia e sem desativados).
- O tempo de 10 s conta desde o começo da leitura; cada consulta confere o tempo que sobra (cliente que estoura vira "não deu tempo de ler", nunca erro da tela). Sem nenhum cliente lido, os cartões de Números mostram "—" (só o Custo da IA fica, se veio); o "Atualizar" fica "Atualizando…" e travado enquanto lê.
- Não reabrir sem o dono pedir: o "ninguém usando" é número (aba Números), não alerta (decisão do Tony, 04/10).

## Funis novos em tudo: Disparos, disparo em massa, agendamento e a ação das Automações (05/10/2026)

Fecha a armadilha 8 da seção de 04/10: toda tela que ainda lia os funis antigos
(`messageFunnelsService`, `/message_funnels`) passou a ler os **funis de
conversa** (`GET /flow_automations?kind=conversation`, os do usuário + os da
equipe). Depende do backend `lm-flow` (PR "funis novos em tudo": a ação no
servidor e o `message_count` da lista) — **o backend entra primeiro**.

- **"Usar funil"** no **disparo em massa** do Funil de vendas
  (`BulkDispatchModal`) e no **Agendar envio** (`ScheduleActionModal`, por
  bloco): lista **Meus funis** / **Da equipe**, só os **ligados e com o passo a
  passo terminado** (mesma régua do "Disparar funil" da conversa), e carrega o
  escolhido no editor de sempre. Peça única: `ConversationFunnelSelect`
  (`components/flowAutomations`), que some quando não há funil pronto.
- **A conversão** (`features/flowAutomations/conversationFunnelDraft.ts`): os
  blocos a partir do primeiro (caminho principal) viram itens do editor
  (`SequenceDraftItem`). "Mandar WhatsApp" com arquivo → foto/vídeo/documento/
  áudio/figurinha (texto vira legenda só em foto, vídeo e documento — como o
  servidor manda); com contato → contato; só texto → texto; "Ação de lead" de
  envio também. **"Esperar" vira item "Aguardar" ANTES da mensagem seguinte**
  (esperas seguidas somam; espera no começo ou no fim cai fora). O editor e o
  servidor do disparo/agendamento cortam em **600 s**: espera maior entra como
  10 minutos. Bloco que não é mensagem (etiqueta, etapa, aviso), espera "até a
  data" e tipo que a tela não manda (o disparo em massa não manda **contato**
  nem **figurinha**) ficam de fora. Em todos esses casos sai um aviso
  (`draftNotice`) junto do "Funil carregado".
- **"Salvar modelo" saiu** dos dois modais: ele criava funil ANTIGO. A
  biblioteca agora é Funis de mensagem; no disparo em massa ficou o link
  **Montar funil** (abre Funis de mensagem em outra aba, pra não perder o que
  está montado). Se o dono quiser "salvar a sequência como funil" de volta, é
  criar o funil de conversa pelo servidor (só gestor cria do zero) — não
  reabrir sem ele pedir.
- **Disparos · aba Funis** (era "Cadências"): os funis de conversa com o número
  de mensagens (`message_count` da lista; `funnelMessageCount`), selo **Da
  equipe**, estado ("desligado", "falta terminar o passo a passo") e **Abrir em
  Funis de mensagem** (`/automations/message-funnels/:id`). Vazio: **Novo
  funil** leva pra Funis de mensagem.
- **Ação "Disparar funil de mensagens"** (regras das Automações e o bloco no
  construtor, o mesmo `ActionEditor`): **Qual funil**, com Meus funis / Da
  equipe e o estado no nome; grava `params.flow_automation_id` e **tira o
  `funnel_id`**. Saíram "Criar funil novo"/"Editar funil" (o editor antigo):
  ficou o link pra Funis de mensagem (outra aba) e **Recarregar a lista**. A
  ação antiga (`funnel_id`) abre com a faixa **"(formato antigo)"** e o nome do
  funil antigo, e continua disparando igual até alguém trocar. O resumo do
  cartão diz "Funil: X" ou "Funil: X (formato antigo)".
  - Obrigatório: `flow_automation_id`; a ação antiga com só `funnel_id` segue
    completa (`missingActionParams` tem o caso especial).
  - `AutomationResources` ganhou `conversationFunnels`; `messageFunnels`
    (antigos) ficou só pra dar nome à ação no formato antigo.

O que ainda usa o serviço antigo no frontend:

1. `LeadAutomationsEditors` → `messageFunnelsService.list` só pra mostrar o
   nome na ação "(formato antigo)".
2. `tenantTemplateVariablesService` (mesmo arquivo do serviço antigo): as
   **Variáveis de mensagem** — não é funil, fica.
3. `pages/Customer/Settings/MessageFunnels` e `components/messageFunnels/
   MessageFunnelEditor`: **código sem rota** (a rota antiga leva pra página
   nova). Dá pra apagar num PR de faxina.

## IA Vendedora · casca nova: barra de topo, Painel primeiro e veredito único (desde 2026-10-05)

> Entrega 1 da refatoração da IA Vendedora. Spec: `LM FLOW/specs/2026-10-05-ia-vendedora-refatoracao-design.md`; plano: `LM FLOW/plans/2026-10-05-ia-vendedora-entrega-1-casca.md`. Só tela: nenhuma IA muda de atendimento.

**O que aparece na tela:** barra de topo própria, no modelo do Meu site: o seletor da IA (nome + ▾, com o veredito de cada IA e *Nova IA* no fim da lista), o selo do veredito da IA aberta e os menus *Painel ▾* (*Visão geral*, *Sugestões*, *Relatório semanal*) · *Configurar* · *Ensinar* · *Testar* · *Diagnóstico*, mais *Mais ações* (⋯) com *Duplicar esta IA* e *Excluir IA*. A lista de IAs à esquerda e as 8 abas saíram.

- *Visão geral* abre primeiro: *O que precisa de atenção* (cada pendência com *Corrigir*), *Números do período* (o painel da antiga aba Resultados; sem números, diz o motivo) e até 3 sugestões esperando resposta, com *Ver todas*.
- *Configurar* é a página de configuração de sempre, inteira, com o nome e a caixinha *Ativa* em cima (até a entrega 2).
- *Ensinar* junta *O que ela sabe* (Base de Conhecimento) e *Regras e exemplos* (Aprendizado).
- *Testar*, *Sugestões*, *Relatório semanal* e *Diagnóstico* são as abas de antes, movidas.

**Decisões (não reabrir sem o dono pedir):**
1. Endereço `/ia-vendedora?ia=<id>&tela=<id>`, sempre com `replace` (o Voltar sai da página). Sem `tela`, Visão geral. Fonte única das telas: `src/features/salesAgents/iaMenu.ts`.
2. Com várias IAs, abre a última usada neste navegador (`localStorage` `lmflow:ia-vendedora:ultima`, com `try/catch`); senão, a primeira.
3. Veredito único (`src/features/salesAgents/situacao.ts`): *Atendendo* · *Parada: <motivo>* · *Atendendo com restrição: só …* · *Desligada* · *Rascunho* (na entrega 1, desligada e sem número). Calculado da IA + `GET /sales_agents/:id/diagnostics`, espelhando o `SalesAgents::TriggerGate` (quem ela atende) e o `SalesAgents::HealthCheck`. Só os itens `inbox`, `mode`, `credentials` e `api_key` do Diagnóstico param a IA; os outros erros viram pendência.
4. Gatilho que restringe aparece no selo (laranja) e como pendência, mesmo com a linha *Gatilhos* do Diagnóstico verde (o servidor não mudou).
5. Follow-up ligado com máximo 0 vira a pendência laranja *Follow-up sem limite de tentativas*. As IAs que já estão assim continuam iguais.
6. Sugestões e Relatório semanal seguem a chave `ia_insights` (a Leal Mídia sempre vê): sem ela somem do Painel, o endereço cai na Visão geral e a Visão geral nem lê as sugestões.

**Armadilhas:**
1. **O `?agent=<id>` continua valendo**: é como o assistente (`/ia-vendedora/:id/assistente`) devolve. Abre a IA em Configurar e vira `?ia=&tela=configurar`. Quem mexer no assistente antes da entrega 2 não troca esse retorno.
2. **Duplicar abre a cópia na hora:** põe a cópia na lista, seleciona a cópia (`setSelected(copy)`) e só então aponta o endereço pra ela. Sem a seleção, durante a recarga da lista a tela Configurar mostrava a IA original e um Salvar gravava nela; sem a cópia na lista, a resolução do endereço voltava pra original (`SalesAgents.casca.spec.tsx`).
3. **Specs que leem o código leem a pasta inteira** (`src/test/fonteDaIaVendedora.ts`: casca primeiro, sem o `assistente/` e sem specs). Campo novo no `saveAgent` continua no `SalesAgents.tsx`; frase nova de uma seção mora no arquivo dela, em `configuracao/legado/`.
4. **`configuracao/comum.tsx`** (`Toggle`, `CheckRow`, `InboxOption`, `PipelineOpt`, `StageOpt`) fica FORA de `legado/` porque a Base de Conhecimento usa o `CheckRow`: a entrega 2 apaga o legado sem quebrar o Ensinar.
5. **O Diagnóstico da IA aberta é lido ao abrir a página** (antes, só ao abrir a aba) e relido quando a IA é salva (`updated_at`), nunca a cada tecla. A tela Diagnóstico continua lendo por conta própria.
6. Nenhuma chave de funcionalidade nova: `useClientToggle('ia_insights')` continua literal no `SalesAgents.tsx` e `useClientToggle('ia_playbook')` no `ConfigLegado.tsx`.
7. **O Diagnóstico guardado leva o id da IA** (`{ id, report }`) e só vale pra IA aberta: ao trocar de IA, o selo não herda o veredito da anterior enquanto o da nova carrega (`SalesAgents.casca.spec.tsx`).
8. **Trocar de IA remonta a tela** (`key={selected.id}` no contêiner das telas, `SalesAgents.tsx`): Testar, números da Visão geral e Sugestões nunca carregam da IA anterior (a conversa de teste de A não vai pra B). Quem tirar o `key` traz o vazamento de volta (`SalesAgents.casca.spec.tsx`).
9. **Diagnóstico que não carrega não vira "tudo certo":** se a leitura falha (502, perfil sem `sales_agents.diagnostics`), a Visão geral diz *"Não consegui conferir a situação desta IA agora."* no lugar de *"Nada pendente"*; as pendências que a própria configuração mostra continuam aparecendo e o selo segue só na configuração.

## Canal WhatsApp: mensagem para quem liga é opcional e vem vazia (05/10/2026)

Caso real: o Leonardo (Mais que Imóveis) desligou "Rejeitar chamadas" e o cliente que ligava continuava recebendo "Não aceito chamadas" no WhatsApp.

- **A Evolution manda o texto pra todo mundo que liga, com a rejeição ligada OU desligada.** São duas checagens separadas no servidor dela. Por isso a mensagem só pode existir com a rejeição ligada, e em branco não manda nada.
- **Vazia de fábrica**, na criação do canal (antes vinha "I do not accept calls", em inglês) e na tela de configuração (antes "Não aceito chamadas"). Ao abrir a tela, campo vazio continua vazio. Antes o texto de fábrica reaparecia e voltava a ser gravado no próximo salvar.
- **Rejeição desligada = mensagem vazia na gravação**, aqui e no servidor (`Evolution::CallMessage`, backend). O campo esconder não basta: era exatamente o texto escondido que ia pra Evolution.
- Não reabrir "voltar com um texto padrão" sem o dono pedir.

## Modelos de página de anúncio (D1) (05/10/2026)

Três modelos prontos no assistente "Criar com assistente" (passo 1, grupo "Modelos prontos"): **Lançamento**, **Revenda** e **Aluguel**.

- **Os modelos vivem no código**, não no banco: `src/features/landing/modelos/modelosDeAnuncio.ts` (blocos, tema e frase) e `perguntas.ts` (perguntas de Revenda e Aluguel). Cada chamada de `blocos()` gera ids novos. Mudar um modelo não mexe em página já criada: a página ganha uma cópia dos blocos e do tema na criação.
- **Formulário na primeira tela do celular.** Todo modelo começa com a capa com `formInHero` ligado e o `lead_form` logo depois. O formulário aparece dentro da capa, sem rolar.
- **O cartão do formulário dentro da capa usa a cor de fundo do bloco** (`blockBg` do tema), não a do fundo da página.
- **`#lp-lead-form` fica só no primeiro formulário visível da página.** Se houver dois, o segundo segue no lugar dele, sem o id.
- **A página larga no computador só existe com o formulário na capa.** Sem `formInHero`, ou sem formulário visível, a página volta à coluna estreita de 460px, igual a de antes.
- **A prévia do editor é de celular**, mesmo no computador: a página larga só aparece na página publicada.
- **Imóvel é obrigatório** para criar por modelo. Cria sempre com `createForProperty` (nunca `getOrCreateForProperty`): **um imóvel pode ter várias páginas de anúncio** (teste A/B). O atalho no cadastro do imóvel continua abrindo a primeira.
- **O modelo nunca troca sozinho.** Se o imóvel combina mais com outro (`modeloSugerido`: locação ou temporada = Aluguel, empreendimento = Lançamento, o resto = Revenda), aparece uma linha com o botão "Trocar". Quem decide é a pessoa.
- **Fase da obra nasce escondida no Lançamento**, porque o percentual é manual. As perguntas de Revenda e Aluguel só pesam, não desqualificam.
- As fontes dos temas são as da lista `FONTES_DO_SITE`; a landing usa a mesma lista do site.

## Modelo do site (D2) (05/10/2026)

Nova tela **Modelo do site** (primeira de "Personalizar"): três cartões, **Clássico**, **Editorial** e **Popular**, cada um com uma miniatura em HTML/CSS pintada com as cores do próprio cliente.

- **O modelo muda só o visual.** Grava fonte, `appearance` (fonte dos títulos, fundo, topo, faixa de cima, capa, menu, cartões e rodapé), `listing.card_layout`, `home.callouts.layout` e o liga/desliga de "Como funciona" e "Atendimento". Os modelos vivem no código (`src/features/siteBuilder/modelosDoSite.ts`).
- **Preserva sempre:** cores, logo, `logo_light_url`, a frase do rodapé, o filtro da capa, a busca, as vitrines, as chamadas próprias, os mais buscados, o menu e os textos já escritos. O Popular só preenche os 4 passos de fábrica (`PASSOS_MCMV`) se a lista estiver vazia; o Editorial só usa os textos de fábrica do Atendimento se o título estiver em branco.
- **Nada vai pro ar antes do Salvar.** O botão "Usar este modelo" pede confirmação, chama `setF` uma vez e avisa "Modelo aplicado. Confira em Ver prévia e clique em Salvar."
- **Editorial e Popular usam a capa dividida** (texto e busca de um lado, foto do outro). Com ela, o topo da home fica sólido em vez de transparente.
- **"Em uso" só quando bate tudo.** `modeloAtual` compara só as chaves da tabela do modelo (não cores nem textos; em passos e Atendimento, só o liga/desliga). Se o cliente mexer em uma, nenhum cartão fica "Em uso".
- **Vindas das tarefas anteriores:** a fonte dos títulos carrega como um segundo link do Google Fonts; a classe `font-[var(--display)]` ganhou uma regra global de `font-family`, porque no Tailwind 4 ela compilava para `font-weight`; o menu em maiúsculas vale só no computador; as seções novas "Como funciona" e "Atendimento" ficam na tela "Página inicial · Mais seções".
- **Vitrine "Minha Casa Minha Vida":** o modelo Popular não cria vitrine (isso é conteúdo). A regra `mcmv` está disponível em Vitrines.
