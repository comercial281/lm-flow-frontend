// Regras de exibição da lista "@lealmidia.com.br nos clientes, fora desta
// Equipe" (Fase 1 — Cargos). O servidor decide quem entra na lista; aqui só se
// escreve em português o que ele mandou.
import type { SupportReviewPerson, SupportReviewTenant } from '@/services/superLogs/superLogsService';

export function criterionLabel(enabled: boolean): string {
  return enabled
    ? 'Critério novo LIGADO: só quem está nesta Equipe é suporte.'
    : 'Critério novo DESLIGADO: hoje qualquer e-mail @lealmidia.com.br é suporte.';
}

export function tenantsToShow(tenants: SupportReviewTenant[]): SupportReviewTenant[] {
  return tenants.filter(t => t.people.length > 0 || t.team_accounts.length > 0 || !!t.error);
}

const dataBR = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

export function personDetail(p: SupportReviewPerson): string {
  const partes = [p.role];
  if (p.deactivated) partes.push('desativado');
  partes.push(p.last_sign_in_at ? `último acesso em ${dataBR(p.last_sign_in_at)}` : 'nunca entrou');
  if (p.stays_support) partes.push('continua suporte (fixo)');
  return partes.join(' · ');
}

export function accountCreatedLabel(createdAt: string | null): string | null {
  return createdAt ? `criada em ${dataBR(createdAt)}` : null;
}

export function reviewTotals(tenants: SupportReviewTenant[]) {
  return {
    people: tenants.reduce((n, t) => n + t.people.length, 0),
    withoutRoles: tenants.filter(t => t.roles_seeded === false).length,
    failed: tenants.filter(t => !!t.error).length,
    teamAccounts: tenants.reduce((n, t) => n + t.team_accounts.length, 0),
  };
}
