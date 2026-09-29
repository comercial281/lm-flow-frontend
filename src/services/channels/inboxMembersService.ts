import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type { InboxMembersUpdateResponse, AgentChannel } from '@/types/channels/inbox';

// Inbox Members Service following Evolution patterns
const InboxMembersService = {
  /**
   * Get all agents assigned to an inbox
   * Endpoint: GET /api/v1/inbox_members/:inbox_id
   */
  async get(inboxId: string): Promise<AgentChannel[]> {
    try {
      const response = await api.get(`/inbox_members/${inboxId}`);
      const data = extractData<AgentChannel[]>(response);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('InboxMembersService.get error:', error);
      return []; // Return empty array on error
    }
  },

  /**
   * Update agents assigned to an inbox
   * Endpoint: PATCH /api/v1/inbox_members
   *
   * This follows the exact pattern from the Vue app:
   * - Uses PATCH method to the base inbox_members endpoint
   * - Sends inbox_id and user_ids in the body
   */
  async update(inboxId: string, agentIds: string[]): Promise<InboxMembersUpdateResponse> {
    const response = await api.patch('/inbox_members', {
      inbox_id: inboxId,
      user_ids: agentIds,
    });
    return extractData<InboxMembersUpdateResponse>(response);
  },

  /**
   * Tira agentes específicos de um número (usado pra tirar o dono ANTERIOR
   * depois de trocar o Dono do número — fase 2b.1 — sem reenviar a lista
   * inteira de colaboradores).
   * Endpoint: DELETE /api/v1/inbox_members
   */
  async remove(inboxId: string, agentIds: string[]): Promise<void> {
    await api.delete('/inbox_members', {
      data: { inbox_id: inboxId, user_ids: agentIds },
    });
  },
};

export default InboxMembersService;
