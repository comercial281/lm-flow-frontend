import api from '@/services/core/api';
import type { EdicaoDoPacote, MudancasDoPacote, PacoteDaLista, PacoteDetalhe, ResultadoDeAplicar } from '@/types/admin/pacotes';

export const pacotesService = {
  async listar(): Promise<PacoteDaLista[]> { return (await api.get('/super/packages')).data.data; },
  async obter(id: string): Promise<PacoteDetalhe> { return (await api.get(`/super/packages/${id}`)).data.data; },
  async criar(dados: { name: string; from_package_id?: string; from_tenant_id?: string }): Promise<PacoteDetalhe> {
    return (await api.post('/super/packages', dados)).data.data;
  },
  async previa(id: string, edicao: EdicaoDoPacote): Promise<{ clients_count: number; changes: MudancasDoPacote }> {
    return (await api.post(`/super/packages/${id}/preview_update`, edicao)).data.data;
  },
  async salvar(id: string, edicao: EdicaoDoPacote, aplicar: boolean): Promise<{ data: PacoteDetalhe; result: ResultadoDeAplicar | null }> {
    const r = await api.patch(`/super/packages/${id}`, { ...edicao, apply_to_clients: aplicar });
    return { data: r.data.data, result: r.data.result ?? null };
  },
  async apagar(id: string): Promise<void> { await api.delete(`/super/packages/${id}`); },
};
