import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Conversas no Vidro violeta (spec 2026-10-30-vidro-violeta-telas-design.md). O
// jsdom não aplica CSS: aqui se confere o que o conversas.css promete.
const css = readFileSync(resolve(__dirname, 'conversas.css'), 'utf8');
const bloco = (seletor: string) => {
  const i = css.indexOf(`${seletor} {`);
  expect(i, `regra ${seletor}`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf('}', i));
};

describe('conversas.css', () => {
  it('não usa desfoque', () => {
    expect(css).not.toMatch(/backdrop-filter|blur\(/);
  });

  it('não toca no verde do WhatsApp (topo, balões, conversa)', () => {
    expect(css).not.toMatch(/\.wa-header|\.wa-msg-bubble|\.wa-chat/);
  });

  it('a linha da conversa fica solta, com canto de 14 px', () => {
    expect(bloco('.conversa-linha')).toMatch(/border-radius: 14px/);
    expect(bloco('.conversa-linha')).toMatch(/margin: 2px 8px/);
  });

  it('a conversa aberta tem o brilho do item ativo do menu e o fio aceso', () => {
    expect(bloco(".conversa-linha[data-aberta='true']")).toMatch(
      /linear-gradient\(90deg, rgba\(140, 96, 244, 0\.2\), rgba\(140, 96, 244, 0\.03\)\)/,
    );
    const fio = bloco(".conversa-linha[data-aberta='true']::before");
    expect(fio).toMatch(/width: 3px/);
    expect(fio).toMatch(/background: linear-gradient\(#c58ffa, #5b34d1\)/);
  });

  it('o painel do lead é opaco quando abre por cima da conversa (celular) e translúcido ao lado', () => {
    expect(bloco('.conversas-painel')).toMatch(/background: var\(--card\)/);
    const i = css.indexOf('@media (min-width: 768px)');
    expect(i).toBeGreaterThan(-1);
    expect(css.slice(i)).toMatch(/\.conversas-painel \{[^}]*rgba\(255, 255, 255, 0\.55\)/);
  });

  it('com "reduzir movimento" a lista não anima', () => {
    const i = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(i).toBeGreaterThan(-1);
    expect(css.slice(i)).toMatch(/\.conversa-linha[\s\S]*animation: none/);
  });
});
