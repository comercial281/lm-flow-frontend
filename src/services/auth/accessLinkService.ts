// Convite de acesso: o link que a pessoa recebe no WhatsApp para CRIAR a senha
// dela e já entrar.
//
// Rota truly public (/api/public/v1), sem auth — a pessoa ainda não tem senha,
// então não há sessão nenhuma para mandar. Mesma convenção da porta de entrada
// da Área de Membros e do onboarding público.

import axios from 'axios';
import { getSubdomainSlug } from '@/services/core/tenant';

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/public/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// ⚠️ O tenant tem que viajar no cabeçalho. A pessoa abre o link no endereço da
// imobiliária dela, mas quem responde é a API (api.lmflow.com.br) — e daquele
// lado o subdomínio é "api", que é reservado. Sem o cabeçalho o servidor
// procuraria a pessoa no apartamento errado e o convite seria recusado como se
// fosse de outro cliente.
client.interceptors.request.use(config => {
  const tenant = getSubdomainSlug();
  if (tenant) {
    config.headers.set?.('X-Tenant', tenant);
    (config.headers as Record<string, unknown>)['X-Tenant'] = tenant;
  }
  return config;
});

export interface AccessLinkInvite {
  valid: boolean;
  name?: string;
  email_hint?: string;
  tenant?: string;
  reason?: string;
  message?: string;
}

export interface AccessLinkRedeemed {
  access_token?: string | null;
  signed_in: boolean;
  user: { id: number | string; email: string; name: string };
}

export const accessLinkService = {
  // Abrir o convite NÃO o consome — o WhatsApp pré-visualiza links, e uma
  // pré-visualização não pode queimar o acesso antes de a pessoa tocar nele.
  peek: async (token: string): Promise<AccessLinkInvite> => {
    const { data } = await client.get<{ data: AccessLinkInvite }>('/access_link', {
      params: { t: token },
    });
    return data?.data ?? { valid: false };
  },

  redeem: async (
    token: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<AccessLinkRedeemed> => {
    const { data } = await client.post<{ data: AccessLinkRedeemed }>('/access_link', {
      t: token,
      password,
      password_confirmation: passwordConfirmation,
    });
    return data.data;
  },
};

export default accessLinkService;
