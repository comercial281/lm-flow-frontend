// src/services/superAdmin/dashboardBannersService.ts
// Área do Admin → Comunicação → Banner. Toda regra (medida da arte, público,
// datas) é do servidor: a tela mostra o motivo que ele devolve.
import api from '@/services/core/api';
import type {
  ArteDoBanner, BannerAdmin, CamposDoBanner, CargoDoBanner, ImobiliariaDoBanner, PublicoDoBanner,
} from '@/types/admin/dashboardBanners';

interface Envelope<T> { success: boolean; data: T }

export const dashboardBannersService = {
  async listar(): Promise<{ banners: BannerAdmin[]; imobiliarias: ImobiliariaDoBanner[] }> {
    const res = await api.get('/super/dashboard_banners');
    const corpo = res.data as Envelope<BannerAdmin[]> & { meta?: { tenants?: ImobiliariaDoBanner[] } };
    return { banners: corpo.data, imobiliarias: corpo.meta?.tenants ?? [] };
  },
  async criar(campos: CamposDoBanner): Promise<BannerAdmin> {
    const res = await api.post('/super/dashboard_banners', campos);
    return (res.data as Envelope<BannerAdmin>).data;
  },
  async salvar(id: string, campos: CamposDoBanner): Promise<BannerAdmin> {
    const res = await api.patch(`/super/dashboard_banners/${id}`, campos);
    return (res.data as Envelope<BannerAdmin>).data;
  },
  async enviarArte(id: string, arte: ArteDoBanner, arquivo: File): Promise<BannerAdmin> {
    const form = new FormData();
    form.append('file', arquivo);
    const res = await api.put(`/super/dashboard_banners/${id}/images/${arte}`, form);
    return (res.data as Envelope<BannerAdmin>).data;
  },
  async tirarArte(id: string, arte: ArteDoBanner): Promise<BannerAdmin> {
    const res = await api.delete(`/super/dashboard_banners/${id}/images/${arte}`);
    return (res.data as Envelope<BannerAdmin>).data;
  },
  async contarPublico(roles: CargoDoBanner[], tenantSlugs: string[]): Promise<PublicoDoBanner> {
    const res = await api.get('/super/dashboard_banners/audience', { params: { roles, tenant_slugs: tenantSlugs } });
    return (res.data as Envelope<PublicoDoBanner>).data;
  },
  /** 409 = o público mudou; o erro traz `audience` com o número novo. */
  async publicar(id: string, pessoas: number): Promise<BannerAdmin> {
    const res = await api.post(`/super/dashboard_banners/${id}/publish`, { expected_people: pessoas });
    return (res.data as Envelope<BannerAdmin>).data;
  },
  async tirarDoAr(id: string): Promise<BannerAdmin> {
    const res = await api.post(`/super/dashboard_banners/${id}/unpublish`);
    return (res.data as Envelope<BannerAdmin>).data;
  },
  async excluir(id: string): Promise<void> {
    await api.delete(`/super/dashboard_banners/${id}`);
  },
};
