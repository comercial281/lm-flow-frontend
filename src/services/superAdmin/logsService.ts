import api from '@/services/core/api';
import type { LogFilters, LogsPage } from '@/types/admin/logs';

interface Envelope<T> { success: boolean; data: T }

export const LOGS_POR_PAGINA = 30;

export const logsService = {
  async list(f: LogFilters, before?: string): Promise<LogsPage> {
    const params: Record<string, string | number> = { per_page: LOGS_POR_PAGINA };
    const q = f.q.trim();
    if (q) params.q = q;
    if (f.tenant) params.tenant = f.tenant;
    if (f.category) params.category = f.category;
    if (f.period) params.period = f.period;
    if (f.sensitiveOnly) params.sensitive_only = 'true';
    if (f.includeTeam) params.include_team = 'true';
    if (before) params.before = before;
    const res = await api.get('/super/logs', { params });
    return (res.data as Envelope<LogsPage>).data;
  },
};
