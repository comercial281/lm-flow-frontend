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

// Tema claro (pedido do dono, 15/10/2026): sem o véu roxo nos cartões; o dado
// continua roxo, sólido. O escuro não mudou.
describe('lmf.css e o tema claro neutro', () => {
  const claro = css.slice(css.indexOf('.lmf {'), css.indexOf('.dark .lmf {'));
  const escuro = css.slice(css.indexOf('.dark .lmf {'), css.indexOf('.lmf-glass {'));

  it('no claro o cartão é branco chapado, sem véu roxo', () => {
    expect(claro).toMatch(/--lmf-glass-from:\s*#ffffff/);
    expect(claro).toMatch(/--lmf-glass-to:\s*#ffffff/);
    expect(claro).toMatch(/--lmf-bg:\s*#f6f6f7/);
  });

  it('no claro o dado é roxo sólido', () => {
    expect(claro).toMatch(/--lmf-data:\s*#7c3aed/);
  });

  it('no claro o cartão tem contorno em degradê roxo leve; no escuro, o de antes', () => {
    expect(css).toMatch(/\.lmf \.lmf-glass \{[^}]*border-color: transparent[^}]*border-box/s);
    expect(css).toMatch(/\.dark \.lmf \.lmf-glass \{[^}]*border-color: var\(--lmf-border\)/s);
  });

  it('no escuro o dado continua roxo', () => {
    expect(escuro).toMatch(/--lmf-data:\s*#7c3aed/);
    expect(escuro).toMatch(/--lmf-data-fade:\s*#7c3aed/);
  });
});
