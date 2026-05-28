// Types for the customizable role system (CustomRole).
// Mirrors the API shape returned by Api::V1::RolesController.

export interface CustomRole {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  permissions: string[];
  effective_permissions: string[];
  system: boolean;
  inherits_from_id: number | null;
  template_id: string | null;
  users_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoleFormData {
  name: string;
  description?: string | null;
  color?: string;
  permissions: string[];
  inherits_from_id?: number | null;
}

export interface RoleAction {
  permission: string; // ex: "properties.create"
  action: string;     // ex: "create"
  label: string;      // ex: "Criar"
}

export interface RoleResource {
  resource: string;   // ex: "properties"
  label: string;      // ex: "Imóveis"
  actions: RoleAction[];
}

export interface PermissionSection {
  key: string;        // ex: "imoveis"
  label: string;      // ex: "Imóveis"
  resources: RoleResource[];
}

export interface RoleAuditLogEntry {
  id: number;
  action:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'permission_added'
    | 'permission_removed'
    | 'permission_replaced'
    | 'renamed'
    | 'cloned'
    | 'restored';
  note: string | null;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  changed_by: {
    id: string;
    name: string;
    email: string;
  } | null;
  created_at: string;
}
