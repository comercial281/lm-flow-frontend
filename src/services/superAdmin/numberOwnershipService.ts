import api from '@/services/core/api';

/**
 * CONFERÊNCIA DE NÚMEROS (painel raiz): de quem é cada número de WhatsApp de
 * cada cliente, segundo a regra única do servidor. Só leitura.
 *
 * Backend: /api/v1/super/number_ownership (Numbers::OwnershipDiagnosis).
 * A lista é barata; o diagnóstico é de UM cliente por pedido (o servidor corta
 * pedido longo em 15 s), por isso a tela pede em lotes.
 */
export type OwnershipVerdict = 'migrates' | 'needs_review' | 'unreadable';
export type OwnershipSource = 'responsible' | 'roleta' | 'liberated' | 'shared';
export type NumberConnection = 'connected' | 'connecting' | 'disconnected' | 'unknown';

export interface OwnershipTenant {
  id: string;
  name: string;
  slug: string;
}

export interface OwnershipPersonRef {
  id: string;
  name: string;
  active: boolean;
}

export interface OwnershipRoleta {
  id: string;
  name: string;
  /** Entrada do número E roleta ligadas. Desligada não manda em nada. */
  active: boolean;
  shared: boolean;
  brokers: OwnershipPersonRef[];
}

export interface OwnershipLiberated {
  id: string;
  name: string;
  /** false = gestor ou administrador (não conta na regra do único liberado). */
  corretor: boolean;
  active: boolean;
}

export interface OwnershipNumber {
  inbox_id: string;
  name: string;
  phone: string | null;
  connection: NumberConnection;
  responsible: OwnershipPersonRef | null;
  roletas: OwnershipRoleta[];
  liberated: OwnershipLiberated[];
  /** null = Compartilhado (da imobiliária). */
  suggested_owner: OwnershipPersonRef | null;
  source: OwnershipSource;
  source_roleta: string | null;
  phone_matches: boolean;
  /** Já em português, escritos pelo servidor. Vazio = sem conflito. */
  conflicts: string[];
}

export interface OwnershipPerson {
  id: string;
  name: string;
  corretor: boolean;
  active: boolean;
  numbers: { inbox_id: string; name: string }[];
  no_number: boolean;
}

export interface OwnershipSummary {
  numbers: number;
  owned: number;
  shared: number;
  needs_review: number;
}

export interface OwnershipDiagnosis {
  tenant: OwnershipTenant;
  verdict: OwnershipVerdict;
  /** Motivo quando verdict = 'unreadable'. */
  reason: string | null;
  summary: OwnershipSummary;
  numbers: OwnershipNumber[];
  people: OwnershipPerson[];
  read_at: string;
}

const numberOwnershipService = {
  listTenants: () => api.get<{ data: OwnershipTenant[] }>('/super/number_ownership'),
  diagnose: (tenantId: string, refresh = false) =>
    api.get<{ data: OwnershipDiagnosis }>(`/super/number_ownership/${tenantId}`, {
      params: refresh ? { refresh: 1 } : {},
    }),
};

export default numberOwnershipService;
