import api from '@/services/core/api';
import type {
  CatalogEvent,
  LabelledKey,
  PipelineStages,
  PolicyPatch,
  PolicyUser,
  ResolvedPolicy,
} from '@/services/notifications/notificationPolicyService';

/**
 * Os avisos vistos de DENTRO do app do cliente.
 *
 * Dois níveis, e a ordem importa:
 *
 *   • a LISTA DA EMPRESA (`policy`) — o que a imobiliária recebe. É a MESMA
 *     configuração que a Área do Admin edita em outra tela; só o caminho muda.
 *     Escrever é coisa de admin e gerente (o servidor recusa os demais).
 *
 *   • o SILÊNCIO PESSOAL (`mutes`) — o que CADA UM cala pra si, por cima do que a
 *     empresa ligou. Só tira, nunca acrescenta: ninguém liga no Perfil um aviso
 *     que a empresa desligou.
 *
 * Envelope { success, data }, então as telas leem res.data.data.
 */

export interface ClientCatalogData {
  groups: LabelledKey[];
  channels: LabelledKey[];
  origin_groups: LabelledKey[];
  events: CatalogEvent[];
  policy: ResolvedPolicy;
  users: PolicyUser[];
  pipelines: PipelineStages[];
  can_edit: boolean;
}

/** Por evento, a lista COMPLETA de canais calados. Lista vazia limpa o evento. */
export type MutesMap = Record<string, string[]>;

export interface MutesData {
  groups: LabelledKey[];
  channels: LabelledKey[];
  origin_groups: LabelledKey[];
  events: CatalogEvent[];
  policy: ResolvedPolicy;
  mutes: MutesMap;
}

class NotificationPreferencesService {
  /** A lista da empresa + tudo que a tela precisa para desenhar os ajustes. */
  async policy(): Promise<ClientCatalogData> {
    const res = await api.get('/notification_policy');
    return res.data.data;
  }

  async updatePolicy(policy: PolicyPatch): Promise<{ policy: ResolvedPolicy }> {
    const res = await api.patch('/notification_policy', { policy });
    return res.data.data;
  }

  /** O que eu calei pra mim, junto do que a empresa ligou (a tela mostra só o que posso receber). */
  async mutes(): Promise<MutesData> {
    const res = await api.get('/notification_mutes');
    return res.data.data;
  }

  async updateMutes(mutes: MutesMap): Promise<{ mutes: MutesMap }> {
    const res = await api.patch('/notification_mutes', { mutes });
    return res.data.data;
  }
}

export default new NotificationPreferencesService();
