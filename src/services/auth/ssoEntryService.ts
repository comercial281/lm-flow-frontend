// "Entrar" do painel raiz, lado do cliente (auditoria 3E-04, 12/11/2026).
//
// O painel abre /sso?code=<código> no endereço do cliente. O código vale uma
// vez e por 60 s; aqui ele é trocado pelo passe da plataforma num POST. A sessão
// nunca mais passa pela URL (histórico do navegador, log de acesso).
//
// Rota pública (/api/public/v1), sem auth, com o cliente no X-Tenant — mesma
// convenção do convite de acesso (accessLinkService).

import axios from 'axios';
import { getSubdomainSlug } from '@/services/core/tenant';

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/public/v1`,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(config => {
  const tenant = getSubdomainSlug();
  if (tenant) {
    config.headers.set?.('X-Tenant', tenant);
    (config.headers as Record<string, unknown>)['X-Tenant'] = tenant;
  }
  return config;
});

export const ssoEntryService = {
  // Devolve o passe, ou null se o código venceu, já foi usado ou é de outro cliente.
  exchange: async (code: string): Promise<string | null> => {
    try {
      const { data } = await client.post<{ data?: { access_token?: string } }>('/sso_entry', { code });
      return data?.data?.access_token || null;
    } catch {
      return null;
    }
  },
};

export default ssoEntryService;
