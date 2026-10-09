import apiAuth from '@/services/core/apiAuth';
import { extractData } from '@/utils/apiHelpers';
import type {
  CustomRole,
  RoleFormData,
  PermissionSection,
  RoleAuditLogEntry,
  CapabilityTheme,
  RoleCapabilities,
} from '@/types/customRoles';

/** Frase de erro das permissões por linha: o PATCH responde `error` como TEXTO
 *  (pt-BR), diferente do resto da API (`error.message`). Local de propósito:
 *  mexer no apiErrorMessage global mostraria "Forbidden" em inglês em outras telas. */
export function capabilitiesErrorMessage(err: unknown, fallback: string): string {
  const d = (err as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const bruto = d?.error;
  // RBAC 403 manda `error` em inglês E `message` em pt-BR: a frase da tela é a message.
  if (typeof bruto === 'string' && typeof d?.message === 'string' && d.message) return d.message;
  if (typeof bruto === 'string' && bruto) return bruto;
  const msg = (bruto as { message?: unknown } | undefined)?.message;
  if (typeof msg === 'string' && msg) return msg;
  if (typeof d?.message === 'string' && d.message) return d.message;
  return fallback;
}

class CustomRolesService {
  async list(): Promise<CustomRole[]> {
    const res = await apiAuth.get('/roles');
    return extractData<CustomRole[]>(res);
  }

  async get(id: number | string): Promise<CustomRole> {
    const res = await apiAuth.get(`/roles/${id}`);
    return extractData<CustomRole>(res);
  }

  async create(data: RoleFormData): Promise<CustomRole> {
    const res = await apiAuth.post('/roles', { role: data });
    return extractData<CustomRole>(res);
  }

  async update(id: number | string, data: Partial<RoleFormData>): Promise<CustomRole> {
    const res = await apiAuth.patch(`/roles/${id}`, { role: data });
    return extractData<CustomRole>(res);
  }

  async destroy(id: number | string): Promise<void> {
    await apiAuth.delete(`/roles/${id}`);
  }

  async clone(id: number | string, newName?: string): Promise<CustomRole> {
    const res = await apiAuth.post(`/roles/${id}/clone`, { name: newName });
    return extractData<CustomRole>(res);
  }

  async auditLog(id: number | string): Promise<RoleAuditLogEntry[]> {
    const res = await apiAuth.get(`/roles/${id}/audit_log`);
    return extractData<RoleAuditLogEntry[]>(res);
  }

  async permissionsCatalog(): Promise<PermissionSection[]> {
    const res = await apiAuth.get('/roles/permissions_catalog');
    return extractData<PermissionSection[]>(res);
  }

  /** Linhas por tema + estado (ligado/desligado/parcial) de cada cargo. */
  async capabilities(): Promise<{ themes: CapabilityTheme[]; roles: RoleCapabilities[] }> {
    const res = await apiAuth.get('/roles/capabilities');
    return extractData<{ themes: CapabilityTheme[]; roles: RoleCapabilities[] }>(res);
  }

  /** Liga/desliga linhas de um cargo. Erro 422 vem com `error` em string: use capabilitiesErrorMessage. */
  async updateCapabilities(id: number | string, changes: Record<string, boolean>): Promise<RoleCapabilities> {
    const res = await apiAuth.patch(`/roles/${id}/capabilities`, { changes });
    return extractData<RoleCapabilities>(res);
  }
}

export const customRolesService = new CustomRolesService();
export default customRolesService;
