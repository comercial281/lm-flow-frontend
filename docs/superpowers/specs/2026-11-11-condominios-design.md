# Condomínios: cadastro do prédio e unidades plugadas — design

> 11/11/2026. Desenho fechado com o Tony na conversa de 11/11 (brainstorming).
> Repos: `backend/` (base `saas-multitenant`) e `frontend/` (base `main`). Dois PRs, o backend entra primeiro. Merge = deploy: confirmar com o Tony antes de cada um.
> Referência visual: o "Novo Condomínio, Edifício ou Lançamento" e a lista "Condomínios e lançamentos" do Kenlo IMOB (prints na conversa). O LM Flow copia a ideia, não a tela nem a lista de ~150 campos.

## Por quê

No Kenlo o condomínio é o prédio "pai": endereço, infraestrutura, lazer, segurança, fotos das áreas comuns e contatos de zelador/portaria moram nele, e cada unidade de revenda é ligada a ele e herda isso. No LM Flow não existe esse pai: quem cadastra o 5º apartamento do mesmo prédio refaz endereço, comodidades e fotos do prédio à mão, e quando algo do prédio muda (portaria vira 24h) cada anúncio fica desatualizado do seu jeito.

Primeiro caso real: a MQI (Mais Que Imóveis) saindo do Kenlo com 512 condomínios cadastrados lá. **A migração desses 512 NÃO entra aqui**: primeiro sai a tela, a migração é a entrega seguinte.

## Decisões do Tony

1. **Plugar é opcional.** Na unidade, a pessoa pode continuar preenchendo tudo à mão ou plugar num condomínio.
2. **Vínculo vivo:** mudou o condomínio, mudam na hora todas as unidades plugadas (inclusive o que aparece no site, nos portais e pra IA).
3. **Primeiro a tela, depois a migração** da MQI e mais campos/dados ("vamos primeiro criar e depois melhorar, trazer mais campos e dados").
4. **Permissão:** criar/editar/excluir condomínio é do gestor por padrão; o corretor pode, se o gestor liberar no cargo dele.
5. **O nome do condomínio vai pra fora** (Tony, 11/11: "sim, ok"): aparece na página do imóvel no site, vai pros portais onde o formato do XML tem campo de nome do prédio/condomínio (onde não tem, nada; não mexer na descrição) e entra na busca da IA (lead pergunta "tem algo no Edifício Aurora?" e a IA acha as unidades plugadas). Construtora, incorporadora, administradora e ano de construção ficam internos por enquanto.
6. Continua valendo a decisão de 02/10 (seção "Imóveis: Empreendimentos e Revenda" do `frontend/CLAUDE.md`): **pra fora, cada unidade continua sendo "um imóvel"**. Site, portais e IA não passam a conhecer "condomínio" como coisa própria; recebem a unidade com os dados do prédio já juntos.

## Chamadas minhas (o Tony pode vetar ao ler)

- **Só Revenda e Leilão plugam** (Leilão usa as mesmas seções da Revenda, conferido em `secoesDoCadastro.ts`). Empreendimento já é o prédio inteiro; plugar um empreendimento num condomínio duplicaria cadastro.
- **O condomínio não é anúncio:** não tem situação de venda, não vai pro site sozinho, não entra em XML, a IA não oferece "o condomínio".
- **Comodidades:** a lista "do condomínio" que já existe (`CONDO_FEATURES`, 17 itens) ganha ~12 itens comuns em anúncio residencial: Portão eletrônico, Quadra de tênis, Brinquedoteca, Salão de jogos, Espaço pet, Coworking, Lavanderia coletiva, Vaga para visitantes, Churrasqueira (condomínio), Piscina infantil, Piscina aquecida, Sala de cinema. Os ~150 do Kenlo ficam pra depois. Slug novo entra no `amenities.ts` (frontend) e nos 5 pontos do backend: `AI::PropertyExtractor` (lista branca), `PropertyTextParser::CONDO_TERMS` (**obrigatório**: é ele que faz a busca da IA procurar em `condo_features` e não em `features`, `catalog_search.rb:553`), `SalesAgents::PropertyFeatures`, `SalesAgents::LeadWishes` e `ChavesNaMaoSerializer::COMMON_ITEMS`. Portal que não conhece o item simplesmente não manda.
- **Onde mora:** aba **Condomínios** na tela de Imóveis, sempre a última (depois de Leilão quando ela aparece). Não é um `ListingKind`: a contagem e a lista dela vêm do endpoint próprio, fora do `contarPorTipo`.
- **Unidade que vem do site do cliente (fonte ligada) não pluga.** O campo Condomínio aparece desligado com "Este imóvel vem do site <fonte>: endereço e comodidades vêm de lá". Motivo: o leitor VRSync (Kenlo, Jetimob…) trava todos os campos herdáveis e o da Basel trava parte do endereço, o que daria endereço misturado. Desligou a fonte, pluga.
- **Condomínio de casas (horizontal):** a unidade herda o endereço, mas o **alfinete continua da unidade** (nasce no ponto do condomínio e pode ser arrastado). Em Prédio e Comercial o alfinete trava.
- **Fotos do condomínio e a capa:** se a unidade não tem foto própria, a primeira do condomínio vira a capa no site e nos portais (melhor que anúncio sem foto). Os contadores internos ("sem foto" da Dashboard e a nota do anúncio) contam **só as fotos da unidade**, pra continuar cobrando a foto do apartamento.
- **Mudança no condomínio não conta como "imóvel atualizado".** Propagar não mexe no `updated_at` da unidade, então ela não sai do Desatualizado nem sobe em "atualizados recentemente" sem ninguém ter conferido o preço.

## O que aparece na tela

### Imóveis → aba Condomínios (lista)
- Contagem na aba como as outras.
- Botão **+ Novo condomínio** (só para quem tem a permissão nova).
- Busca por nome/bairro; filtro de cidade. Sem o filtro retrátil grande das outras abas por enquanto.
- Linhas com: **Nome**, **Endereço** (rua, nº), **Bairro**, **Cidade**, **Unidades** (quantas plugadas, sem contar excluídas), **À venda** (plugadas com situação Disponível/Reservado), **Vendidas**, **Atualizado**. Clicar abre o cadastro (quem não pode editar abre em leitura).
- Vazio: convite explicando pra que serve ("Cadastre o prédio uma vez e plugue os apartamentos nele: endereço, lazer e fotos das áreas comuns vêm junto").

### Cadastro do condomínio
Mesmo esqueleto visual do cadastro de imóvel (seções empilhadas, mesmo componente de endereço/mapa, mesmo upload de fotos).

1. **Básico:** Nome* · Tipo (Prédio/vertical · Condomínio de casas/horizontal · Comercial) · Construtora · Incorporadora · Administradora · Ano de construção · Observação interna (só a imobiliária vê).
2. **Localização:** CEP → rua, número, bairro, cidade, UF, alfinete no mapa (reusar a seção do imóvel). Rua, cidade e UF obrigatórios.
3. **Comodidades do condomínio:** as caixinhas de `CONDO_FEATURES` (com os itens novos).
4. **Fotos das áreas comuns:** upload, ordem, capa igual ao imóvel.
5. **Contatos:** linhas com Nome · Cargo (Zelador, Porteiro, Síndico, Administradora, Outro) · Telefone · E-mail, "+ Adicionar contato", remover. Uso interno; não vira contato do CRM, não vai pra lugar nenhum fora do cadastro.
6. **Unidades plugadas** (só na edição): lista com código, título, situação, link pro imóvel.

Salvar com unidades plugadas: as unidades atualizam na hora (sem pergunta extra; o aviso fixo no topo do cadastro diz "Mudanças aqui valem para as N unidades plugadas").

**Excluir condomínio:** confirmação com o número de unidades plugadas. As unidades **desplugam e ficam com a cópia** do que herdaram, destravada. Nada some do anúncio.

### Cadastro da unidade (Revenda)
- Na seção **Localização**, primeiro campo: **Condomínio (opcional)** com busca por nome. Quem tem a permissão vê também "+ Cadastrar condomínio" (abre o cadastro e volta com ele escolhido).
- **Plugado:**
  - Endereço do prédio (CEP, rua, número, bairro, cidade, UF, alfinete) aparece preenchido e **travado**, com o aviso "Vem do Condomínio X · editar no condomínio" (link). **Complemento** (apto, bloco, casa 12) continua livre e é da unidade.
  - Em **Características**, a lista do condomínio aparece marcada pelo prédio e travada com o mesmo aviso. A lista "do imóvel" (varanda, armários etc.) continua livre.
  - Em **Fotos e vídeos**, debaixo das fotos da unidade, uma faixa só de leitura: "Mais N fotos do condomínio entram depois destas no site e nos portais".
  - Tudo o mais (valores, quartos, metragem, proprietário, descrição…) segue livre como hoje.
- Ao plugar, o que a pessoa já tinha digitado nesses campos é substituído pelo do condomínio (aviso antes de confirmar se havia algo diferente).
- **Desplugar** ("Tirar do condomínio"): a unidade fica com a cópia do que estava herdado, destravada.
- **Campo travado pelo site do cliente vence o condomínio.** Se a unidade vem de uma fonte de site (`feed.locked_fields`) e o campo é travado pela fonte, o condomínio não escreve nele; o aviso do campo continua sendo o do site. O condomínio preenche só os campos livres.

### Lista de Revenda
Sem mudança obrigatória. (Opcional, se barato: o nome do condomínio debaixo do endereço.)

## Permissão

- Chave nova: `condominiums.manage` (criar, editar, excluir condomínio).
- Ver a aba e a lista: quem tem `properties.read`.
- Plugar/desplugar uma unidade é editar a unidade: `properties.update`, com o mesmo alcance de hoje (quem pode editar um imóvel pode plugá-lo; hoje `update` não recorta por captador/responsável e esta entrega não muda isso). Sem `condominiums.manage`, a pessoa pluga em condomínio existente, mas não cria nem edita condomínio.
- Semente: a chave entra nos cargos `administrador`, `gerente` e `diretor` de todo schema (inclusive `public`), uma vez, com marca própria em `schema_migrations` (mesmo padrão do `lmflow_seed_corretor_scheduling` no `RoleSeederService`). `corretor`, `consultor` e `recepcionista` nascem sem; o gestor liga na tela de cargos. Cargo criado pelo cliente não é tocado.
- A chave aparece na tela de cargos/permissões junto das de Imóveis, com o texto "Cadastrar e editar condomínios dos imóveis (muda o anúncio de todas as unidades plugadas)". Não confundir com o condomínio mensal da Locação (`LocacaoCondominio`, `Api::V1::Locacao::CondominiosController`): nomes de classe, rota e permissão novos não podem colidir nem ficar ambíguos com os dela.

## Como funciona por dentro (restrição, não sugestão)

**Herança por cópia no salvar, não por leitura.** Os campos herdados (endereço do prédio + `condo_features`) são **gravados nas colunas da própria unidade** quando ela é plugada e sempre que o condomínio é salvo. Motivo: hoje site (`site_controller`), portais (`real_estate/feeds/*`), IA (`sales_agents/catalog_search` filtra por SQL em `condo_features` e endereço) e importadores leem essas colunas direto. Copiando, nenhum deles muda e a busca da IA continua funcionando sem join. Também deixa a volta de versão segura (ver abaixo).

- Tabela nova `condominiums` (por schema): nome, tipo, construtora, incorporadora, administradora, ano, observação interna, endereço completo + lat/long, `condo_features` (jsonb array de slugs), `contacts` (jsonb), timestamps, `discarded_at` (excluir = soft delete, como imóvel).
- Fotos do condomínio: tabela/anexo próprio no mesmo padrão de `PropertyPhoto` (Active Storage, `TenantMediaUrl`). **As fotos não são copiadas** pra unidade (arquivo duplicado por unidade não escala). Elas entram na leitura, depois das fotos da unidade, em todo lugar que hoje monta a galeria da unidade pra fora: página do imóvel no site, XMLs dos portais e envio de fotos pela IA. O builder mapeia esses pontos; o critério é "onde a unidade mostra foto pra fora, as do condomínio vêm depois".
- `properties.condominium_id` (uuid, nulo, índice). O nome do condomínio pode ir por join ou por cópia na unidade (decisão do builder); se for cópia, propaga junto com o resto e também não toca `updated_at`. Na IA, o texto do imóvel (`SalesAgents::PropertyFeatures` ou equivalente) cita o condomínio e a busca do catálogo (`catalog_search`) casa pelo nome. Só Revenda (e Leilão, se for o mesmo cadastro) aceita.
- **O servidor garante a trava**, não só a tela: update de unidade plugada ignora (ou recusa com mensagem clara) os campos herdados.
- Salvar o condomínio propaga pras unidades plugadas na mesma transação, **sem tocar `updated_at` da unidade** (`update_columns` ou equivalente; o Desatualizado, `Property.stale`, e a ordenação `sort=updated` leem essa data).
- **Sinal pros portais:** como a unidade não muda de data, os serializers de XML usam, pra unidade plugada, a maior entre a data dela, a do condomínio e a das fotos do condomínio (Chaves na Mão usa `photo.updated_at`; OpenNavent o maior `updated_at` dos imóveis). Foto nova no prédio tem que fazer o portal re-ler as unidades.
- Unidade excluída (`discarded_at`) não conta nem recebe propagação.

## Fora desta entrega

- Migração dos 512 condomínios da MQI vindos do Kenlo (próxima entrega; ela pluga os imóveis que vieram de lá).
- Os ~150 itens do Kenlo, campos de lançamento (status comercial, sistema de vendas, plantão, fase da obra, valor mín/máx, hotsite, arquitetura, paisagismo, fachada, padrão), tour virtual, arquivos do condomínio.
- Quadro de unidades, "com proposta", controle unidade a unidade.
- Condomínio como página própria no site, ou a IA falar "do condomínio" como entidade.
- Plugar Empreendimento.
- MCP: nada novo nesta entrega.

## Volta de versão (para a armadilha 4 do `LM FLOW/CLAUDE.md`)

Tabela e coluna novas, inofensivas pro código antigo. Como os dados herdados estão copiados nas colunas da unidade, voltar o backend mantém endereço e comodidades nos anúncios; só somem as fotos do condomínio das unidades (no site e portais) e a tela de Condomínios dá erro: voltar a tela junto. Não rodar `down` que apague a tabela.

## Entrega

1. **Backend** (`saas-multitenant`): tabela, coluna, model, fotos, CRUD `/api/v1/condominiums`, plug/unplug no update da unidade, propagação, trava no servidor, galeria com fotos do condomínio nos pontos de saída, permissão + semente, specs. Conferir número de migration contra todas as branches do origin na hora do merge.
2. **Frontend** (`main`): aba, lista, cadastro, campo na unidade com travas (estender o `CamposTravadosContext` com o motivo "condomínio"), faixa de fotos, permissão na tela de cargos, itens novos em `amenities.ts`, seção nova no `frontend/CLAUDE.md`.

## Deixado ao builder

Nomes de rota e componentes, formato exato do jsonb de contatos, se a propagação roda inline ou em job (inline se o volume por condomínio for baixo, que é o caso), layout fino da lista e do cadastro dentro do padrão da casa, se Leilão entra (confirmar no código se é o mesmo formulário de Revenda).
