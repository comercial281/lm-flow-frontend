import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Construtor no Vidro violeta (spec 2026-10-30-vidro-violeta-telas-design.md). O
// jsdom não aplica CSS: aqui se confere o que o construtor.css promete.
const css = readFileSync(resolve(__dirname, 'construtor.css'), 'utf8');
const bloco = (seletor: string) => {
  const i = css.indexOf(`${seletor} {`);
  expect(i, `regra ${seletor}`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf('}', i));
};

describe('construtor.css', () => {
  it('não usa desfoque', () => {
    expect(css).not.toMatch(/backdrop-filter|blur\(/);
  });

  it('pontos do fundo levemente roxos nos dois temas', () => {
    expect(bloco('.react-flow')).toMatch(/--xy-background-pattern-color: rgba\(91, 52, 209, 0\.22\)/);
    expect(bloco('.dark .react-flow')).toMatch(/--xy-background-pattern-color: rgba\(197, 143, 250, 0\.16\)/);
  });

  it('o bloco tem canto de 16 px e o selecionado acende o halo roxo', () => {
    expect(bloco('.fluxo-bloco')).toMatch(/border-radius: 16px/);
    expect(bloco(".fluxo-bloco[data-selecionado='true']")).toMatch(/0 0 0 2px #8c60f4, 0 0 0 7px rgba\(140, 96, 244, 0\.18\)/);
  });

  it('a faixa ganha um brilho por cima da cor do grupo', () => {
    expect(bloco('.fluxo-faixa')).toMatch(/linear-gradient\(180deg, rgba\(255, 255, 255, 0\.18\), rgba\(255, 255, 255, 0\) 70%\)/);
  });

  it('a linha tem 2 px e o CSS não muda o desenho nem a cor das saídas', () => {
    expect(bloco('.react-flow__edge-path')).toMatch(/stroke-width: 2px/);
    expect(css).not.toMatch(/\bd:|stroke: /);
  });

  it('com "reduzir movimento" o bloco não anima', () => {
    const i = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(i).toBeGreaterThan(-1);
    expect(css.slice(i)).toMatch(/\.fluxo-bloco[\s\S]*transition: none/);
  });
});
