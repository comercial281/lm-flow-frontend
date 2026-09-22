import api from '@/services/core/api';

/**
 * Aviso de VISITA MARCADA PELA IA no grupo que a Leal Mídia tem com cada
 * imobiliária ("APTO PREMIUM x Leal Mídia") — o mesmo grupo do relatório da
 * semana e do aviso de aula nova, e por isso a mensagem sai pelo número
 * operacional da Leal Mídia.
 *
 * Só as visitas que a IA marcou entram: quem marca à mão no CRM não dispara
 * nada. Nasce desligado em toda imobiliária e é ligado uma a uma.
 *
 * Backend: /api/v1/super/ai_visit_notices (`SalesAgents::VisitAnnouncer`).
 */
export interface AiVisitNoticeClient {
  schema: string;
  slug: string;
  name: string;
  enabled: boolean;
  /** Grupos escolhidos à mão. Vazio = o servidor descobre pelo nome do grupo. */
  group_jids: string[];
}

export interface AiVisitNoticeGroup {
  jid: string;
  name: string;
  /** 'cadastro' (o JID gravado na imobiliária), 'nome' ou 'escolhido'. */
  source?: string | null;
}

export interface AiVisitNoticeGroups {
  schema: string;
  enabled: boolean;
  /** Por que o aviso não iria a lugar nenhum. Vazio = tem destino. */
  reason?: string | null;
  /** Para onde o aviso sairia hoje. */
  selected: string[];
  groups: AiVisitNoticeGroup[];
}

export interface AiVisitNoticeHistoryEntry {
  at?: string;
  schema?: string;
  lead?: string;
  quando?: string;
  acao?: string;
  sent?: number;
  total?: number;
}

export interface AiVisitNoticeConfig {
  template: string;
  default_template: string;
  instance: string;
  /** Os marcadores aceitos no texto, servidos pelo backend. */
  vars: string[];
  clients: AiVisitNoticeClient[];
  history: AiVisitNoticeHistoryEntry[];
}

/** O que muda em UMA imobiliária. */
export interface AiVisitNoticeTenantPatch {
  enabled: boolean;
  group_jids: string[];
}

const BASE = '/super/ai_visit_notices';

export const aiVisitNoticeService = {
  async load(): Promise<AiVisitNoticeConfig> {
    const res = await api.get(BASE);
    return (res.data as { data: AiVisitNoticeConfig }).data;
  },

  /**
   * ⚠️ Manda SÓ as imobiliárias que mudaram. O servidor mescla por cliente — as
   * outras ficam como estão, inclusive a que foi criada depois de esta tela
   * abrir. Mandar o mapa inteiro seria a armadilha da janela *Destino do lead*
   * da landing: salvar apagando o que a tela não conhece.
   */
  async save(patch: {
    template?: string;
    tenants?: Record<string, AiVisitNoticeTenantPatch>;
  }): Promise<AiVisitNoticeConfig> {
    const res = await api.put(BASE, patch);
    return (res.data as { data: AiVisitNoticeConfig }).data;
  },

  /**
   * Os grupos de UM cliente. É a metade cara (o servidor fala com o WhatsApp e
   * varre o banco daquela imobiliária), por isso é de clique e nunca vem na
   * carga da tela.
   */
  async groups(schema: string): Promise<AiVisitNoticeGroups> {
    const res = await api.get(`${BASE}/groups`, { params: { schema } });
    return (res.data as { data: AiVisitNoticeGroups }).data;
  },

  /** Manda uma mensagem de exemplo, marcada como teste, no grupo daquele cliente. */
  async test(schema: string): Promise<{ sent: number; total: number }> {
    const res = await api.post(`${BASE}/test`, { schema });
    return (res.data as { data: { sent: number; total: number } }).data;
  },
};
