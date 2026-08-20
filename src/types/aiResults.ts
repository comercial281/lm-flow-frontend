// Resultados da IA — os números que a Leal Mídia vê no painel raiz e que o
// cliente vê na aba da própria IA.
//
// Os dois lados leem O MESMO formato porque leem a MESMA medição no backend. Se
// o cliente abrir a aba dele e vir 9 visitas enquanto a tela que mostramos a ele
// diz 11, a conversa seguinte não é sobre a diferença: é sobre qual dos dois
// painéis mente. Por isso os tipos moram aqui, e não dentro de um dos serviços.

export interface PerformancePoint {
  day: string;
  leads: number;
  replies: number;
  visits: number;
}

export interface PerformanceCounts {
  ai_leads: number;
  replies: number;
  failed: number;
  skipped: number;
  runs: number;
  after_hours_replies: number;
  attended: number;
  answered: number;
  qualified: number;
  hot: number;
  handoffs: number;
  visits: number;
  visits_completed: number;
  visits_upcoming: number;
  agents_total: number;
  agents_enabled: number;
  // Ausente na aba do cliente de propósito: é o que a Leal Mídia paga à
  // Anthropic, não o que o cliente paga. Mostrá-lo ali entregaria a margem na
  // tela do próprio cliente.
  cost_usd?: number;
  // null (e não 0) quando não houve atendimento no período: "0%" acusaria a IA
  // de um fracasso que não houve. A tela mostra "—" nesse caso.
  reply_rate: number | null;
  qualify_rate: number | null;
  median_latency_ms: number | null;
}

export interface PerformanceTenant extends PerformanceCounts {
  tenant_slug: string | null;
  tenant_name: string;
  series: PerformancePoint[];
}

export interface PerformanceTotals extends PerformanceCounts {
  clients: number;
}

// Painel raiz: todos os clientes de uma vez.
export interface PerformanceReport {
  days: number;
  since: string;
  generated_at: string;
  totals: PerformanceTotals;
  tenants: PerformanceTenant[];
  series: PerformancePoint[];
}

// Aba do cliente: uma IA só. `null` quando essa IA ainda não tem registro.
export interface AgentPerformance extends PerformanceCounts {
  days: number;
  since: string;
  series: PerformancePoint[];
}
