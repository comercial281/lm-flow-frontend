import apiAuth from '@/services/core/apiAuth';
import { extractData } from '@/utils/apiHelpers';
import type {
  CustomRole,
  RoleFormData,
  PermissionSection,
  RoleAuditLogEntry,
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
}

export const customRolesService = new CustomRolesService();
export default customRolesService;
