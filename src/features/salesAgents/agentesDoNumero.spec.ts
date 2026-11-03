import { describe, it, expect } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agentesParaOBloco, temNumeroDividido } from './agentesDoNumero';

const n = (inbox_id: string, position: number, enabled = true) => ({ inbox_id, position, enabled }) as never;
const ag = (id: string, name: string, p: Partial<SalesAgent>): SalesAgent => ({
  id, name, enabled: true, numbers: [], inbox_id: null, followup_only: false, absorbed_into_id: null, ...p,
}) as unknown as SalesAgent;

describe('agentes do bloco', () => {
  it('temNumeroDividido: 2 ligados no mesmo número', () => {
    const a = ag('a', 'Agente A', { numbers: [n('i1', 0)] });
    const b = ag('b', 'Agente B', { numbers: [n('i1', 1)] });
    const c = ag('c', 'Agente C', { numbers: [n('i2', 0)] });
    expect(temNumeroDividido([a, b, c])).toBe(true);
    expect(temNumeroDividido([a, c])).toBe(false);
    expect(temNumeroDividido([a, { ...b, enabled: false }])).toBe(false);
  });

  it('agentesParaOBloco: só vivos, ligados e que respondem ao vivo', () => {
    const a = ag('a', 'Agente A', {});
    const b = ag('b', 'Agente B', { followup_only: true });
    const c = ag('c', 'Agente C', { enabled: false });
    expect(agentesParaOBloco([a, b, c]).map(x => x.id)).toEqual(['a']);
  });
});
