import { describe, expect, it } from 'vitest';
import { vencido } from './emDia';

describe('vencido (f2-07)', () => {
  it('vence no dia do prazo e depois dele', () => {
    expect(vencido({ stale_due_on: '2026-10-11' }, '2026-10-11')).toBe(true);
    expect(vencido({ stale_due_on: '2026-10-01' }, '2026-10-11')).toBe(true);
    expect(vencido({ stale_due_on: '2026-10-12' }, '2026-10-11')).toBe(false);
    expect(vencido({ stale_due_on: null }, '2026-10-11')).toBe(false);
  });
});
