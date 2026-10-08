// src/features/cardDoLead/pagina/textoDosDias.spec.ts
import { describe, expect, it } from 'vitest';
import { textoDosDias } from './textoDosDias';

describe('textoDosDias', () => {
  it('etapa nunca visitada: nada', () => {
    expect(textoDosDias(undefined)).toBe('');
  });
  it('menos de um dia completo', () => {
    expect(textoDosDias({ stage_id: 's1', days: 0, current: true })).toBe('menos de 1 dia');
  });
  it('um e vários', () => {
    expect(textoDosDias({ stage_id: 's1', days: 1, current: false })).toBe('1 dia');
    expect(textoDosDias({ stage_id: 's1', days: 92, current: false })).toBe('92 dias');
  });
});
