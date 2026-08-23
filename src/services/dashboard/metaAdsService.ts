import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

export interface MetaAdsConfig {
  is_enabled: boolean;
  ad_account_id: string | null;
  ad_account_name: string | null;
  uses_own_token: boolean;
  ready: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  rows?: number;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  status: string;
  active: boolean;
}

export const fetchMetaAdsConfig = async (): Promise<MetaAdsConfig> =>
  extractData(await api.get('/meta_ads'));

/** Contas que o token de sistema enxerga — o cliente escolhe, não cola token. */
export const fetchMetaAdAccounts = async (): Promise<MetaAdAccount[]> =>
  extractData(await api.get('/meta_ads/available_accounts'));

export const updateMetaAdsConfig = async (payload: {
  ad_account_id?: string;
  ad_account_name?: string;
  is_enabled?: boolean;
}): Promise<MetaAdsConfig> => extractData(await api.patch('/meta_ads', payload));

export const syncMetaAds = async (days = 14): Promise<MetaAdsConfig> =>
  extractData(await api.post('/meta_ads/sync', { days }));
