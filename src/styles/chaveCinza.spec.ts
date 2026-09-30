import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Decisão D2 da Fase 3 (Tony, 30/09/2026): chave desligada é CINZA. Vermelho
// fica pra erro e Excluir. A regra mora numa linha de CSS global com
// !important — fácil de "voltar" sem ninguém notar. Este teste nota.

const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

const blocoDesligado = (seletor: string) => {
  const i = css.indexOf(seletor);
  expect(i).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf('}', i));
};

describe('chave desligada', () => {
  it('é cinza no tema claro e no escuro, nunca vermelha', () => {
    const claro = blocoDesligado("button[role='switch'][data-state='unchecked'],\n[role='switch'][aria-checked='false'] {");
    const escuro = blocoDesligado(".dark button[role='switch'][data-state='unchecked']");
    for (const bloco of [claro, escuro]) {
      expect(bloco).not.toMatch(/#ef4444|#dc2626|red/i);
    }
    expect(claro).toContain('#a1a1aa');
    expect(escuro).toContain('#52525b');
  });
});
