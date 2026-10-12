import { describe, expect, it } from 'vitest';
import { podeMarcarEmDia, vencido } from './emDia';

describe('vencido (f2-07)', () => {
  it('vence no dia do prazo e depois dele', () => {
    expect(vencido({ stale_due_on: '2026-10-11' }, '2026-10-11')).toBe(true);
    expect(vencido({ stale_due_on: '2026-10-01' }, '2026-10-11')).toBe(true);
    expect(vencido({ stale_due_on: '2026-10-12' }, '2026-10-11')).toBe(false);
    expect(vencido({ stale_due_on: null }, '2026-10-11')).toBe(false);
  });
});

describe('podeMarcarEmDia (corretor, 12/10/2026)', () => {
  it('segue o que o servidor diz de cada imóvel', () => {
    expect(podeMarcarEmDia({ can_confirm_current: true }, false)).toBe(true);
    expect(podeMarcarEmDia({ can_confirm_current: false }, true)).toBe(false);
  });

  it('servidor antigo (sem o campo): só quem edita imóvel', () => {
    expect(podeMarcarEmDia({}, true)).toBe(true);
    expect(podeMarcarEmDia({}, false)).toBe(false);
  });
});
