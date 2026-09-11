import { BaseFilter } from "@/types/core";
import { Role } from "@/types/auth";
import type { PaginatedResponse, StandardResponse, PaginationMeta } from '@/types/core';

export type CRole = 'agent' | 'manager' | 'admin';

export interface User {
  id: string;
  uid?: string; // OAuth provider UID
  name: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  available_name?: string;
  thumbnail?: string;
  availability: 'online' | 'busy' | 'offline';
  availability_status?: 'online' | 'busy' | 'offline'; // Alias for availability
  role?: Role;
  chave_role?: CRole; // LM Flow role: agent | manager | admin
  whatsapp_number?: string | null; // WhatsApp p/ receber lembretes de automação
  plain_password?: string | null; // senha guardada (super-admin/gestor), quando houver
  confirmed: boolean;
  created_at: string;
  updated_at: string;
  permissions: string[];
  /** Corretor DESATIVADO: o perfil continua, a pessoa parou de trabalhar. */
  deactivated?: boolean;
  deactivated_at?: string | null;
  deactivation_reason?: DeactivationReason | null;
  deactivation_snapshot?: DeactivationSnapshot | null;
}

export type DeactivationReason = 'ferias' | 'afastamento' | 'saiu';

/** O registro do que aconteceu na desativação — o que a tela conta depois. */
export interface DeactivationSnapshot {
  at?: string;
  reason?: DeactivationReason;
  transfer_to_id?: string | null;
  transfer_to_name?: string | null;
  disconnect_number?: boolean;
  exclusive_number?: DeactivationNumber | null;
  cleanup?: {
    status?: 'pending' | 'done' | 'failed';
    leads?: { conversations?: number; contacts?: number; failures?: number; skipped?: boolean };
    offers?: number;
    number?: { name?: string; logged_out?: boolean; skipped?: boolean; error?: string };
    error?: string;
  };
}

export interface DeactivationNumber {
  roleta_instance_id?: string;
  inbox_id?: string;
  name?: string | null;
  phone?: string | null;
}

/**
 * O que o corretor CARREGA — o estrago que a janela de confirmação mostra antes.
 * Campo que o servidor não conseguiu contar volta nulo, e a tela não mostra
 * aquela linha em vez de mostrar zero (que seria mentira).
 */
export interface DeactivationPreview {
  leads: number | null;
  open_conversations: number | null;
  pending_offers: number | null;
  roletas: string[];
  /** null = ele não tem número exclusivo; a opção de desconectar nem aparece. */
  exclusive_number: DeactivationNumber | null;
  shared_numbers: string[];
  user?: User;
}

export interface DeactivatePayload {
  reason: DeactivationReason;
  transfer_to_id?: string | null;
  disconnect_number?: boolean;
}

export interface UsersListParams {
  page?: number;
  per_page?: number;
  sort?: 'name' | 'email' | 'role' | 'created_at';
  order?: 'asc' | 'desc';
  q?: string;
}

export interface UserCreateData {
  name: string;
  email: string;
  role: string;
  auto_offline?: boolean;
  availability?: 'online' | 'busy' | 'offline';
  whatsapp_number?: string;
}

export interface UserUpdateData {
  name?: string;
  email?: string;
  role?: string;
  chave_role?: CRole;
  auto_offline?: boolean;
  availability?: 'online' | 'busy' | 'offline';
  avatar?: File;
  password?: string;
  whatsapp_number?: string;
}

export interface UsersResponse extends PaginatedResponse<User> {}

export interface UsersUserResponse extends StandardResponse<User> {}

export interface UserDeleteResponse extends StandardResponse<{ message: string }> {}

export interface BulkInviteParams {
  emails: string[];
}

export interface BulkInviteResponse {
  success: boolean;
  message: string;
  invited_users: User[];
  failed_invitations: Array<{
    email: string;
    error: string;
  }>;
}

// UI State Types
export interface UsersState {
  users: User[];
  selectedUserIds: string[];
  meta: {
    pagination: PaginationMeta;
  };
  loading: {
    list: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    bulk: boolean;
  };
  filters: BaseFilter[]; // UserFilter type from users-filters
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface UserFormData {
  name: string;
  email: string;
  availability: 'online' | 'busy' | 'offline';
  role?: string;
  avatar?: File;
  removeAvatar?: boolean;
  password?: string;
  confirmPassword?: string;
  whatsapp_number?: string;
}

export interface UserTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface UserActionsMenuProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  canEdit: boolean;
  canDelete: boolean;
}
