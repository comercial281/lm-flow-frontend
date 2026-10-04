// Usuários de todos os clientes (entrega 3A). Espelha app/services/users do backend.
export type UserSituation = 'ativo' | 'sumido' | 'nunca_entrou' | 'desativado';

export type UserNotification = 'ok' | 'bloqueada' | 'falhando';

export interface UserRow {
  tenant_schema: string;
  tenant_name: string;
  tenant_id: string | null;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  team: boolean;
  last_seen_at: string | null;
  accesses_30d: number;
  seconds_30d: number;
  situation: UserSituation;
  // null: o registro de notificações não pôde ser lido.
  notification: UserNotification | null;
}

export interface UsersPage {
  items: UserRow[];
  meta: { total: number; page: number; per_page: number };
  tenants: { schema: string; name: string }[];
  roles: string[];
  errors: { tenant_name: string; message: string }[];
}

export interface UserFilters {
  q: string;
  tenant: string | null;
  role: string;
  situation: '' | UserSituation;
  notification: '' | 'com_problema';
  includeTeam: boolean;
  page: number;
}

export interface UserEntry { started_at: string; last_seen_at: string | null; duration_seconds: number; ip: string | null; device: string; new_device: boolean }
export interface UserAction { occurred_at: string; category: string | null; action: string | null; title: string | null; description: string | null; sensitive?: boolean }

export type DeliveryStatus = 'enviado' | 'falhou' | 'apareceu' | 'clicou' | 'entregue' | 'lido';
export interface NotificationDeliveryRow {
  id: string; kind: string | null; preview: string | null; recipient: string | null; status: DeliveryStatus; error: string | null;
  sent_at: string; shown_at: string | null; clicked_at: string | null; delivered_at: string | null; read_at: string | null;
}
export interface UserNotifications {
  permissions: { device: string; permission: 'granted' | 'denied' | 'default' | 'unsupported'; seen_at: string }[];
  push_devices: number;
  push: NotificationDeliveryRow[];
  whatsapp: NotificationDeliveryRow[];
  bell: { title: string; read: boolean; created_at: string }[];
}

export interface UserProfile {
  person: UserRow;
  summary: { top_screens: { screen: string; seconds: number }[] };
  entries: UserEntry[];
  actions: UserAction[];
  // null: o registro de notificações não pôde ser lido.
  notifications: UserNotifications | null;
}
