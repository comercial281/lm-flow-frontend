// src/services/superAdmin/mcpKeysService.ts
import api from '@/services/core/api';
import type { ChaveMcp, ChaveMcpGerada } from '@/types/admin/mcpKeys';

interface Envelope<T> { success: boolean; data: T }

export const mcpKeysService = {
  async listar(): Promise<ChaveMcp[]> {
    const res = await api.get('/super/mcp_keys');
    return (res.data as Envelope<ChaveMcp[]>).data;
  },
  async gerar(nome: string): Promise<ChaveMcpGerada> {
    const res = await api.post('/super/mcp_keys', { name: nome });
    return (res.data as Envelope<ChaveMcpGerada>).data;
  },
  async revogar(id: string): Promise<ChaveMcp> {
    const res = await api.post(`/super/mcp_keys/${id}/revoke`);
    return (res.data as Envelope<ChaveMcp>).data;
  },
  async podeEditarModelos(id: string, pode: boolean): Promise<ChaveMcp> {
    const res = await api.patch(`/super/mcp_keys/${id}`, { can_edit_models: pode });
    return (res.data as Envelope<ChaveMcp>).data;
  },
};
