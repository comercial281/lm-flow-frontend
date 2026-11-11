import { describe, expect, it } from 'vitest';
import {
  CAPTACAO_DE_COLEGA,
  DE_OUTRO_RESPONSAVEL,
  SEM_A_CHAVE,
  regraDoResponsavel,
  type EntradaDaRegra,
} from './responsavelProprio';

const base: EntradaDaRegra = {
  escolheQualquer: false, recebeOsProprios: true, meuId: 'eu',
  responsavelAntes: null, responsavelAgora: null, captadorAgora: null,
};
const regra = (e: Partial<EntradaDaRegra>) => regraDoResponsavel({ ...base, ...e });

describe('regraDoResponsavel', () => {
  it('quem lê a equipe escolhe qualquer um', () => {
    expect(regra({ escolheQualquer: true, recebeOsProprios: false, responsavelAntes: 'bia' }))
      .toEqual({ podeTrocar: true, euNoSeletor: false, podeMexerNaChave: true, motivo: null });
  });

  it('sem a chave, tudo travado', () => {
    expect(regra({ recebeOsProprios: false })).toMatchObject({ podeTrocar: false, podeMexerNaChave: false, motivo: SEM_A_CHAVE });
  });

  it('imóvel livre: se oferece, e a chave abre só depois de se escolher', () => {
    expect(regra({})).toMatchObject({ podeTrocar: true, euNoSeletor: true, podeMexerNaChave: false, motivo: null });
    expect(regra({ responsavelAgora: 'eu' })).toMatchObject({ podeMexerNaChave: true });
  });

  it('imóvel dele: pode se tirar e desligar a chave', () => {
    expect(regra({ responsavelAntes: 'eu', responsavelAgora: null })).toMatchObject({ podeTrocar: true, podeMexerNaChave: true });
  });

  it('imóvel de outro responsável: travado', () => {
    expect(regra({ responsavelAntes: 'bia', responsavelAgora: 'bia' }))
      .toMatchObject({ podeTrocar: false, euNoSeletor: false, podeMexerNaChave: false, motivo: DE_OUTRO_RESPONSAVEL });
  });

  it('captação de colega: não se oferece', () => {
    expect(regra({ captadorAgora: 'bia' })).toMatchObject({ euNoSeletor: false, motivo: CAPTACAO_DE_COLEGA });
  });

  it('captação dele mesmo: se oferece', () => {
    expect(regra({ captadorAgora: 'eu' })).toMatchObject({ euNoSeletor: true, motivo: null });
  });
});
