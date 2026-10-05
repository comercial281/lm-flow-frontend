import api from '@/services/core/api';
import type { Atencao, Numeros, PeriodoNumeros } from '@/types/admin/overview';

interface Envelope<T> {
  success: boolean;
  data: T;
}

export const overviewService = {
  async atencao(): Promise<Atencao> {
    const res = await api.get('/super/overview/attention');
    return (res.data as Envelope<Atencao>).data;
  },
  async numeros(f: { periodo: PeriodoNumeros; tenant: string | null; refresh?: boolean }): Promise<Numeros> {
    const params: Record<string, string> = { periodo: f.periodo };
    if (f.tenant) params.tenant = f.tenant;
    if (f.refresh) params.refresh = '1';
    const res = await api.get('/super/overview/numbers', { params });
    return (res.data as Envelope<Numeros>).data;
  },
};
