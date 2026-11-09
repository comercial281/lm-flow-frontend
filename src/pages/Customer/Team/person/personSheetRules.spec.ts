import { describe, expect, it } from 'vitest';
import { UFS, buildUserPatch, creciDaPessoa, type PersonDraft } from './personSheetRules';

const pessoa = { name: 'Fulano', whatsapp_number: '5511999998888', creci: '12345-F', creci_state: 'SP' };
const rascunho = (parcial: Partial<PersonDraft> = {}): PersonDraft => ({
  name: 'Fulano', phone: '11999998888', cargo: null, creci: '12345-F', creciState: 'SP', ...parcial,
});

describe('CRECI e UF na ficha da pessoa', () => {
  it('igual ao gravado (com espaço em volta) não vai no patch', () => {
    expect(buildUserPatch(pessoa, rascunho({ creci: ' 12345-F ' }), null)).toEqual({});
  });

  it('número novo vai; apagado vai como nulo', () => {
    expect(buildUserPatch(pessoa, rascunho({ creci: '999-F' }), null)).toEqual({ creci: '999-F' });
    expect(buildUserPatch(pessoa, rascunho({ creci: '' }), null)).toEqual({ creci: null });
  });

  it('UF trocada vai; vazia vai como nula', () => {
    expect(buildUserPatch(pessoa, rascunho({ creciState: 'RJ' }), null)).toEqual({ creci_state: 'RJ' });
    expect(buildUserPatch(pessoa, rascunho({ creciState: '' }), null)).toEqual({ creci_state: null });
  });

  it('pessoa sem CRECI gravado e campo vazio: nada muda', () => {
    expect(buildUserPatch({ ...pessoa, creci: null, creci_state: null }, rascunho({ creci: '', creciState: '' }), null)).toEqual({});
  });

  it('as 27 UFs', () => {
    expect(UFS).toHaveLength(27);
    expect(UFS).toContain('DF');
  });

  it('como o CRECI aparece só pra leitura', () => {
    expect(creciDaPessoa({ creci: '12345-F', creci_state: 'SP' })).toBe('CRECI 12345-F/SP');
    expect(creciDaPessoa({ creci: '12345-F', creci_state: null })).toBe('CRECI 12345-F');
    expect(creciDaPessoa({ creci: null, creci_state: 'SP' })).toBeNull();
  });
});
