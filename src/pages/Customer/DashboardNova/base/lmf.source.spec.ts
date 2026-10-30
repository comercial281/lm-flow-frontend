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

// Vidro violeta (escolha do dono, 30/10/2026): a linguagem do Portal do Cliente do
// Hub. Substitui o "neutro grafite" de 15/10/2026.
describe('lmf.css e o Vidro violeta', () => {
  const claro = css.slice(css.indexOf('.lmf {'), css.indexOf('.dark .lmf {'));
  const escuro = css.slice(css.indexOf('.dark .lmf {'), css.indexOf('.lmf-glass {'));

  it('o fundo é transparente: quem pinta é a página (e o fundo vivo, no escuro)', () => {
    expect(claro).toMatch(/--lmf-bg:\s*transparent/);
  });

  it('no claro o cartão é vidro quase opaco e o dado é o roxo do Portal', () => {
    expect(claro).toMatch(/--lmf-glass-from:\s*rgba\(255, 255, 255, 0\.95\)/);
    expect(claro).toMatch(/--lmf-data:\s*#5b34d1/);
  });

  it('no escuro o dado é o roxo claro e o vermelho é vivo (alerta tem que saltar)', () => {
    expect(escuro).toMatch(/--lmf-data:\s*#8c60f4/);
    expect(escuro).toMatch(/--lmf-down:\s*#ff4d6d/);
  });

  it('o cartão de vidro tem o anel de 1px que acende no canto', () => {
    expect(css).toMatch(/\.lmf-glass::after \{[^}]*mask-composite: exclude/s);
  });
});
