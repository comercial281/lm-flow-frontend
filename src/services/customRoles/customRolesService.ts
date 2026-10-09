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

  /** Liga/desliga linhas de um cargo. Erro 422 vem com `error` em string: use apiErrorMessage. */
  async updateCapabilities(id: number | string, changes: Record<string, boolean>): Promise<RoleCapabilities> {
    const res = await apiAuth.patch(`/roles/${id}/capabilities`, { changes });
    return extractData<RoleCapabilities>(res);
  }
}

export const customRolesService = new CustomRolesService();
export default customRolesService;
