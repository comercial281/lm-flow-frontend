# Condomínios — frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba Condomínios em Imóveis, cadastro do condomínio (com fotos das áreas comuns) e o campo "Condomínio (opcional)" no cadastro da unidade de Revenda/Leilão, com os campos herdados travados.

**Architecture:** Regras em `src/features/properties/condominios/` com spec; telas em `src/pages/Customer/Properties/condominios/`; serviço próprio. A trava do condomínio reaproveita `CamposTravadosContext` (lista somada site + condomínio) e ganha um contexto de motivo para o texto de cada campo.

**Tech Stack:** React + Vite + TS, Vitest + RTL, pnpm.

**Spec:** `LM FLOW/specs/2026-11-11-condominios-design.md`. Contrato do servidor: `LM FLOW/specs/2026-11-11-condominios-plano-backend.md` (Tasks 2, 4 e 5 definem as rotas e o JSON). Repo `LM FLOW/frontend`, worktree a partir de `origin/main`, branch `claude/condominios`. Copiar este plano para `docs/superpowers/plans/2026-11-11-condominios.md` no worktree.

## Global Constraints

- Só começa depois do PR do backend existir; o PR do frontend só é mergeado depois do backend estar no ar. **Não mergear**: abrir o PR e parar.
- Texto em pt-BR literal (as telas de Imóveis não usam i18n), frase com só a primeira maiúscula ("Novo condomínio"), sem palavra técnica na tela ("slug", "label", "tag"…), Excluir (nunca apagar/deletar).
- Peças da casa: `Pagina` + `BaseHeader`, `Abas` (um nível só, Condomínios é irmã das outras abas, sem sub-aba), `Seletor`, `Checkbox`, `Aviso`, `EmptyState`, `Carregando`, `useConfirmacao` (nunca `confirm()`), `Tabela`/`LinhaDaTabela`/`Celula` de `Campanhas/TabelaDaTela.tsx`, formato por `@/lib/formato`. Nada de botão solto: o link "editar no condomínio" mora dentro do aviso.
- Sem `featureKey` nem `clientToggleKey` novos (vive debaixo de `properties`).
- Permissão: `useCan()('condominiums','manage')` para criar/editar/excluir condomínio e subir/mexer em foto dele; ver é `properties.read`.
- Rotas: `/properties/condominios/novo`, `/properties/condominios/:id`, `/properties/condominios/:id/fotos`. Cada uma também em `src/routes/permissionRoutes.ts`; as duas de cadastro entram no `ROTA_RECOLHE_MENU` (`src/components/layout/menuRecolhidoEm.ts:12`).
- Aba na URL: `?aba=condominios`.
- Textos fixos (copiar exatos):
  - aviso no cadastro do condomínio: `Mudanças aqui valem para as {N} unidades plugadas.` (N=1: `para a unidade plugada`; N=0 não mostra)
  - aviso na unidade plugada: `Vem do condomínio {nome}.` + link `Editar no condomínio` (só com a permissão)
  - dica por campo travado pelo condomínio: `Vem do condomínio: mude no cadastro do condomínio.`
  - unidade com fonte de site: campo desligado com `Este imóvel vem do site da imobiliária: endereço e comodidades vêm de lá.`
  - faixa de fotos: `Mais {N} fotos do condomínio entram depois destas no site e nos portais.` (N=1 no singular)
  - vazio da aba: título `Nenhum condomínio ainda`, texto `Cadastre o prédio uma vez e plugue os apartamentos nele: endereço, lazer e fotos das áreas comuns vêm junto.`
  - excluir: `Excluir o condomínio {nome}?` / `As {N} unidades plugadas ficam com o endereço e as comodidades de hoje e passam a ser editadas nelas.`
  - plugar com dado diferente: `Plugar em {nome}?` / `O endereço e as comodidades do condomínio substituem os que estão nesta unidade.`
- Novos itens em `CONDO_FEATURES` (slug → rótulo): `portao_eletronico` Portão eletrônico, `quadra_de_tenis` Quadra de tênis, `brinquedoteca` Brinquedoteca, `salao_de_jogos` Salão de jogos, `espaco_pet` Espaço pet, `coworking` Coworking, `lavanderia_coletiva` Lavanderia coletiva, `vaga_visitantes` Vaga para visitantes, `churrasqueira_condominio` Churrasqueira, `piscina_infantil` Piscina infantil, `piscina_aquecida` Piscina aquecida, `cinema` Sala de cinema.
- Testes: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run <arquivos>`; build completo `pnpm build` (roda as travas da casa) no fim.

## Review Focus

1. **Voltar da aba Condomínios para a mesma aba de antes** (`trocarAba` tem `if (k === kind) return`) → a lista de imóveis volta a aparecer. Teste na Task 3.
2. **Unidade plugada aberta com o servidor sem `condominium` no JSON** (backend velho) → cadastro abre normal, sem campo travado, sem quebrar. Teste na Task 5.
3. **Trocar de condomínio A para B na mesma unidade sem salvar** → travas e textos passam a ser de B; tirar do condomínio destrava tudo na hora. Teste na Task 5.
4. **Condomínio horizontal** → alfinete continua arrastável na unidade e o texto do mapa não diz que vem do site. Teste na Task 5.
5. **Usuário sem `condominiums.manage`** → vê a aba e abre o condomínio só em leitura (campos desligados, sem Salvar/Excluir/foto). Teste na Task 4.

---

### Task 1: Serviço, tipos e comodidades novas

**Files:**
- Create: `src/services/condominiums/condominiumsService.ts`
- Modify: `src/services/propertyPhotos/propertyPhotosService.ts` (base da URL vira parâmetro: exportar `criarServicoDeFotos(base: (id: string) => string)` e manter `propertyPhotosService = criarServicoDeFotos(id => `/properties/${id}/photos`)` com o mesmo comportamento)
- Modify: `src/services/properties/propertiesService.ts` (`Property.condominium`, `PropertyFormData.condominium_id`)
- Modify: `src/features/properties/amenities.ts`, `src/features/properties/amenities.spec.ts`
- Test: `src/services/condominiums/condominiumsService.spec.ts`

**Interfaces:**
- Produces:
  - `type CondominiumKind = 'vertical'|'horizontal'|'commercial'`; `ROTULO_DO_TIPO: Record<CondominiumKind,string>` = Prédio · Condomínio de casas · Comercial.
  - `interface CondominiumContact { name: string; role: 'zelador'|'porteiro'|'sindico'|'administradora'|'outro'; phone: string; email: string }`
  - `interface CondominiumRow` e `interface Condominium` com os campos do backend (Task 2 do plano do backend); `interface CondominiumFormData` = campos editáveis (nomes iguais aos do servidor, endereço igual ao do imóvel, `location_source`).
  - `condominiumsService`: `list(params: {q?, city?, page?, per_page?}) -> Promise<{data: CondominiumRow[]; meta: {total; page; per_page; cities: string[]}}>`, `get(id) -> Promise<Condominium>`, `create(data) -> Promise<Condominium>`, `update(id, data) -> Promise<Condominium>`, `remove(id) -> Promise<void>`, `fotos = criarServicoDeFotos(id => `/condominiums/${id}/photos`)`.
  - `Property.condominium?: { id: string; name: string; kind: CondominiumKind; locked_fields: string[]; photos_count: number } | null`; `PropertyFormData.condominium_id: string | null` (`FORMULARIO_VAZIO` = null; `formularioDoImovel` lê `p.condominium?.id ?? null`).
- [ ] **Step 1: Write the failing tests**: `condominiumsService.list({q:'perd'})` chama `GET /condominiums` com `params.q`; `update` manda `{condominium: data}`; `fotos.upload` posta em `/condominiums/c1/photos/upload`; `propertyPhotosService.upload` continua em `/properties/p1/photos/upload`; `amenities.spec`: contagem `[19, 29]`, `labelsFor(['cinema'])` = `['Sala de cinema']`; `formularioDoCadastro.spec`: `formularioDoImovel({...,condominium:{id:'c1',...}}).condominium_id === 'c1'`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + specs existentes de fotos e de `formularioDoCadastro`.
- [ ] **Step 5:** Commit `feat(condominios): serviço, tipos e comodidades novas`.

---

### Task 2: Regras do condomínio e das travas

**Files:**
- Create: `src/features/properties/condominios/regrasDoCondominio.ts` + `.spec.ts`
- Modify: `src/features/properties/cadastro/travasDoSite.ts` + `travasDoSite.spec.ts`

**Interfaces:**
- Produces (`regrasDoCondominio.ts`):
  - `ABA_CONDOMINIOS = 'condominios'`; `estaNaAbaDeCondominios(sp: URLSearchParams): boolean`.
  - `CONDOMINIO_VAZIO: CondominiumFormData`; `formularioDoCondominio(c: Condominium): CondominiumFormData`.
  - `errosDoCondominio(f): string[]` → `Dê um nome ao condomínio.` e `Preencha rua, cidade e UF do condomínio.` (mesmas do servidor).
  - `camposHerdados(c: {kind; locked_fields?}): string[]` → usa `locked_fields` do servidor quando vier; senão monta: os 6 de endereço com `address_zip` (nome da tela para `address_cep`) + `latitude longitude` fora do horizontal + `condo_features`.
  - `valoresHerdados(c: Condominium, kind): Partial<PropertyFormData>` → os valores dos campos herdados para pôr no formulário da unidade ao plugar.
  - `difereDoCondominio(form: PropertyFormData, c: Condominium): boolean` → true se algum campo herdado preenchido na unidade difere do condomínio (decide se pede confirmação).
  - `podePlugar(imovel: Property|null, kind: ListingKind): {pode: boolean; motivo?: string}` → `development` não; `imovel?.feed?.locked_fields.length` → não, com o texto da fonte de site.
  - `textoDasUnidades(n)`, `textoDasFotosDoCondominio(n)` com os textos fixos da Global Constraints.
- Produces (`travasDoSite.ts`, mantendo tudo que existe):
  - `DICA_DO_CONDOMINIO = 'Vem do condomínio: mude no cadastro do condomínio.'`
  - `CamposDoCondominioContext = createContext<readonly string[]>([])`
  - `useDicaDoCampo(campo: string): string | undefined` → dica do **site** se o campo está travado pelo site (o site vence: o servidor mantém o valor do site nesse campo mesmo com condomínio), senão a do condomínio se o campo está na lista do condomínio, senão undefined (usa o mesmo mapeamento `address_zip`↔`address_cep`). Teste: campo nas duas listas → texto do site.
- [ ] **Step 1: Write the failing tests**: cada função acima com os casos do spec (horizontal sem `latitude`; `development` não pluga; feed com travas não pluga e devolve o texto; `difereDoCondominio` false com campos vazios; `useDicaDoCampo` com os dois contextos e com nenhum).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(condominios): regras do condomínio e dica por motivo de trava`.

---

### Task 3: Aba Condomínios na lista de Imóveis

**Files:**
- Create: `src/pages/Customer/Properties/lista/ListaDeCondominios.tsx` + `ListaDeCondominios.spec.tsx`
- Modify: `src/pages/Customer/Properties/Properties.tsx` (abas ~592-598, cabeçalho ~569-589, efeito de carga, `trocarAba` ~286)
- Modify: `src/pages/Customer/Properties/lista/telaImoveis.spec.tsx`

**Interfaces:**
- Consumes: Task 1, Task 2 (`ABA_CONDOMINIOS`, `estaNaAbaDeCondominios`).
- Produces: `ListaDeCondominios({ podeEditar }: { podeEditar: boolean })` — busca (Input com ícone, igual à de imóveis), `Seletor` de cidade (`meta.cities`, "Todas as cidades"), tabela com Nome · Endereço (rua, nº) · Bairro · Cidade · Unidades · À venda · Vendidas · Atualizado (`tempoDesde`); linha abre `/properties/condominios/:id`; `Carregando`, `EmptyState` (vazio da Global Constraints, ação "+ Novo condomínio" só com `podeEditar`; sem resultado de busca → `tipo="semResultado"`), erro → `EmptyState tipo="erro"`. Contador de chamadas para ignorar resposta velha (padrão `SitesELandingPages`).
- Em `Properties.tsx` (mudança mínima, sem regra nova na tela): estado `emCondominios` iniciado por `estaNaAbaDeCondominios`; aba extra `{chave:'condominios', rotulo:`Condomínios (${n})`}` no fim do array de `Abas` (contagem pelo `meta.total` de `condominiumsService.list({per_page:1})`, "…" enquanto carrega); trocar para ela grava `aba=condominios`; trocar para qualquer outra limpa o flag mesmo se for o mesmo `kind`; com o flag ligado: no lugar da barra/lista/mapa renderiza `<ListaDeCondominios/>`, a carga de imóveis não roda, `?visao=mapa` é ignorado, `primaryAction` = "Novo condomínio" (`show: pode('condominiums','manage')`) e some "Gerar descrições com IA".
- [ ] **Step 1: Write the failing tests**
  - `ListaDeCondominios.spec`: 3 linhas com contagens; busca chama `list` com `q`; trocar cidade chama com `city`; vazio mostra o texto e o botão só com `podeEditar`; clicar linha navega.
  - `telaImoveis.spec`: `/properties?aba=condominios` abre a aba e não chama `svc.list` de imóveis; clicar "Revenda" e voltar; abrir em Revenda → Condomínios → Revenda mostra a lista de imóveis (Review Focus 1); "Novo condomínio" some sem a permissão (mock de `useCan`).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + specs da pasta `lista/` inteiros.
- [ ] **Step 5:** Commit `feat(condominios): aba Condomínios em Imóveis`.

---

### Task 4: Cadastro do condomínio e fotos das áreas comuns

**Files:**
- Create: `src/pages/Customer/Properties/condominios/CadastroDoCondominio.tsx` + `.spec.tsx`
- Create: `src/pages/Customer/Properties/condominios/SecaoContatos.tsx`, `SecaoUnidades.tsx`
- Modify: `src/pages/Customer/Properties/cadastro/secoes/SecaoLocalizacao.tsx` (tipo de props genérico: aceitar qualquer formulário com os campos de endereço + `latitude/longitude/location_source`; texto do ponto travado vira `useDicaDoCampo('latitude')`/texto do site em vez do fixo ~269-271; trocar `dicaSe(trava.x)` por `useDicaDoCampo(...)`)
- Modify: `src/pages/Customer/Properties/fotos/FotosDoImovel.tsx`, `src/features/properties/fotos/useFotosDoImovel.ts` (aceitar `alvo: 'imovel' | 'condominio'`: serviço, permissões — condomínio usa `condominiums.manage` para tudo que muda —, link de volta e título; imóvel continua igual)
- Modify: `src/routes/index.tsx`, `src/routes/lazyPages.ts`, `src/routes/permissionRoutes.ts`, `src/components/layout/menuRecolhidoEm.ts`
- Test: `CadastroDoCondominio.spec.tsx`, specs existentes de `SecaoLocalizacao`, `FotosDoImovel`, `permissionRoutes.source.spec.ts`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces: rotas da Global Constraints (`novo` e `:id` → `PermissionRoute resource="properties" action="read"`; o salvar/excluir exige `condominiums.manage` na tela; `:id/fotos` → `properties.read`).
- Tela no molde do `CadastroDoImovel` (Pagina + "← Condomínios" no `acima` levando a `/properties?aba=condominios`, `IndiceDoCadastro`, seções em `Card role="region"`, `BarraDoCadastro`, guarda de alterações não salvas, `useNomeDaAba`):
  1. **Básico:** Nome*, Tipo (`Seletor`, `ROTULO_DO_TIPO`), Construtora, Incorporadora, Administradora, Ano de construção (`CampoNumero`), Observação interna (multilinha, ajuda "Só a imobiliária vê.").
  2. **Localização:** `SecaoLocalizacao` com o formulário do condomínio.
  3. **Comodidades do condomínio:** pílulas de `CONDO_FEATURES` (mesmo visual da Características).
  4. **Fotos das áreas comuns:** na criação, escolher arquivos (sobem depois de criar, igual ao imóvel); na edição, faixa com miniaturas + "Gerenciar fotos" → `/properties/condominios/:id/fotos`.
  5. **Contatos:** `SecaoContatos` — linhas Nome · Cargo (`Seletor`: Zelador, Porteiro, Síndico, Administradora, Outro) · Telefone · E-mail, "+ Adicionar contato", remover por `IconActionButton` com nome acessível.
  6. **Unidades plugadas** (só edição): `SecaoUnidades` lista código · título · situação (`rotuloDaSituacao`) com link para `/properties/:id/editar`; vazia → "Nenhuma unidade plugada. Plugue pelo cadastro do imóvel, em Localização." dentro de `EmptyState tamanho` pequeno.
  - Aviso fixo no topo com `textoDasUnidades(n)` quando n > 0.
  - Excluir (menu da barra, só com a permissão) com `useConfirmacao` e os textos da Global Constraints; depois volta para a aba.
  - Sem permissão: tudo desligado, sem Salvar/Excluir, faixa de fotos sem "Gerenciar".
  - Erros: `errosDoCondominio` antes de salvar (foco na seção); 422 do servidor vem no envelope padrão `{error: {code, message}}`: mostrar `error.message`.
  - Criar com `?voltar=<caminho>` (só caminho interno começando com `/properties/`): depois de criar, navega para `<caminho>?condominio=<id>` (ou `&` se já houver query) em vez do cadastro do condomínio. Teste: criar com `voltar=/properties/p1/editar` navega para `/properties/p1/editar?condominio=c9`; `voltar=https://x` é ignorado.
- [ ] **Step 1: Write the failing tests** (`CadastroDoCondominio.spec`, serviço mockado com `vi.hoisted`, `MapaDoCadastro` mockado como no `SecaoLocalizacao.spec`)
  - criar com nome, rua, cidade, UF e 2 comodidades → `create` chamado com `kind:'vertical'`, `condo_features` certo e contatos; navega para `/properties/condominios/:id`.
  - salvar sem nome mostra `Dê um nome ao condomínio.` e não chama `create`.
  - edição com 6 unidades mostra `Mudanças aqui valem para as 6 unidades plugadas.` e a lista das unidades.
  - excluir pede confirmação com os textos e chama `remove`.
  - sem `condominiums.manage` (Review Focus 5): campos desligados, sem botão Salvar.
  - `SecaoLocalizacao.spec` continua passando; novo caso: campo em `CamposDoCondominioContext` mostra a dica do condomínio.
  - `FotosDoImovel` com `alvo:'condominio'` usa `condominiumsService.fotos` e volta para o cadastro do condomínio.
  - `permissionRoutes.source.spec.ts` e a regex do menu: `/properties/condominios/novo` e `/properties/condominios/c1` recolhem o menu.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + specs de `cadastro/` e `fotos/` inteiros.
- [ ] **Step 5:** Commit `feat(condominios): cadastro do condomínio e fotos das áreas comuns`.

---

### Task 5: "Condomínio (opcional)" no cadastro da unidade

**Files:**
- Create: `src/pages/Customer/Properties/cadastro/secoes/CampoDoCondominio.tsx` + `.spec.tsx` (busca no molde de `src/components/properties/SeletorDeImoveis.tsx`, usando `condominiumsService.list({q})`)
- Modify: `src/pages/Customer/Properties/cadastro/CadastroDoImovel.tsx` (~135 travas, ~282 `conteudoDa('localizacao')`, ~338-363 provider e aviso, faixa de fotos em `midia`)
- Modify: `src/pages/Customer/Properties/cadastro/secoes/SecaoCaracteristicas.tsx` (dica por `useDicaDoCampo('condo_features')` e, com condomínio, subtítulo do grupo "Do condomínio" = `Vem do condomínio {nome}.`)
- Modify: `src/pages/Customer/Properties/cadastro/secoes/SecaoMidia.tsx` (prop opcional `fotosDoCondominio?: number` → faixa só de leitura com `textoDasFotosDoCondominio`)
- Test: `CampoDoCondominio.spec.tsx`, `src/pages/Customer/Properties/cadastro/condominioNaUnidade.spec.tsx`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces: `CampoDoCondominio({ escolhido, aoEscolher, aoTirar, desligado, motivo, podeCadastrar }: { escolhido: Property['condominium']; aoEscolher(c: Condominium): void; aoTirar(): void; desligado: boolean; motivo?: string; podeCadastrar: boolean })`. "+ Cadastrar condomínio" (só `podeCadastrar`) navega na mesma aba, passando pela guarda de alterações não salvas, para `/properties/condominios/novo?voltar=<caminho do cadastro da unidade>`. O cadastro do condomínio (Task 4), ao criar com `voltar` presente, navega para `voltar` acrescentando `condominio=<id>`, e o cadastro da unidade, ao abrir com `?condominio=<id>`, busca esse condomínio e roda `aoEscolher` com ele.
- Em `CadastroDoImovel`:
  - estado `condominio` (iniciado por `imovel?.condominium`), só para `resale`/`auction` (`podePlugar`).
  - `aoEscolher(c)`: se `difereDoCondominio(form, c)` → `useConfirmacao` com os textos; ao confirmar, `setF({condominium_id: c.id, ...valoresHerdados(c, kind)})` e `condominio = {id, name, kind, locked_fields: camposHerdados(c), photos_count}`.
  - `aoTirar()`: `setF({condominium_id: null})`, `condominio = null` (valores ficam).
  - Providers: `CamposTravadosContext` = `[...travadosDoSite, ...camposDoCondominio]`; `CamposDoCondominioContext` = `camposDoCondominio`. O `Aviso` do site continua só quando `travadosDoSite.length > 0`.
  - Seção Localização: `CampoDoCondominio` antes da `SecaoLocalizacao`; com condomínio, `Aviso tom="info"` com `Vem do condomínio {nome}.` e o link `Editar no condomínio` (só com permissão) dentro dele.
  - `SecaoMidia` recebe `fotosDoCondominio={condominio?.photos_count}`.
  - Payload: `condominium_id` vai junto (já está no `PropertyFormData`).
- [ ] **Step 1: Write the failing tests**
  - Revenda: escolher "Cyrela Arti Perdizes" num formulário vazio pluga sem perguntar; rua/CEP/bairro/cidade/UF ficam desligados com a dica do condomínio; complemento continua livre; `condo_features` desligado; "Do imóvel" livre.
  - Com rua diferente já digitada → pergunta; cancelar não pluga.
  - Tirar do condomínio → tudo livre de novo, valores mantidos.
  - Trocar de A para B → travas e aviso com o nome de B (Review Focus 3).
  - Horizontal → mapa com `data-travado="false"` (mock do `MapaDoCadastro`) (Review Focus 4).
  - Empreendimento → campo não aparece; imóvel com `feed.locked_fields` → campo desligado com o texto da fonte.
  - Imóvel sem `condominium` no JSON (servidor velho) → abre normal (Review Focus 2).
  - Salvar envia `condominium_id`.
  - `SecaoMidia` com `fotosDoCondominio={8}` mostra `Mais 8 fotos do condomínio entram depois destas no site e nos portais.`; com 1, singular; sem, nada.
  - `travasPorCampo.spec.tsx`, `SecaoCondicoes.spec.tsx`, `SecaoMidia.spec.tsx` continuam passando.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + `src/pages/Customer/Properties` inteiro.
- [ ] **Step 5:** Commit `feat(condominios): plugar a unidade no condomínio`.

---

### Task 6: Nome do condomínio na página pública, diário e PR

**Files:**
- Modify: `src/pages/Public/ImovelPublicPage.tsx` (`PropertyDTO` ~49-67 ganha `condominium_name?: string | null`; linha "Condomínio {nome}" logo depois da linha da região ~465, no estilo dela)
- Modify: `CLAUDE.md` (frontend): seção nova `## Imóveis: Condomínios (desde 2026-11-11)` com **O que aparece na tela**, **Decisões do dono (não reabrir sem ele)** (as 6 do spec + as chamadas a–g aprovadas), **Armadilhas** (abas não são `ListingKind`; trava somada site+condomínio e o aviso do site só com trava do site; `criarServicoDeFotos`; rotas e menu recolhido; backend primeiro), **Voltar versão** (voltar a tela sozinha com o backend novo: a unidade plugada abre como hoje e o servidor segue travando; voltar o backend exige voltar a tela junto), **Testes**.
- Test: `src/pages/Public/ImovelPublicPage.spec.tsx` (ou o spec existente da página)

- [ ] **Step 1:** Teste: payload com `condominium_name: 'Cyrela Arti Perdizes'` mostra "Condomínio Cyrela Arti Perdizes"; sem o campo, nada.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar + seção do diário. **Step 4:** PASS.
- [ ] **Step 5:** `pnpm build` inteiro (travas de catálogo, i18n, caixinhas, padrão, `tsc`) → verde; `npx vitest run` inteiro → verde.
- [ ] **Step 6:** Commit `feat(condominios): nome do condomínio no site + diário` e abrir o PR (base `main`), corpo dizendo que depende do PR do backend no ar. **Não mergear.**
