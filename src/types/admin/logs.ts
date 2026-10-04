// Usuários → Logs (entrega 4). Espelha app/services/activity_events/feed.rb do backend.
export interface LogItem {
  id: string;
  tenant_schema: string;
  tenant_name: string;
  occurred_at: string;
  category: string;
  action: string;
  level: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_type: string | null;
  sensitive: boolean;
}

export interface LogsPage {
  items: LogItem[];
  next_before: string | null;
  tenants: { schema: string; name: string }[];
  categories: string[];
  errors: { tenant_name: string; message: string }[];
}

export type LogPeriod = '' | '24h' | '7d' | '30d' | '90d' | '12m';

export interface LogFilters {
  q: string;
  tenant: string | null;
  category: string;
  period: LogPeriod;
  sensitiveOnly: boolean;
  includeTeam: boolean;
}
