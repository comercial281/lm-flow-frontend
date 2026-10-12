// src/services/dashboard/bannersService.ts
// Banner da Dashboard, lado de quem usa. O servidor decide o que cada pessoa vê.
import api from '@/services/core/api';
import type { BannerDaDashboard } from '@/types/admin/dashboardBanners';

export const bannersService = {
  async meus(): Promise<BannerDaDashboard[]> {
    const res = await api.get('/dashboard_banners');
    return (res.data?.data ?? []) as BannerDaDashboard[];
  },
  async vistos(ids: string[]): Promise<void> {
    await api.post('/dashboard_banners/seen', { ids });
  },
  async clicou(id: string): Promise<void> {
    await api.post(`/dashboard_banners/${id}/click`);
  },
};
