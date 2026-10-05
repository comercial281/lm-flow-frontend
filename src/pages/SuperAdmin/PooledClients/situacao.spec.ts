import { describe, it, expect } from 'vitest';
import { rotuloDaSituacao } from './situacao';

describe('rotuloDaSituacao', () => {
  it('usa a situação do servidor, com os rótulos de sempre', () => {
    expect(rotuloDaSituacao('ativo', 'trial').label).toBe('Ativo');
    expect(rotuloDaSituacao('provisionando', 'trial')).toMatchObject({ label: 'Provisionando', provisionando: true });
    expect(rotuloDaSituacao('congelado', 'suspended').label).toBe('Suspenso');
    expect(rotuloDaSituacao('com_erro', 'error').label).toBe('Erro');
    expect(rotuloDaSituacao('arquivado', 'suspended').label).toBe('Arquivado');
  });

  it('servidor antigo (sem situation) cai no status', () => {
    expect(rotuloDaSituacao(undefined, 'active').label).toBe('Ativo');
    expect(rotuloDaSituacao(undefined, 'suspended').label).toBe('Suspenso');
  });
});
