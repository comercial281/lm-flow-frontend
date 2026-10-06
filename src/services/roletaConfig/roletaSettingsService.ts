import api from '@/services/core/api';

// Os AVISOS DA ROLETA, configurados uma vez por cliente (D7, roleta nova).
//
// Valem para todas as roletas e saem todos pelo Operacional (LM01), inclusive o
// do grupo. Cada aviso tem a sua chave e TODOS nascem desligados. Texto nulo =
// o texto de fábrica (que funciona sem edição, inclusive com roleta sem prazo).
// Contrato do PR do servidor B2: `GET`/`PUT /roleta_settings`.

/** Uma pessoa da Equipe escolhida como gestor, com o WhatsApp do cadastro dela. */
export interface RoletaGestor {
  id: string;
  name: string;
  /** Falso = "sem WhatsApp no cadastro": não recebe aviso nenhum. */
  whatsapp_present: boolean;
}

export interface RoletaSettingsFields {
  gestor_user_ids: string[];
  group_jid: string | null;
  group_name: string | null;
  notify_broker_offer: boolean;
  notify_broker_won: boolean;
  notify_gestor_exhausted: boolean;
  notify_gestor_accepted: boolean;
  notify_gestor_morning: boolean;
  notify_group_offer: boolean;
  notify_group_repass: boolean;
  template_broker_offer: string | null;
  template_broker_won: string | null;
  template_gestor_exhausted: string | null;
  template_gestor_accepted: string | null;
  template_group_offer: string | null;
  template_group_repass: string | null;
}

export interface RoletaSettings extends RoletaSettingsFields {
  gestores: RoletaGestor[];
}

export type RoletaNoticeKey = Extract<keyof RoletaSettingsFields, `notify_${string}`>;
export type RoletaTemplateKey = Extract<keyof RoletaSettingsFields, `template_${string}`>;

export const CAMPOS_DOS_AVISOS: (keyof RoletaSettingsFields)[] = [
  'gestor_user_ids', 'group_jid', 'group_name',
  'notify_broker_offer', 'notify_broker_won',
  'notify_gestor_exhausted', 'notify_gestor_accepted', 'notify_gestor_morning',
  'notify_group_offer', 'notify_group_repass',
  'template_broker_offer', 'template_broker_won',
  'template_gestor_exhausted', 'template_gestor_accepted',
  'template_group_offer', 'template_group_repass',
];

/** O registro como a tela precisa: tudo presente, chave ausente = desligada. */
export function normalizarAvisos(bruto: Partial<RoletaSettings> | null | undefined): RoletaSettings {
  const b = bruto ?? {};
  const chave = (k: RoletaNoticeKey) => b[k] === true;
  const texto = (k: RoletaTemplateKey) => (typeof b[k] === 'string' && b[k] ? (b[k] as string) : null);
  return {
    gestor_user_ids: Array.isArray(b.gestor_user_ids) ? b.gestor_user_ids : [],
    group_jid: b.group_jid || null,
    group_name: b.group_name || null,
    notify_broker_offer: chave('notify_broker_offer'),
    notify_broker_won: chave('notify_broker_won'),
    notify_gestor_exhausted: chave('notify_gestor_exhausted'),
    notify_gestor_accepted: chave('notify_gestor_accepted'),
    notify_gestor_morning: chave('notify_gestor_morning'),
    notify_group_offer: chave('notify_group_offer'),
    notify_group_repass: chave('notify_group_repass'),
    template_broker_offer: texto('template_broker_offer'),
    template_broker_won: texto('template_broker_won'),
    template_gestor_exhausted: texto('template_gestor_exhausted'),
    template_gestor_accepted: texto('template_gestor_accepted'),
    template_group_offer: texto('template_group_offer'),
    template_group_repass: texto('template_group_repass'),
    gestores: Array.isArray(b.gestores) ? b.gestores : [],
  };
}

/** Só os campos graváveis (o `gestores` é leitura, calculado pelo servidor). */
export function camposGravaveis(s: RoletaSettings): RoletaSettingsFields {
  const saida = {} as Record<string, unknown>;
  for (const k of CAMPOS_DOS_AVISOS) saida[k] = s[k];
  return saida as unknown as RoletaSettingsFields;
}

function miolo(res: { data?: unknown }): Partial<RoletaSettings> {
  const corpo = res?.data as { data?: unknown } | undefined;
  return ((corpo && typeof corpo === 'object' && 'data' in corpo ? corpo.data : corpo) ?? {}) as Partial<RoletaSettings>;
}

export const roletaSettingsService = {
  async get(): Promise<RoletaSettings> {
    const res = await api.get('/roleta_settings');
    return normalizarAvisos(miolo(res));
  },

  // Manda o registro inteiro (o PUT substitui). Devolve o gravado, com os
  // gestores recalculados (quem tem WhatsApp no cadastro).
  async update(campos: RoletaSettingsFields): Promise<RoletaSettings> {
    const res = await api.put('/roleta_settings', campos);
    return normalizarAvisos(miolo(res));
  },
};

export default roletaSettingsService;
