import type { MemberNumber, TeamAccessMember } from '@/types/teamAccess';

/* Filtros da lista de Pessoas: cada um responde a uma pergunta do gestor ("quem
   está sem número?", "quem tem número caído?", "quem ainda não entrou?"). */

export type PeopleFilter = 'todas' | 'sem_numero' | 'desconectado' | 'nao_entrou';

export const PEOPLE_FILTERS: { key: PeopleFilter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'sem_numero', label: 'Sem número' },
  { key: 'desconectado', label: 'Número desconectado' },
  { key: 'nao_entrou', label: 'Ainda não entrou' },
];

/** Situação de um número, que é o que pinta a bolinha. */
export type NumberState = 'connected' | 'waiting' | 'disconnected' | 'unknown';

export function numberState(n: Pick<MemberNumber, 'connection' | 'never_connected'>): NumberState {
  // Nunca conectou = ainda está esperando o QR, mesmo que o estado gravado diga outra coisa.
  if (n.never_connected) return 'waiting';
  if (n.connection === 'connected') return 'connected';
  if (n.connection === 'connecting') return 'waiting';
  if (n.connection === 'disconnected') return 'disconnected';
  return 'unknown';
}

const numbersOf = (m: TeamAccessMember): MemberNumber[] => m.all_numbers ?? [];

/** Inativo não entra nos filtros de problema: não há o que consertar nele. */
const ativo = (m: TeamAccessMember) => !m.deactivated;

export function matchesFilter(m: TeamAccessMember, filter: PeopleFilter): boolean {
  switch (filter) {
    case 'todas':
      return true;
    case 'sem_numero':
      // Administrador vê todos os números sem ter nenhum: nunca é "sem número".
      return ativo(m) && !m.sees_all_inboxes && numbersOf(m).length === 0;
    case 'desconectado':
      return ativo(m) && numbersOf(m).some(n => numberState(n) === 'disconnected');
    case 'nao_entrou':
      return ativo(m) && !m.last_seen_at;
  }
}

export function filterCounts(members: TeamAccessMember[]): Record<PeopleFilter, number> {
  const counts = { todas: 0, sem_numero: 0, desconectado: 0, nao_entrou: 0 } as Record<PeopleFilter, number>;
  for (const m of members) {
    for (const f of PEOPLE_FILTERS) if (matchesFilter(m, f.key)) counts[f.key] += 1;
  }
  return counts;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca por nome (sem acento) ou por dígitos do celular. */
export function matchesSearch(m: TeamAccessMember, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (semAcento(m.name).includes(semAcento(q))) return true;
  const digits = q.replace(/\D/g, '');
  return digits.length > 0 && (m.whatsapp_number ?? '').replace(/\D/g, '').includes(digits);
}

export function applyPeopleFilters(members: TeamAccessMember[], filter: PeopleFilter, query: string): TeamAccessMember[] {
  return members.filter(m => matchesFilter(m, filter) && matchesSearch(m, query));
}
