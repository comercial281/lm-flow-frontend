import type { AutoAccessDetail } from '@/types/teamAccess';

/* Por que o sistema liberou um número sozinho para a pessoa (a ficha mostra o motivo). */

export function autoAccessLabel(detail?: AutoAccessDetail): string {
  if (!detail) return 'liberado pelo sistema';
  if (detail.reason === 'leads') {
    return detail.leads === 1 ? 'é responsável por 1 lead daqui' : `é responsável por ${detail.leads} leads daqui`;
  }
  if (detail.reason === 'roleta') return 'recebe leads deste número pela roleta';
  return 'tem lead que não entrou por número nenhum';
}
