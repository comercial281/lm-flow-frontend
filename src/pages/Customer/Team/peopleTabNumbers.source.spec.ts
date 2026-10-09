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
const ficha = semComentarios('person/PersonSheet.tsx');

describe('Equipe → Pessoas fala número', () => {
  it('nenhum texto de tela diz instância', () => {
    expect(codigo).not.toMatch(/inst[âa]ncia/i);
  });

  it('a lista, o chip e a ficha nunca dizem instância nem canal', () => {
    for (const fonte of [lista, chip, ficha]) {
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

  // A ficha (que substituiu o "Gerenciar acesso") lista TODOS os números da
  // pessoa, separando o dono de quem só atende; o principal só se escolhe com a
  // regra do dono (sem ela o principal não decide nada).
  it('a ficha mostra todos os números, o dono e o celular para avisos', () => {
    expect(ficha).toContain('member.all_numbers');
    expect(ficha).not.toMatch(/member\.numbers\b/);
    expect(ficha).toContain('OWNER_TITLE');
    expect(ficha).toContain("'Atende as conversas'");
    expect(ficha).toContain('canEdit && numberOwnerRule && owned.length > 1');
    expect(ficha).toContain('numbersService.setUserPrimary(');
    expect(ficha).toContain('Recebe o link de acesso e os avisos de lead novo.');
    expect(codigo).toContain('numberOwnerRule={numberOwnerRule}');
  });
});
