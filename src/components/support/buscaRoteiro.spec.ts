import { describe, it, expect } from 'vitest';
import { buscarPerguntas, normalizar } from './buscaRoteiro';

describe('busca do roteiro', () => {
  it('ignora acento e maiúscula', () => {
    expect(normalizar('Não CHEGOU')).toBe('nao chegou');
    expect(buscarPerguntas('LEAD NAO CHEGOU')).toContain('lead-nao-chegou');
  });

  it('acha por sinônimo', () => {
    expect(buscarPerguntas('qr code')).toContain('conectar-whatsapp');
  });

  it('todas as palavras precisam aparecer', () => {
    expect(buscarPerguntas('senha imovel')).toEqual([]);
  });

  it('termo vazio devolve todas as perguntas', () => {
    expect(buscarPerguntas('  ').length).toBeGreaterThanOrEqual(8);
  });
});
