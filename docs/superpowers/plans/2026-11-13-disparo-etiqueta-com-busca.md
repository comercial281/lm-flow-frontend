# Disparo: etiqueta com busca — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a parede de pílulas de etiqueta do Disparo pela lista com busca do construtor.

**Architecture:** `EscolhaDeEtiqueta` ganha `semCriar`, `semNome` e `idBusca` (opcionais, sem efeito nos usos atuais). `PassoQuemRecebe` passa a usar o componente; `BulkDispatchModal` pede as etiquetas com contagem.

**Tech Stack:** React + TS + Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-13-disparo-etiqueta-com-busca-design.md`

## Global Constraints
- Textos: "Buscar etiqueta" (placeholder sem criar), "Nenhuma etiqueta com esse nome.", "Nenhuma etiqueta cadastrada ainda.".
- Regra do disparo intacta: `labels` = títulos marcados.
- Diário de produto: seção nova no `CLAUDE.md` do frontend no mesmo PR.

## Review Focus
- Conta com 0 etiquetas no Disparo: mostra "Nenhuma etiqueta cadastrada ainda.", sem convite a criar → teste na Task 1.
- Enter com busca sem resultado e `semCriar`: não chama `createLabel` → teste na Task 1.
- Erro ao carregar etiquetas segue com Tentar de novo e não duplica → specs existentes de `BulkDispatchModal.erroDeCarga` (ajustar a query de `button` pra `checkbox`).
- Etiqueta do sistema marcada continua visível em Marcadas → já coberto pelo spec do componente.
- Usos do construtor sem as props novas não mudam → specs existentes do componente passam sem edição.

---

### Task 1: `EscolhaDeEtiqueta` sem criar e sem nome

**Files:**
- Modify: `src/components/flowAutomations/EscolhaDeEtiqueta.tsx`
- Test: `src/components/flowAutomations/EscolhaDeEtiqueta.spec.tsx`

**Interfaces:**
- Produces: props `semCriar?: boolean`, `semNome?: boolean`, `idBusca?: string` em `EscolhaDeEtiquetaProps`.

- [ ] **Step 1: testes que falham**
  - `semCriar: busca sem resultado mostra "Nenhuma etiqueta com esse nome." e Enter não cria` → sem botão /Criar etiqueta/, `createLabel` não chamado, placeholder "Buscar etiqueta".
  - `semCriar: lista vazia mostra "Nenhuma etiqueta cadastrada ainda."`.
  - `semNome: não repete o rótulo e usa o idBusca` → sem texto "Etiquetas" do componente, `textbox` com `id` = idBusca, "Nenhuma marcada" visível.
- [ ] **Step 2:** `pnpm vitest run src/components/flowAutomations/EscolhaDeEtiqueta.spec.tsx` → falham.
- [ ] **Step 3:** implementar as três props.
- [ ] **Step 4:** mesmo comando → todos passam (inclusive os 12 antigos).
- [ ] **Step 5:** commit.

### Task 2: Disparo usa a lista

**Files:**
- Modify: `src/components/pipelines/disparo/PassoQuemRecebe.tsx:253-280`, `src/components/pipelines/BulkDispatchModal.tsx:282`
- Test: `src/components/pipelines/BulkDispatchModal.erroDeCarga.spec.tsx`, `src/components/pipelines/BulkDispatchModal.spec.tsx`
- Docs: `CLAUDE.md` (seção nova "Disparo: etiqueta com busca")

**Interfaces:**
- Consumes: `EscolhaDeEtiqueta` com `modo="varias" semCriar semNome idBusca`, `escolhidas={etiquetasMarcadas}`, `aoMudar` que troca a lista inteira.
- Produces: `PassoQuemRecebe` recebe `aoMudarEtiquetas: (titulos: string[]) => void` no lugar de `aoMarcarEtiqueta`.

- [ ] **Step 1:** nos specs de erro de carga, buscar a etiqueta por `checkbox` (/quente/); novo teste em `BulkDispatchModal.spec`: digitar "que" na busca e marcar "quente" envia `labels: ['quente']` na prévia.
- [ ] **Step 2:** rodar os dois specs → falham.
- [ ] **Step 3:** trocar as pílulas pelo componente; `getLabels({ withCounts: true })`.
- [ ] **Step 4:** `pnpm vitest run src/components/pipelines` e `pnpm build` → verdes.
- [ ] **Step 5:** seção no `CLAUDE.md`, commit.
