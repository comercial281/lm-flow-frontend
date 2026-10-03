import { describe, expect, it } from 'vitest';
import { secoesDoCadastro, tipoDaUrl } from './secoesDoCadastro';

const ids = (k: 'development' | 'resale', editando = false) => secoesDoCadastro(k, { editando }).map(s => s.id);

describe('secoesDoCadastro', () => {
  it('empreendimento tem Construtora, Obra e Tipologias; nunca Proprietário nem Dados internos', () => {
    expect(ids('development')).toEqual(['basico', 'construtora', 'localizacao', 'obra', 'tipologias', 'detalhesVenda',
      'caracteristicas', 'midia', 'descricao', 'equipe', 'comissao']);
  });
  it('revenda tem Proprietário, Valores, Composição e Dados internos', () => {
    const r = ids('resale');
    expect(r).toContain('proprietario');
    expect(r).toContain('dadosInternos');
    expect(r).not.toContain('construtora');
    expect(r).not.toContain('obra');
  });
  it('Onde divulgar só na edição, por último', () => {
    expect(ids('resale')).not.toContain('ondeDivulgar');
    expect(ids('resale', true).at(-1)).toBe('ondeDivulgar');
  });
  it('tipo pela URL', () => {
    expect([tipoDaUrl('empreendimento'), tipoDaUrl('revenda'), tipoDaUrl('x'), tipoDaUrl(null)])
      .toEqual(['development', 'resale', null, null]);
  });
});
