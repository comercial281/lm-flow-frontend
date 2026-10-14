import { describe, expect, it } from 'vitest';
import { customAttributesService } from './customAttributesService';

describe('customAttributesService.generateAttributeKey', () => {
  it("chave sem acento: 'Média do Cliente' → 'media_do_cliente'", () => {
    expect(customAttributesService.generateAttributeKey('Média do Cliente')).toBe('media_do_cliente');
  });

  it('cedilha, til e símbolos viram letra simples ou sublinhado', () => {
    expect(customAttributesService.generateAttributeKey('Coração  & Ação!')).toBe('coracao_acao');
  });

  it('mantém o que já funcionava', () => {
    expect(customAttributesService.generateAttributeKey('Prioridade do Cliente')).toBe('prioridade_do_cliente');
  });
});
