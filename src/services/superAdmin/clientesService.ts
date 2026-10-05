import api from '@/services/core/api';
import type { CatalogItem } from '@/pages/SuperAdmin/featureCatalog';
import type { ClientePooled, NovaPessoa, Pessoa } from '@/types/admin/clientes';

export type AcaoDoCliente = 'suspend' | 'unsuspend' | 'archive' | 'unarchive';
const base = (id: string) => `/super/pooled_tenants/${id}`;

export const clientesService = {
  async listar(arquivados: boolean): Promise<ClientePooled[]> {
    const r = await api.get(`/super/pooled_tenants${arquivados ? '?archived=true' : ''}`);
    return r.data?.data ?? [];
  },
  async obter(id: string): Promise<ClientePooled> {
    const r = await api.get(base(id));
    return r.data.data;
  },
  async atualizar(id: string, patch: Record<string, unknown>): Promise<ClientePooled> {
    const r = await api.patch(base(id), patch);
    return r.data.data;
  },
  async acao(id: string, acao: AcaoDoCliente): Promise<void> {
    await api.post(`${base(id)}/${acao}`);
  },
  async excluir(id: string, slug: string): Promise<void> {
    await api.delete(base(id), { data: { confirm_slug: slug } });
  },
  async entrar(id: string): Promise<string> {
    const r = await api.post(`${base(id)}/sso`);
    return r.data.data.url;
  },
  async pessoas(id: string): Promise<Pessoa[]> {
    const r = await api.get(`${base(id)}/members`);
    return r.data?.data ?? [];
  },
  async adicionarPessoa(id: string, dados: NovaPessoa): Promise<{ access_url: string | null; whatsapp?: { sent?: boolean; skipped?: string; error?: string } }> {
    const r = await api.post(`${base(id)}/add_member`, dados);
    return { access_url: r.data.access_url ?? null, whatsapp: r.data.whatsapp };
  },
  async removerPessoa(id: string, userId: string): Promise<void> {
    await api.post(`${base(id)}/remove_member`, { user_id: userId });
  },
  async linkDeAcesso(id: string, userId: string): Promise<string> {
    const r = await api.post(`${base(id)}/access_link`, { user_id: userId });
    return r.data.data.url;
  },
  async enviarLink(id: string, userId: string, instancia?: string): Promise<{ sent?: boolean; skipped?: string; error?: string }> {
    const r = await api.post(`${base(id)}/send_access_link`, { user_id: userId, instance: instancia });
    return r.data.whatsapp ?? {};
  },
  async funcoes(id: string): Promise<{ features: Record<string, boolean>; catalog: CatalogItem[] }> {
    const r = await api.get(`${base(id)}/features`);
    return { features: r.data.data.features, catalog: r.data.data.catalog };
  },
  async mudarFuncoes(id: string, patch: Record<string, boolean>): Promise<Record<string, boolean>> {
    const r = await api.patch(`${base(id)}/update_features`, { features: patch });
    return r.data.data.features;
  },
  async dadosDeProvisionamento(): Promise<{ whatsapp_groups: unknown[]; templates: unknown[] }> {
    const r = await api.get('/super/pooled_tenants/provision_data');
    return r.data.data;
  },
};
