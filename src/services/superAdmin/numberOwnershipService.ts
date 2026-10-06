import api from '@/services/core/api';

/**
 * CONFERÊNCIA DE NÚMEROS (painel raiz): de quem é cada número de WhatsApp de
 * cada cliente, segundo a regra única do servidor. Lê — e, desde a fase 2b.1,
 * LIGA/DESLIGA a regra do dono do número, cliente a cliente (escrita em
 * produção: só com o ok do dono do produto).
 *
 * Backend: /api/v1/super/number_ownership (Numbers::OwnershipDiagnosis).
 * A lista é barata; o diagnóstico é de UM cliente por pedido (o servidor corta
 * pedido longo em 15 s), por isso a tela pede em lotes.
 */
export type OwnershipVerdict = 'migrates' | 'needs_review' | 'unreadable';
export type OwnershipSource = 'responsible' | 'roleta' | 'liberated' | 'shared';
export type NumberConnection = 'connected' | 'connecting' | 'disconnected' | 'unknown';

/**
 * Entrega 4 (Números conectados): a situação do número, decidida pelo servidor
 * (Numbers::Situation). A tela nunca deduz isto do estado cru da conexão.
 */
export type NumberSituation = 'connected' | 'connecting' | 'disconnected' | 'never' | 'official' | 'unknown';

/** Entrega 4: quantos números de cada situação o cliente tem (lido na hora pela lista). */
export interface ConnectionSummary {
  connected: number;
  connecting: number;
  /** Caídos: a mesma régua da Atenção. */
  down: number;
  never: number;
  official: number;
  unknown: number;
  total: number;
}

export interface OwnershipTenant {
  id: string;
  name: string;
  slug: string;
  /** Só na lista (entrega 4): o schema, que o ?cliente= da Atenção usa. */
  schema?: string;
  /** Só na lista (entrega 4). null = não deu para ler a conexão deste cliente. */
  connection_summary?: ConnectionSummary | null;
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
  /** Entrega 4: lida na hora pelo servidor, por cima da conferência guardada. */
  situation: NumberSituation;
  /** ISO de quando caiu; só no `disconnected`. */
  disconnected_at: string | null;
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
  /**
   * Fase 2b.1: o código de máquina de cada conflito, na MESMA ordem de
   * `conflicts`. A tela escolhe a dica pelo código, nunca lendo a frase.
   * Ausente = servidor antigo.
   */
  conflict_codes?: string[];
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

/** Fase 2b.1: o último Ligar/Desligar deste cliente. */
export interface OwnershipRuleLast {
  action: 'enable' | 'disable';
  /** ISO com o fuso do servidor (ex.: 2026-09-28T15:04:05-03:00). */
  at: string;
  by: string;
  /** Quantos donos o Ligar gravou (0 no Desligar). */
  changed: number;
}

/** Fase 2b.1: a regra do dono do número vale neste cliente? */
export interface OwnershipRule {
  enabled: boolean;
  last: OwnershipRuleLast | null;
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
  /** Fase 2b.1. Ausente = servidor antigo (a tela não oferece Ligar). */
  rule?: OwnershipRule | null;
}

/** Entrega 4: um número da Leal Mídia (instância da plataforma). Nunca vem token. */
export interface PlatformNumber {
  name: string;
  phone: string | null;
  status: NumberSituation; // números do public seguem a régua da Atenção (podem vir 'never')
  /** ISO de quando caiu; o servidor pode não mandar. */
  disconnected_at?: string | null;
}

export interface PlatformNumbers {
  /** true = o servidor não conseguiu ler a Evolution agora. */
  unreadable: boolean;
  numbers: PlatformNumber[];
}

const numberOwnershipService = {
  listTenants: () => api.get<{ data: OwnershipTenant[] }>('/super/number_ownership'),
  diagnose: (tenantId: string, refresh = false) =>
    api.get<{ data: OwnershipDiagnosis }>(`/super/number_ownership/${tenantId}`, {
      params: refresh ? { refresh: 1 } : {},
    }),
  /** Ligar dono do número: grava os donos sugeridos e liga a regra. 422 = recusa com motivo. */
  enableRule: (tenantId: string) =>
    api.post<{ data: OwnershipDiagnosis }>(`/super/number_ownership/${tenantId}/enable`),
  /** Desligar dono do número: só desliga a regra (os donos ficam gravados). */
  disableRule: (tenantId: string) =>
    api.post<{ data: OwnershipDiagnosis }>(`/super/number_ownership/${tenantId}/disable`),
  /** Entrega 4: os números da Leal Mídia (guardado 60 s no servidor). */
  platformNumbers: () => api.get<{ data: PlatformNumbers }>('/super/number_ownership/platform_numbers'),
};

export default numberOwnershipService;
