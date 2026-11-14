# Mais filtros do Moderno em painel flutuante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** na capa do Moderno, "Mais filtros" abre a segunda linha como painel flutuante por cima da seção de baixo, com descida animada e sombra, sem mudar a altura da capa.

**Architecture:** só tela. O `<form>` da `BuscaModerna` vira `relative` e a linha extra vira `absolute top-full`. Entrada por `@starting-style` (variante `starting:` do Tailwind 4); saída por estado `saindo` + timer de 200ms antes de desmontar. Esc fecha. A capa dividida ganha `relative z-10`.

**Tech Stack:** React + TS + Tailwind 4.1, Vitest + Testing Library (`vi.useFakeTimers` pro timer de saída).

**Spec:** `docs/superpowers/specs/2026-11-13-mais-filtros-painel-design.md`

## Global Constraints
- Clique fora NÃO fecha. Esc fecha.
- Duração 200ms, desce 8px (`-translate-y-2`). `motion-reduce:transition-none`.
- `tw-animate-css` não está ligado no CSS: não usar `animate-in`/`slide-in-*`.
- Não mexer no `useBuscaDaCapa`, no Clássico nem na página de Imóveis.

## Review Focus
- Fechar e reabrir rápido (dentro dos 200ms): o painel tem que voltar aberto, não sumir quando o timer antigo vencer → teste no Task 1.
- Navegador sem `@starting-style` (Chrome < 117, Safari < 17.5): aparece sem animação, sem quebrar (só CSS, sem teste).
- Celular: painel com um filtro por linha não pode sair da largura da busca (`left-0 right-0`).
- Lista nativa (`select`) aberta dentro do painel + Esc: o Esc do select fecha só a lista no navegador; aceitável.
- Capa dividida sem `z-10`: a seção seguinte cobriria o painel → teste no Task 1.

---

### Task 1: painel flutuante na BuscaModerna

**Files:**
- Modify: `src/pages/Public/moderno/BuscaModerna.tsx` (form `relative`; bloco `data-campos-da-busca-mais`; hook local; Esc)
- Modify: `src/pages/Public/moderno/CapaModerna.tsx` (section da capa dividida: `relative z-10`)
- Modify: `CLAUDE.md` (parágrafo "Busca da capa (decisões do Tony em 13/11)" do Moderno: uma frase sobre o painel)
- Test: `src/pages/Public/moderno/InicioModerno.spec.tsx`

**Interfaces:**
- Produces (local em BuscaModerna.tsx): `function usePainelComSaida(aberto: boolean, ms?: number): { montado: boolean; saindo: boolean }` — `montado` fica true até `ms` depois de `aberto` virar false; reabrir cancela o timer.

- [ ] **Step 1: testes que falham** (no describe 'Início do Moderno', reaproveitando o fixture de 6 campos do teste "6 campos: 3 na barra…")
  - `'Mais filtros abre um painel flutuante por cima da seção de baixo (a capa não cresce)'`: depois do clique, `[data-campos-da-busca-mais]` tem `absolute`, `top-full`, `left-0`, `right-0`, `z-20` e uma classe que começa com `shadow-[`; o `form[role=search]` tem `relative`.
  - `'Menos filtros fecha o painel com a saída animada'`: `vi.useFakeTimers()`; abre; clica "Menos filtros"; o painel ainda existe e tem `opacity-0`; `vi.advanceTimersByTime(200)`; painel `null`.
  - `'Esc fecha o painel; clique fora não fecha'`: abre; `fireEvent.mouseDown(document.body)` + `fireEvent.click(document.body)` → botão continua "Menos filtros"; `fireEvent.keyDown(document, { key: 'Escape' })` → botão volta a "Mais filtros".
  - `'reabrir durante a saída mantém o painel aberto'`: fake timers; abre, fecha, `advanceTimersByTime(100)`, abre, `advanceTimersByTime(200)` → painel existe e sem `opacity-0`.
  - `'capa dividida fica por cima da seção seguinte (relative z-10)'`: com `hero_layout: 'split'`, `#topo` tem `relative` e `z-10`.

- [ ] **Step 2:** `pnpm vitest run src/pages/Public/moderno/InicioModerno.spec.tsx` → os 5 novos FALHAM; os antigos passam.

- [ ] **Step 3: implementar**
  - `usePainelComSaida` como na Interface (useState + useEffect com setTimeout/clearTimeout).
  - Painel: renderizar quando `montado && mais.length > 0`. Classes: `absolute left-0 right-0 top-full z-20 mt-2 grid grid-cols-1 gap-2 rounded-[22px] bg-[var(--m-surface)] p-2.5 sm:grid-cols-3 lg:grid-cols-4 shadow-[0_28px_60px_-20px_rgba(8,10,22,0.55)] transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none starting:opacity-0 starting:-translate-y-2` + `opacity-0 -translate-y-2 pointer-events-none` quando `saindo`. Células continuam `celula(c, true)`.
  - Esc: `useEffect` com `keydown` no `document` enquanto `abertos`; `Escape` chama `alternarMais()`.
  - Atualizar o comentário do topo do arquivo (item 1) com o painel.
  - CapaModerna dividida: `<section id="topo" className="relative z-10 px-4 pt-3">`.
  - CLAUDE.md: no parágrafo do Moderno, "**Mais filtros** abre um painel flutuante por cima da seção de baixo (desce com sombra, a capa não cresce). Fecha no Menos filtros ou Esc; clique fora não fecha (decisão do Tony em 13/11)."

- [ ] **Step 4:** mesmo comando do Step 2 → todos PASSAM. Depois `pnpm build` (travas da casa + tsc) → sem erro.

- [ ] **Step 5: conferência visual** no `pnpm dev` com chrome-devtools: capa com foto e dividida, 1280px e 390px, print aberto e no meio da animação.

- [ ] **Step 6: commit** (autor `comercial281 <comercial@lealmidia.com.br>`)
```bash
git add src/pages/Public/moderno/BuscaModerna.tsx src/pages/Public/moderno/CapaModerna.tsx src/pages/Public/moderno/InicioModerno.spec.tsx CLAUDE.md docs/superpowers
git commit -m "Site Moderno: Mais filtros abre em painel flutuante com sombra"
```
