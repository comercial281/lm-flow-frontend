import { describe, expect, it } from 'vitest';
import { applyPeopleFilters, filterCounts, matchesSearch, numberState } from './peopleFilters';
import type { MemberNumber, TeamAccessMember } from '@/types/teamAccess';

const num = (over: Partial<MemberNumber> = {}): MemberNumber => ({
  inbox_id: '1', name: 'Comercial', phone: null, connection: 'connected', principal: true, never_connected: false, owner: true, ...over,
});
const pessoa = (over: Partial<TeamAccessMember> = {}): TeamAccessMember => ({
  id: '1', name: 'Ana Souza', email: 'a@x.com', confirmed: true, availability: 1,
  role: { key: 'agent', name: 'Corretor', chave_role: 'agent' },
  sees_all_inboxes: false, granted_inbox_ids: [], auto_inbox_ids: [], auto_access: {},
  all_numbers: [num()], last_seen_at: '2026-10-09T10:00:00Z', ...over,
});

describe('numberState', () => {
  it('nunca conectou espera conectar, mesmo com estado gravado', () => {
    expect(numberState({ connection: 'disconnected', never_connected: true })).toBe('waiting');
  });
  it('mapeia o resto', () => {
    expect(numberState({ connection: 'connected', never_connected: false })).toBe('connected');
    expect(numberState({ connection: 'connecting', never_connected: false })).toBe('waiting');
    expect(numberState({ connection: 'disconnected', never_connected: false })).toBe('disconnected');
    expect(numberState({ connection: null, never_connected: false })).toBe('unknown');
  });
});

describe('filterCounts', () => {
  const equipe = [
    pessoa({ id: '1' }),
    pessoa({ id: '2', all_numbers: [] }),
    pessoa({ id: '3', all_numbers: [num({ connection: 'disconnected' })] }),
    pessoa({ id: '4', last_seen_at: null }),
    // admin: sem números listados, nunca é "sem número"
    pessoa({ id: '5', sees_all_inboxes: true, all_numbers: [] }),
    // inativo não conta nos problemas
    pessoa({ id: '6', deactivated: true, all_numbers: [], last_seen_at: null }),
  ];

  it('conta cada filtro; admin e inativo não entram nos problemas', () => {
    expect(filterCounts(equipe)).toEqual({ todas: 6, sem_numero: 1, desconectado: 1, nao_entrou: 1 });
  });

  it('aplica o filtro escolhido', () => {
    expect(applyPeopleFilters(equipe, 'sem_numero', '').map(m => m.id)).toEqual(['2']);
    expect(applyPeopleFilters(equipe, 'todas', '')).toHaveLength(6);
  });

  it('servidor antigo sem all_numbers não quebra', () => {
    const velho = pessoa({ all_numbers: undefined });
    expect(filterCounts([velho]).sem_numero).toBe(1);
  });
});

describe('matchesSearch', () => {
  const ana = pessoa({ name: 'Ana Sousa', whatsapp_number: '(11) 94087-1974' });
  it('acha por nome sem acento nem caixa', () => {
    expect(matchesSearch(pessoa({ name: 'José' }), 'jose')).toBe(true);
    expect(matchesSearch(ana, 'SOUS')).toBe(true);
  });
  it('acha por dígitos do celular em qualquer formatação', () => {
    expect(matchesSearch(ana, '94087')).toBe(true);
    expect(matchesSearch(ana, '(11) 9408')).toBe(true);
    expect(matchesSearch(ana, '99999')).toBe(false);
  });
  it('texto sem dígitos não casa com celular', () => {
    expect(matchesSearch(ana, 'xyz')).toBe(false);
  });
});
