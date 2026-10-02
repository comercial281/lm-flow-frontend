import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// No computador a lista dos filtros é um <button> (Seletor, modo bare). O jsdom não
// aplica o CSS; aqui se confere o que o lmf.css promete para esse botão.
const css = readFileSync(resolve(__dirname, 'lmf.css'), 'utf8');

describe('lmf.css e o Seletor', () => {
  it('o fundo roxo do filtro ligado é só do botão liga/desliga (aria-pressed), não da lista', () => {
    expect(css).not.toMatch(/button\.lmf-campo-controle\[data-active/);
    expect(css).toContain("button.lmf-campo-controle[aria-pressed='true']");
  });

  it('o .lmf-select do computador ganha de volta a seta que o nativo desenhava', () => {
    expect(css).toContain(".lmf-select[data-slot='select-trigger'] > svg:last-child");
  });

  it('o campo não soma o anel do design system ao contorno próprio', () => {
    expect(css).toMatch(/\.lmf-campo-controle\[data-slot='select-trigger'\]\s*\{\s*box-shadow:\s*none/);
  });
});
