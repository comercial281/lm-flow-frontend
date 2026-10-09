import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// A aba Pessoas tem ~750 linhas e monta a tela com meia dúzia de serviços;
// montá-la num teste puxaria tudo. Lê o código-fonte, como o spec das rotas.
// O que se trava: a lista e a janela falam NÚMERO (spec 2b, critério 4), os
// chips da lista vêm de `all_numbers` (todos os números da pessoa, e não só os
// de que ela é dona) e a regra do dono entra pelo ponto único (useNumberOwnerRule)
// na janela "Gerenciar acesso".
const semComentarios = (arquivo: string) =>
  readFileSync(resolve(__dirname, arquivo), 'utf8')
    // Comentários fora (os de bloco, inclusive os `{/* */}` do JSX, e as linhas
    // que são só `//`): eles contam a história e podem citar o nome antigo.
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const codigo = semComentarios('PeopleTab.tsx');
const lista = semComentarios('people/PeopleList.tsx');
const chip = semComentarios('people/NumberChip.tsx');

describe('Equipe → Pessoas fala número', () => {
  it('nenhum texto de tela diz instância', () => {
    expect(codigo).not.toMatch(/inst[âa]ncia/i);
  });

  it('a lista e o chip nunca dizem instância nem canal', () => {
    for (const fonte of [lista, chip]) {
      expect(fonte).not.toMatch(/inst[âa]ncia/i);
      expect(fonte).not.toMatch(/\bcanal\b|\bcanais\b|\binbox\b/i);
    }
  });

  it('os chips vêm de all_numbers, não do `numbers` antigo (só os de que a pessoa é dona)', () => {
    expect(lista).toContain('member.all_numbers');
    expect(lista).not.toMatch(/member\.numbers\b/);
    expect(lista).toContain('<NumberChip');
  });

  it('o atalho Criar número só aparece com a permissão de criar número', () => {
    expect(lista).toContain('canCreateNumber &&');
    expect(codigo).toContain("canCreateNumber={can('channels', 'create')}");
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
