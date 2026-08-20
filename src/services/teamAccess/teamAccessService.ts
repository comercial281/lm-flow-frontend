import apiAuth from '@/services/core/apiAuth';
import { extractData } from '@/utils/apiHelpers';
import type { TeamAccessOverview } from '@/types/teamAccess';

/* Uma chamada só para montar a tela de Equipe.
 *
 * Antes eram: a lista de pessoas, a lista de números e mais UMA POR NÚMERO para
 * descobrir os membros — e mesmo assim a tela não sabia dizer se um acesso tinha
 * sido concedido por um humano ou pelo sistema, que é a única coisa que o gestor
 * quer saber ao olhar aquilo. */
class TeamAccessService {
  async overview(): Promise<TeamAccessOverview> {
    const res = await apiAuth.get('/team_overview');
    const data = extractData<TeamAccessOverview>(res);
    return {
      inboxes: data?.inboxes ?? [],
      members: data?.members ?? [],
    };
  }
}

export const teamAccessService = new TeamAccessService();
export default teamAccessService;
