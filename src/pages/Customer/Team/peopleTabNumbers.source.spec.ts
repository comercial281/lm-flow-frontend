import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// A aba Pessoas tem ~750 linhas e monta a tela com meia dúzia de serviços;
// montá-la num teste puxaria tudo. Lê o código-fonte, como o spec das rotas.
// O que se trava: a coluna e a janela falam NÚMERO (spec 2b, critério 4), a
// coluna vem da regra testada (numbersColumnText) e a regra do dono entra pelo
// ponto único (useNumberOwnerRule).
const bruto = readFileSync(resolve(__dirname, 'PeopleTab.tsx'), 'utf8');
// Comentários fora (os de bloco, inclusive os `{/* */}` do JSX, e as linhas
// que são só `//`): eles contam a história e podem citar o nome antigo.
const codigo = bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Equipe → Pessoas fala número', () => {
  it('nenhum texto de tela diz instância', () => {
    expect(codigo).not.toMatch(/inst[âa]ncia/i);
  });

  it('a coluna vem da regra testada e troca de nome com a regra', () => {
    expect(codigo).toContain('numbersColumnText(member, numberOwnerRule)');
    expect(codigo).toContain('numberOwnerRule ? NUMBERS_COLUMN : LIBERATED_TITLE');
    expect(codigo).not.toContain('accessSummary');
  });

  it('a regra entra pelo ponto único, com o eco do retrato da equipe', () => {
    expect(codigo).toContain('useNumberOwnerRule(ownerRuleEcho)');
    expect(codigo).toContain('setOwnerRuleEcho(overview.number_owner_rule ?? null)');
  });

  it('a janela da pessoa mostra os Números de atendimento com a regra, e o Celular para avisos sempre', () => {
    expect(codigo).toMatch(/numberOwnerRule && \(\s*<div[^>]*>\s*<UILabel[\s\S]*?NUMBERS_TITLE/);
    expect(codigo).toContain('<OwnedNumbersList');
    expect(codigo).toContain('{NOTICE_PHONE_LABEL}');
  });
});
