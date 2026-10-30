import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Funil no Vidro violeta (spec 2026-10-30-vidro-violeta-telas-design.md). O jsdom
// não aplica CSS: aqui se confere o que o quadro.css promete.
const css = readFileSync(resolve(__dirname, 'quadro.css'), 'utf8');
const bloco = (seletor: string) => {
  const i = css.indexOf(`${seletor} {`);
  expect(i, `regra ${seletor}`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf('}', i));
};

describe('quadro.css', () => {
  it('não usa desfoque (lista longa pesa no notebook do corretor)', () => {
    expect(css).not.toMatch(/backdrop-filter|blur\(/);
  });

  it('a coluna é uma superfície clara de canto 20 px, translúcida no escuro', () => {
    expect(bloco('.quadro-coluna')).toMatch(/border-radius: 20px/);
    expect(bloco('.quadro-coluna')).toMatch(/background: rgba\(255, 255, 255, 0\.55\)/);
    expect(bloco('.dark .quadro-coluna')).toMatch(/background: rgba\(255, 255, 255, 0\.03\)/);
  });

  it('o topo tem um fio aceso de 3 px na cor da etapa, com roxo de reserva', () => {
    const fio = bloco('.quadro-coluna-topo::before');
    expect(fio).toMatch(/height: 3px/);
    expect(fio).toMatch(/background: var\(--etapa, #8c60f4\)/);
    expect(fio).toMatch(/box-shadow: 0 0 14px var\(--etapa, #8c60f4\)/);
  });

  it('o nome da etapa é rótulo em caixa alta espaçada', () => {
    expect(bloco('.quadro-coluna-nome')).toMatch(/text-transform: uppercase/);
    expect(bloco('.quadro-coluna-nome')).toMatch(/letter-spacing: 0\.14em/);
  });

  it('o card tem canto de 16 px e sobe 2 px no mouse', () => {
    expect(bloco('.quadro-card')).toMatch(/border-radius: 16px/);
    expect(bloco('.quadro-card:hover')).toMatch(/transform: translateY\(-2px\)/);
  });

  it('com "reduzir movimento" a coluna e o card não animam', () => {
    const i = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(i).toBeGreaterThan(-1);
    const reduz = css.slice(i);
    expect(reduz).toMatch(/\.quadro-coluna/);
    expect(reduz).toMatch(/\.quadro-card/);
    expect(reduz).toMatch(/animation: none/);
    expect(reduz).toMatch(/transition: none/);
  });

  it('nunca anima clip-path', () => {
    expect(css).not.toMatch(/clip-path/);
  });
});
