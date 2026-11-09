import { describe, expect, it } from 'vitest';
import { linhaDoAtendimento, linhaDoCreci } from './creci';

describe('CRECI no site', () => {
  it('linha do CRECI da imobiliária', () => {
    expect(linhaDoCreci('J-12345')).toBe('CRECI J-12345');
    expect(linhaDoCreci('  ')).toBeNull();
    expect(linhaDoCreci(null)).toBeNull();
    expect(linhaDoCreci(undefined)).toBeNull();
  });

  it('linha do atendimento com o CRECI de quem atende', () => {
    expect(linhaDoAtendimento('Fulano', '12345-F/SP')).toBe('Atendimento: Fulano · CRECI 12345-F/SP');
    expect(linhaDoAtendimento('Fulano', null)).toBe('Atendimento: Fulano');
    expect(linhaDoAtendimento(null, '12345-F/SP')).toBeNull();
    expect(linhaDoAtendimento(' ', '12345-F/SP')).toBeNull();
  });
});
