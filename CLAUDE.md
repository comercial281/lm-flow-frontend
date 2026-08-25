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
