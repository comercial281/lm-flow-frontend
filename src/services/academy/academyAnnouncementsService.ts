// Aviso de AULA NOVA da Área de Membros nos grupos de WhatsApp dos clientes.
//
// O conteúdo das aulas vive no Supabase do LM Hub, mas o disparo é do backend
// (é ele quem tem a instância operacional da Leal Mídia e o cadastro dos
// clientes). Só o super-admin enxerga estas telas.

import apiClient from '@/services/core/api';

export interface AnnounceGroup {
  jid: string;
  name: string;
}

// Grupo que a instância enxerga, já cruzado com o cadastro dos clientes.
export interface AvailableGroup extends AnnounceGroup {
  client: string | null;
  client_slug: string | null;
  selected: boolean;
}

export interface AnnounceResult {
  jid: string;
  name: string;
  client?: string | null;
  sent: boolean;
  http?: string;
}

export interface AnnounceHistoryEntry {
  at: string;
  lesson_id: string;
  titulo: string;
  curso: string;
  instance: string;
  by: string;
  sent: number;
  total: number;
  groups: AnnounceResult[];
}

export interface AnnounceConfig {
  template: string;
  instance: string;
  enabled: boolean;
  groups: AnnounceGroup[];
  default_template: string;
  variables: string[];
  history: AnnounceHistoryEntry[];
}

// Dados da aula que o disparo precisa. Como as aulas não existem no backend,
// quem publica manda os dados junto — o servidor só monta o texto e envia.
export interface AnnounceLesson {
  id: string;
  titulo: string;
  curso?: string;
  modulo?: string;
  descricao?: string;
  duracao?: number | null;
}

export interface CentralInstance {
  name: string;
  connected: boolean;
}

const base = '/super/academy_announcements';

export const academyAnnouncementsService = {
  config: () => apiClient.get<{ data: AnnounceConfig }>(base),

  saveConfig: (payload: Partial<Pick<AnnounceConfig, 'template' | 'instance' | 'enabled' | 'groups'>>) =>
    apiClient.put<{ data: AnnounceConfig }>(base, payload),

  groups: (instance?: string) =>
    apiClient.get<{ data: AvailableGroup[] }>(`${base}/groups`, { params: instance ? { instance } : {} }),

  // A prévia vem do SERVIDOR de propósito: é ele quem interpola na hora do
  // envio, e um texto montado aqui mostraria uma mensagem que ninguém recebe.
  preview: (payload: { message: string; lesson: AnnounceLesson; path: string }) =>
    apiClient.post<{ data: { text: string } }>(`${base}/preview`, payload),

  send: (payload: {
    message: string;
    instance: string;
    groups: AnnounceGroup[];
    lesson: AnnounceLesson;
    path: string;
  }) =>
    apiClient.post<{ data: { sent: number; total: number; results: AnnounceResult[] } }>(
      `${base}/send`,
      payload,
    ),

  // Remetentes possíveis (instâncias centrais da Leal Mídia) — mesmo endpoint
  // que a tela de Comunicados usa.
  instances: () => apiClient.get<{ data: CentralInstance[] }>('/super/pooled_tenants/instances'),
};

export default academyAnnouncementsService;
