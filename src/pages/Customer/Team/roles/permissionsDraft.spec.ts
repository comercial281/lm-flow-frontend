import { describe, expect, it } from 'vitest';
import { changesByRole, clearRole, countChanges, dropEntries, effectiveState, toggle } from './permissionsDraft';

describe('permissionsDraft', () => {
  it('parcial liga; ligar de novo desliga', () => {
    const d1 = toggle({}, 2, 'a', 'partial');
    expect(d1).toEqual({ 2: { a: true } });
    expect(effectiveState(d1, 2, 'a', 'partial')).toBe('on');
    const d2 = toggle(d1, 2, 'a', 'partial');
    expect(d2).toEqual({ 2: { a: false } });
  });

  it('voltar ao valor do servidor tira do rascunho', () => {
    const d1 = toggle({}, 2, 'a', 'on');
    expect(d1).toEqual({ 2: { a: false } });
    expect(toggle(d1, 2, 'a', 'on')).toEqual({});
    expect(toggle(toggle({}, 3, 'b', 'off'), 3, 'b', 'off')).toEqual({});
  });

  it('conta e agrupa por cargo, sem mutar', () => {
    const base = {};
    const d = toggle(toggle(toggle(base, 2, 'a', 'off'), 2, 'b', 'on'), 3, 'a', 'off');
    expect(base).toEqual({});
    expect(countChanges(d)).toBe(3);
    expect(changesByRole(d)).toEqual([
      { roleId: 2, changes: { a: true, b: false } },
      { roleId: 3, changes: { a: true } },
    ]);
    expect(clearRole(d, 2)).toEqual({ 3: { a: true } });
  });

  it('sem mudança usa o estado do servidor', () => {
    expect(effectiveState({}, 1, 'x', 'partial')).toBe('partial');
    expect(countChanges({})).toBe(0);
  });

  it('dropEntries tira só as linhas soltas e devolve o mesmo objeto quando nada sai', () => {
    const d = { 3: { a: true, b: false }, 9: { a: true } };
    expect(dropEntries(d, () => false)).toBe(d);
    expect(dropEntries(d, (id, k) => id === 9 || k === 'b')).toEqual({ 3: { a: true } });
  });
});
