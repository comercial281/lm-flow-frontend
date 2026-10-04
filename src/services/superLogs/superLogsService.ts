import apiClient from '@/services/core/api';

export interface Whoami {
  email?: string;
  is_owner: boolean;
  is_admin: boolean;
  is_internal: boolean;
}

export interface TeamMember {
  id: string;
  email: string;
  name?: string;
  can_access_admin: boolean;
  active: boolean;
  owner: boolean;
  added_by?: string;
  created_at?: string;
}

/** Fase 1 (Cargos): @lealmidia.com.br / fantasmas fora da Equipe, por cliente (GET /super/support_review). */
export interface SupportReviewPerson {
  id: string;
  name: string;
  email: string;
  role: string;
  deactivated: boolean;
  last_sign_in_at: string | null;
  /** Fantasma fixo: continua suporte mesmo com o critério novo ligado. */
  stays_support: boolean;
}

/** Conta que já existe no cliente com e-mail que ESTÁ na Equipe mas não é @lealmidia.com.br nem fantasma. */
export type SupportReviewTeamAccount = SupportReviewPerson & { created_at: string | null };

export interface SupportReviewTenant {
  name: string;
  slug: string;
  schema: string;
  people: SupportReviewPerson[];
  team_accounts: SupportReviewTeamAccount[];
  plain_passwords: number | null;
  roles_seeded: boolean | null;
  error: string | null;
}

export interface SupportReview {
  team_list_enabled: boolean;
  tenants: SupportReviewTenant[];
}

const superLogsService = {
  // Equipe Leal Mídia + quem sou eu (pro gate do admin)
  whoami: () => apiClient.get<{ data: Whoami }>('/super/whoami'),
  team: () => apiClient.get<{ data: { members: TeamMember[] } }>('/super/team'),
  addMember: (payload: { email: string; name?: string; can_access_admin?: boolean }) =>
    apiClient.post<{ data: { member: TeamMember } }>('/super/team', payload),
  updateMember: (id: string, payload: Partial<Pick<TeamMember, 'name' | 'can_access_admin' | 'active'>>) =>
    apiClient.patch<{ data: { member: TeamMember } }>(`/super/team/${id}`, payload),
  removeMember: (id: string) => apiClient.delete(`/super/team/${id}`),

  // Fase 1 (Cargos): lista dos @lealmidia.com.br fora da Equipe, por cliente.
  supportReview: () => apiClient.get<{ data: SupportReview }>('/super/support_review'),
};

export default superLogsService;
