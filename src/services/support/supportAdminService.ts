import type { AxiosRequestConfig } from 'axios';
import api from '@/services/core/api';
import {
  formulario,
  type SupportKind,
  type SupportMessage,
  type SupportStatus,
  type SupportTicketSummary,
} from './supportService';

// Chat de suporte — lado do TIME (item Suporte da Área do Admin). O servidor
// trava em Users::SupportStaff.front_support?; a tela só aparece pra quem passa.

export interface SupportTicketAdminSummary extends SupportTicketSummary {
  tenant_slug: string | null;
  user_name: string | null;
  user_email: string | null;
}

export interface SupportTicketAdminDetail extends SupportTicketAdminSummary {
  messages: SupportMessage[];
  admin_note: string | null;
  tenant_id: string | null;
}

export interface FiltrosSuporte {
  status?: SupportStatus | '';
  kind?: SupportKind | '';
  tenantSlug?: string;
  q?: string;
  page?: number;
}

// ⚠️ O contador do menu roda de fundo a cada 2 min: se a conta não for do time, o 403 não pode virar toast.
// (cast: o interceptor lê o campo, mas ele não está no tipo do axios)
const SEM_TOAST_403 = { silentForbidden: true } as AxiosRequestConfig;

export const supportAdminService = {
  async list(f: FiltrosSuporte) {
    const { data } = await api.get('/super/support_tickets', {
      params: { status: f.status || undefined, kind: f.kind || undefined, tenant_slug: f.tenantSlug || undefined, q: f.q || undefined, page: f.page ?? 1 },
    });
    return {
      tickets: data.data as SupportTicketAdminSummary[],
      total: data.meta.total as number,
      page: data.meta.page as number,
      perPage: data.meta.per_page as number,
    };
  },
  async openCount(): Promise<number> {
    const { data } = await api.get('/super/support_tickets/open_count', SEM_TOAST_403);
    return data.data.count;
  },
  async show(id: string): Promise<SupportTicketAdminDetail> {
    const { data } = await api.get(`/super/support_tickets/${id}`);
    return data.data;
  },
  async update(id: string, mudanca: { status?: SupportStatus; admin_note?: string }): Promise<SupportTicketAdminDetail> {
    const { data } = await api.patch(`/super/support_tickets/${id}`, mudanca);
    return data.data;
  },
  async reply(id: string, body: string, imagens: File[], status?: 'resolved'): Promise<SupportTicketAdminDetail> {
    const { data } = await api.post(`/super/support_tickets/${id}/messages`, formulario({ body, status }, imagens));
    return data.data;
  },
  async archive(id: string): Promise<void> {
    await api.delete(`/super/support_tickets/${id}`);
  },
  /** O mesmo SSO do "Entrar" do cartão do cliente. */
  async entrarNoCliente(tenantId: string): Promise<string | null> {
    const { data } = await api.post(`/super/pooled_tenants/${tenantId}/sso`);
    return data?.data?.url ?? null;
  },
};
