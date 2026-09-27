import { describe, it, expect } from 'vitest';
import { criterionLabel, tenantsToShow, personDetail, reviewTotals, accountCreatedLabel } from './supportReviewRules';
import type { SupportReviewTenant } from '@/services/superLogs/superLogsService';

const pessoa = (over: Record<string, unknown> = {}) => ({
  id: 'u1', name: 'Fulano', email: 'fulano@lealmidia.com.br', role: 'Administrador',
  deactivated: false, last_sign_in_at: '2026-09-20T13:02:11Z', stays_support: false, ...over,
});
const cliente = (over: Partial<SupportReviewTenant> = {}): SupportReviewTenant => ({
  name: 'Apto Premium', slug: 'apto-premium', schema: 'tenant_apto', people: [], team_accounts: [], plain_passwords: 0,
  roles_seeded: true, error: null, ...over,
});

describe('lista dos @lealmidia.com.br fora da Equipe', () => {
  it('diz em português se o critério novo já vale', () => {
    expect(criterionLabel(false)).toBe('Critério novo DESLIGADO: hoje qualquer e-mail @lealmidia.com.br é suporte.');
    expect(criterionLabel(true)).toBe('Critério novo LIGADO: só quem está nesta Equipe é suporte.');
  });

  it('mostra só os clientes com gente para decidir ou que não deu para ler', () => {
    const lista = [cliente(), cliente({ slug: 'a', people: [pessoa()] }), cliente({ slug: 'b', error: 'caiu' })];
    expect(tenantsToShow(lista).map(t => t.slug)).toEqual(['a', 'b']);
  });

  it('também mostra o cliente que só tem contas de equipe fora do domínio', () => {
    const lista = [cliente(), cliente({ slug: 'c', team_accounts: [{ ...pessoa(), created_at: '2026-09-10T10:00:00Z' }] })];
    expect(tenantsToShow(lista).map(t => t.slug)).toEqual(['c']);
  });

  it('resume cargo, situação e último acesso numa linha', () => {
    expect(personDetail(pessoa())).toBe('Administrador · último acesso em 20/09/2026');
    expect(personDetail(pessoa({ deactivated: true, last_sign_in_at: null }))).toBe('Administrador · desativado · nunca entrou');
    expect(personDetail(pessoa({ stays_support: true }))).toBe('Administrador · último acesso em 20/09/2026 · continua suporte (fixo)');
  });

  it('formata a data de criação da conta em pt-BR', () => {
    expect(accountCreatedLabel('2026-09-10T10:00:00Z')).toBe('criada em 10/09/2026');
    expect(accountCreatedLabel(null)).toBe(null);
  });

  it('soma o que a publicação confere', () => {
    const lista = [
      cliente({ people: [pessoa(), pessoa({ id: 'u2' })], plain_passwords: 3 }),
      cliente({ roles_seeded: false }),
      cliente({ error: 'caiu', plain_passwords: null, roles_seeded: null }),
    ];
    expect(reviewTotals(lista)).toEqual({ people: 2, plainPasswords: 3, withoutRoles: 1, failed: 1, teamAccounts: 0 });
  });

  it('soma também as contas de equipe fora do domínio', () => {
    const lista = [
      cliente({ team_accounts: [{ ...pessoa(), created_at: null }, { ...pessoa({ id: 'u2' }), created_at: null }] }),
      cliente({ team_accounts: [{ ...pessoa({ id: 'u3' }), created_at: null }] }),
    ];
    expect(reviewTotals(lista)).toEqual({ people: 0, plainPasswords: 0, withoutRoles: 0, failed: 0, teamAccounts: 3 });
  });
});
