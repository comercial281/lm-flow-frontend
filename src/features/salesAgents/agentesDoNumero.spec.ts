import { describe, it, expect } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agentesDoNumero, agentesParaOBloco, temNumeroDividido } from './agentesDoNumero';

const n = (inbox_id: string, position: number, enabled = true) => ({ inbox_id, position, enabled }) as never;
const ag = (id: string, name: string, p: Partial<SalesAgent>): SalesAgent => ({
  id, name, enabled: true, numbers: [], inbox_id: null, followup_only: false, absorbed_into_id: null, ...p,
}) as unknown as SalesAgent;

describe('agentesDoNumero', () => {
  it('lista pelos números do agente, na ordem da position, e não pelo espelho inbox_id', () => {
    const a = ag('a', 'Agente A', { inbox_id: 'i9', numbers: [n('i9', 0), n('i1', 2)] });
    const b = ag('b', 'Agente B', { inbox_id: 'i1', numbers: [n('i1', 1)] });
    expect(agentesDoNumero([a, b], 'i1').map(x => x.id)).toEqual(['b', 'a']);
  });

  it('agente sem a lista de números cai no espelho inbox_id', () => {
    const a = ag('a', 'Agente A', { inbox_id: 'i1', numbers: [] });
    expect(agentesDoNumero([a], 'i1')).toHaveLength(1);
    expect(agentesDoNumero([a], 'i2')).toHaveLength(0);
  });

  it('não entram: juntado, só de follow-up e número desligado', () => {
    const lista = [
      ag('a', 'Agente A', { numbers: [n('i1', 0)], absorbed_into_id: 'x' }),
      ag('b', 'Agente B', { numbers: [n('i1', 0)], followup_only: true }),
      ag('c', 'Agente C', { numbers: [n('i1', 0, false)] }),
      ag('d', 'Agente D', { numbers: [n('i1', 0)] }),
    ];
    expect(agentesDoNumero(lista, 'i1').map(x => x.id)).toEqual(['d']);
  });

  it('os ligados vêm no lugar dos desligados; sem nenhum ligado, devolve os desligados', () => {
    const on = ag('a', 'Agente A', { numbers: [n('i1', 1)] });
    const off = ag('b', 'Agente B', { enabled: false, numbers: [n('i1', 0)] });
    expect(agentesDoNumero([on, off], 'i1').map(x => x.id)).toEqual(['a']);
    expect(agentesDoNumero([off], 'i1').map(x => x.id)).toEqual(['b']);
  });

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
