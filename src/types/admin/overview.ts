// Visão Geral do admin (entrega 6): formato de GET /super/overview/attention e /numbers.
export type Gravidade = 'vermelho' | 'amarelo';

export interface NumeroCaido {
  inbox_id: number | string;
  name: string;
  phone: string | null;
  since: string | null;
}

export type Problema =
  | { kind: 'numero_caido'; severity: Gravidade; numbers: NumeroCaido[] }
  | { kind: 'erro_criacao'; severity: Gravidade }
  | { kind: 'ia_falhando'; severity: Gravidade; count: number }
  | { kind: 'custo_ia_alto'; severity: Gravidade; last_24h_brl: number; daily_avg_brl: number }
  | { kind: 'aviso_nao_chega'; severity: Gravidade; people: number }
  | { kind: 'chamado_sem_resposta'; severity: Gravidade; count: number; ticket_id: string | null };

export interface ClienteComProblema {
  schema: string;
  name: string;
  slug: string | null;
  severity: Gravidade;
  problems: Problema[];
}

export interface Ilegivel {
  name: string;
  message: string;
}

export type Situacao = 'ativo' | 'provisionando' | 'congelado' | 'com_erro';

export interface Atencao {
  counts: Record<Situacao, number>;
  clients: ClienteComProblema[];
  ok_count: number;
  generated_at: string;
  unreadable: Ilegivel[];
}

export type PeriodoNumeros = 'hoje' | '7d' | '30d' | 'mes_atual' | 'mes_passado';

export interface TotaisNumeros {
  leads: number;
  conversations: number;
  users_active: number;
  ai_attended: number;
  ai_visits: number;
  ai_cost_brl: number | null;
  users_total?: number;
  users_missing?: number;
}

export interface LinhaCliente {
  schema: string;
  name: string;
  readable: boolean;
  ai_cost_brl: number | null;
  leads?: number;
  conversations?: number;
  users_active?: number;
  users_total?: number;
  users_missing?: number;
  ai_attended?: number;
  ai_visits?: number;
}

export interface Numeros {
  generated_at: string;
  period: {
    key: PeriodoNumeros;
    bucket: 'hour' | 'day';
    starts_at: string;
    ends_at: string;
    prev_starts_at: string;
    prev_ends_at: string;
  };
  tenants: { schema: string; name: string }[];
  totals: TotaisNumeros;
  previous_totals: TotaisNumeros;
  series: { bucket: string; leads: number; conversations: number }[];
  clients: LinhaCliente[];
  structure: { brl: number; launched: string[]; missing: string[] } | null;
  unreadable: Ilegivel[];
}
