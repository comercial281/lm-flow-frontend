/* Retrato único da equipe — o que a tela de Equipe carrega numa chamada só.
 *
 * O ponto destes tipos é a separação que a tela não tinha: um número que a
 * pessoa alcança porque ALGUÉM LIBEROU é uma coisa; um número que ela alcança
 * porque o sistema liberou (para ela conseguir abrir o próprio lead) é outra
 * completamente diferente — ali dentro ela só vê os leads dela, não recebe lead
 * novo, e o gestor NÃO consegue tirar pela tela. */

/** Por que o sistema liberou este número sozinho. */
export type AutoAccessReason =
  /** é dona de leads que conversam por este número */
  | 'leads'
  /** é membro ativo da roleta deste número */
  | 'roleta'
  /** tem lead que não entrou por número nenhum (formulário, anúncio) */
  | 'lead_sem_canal';

export interface AutoAccessDetail {
  reason: AutoAccessReason;
  /** quantos leads dela falam por aqui; 0 nos motivos que não são de lead direto */
  leads: number;
}

export interface TeamAccessRole {
  key: string;
  name: string;
  color?: string;
  custom_role_id?: string | number | null;
  chave_role: string;
}

export interface TeamAccessInbox {
  id: string;
  name: string;
  channel_type?: string;
}

export interface TeamAccessMember {
  id: string;
  name: string;
  email: string;
  whatsapp_number?: string | null;
  /** senha atual guardada, para o "Enviar acesso" reenviar sem trocá-la */
  plain_password?: string | null;
  confirmed: boolean;
  availability: number;
  role: TeamAccessRole;
  /** Administrador alcança todo número sem vínculo nenhum. */
  sees_all_inboxes: boolean;
  /** Números que um humano liberou — estes o gestor controla. */
  granted_inbox_ids: string[];
  /** Números que o sistema liberou — estes o gestor NÃO controla. */
  auto_inbox_ids: string[];
  /** Motivo de cada número do balde automático, indexado pelo id do número. */
  auto_access: Record<string, AutoAccessDetail>;
}

export interface TeamAccessOverview {
  inboxes: TeamAccessInbox[];
  members: TeamAccessMember[];
}
