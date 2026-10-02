import { describe, expect, it } from 'vitest';
import type { Inbox } from '@/types/channels/inbox';
import { linhaDoTopo } from './topoDaConversa';

const inboxes = [
  { id: '7', name: 'Guatemala', phone_number: '+5511982350000' },
] as unknown as Inbox[];

describe('linhaDoTopo', () => {
  it('completo: número, telefone e responsável', () => {
    expect(
      linhaDoTopo({ inboxId: '7', inboxNome: 'Guatemala', inboxes, responsavel: 'Marina' }),
    ).toBe('Número Guatemala · (11) 98235-0000 · Responsável: Marina');
  });

  it('aceita id numérico', () => {
    expect(
      linhaDoTopo({ inboxId: 7, inboxNome: 'Guatemala', inboxes, responsavel: 'Marina' }),
    ).toContain('(11) 98235-0000');
  });

  it('sem telefone, a parte some', () => {
    const semFone = [{ id: '7', name: 'Guatemala' }] as unknown as Inbox[];
    expect(
      linhaDoTopo({
        inboxId: '7',
        inboxNome: 'Guatemala',
        inboxes: semFone,
        responsavel: 'Marina',
      }),
    ).toBe('Número Guatemala · Responsável: Marina');
  });

  it('sem responsável', () => {
    expect(linhaDoTopo({ inboxId: '7', inboxNome: 'Guatemala', inboxes, responsavel: null })).toBe(
      'Número Guatemala · (11) 98235-0000 · Sem responsável',
    );
  });

  it('sem nome do número, a parte "Número" some', () => {
    expect(linhaDoTopo({ inboxId: '7', inboxNome: '', inboxes, responsavel: 'Marina' })).toBe(
      '(11) 98235-0000 · Responsável: Marina',
    );
  });

  it('inboxes nulo: usa só o nome', () => {
    expect(
      linhaDoTopo({ inboxId: '7', inboxNome: 'Guatemala', inboxes: null, responsavel: 'Marina' }),
    ).toBe('Número Guatemala · Responsável: Marina');
  });
});
