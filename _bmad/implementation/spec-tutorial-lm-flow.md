---
title: 'Tutorial LM Flow — Central de Conhecimento global (Docs + Aulas)'
type: 'feature'
created: '2026-06-03'
status: 'in-review'
baseline_commit: '2620e3260b9c10c40c6353ace846dddd727690dc'
context:
  - '{project-root}/src/pages/Customer/Tutorials/index.tsx'
  - '{project-root}/src/components/layout/config/menuItems.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hoje a aba `/tutorials` do LM Flow é um iframe pro Evolution Foundation, conteúdo externo e fora do controle do Giovani. Precisa virar uma central de conhecimento dele, igual à `Conhecimento` do LM Hub (Docs + Aulas + Categorias), com conteúdo GLOBAL — editado uma vez por ele e refletindo em todos os tenants do LM Flow na hora, sem rebuild.

**Approach:** Reusar o schema `knowledge_*` já em prod no Supabase do LM Hub (`cpagtgvtvyenrabpacqc`) como fonte única de verdade. O frontend de cada tenant LM Flow consulta esse Supabase via cliente secundário (anon key + leitura pública via RLS). Escrita restrita a `giovani@chaveflow.com.br` por Edge Function `tutorial-admin` que valida o JWT do Rails do tenant atual.

## Boundaries & Constraints

**Always:**
- Conteúdo é **global**: o mesmo Supabase do LM Hub serve todos os tenants do LM Flow. Zero duplicação por tenant.
- Edição (CRUD) só pelo super-admin universal do LM Flow (`giovani@chaveflow.com.br`). Demais usuários só leem.
- Manter exatamente 2 tabs visíveis: **Docs** e **Aulas**. Sem aba Links nem Arquivos.
- Links viram link inline dentro do `content_md` do doc ou `descricao_md` da aula (sintaxe markdown `[texto](url)`), aproveitando o RichTextEditor.
- Não mexer no item de sidebar nem na rota `/tutorials` — só substituir o `index.tsx`.
- Reusar/portar o módulo `conhecimento` do worktree `lm-hub-conhecimento` (entry + tabs + sidebar + lib + hooks). Não reescrever do zero.
- Validação de URL de vídeo: apenas YouTube e Vimeo (regex já implementada em `lib.ts`).
- Cliente Supabase do LM Hub é **secundário**: nunca substituir o `@/lib/supabase` (Auth/CRM do LM Flow) — criar `@/lib/supabaseLmHub.ts` separado.

**Ask First:**
- Mudar o nome da página (hoje i18n `tutorials.title` = "Tutoriais"). Manter por padrão.
- Apagar o iframe Evolution Foundation imediatamente vs deixar fallback enquanto não há conteúdo seedado. Default: apagar.
- Migrar o seed "Processos Comerciais" (5 docs) do LM Hub pra ficar visível no LM Flow ou começar do zero. Default: aproveita o seed (são processos comerciais que servem pros corretores também).
- Trocar o `requiredEmail` da `Clientes CRM` (hoje `comercial@lealmidia.com.br`) pra `giovani@chaveflow.com.br`. **Fora de escopo**, só registrado.

**Never:**
- Criar tabelas `tutorials_*` novas. Reusar `knowledge_*` existentes em `cpagtgvtvyenrabpacqc`.
- Subir credenciais (anon key, service role) no bundle/repo. Anon key vai em env var (`VITE_LMHUB_SUPABASE_ANON_KEY`); service role só na Edge Function.
- Aceitar token de admin hardcoded no frontend (vaza no bundle Vite). Validação sempre via JWT do Rails do tenant atual.
- Permitir uploads de arquivo (bucket `knowledge-files`) — fora do escopo dessa entrega.
- Auto-rebuild dos tenants Vercel a cada edição (esse é o motivo de NÃO usar JSON estático).
- Suportar Supabase Auth nativo no LM Flow. Auth continua sendo o Rails do tenant.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Usuário comum abre `/tutorials` | logado no LM Flow, email ≠ super-admin | Carrega categorias + docs/aulas; botões "Novo doc / Editar / Excluir / Nova categoria" ocultos | Spinner enquanto carrega; toast erro se Supabase LM Hub off |
| Super-admin abre `/tutorials` | `currentUser.email === giovani@chaveflow.com.br` | Mesma tela + botões CRUD visíveis | Idem |
| Super-admin cria/edita/exclui doc | clica botão | Frontend chama Edge Function `tutorial-admin` com `Authorization: Bearer <jwt rails tenant>` + `X-Tenant-API-URL: <api url do tenant>` | 403 se JWT inválido ou email ≠ super-admin; toast |
| Não-super-admin tenta forjar request CRUD direto | bypass UI | Edge Function valida JWT → 403 | Resposta `{error: 'forbidden'}`; sem efeito |
| Tab "Aulas" sem nenhum módulo seedado | `knowledge_modules` vazio | Empty state com CTA "Criar primeiro módulo" (só visível pro super-admin) | — |
| URL de vídeo inválida (não YT/Vimeo) | super-admin cola URL aleatória | Mutation rejeita com erro "URL inválida — apenas YouTube ou Vimeo" | Toast erro, modal fica aberto |
| Categoria com docs vinculados | super-admin clica excluir | FK `on delete restrict` impede; toast "Não foi possível excluir — verifique se há docs vinculados" | — |
| Env var `VITE_LMHUB_SUPABASE_URL` ausente | deploy mal configurado | Página renderiza com banner "Tutorial indisponível — configurar VITE_LMHUB_SUPABASE_URL" | Não quebra app inteiro |

</frozen-after-approval>

## Code Map

**Fonte (reaproveitar):**
- `[lm-hub-conhecimento]/src/pages/conhecimento/index.tsx` — entry da página (4 tabs no LM Hub)
- `[lm-hub-conhecimento]/src/pages/conhecimento/tabs/DocsTab.tsx` — CRUD docs + RichTextEditor
- `[lm-hub-conhecimento]/src/pages/conhecimento/tabs/AulasTab.tsx` — módulos + lessons embed YT/Vimeo
- `[lm-hub-conhecimento]/src/pages/conhecimento/_internal/CategoriaSidebar.tsx` — árvore de categorias
- `[lm-hub-conhecimento]/src/pages/conhecimento/_internal/VideoEmbed.tsx` — iframe YT/Vimeo
- `[lm-hub-conhecimento]/src/pages/conhecimento/_internal/lib.ts` — `parseVideoUrl`, `slugify`
- `[lm-hub-conhecimento]/src/hooks/useKnowledge.ts` — 49 fns (queries + mutations React Query)
- `[lm-hub-conhecimento]/supabase/migrations/20260528_400000_knowledge_central.sql` — schema (já em prod)

**Destino (criar/editar no `lm-flow-frontend`):**
- `src/pages/Customer/Tutorials/index.tsx` — **SUBSTITUIR** iframe pelo entry da Central (2 tabs)
- `src/pages/Customer/Tutorials/tabs/DocsTab.tsx` — porte adaptado
- `src/pages/Customer/Tutorials/tabs/AulasTab.tsx` — porte adaptado
- `src/pages/Customer/Tutorials/_internal/CategoriaSidebar.tsx` — porte
- `src/pages/Customer/Tutorials/_internal/VideoEmbed.tsx` — porte
- `src/pages/Customer/Tutorials/_internal/lib.ts` — porte
- `src/lib/supabaseLmHub.ts` — **NOVO** cliente Supabase secundário (anon key)
- `src/hooks/useKnowledge.ts` — **NOVO** porte; usa `supabaseLmHub` + chama Edge Function pra writes
- `src/hooks/useIsSuperAdmin.ts` — **NOVO** helper `currentUser.email === giovani@chaveflow.com.br`
- `src/i18n/locales/pt-BR/tutorials.json` — adicionar chaves `docs`, `aulas`, `categoria`, `novo_doc`, etc.
- `.env.example` — adicionar `VITE_LMHUB_SUPABASE_URL`, `VITE_LMHUB_SUPABASE_ANON_KEY`

**Supabase LM Hub (`cpagtgvtvyenrabpacqc`):**
- Nova migration `20260603_tutorial_lmflow_anon_select.sql` — policies `anon SELECT` em 5 tabelas
- Nova Edge Function `tutorial-admin` — valida JWT do Rails do tenant + executa CRUD com service role

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260603_tutorial_lmflow_anon_select.sql` — adicionar policies `select to anon using (true)` em `knowledge_categories`, `knowledge_docs`, `knowledge_modules`, `knowledge_lessons`, `knowledge_links` — habilita leitura pública do conteúdo global
- [x] `supabase/functions/tutorial-admin/index.ts` — Edge Function Deno: recebe `{resource, op, payload}` no body + `Authorization` + `X-Tenant-API-URL` nos headers; chama `GET {X-Tenant-API-URL}/api/v1/profile` com o JWT pra validar email = `giovani@chaveflow.com.br`; se ok, usa service role pra INSERT/UPDATE/DELETE no resource; resources: `categories|docs|modules|lessons`; ops: `create|update|delete`
- [x] `src/lib/supabaseLmHub.ts` — `createClient(import.meta.env.VITE_LMHUB_SUPABASE_URL, import.meta.env.VITE_LMHUB_SUPABASE_ANON_KEY)`; sem persistSession; export `supabaseLmHub`
- [x] `src/hooks/useIsSuperAdmin.ts` — lê `useAuthStore.currentUser.email`; retorna `boolean`; constante `SUPER_ADMIN_EMAIL = 'giovani@chaveflow.com.br'`
- [x] `src/hooks/useKnowledge.ts` — portar `useKnowledge.ts` do LM Hub; **reads** via `supabaseLmHub`; **writes** via fetch pra Edge Function `tutorial-admin` (passa JWT do Rails + URL do tenant Rails do `import.meta.env.VITE_API_URL` ou similar); manter types e signatures iguais
- [x] `src/pages/Customer/Tutorials/_internal/lib.ts` — copiar de `lm-hub-conhecimento` sem mudança
- [x] `src/pages/Customer/Tutorials/_internal/VideoEmbed.tsx` — copiar
- [x] `src/pages/Customer/Tutorials/_internal/CategoriaSidebar.tsx` — copiar; trocar `canEdit` prop pra ler do `useIsSuperAdmin`; ajustar classes Tailwind se o design system do LM Flow (`@evoapi/design-system`) tiver tokens diferentes (cores `lm-neon`, `lm-border` viram tokens equivalentes do LM Flow: `primary`, `border`)
- [x] `src/pages/Customer/Tutorials/tabs/DocsTab.tsx` — copiar do LM Hub; trocar `RichTextEditor` por equivalente do LM Flow (TinyMCE já presente — `VITE_TINYMCE_API_KEY`); manter `canEdit` gate
- [x] `src/pages/Customer/Tutorials/tabs/AulasTab.tsx` — copiar; mesmas adaptações de tokens
- [x] `src/pages/Customer/Tutorials/index.tsx` — **SUBSTITUIR** o iframe atual por: header com `BookOpen` + título + 2 botões de tab (Docs / Aulas), URL state via `useSearchParams` (`?cat=&tab=docs|aulas`); body com `CategoriaSidebar` (só na tab Docs) + tab ativa; gate `useIsSuperAdmin` propaga `canEdit`
- [x] `src/i18n/locales/pt-BR/tutorials.json` — adicionar chaves: `tabs.docs`, `tabs.aulas`, `categorias.titulo`, `categorias.nova`, `docs.novo`, `docs.empty`, `aulas.novo_modulo`, `aulas.empty`, `mensagens.somente_leitura`
- [x] `src/i18n/locales/{en,es,fr,it,pt}/tutorials.json` — espelhar chaves PT-BR em cada locale (texto pode ficar PT-BR se i18n EN não for prioridade; combinar antes)
- [x] `.env.example` — adicionar:
  - `VITE_LMHUB_SUPABASE_URL=https://cpagtgvtvyenrabpacqc.supabase.co`
  - `VITE_LMHUB_SUPABASE_ANON_KEY=` (deixar vazio, valor real só em Vercel)
- [ ] Provisionar em Vercel: rodar `vercel env add VITE_LMHUB_SUPABASE_URL` + `VITE_LMHUB_SUPABASE_ANON_KEY` em **todos** os projetos LM Flow (chave-flow-frontend, lm-flow-frontend, lm-flow-mais-que-im-veis-fnpxsg6a9 + futuros) — script de provisioning (`RailwayProvisioningService`?) também precisa setá-las no `frontend env` (validar com sprint pequena)
- [ ] Deploy: `supabase functions deploy tutorial-admin --project-ref cpagtgvtvyenrabpacqc`; aplicar migration via `supabase db push` ou MCP `apply_migration`

**Acceptance Criteria:**
- Given usuário não-super-admin logado em qualquer tenant LM Flow, when abrir `/tutorials`, then ver a categoria "Processos Comerciais" + 5 docs (Recepção, BANT, Proposta, Follow-up, Onboarding) com conteúdo renderizado e **nenhum** botão de editar/criar/excluir.
- Given `giovani@chaveflow.com.br` logado, when abrir `/tutorials`, then ver botões "Nova categoria", "Novo doc", "Editar", "Excluir" em cada nível e conseguir salvar mudanças.
- Given super-admin cria um doc novo no tenant A, when usuário do tenant B abrir `/tutorials` em seguida, then ver o doc na hora (sem rebuild, sem deploy) após refetch do React Query.
- Given usuário não-super-admin com console aberto chama `POST /functions/v1/tutorial-admin` com JWT próprio, when validação roda, then receber `403 forbidden` e nada é gravado.
- Given super-admin cria aula com URL YouTube válida, when salva, then `video_provider=youtube` + `video_id` extraído corretamente; iframe embed renderiza.
- Given env var `VITE_LMHUB_SUPABASE_URL` ausente no deploy, when abrir `/tutorials`, then ver banner de erro claro; resto do LM Flow continua funcional.
- Given migration aplicada, when `SELECT FROM knowledge_docs` é chamado via anon key, then retornar rows (RLS anon SELECT habilitado).

## Design Notes

**Auth cross-system — por que JWT do Rails + Edge Function:**
- LM Flow não tem Supabase Auth. Users autenticam no backend Rails (JWT). Pra escrever no Supabase do LM Hub com segurança, opções foram:
  1. Token hardcoded no frontend — ❌ vaza no bundle Vite
  2. Login Supabase paralelo do super-admin — ❌ exige cadastro dele no Supabase do LM Hub com mesmo email (`giovani@chaveflow.com.br`), e ainda assim qualquer user de qualquer tenant que crie conta no LM Hub passaria pelo RLS `authenticated`
  3. **Edge Function valida JWT do Rails do tenant atual** — ✅ funciona porque o super-admin universal está injetado em todo tenant via `SUPER_ADMIN_*` env vars (memory `reference_lm_flow_super_admin.md`). Edge Function recebe a URL do Rails do tenant no header, valida o JWT lá, checa email.

**Porte do `RichTextEditor` do LM Hub:**
- LM Hub usa um RTE customizado em `components/kanban/_internal/RichTextEditor.tsx`. LM Flow usa TinyMCE (`VITE_TINYMCE_API_KEY` no .env). Reusar TinyMCE no `DocsTab` em vez de portar o RTE — menos código, suporte nativo a links.

**Tokens de cor:**
- LM Hub usa `lm-neon`, `lm-border`, `lm-subtle`, `text-heading`. LM Flow usa `@evoapi/design-system` (provavelmente `primary`, `border`, `muted-foreground`). Trocar via grep/replace no porte.

## Verification

**Commands:**
- `cd lm-flow-frontend && yarn tsc --noEmit` — expected: 0 erros
- `cd lm-flow-frontend && yarn build` — expected: build passa
- `supabase functions deploy tutorial-admin --project-ref cpagtgvtvyenrabpacqc` — expected: "Deployed Function tutorial-admin"
- `curl -X POST https://cpagtgvtvyenrabpacqc.supabase.co/functions/v1/tutorial-admin -d '{}' -H "Authorization: Bearer FAKE_JWT" -H "X-Tenant-API-URL: https://api-production-a2e30.up.railway.app"` — expected: `403`

**Manual checks:**
- Abrir `https://chave-flow-frontend.vercel.app/tutorials` logado como `giovani@chaveflow.com.br` — ver Categorias + 5 docs + botões CRUD.
- Abrir mesmo path logado com user comum — ver mesmo conteúdo, sem botões.
- Criar um doc novo. Logar em outro tenant (ex: `lm-flow-mais-que-im-veis-fnpxsg6a9`) com user comum — doc aparece após refetch.
- Inspecionar bundle: `grep -r "service_role" dist/` — expected: nenhum match.
