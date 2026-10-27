import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LeadSummary } from '@/services/visits/visitsService';

const leadSummary = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return { ...real, visitsService: { ...real.visitsService, leadSummary: (id: string) => leadSummary(id) } };
});

import { esquecerResumos, lerResumoDoLead, resumoGuardado, RESUMO_VALE_MS } from './guardaDoResumo';

const resumo = (nome: string) => ({ contact: { id: 'c1', name: nome, phone_number: null } }) as unknown as LeadSummary;

describe('lerResumoDoLead', () => {
  beforeEach(() => {
    esquecerResumos();
    leadSummary.mockReset();
  });

  it('guarda por 2 minutos', () => {
    expect(RESUMO_VALE_MS).toBe(120_000);
  });

  it('reaproveita o resumo guardado', async () => {
    let agora = 1_000_000;
    const relogio = () => agora;
    leadSummary.mockResolvedValue(resumo('Mariana'));

    await lerResumoDoLead('v1', relogio);
    agora += 60_000;
    const segunda = await lerResumoDoLead('v1', relogio);
    expect(leadSummary).toHaveBeenCalledTimes(1);
    expect(segunda.contact?.name).toBe('Mariana');

    agora += 61_000; // 121 s depois do primeiro
    await lerResumoDoLead('v1', relogio);
    expect(leadSummary).toHaveBeenCalledTimes(2);
  });

  it('cada visita tem o seu resumo', async () => {
    leadSummary.mockImplementation(async (id: string) => resumo(id));
    await lerResumoDoLead('v1');
    const outra = await lerResumoDoLead('v2');
    expect(leadSummary).toHaveBeenCalledTimes(2);
    expect(outra.contact?.name).toBe('v2');
  });

  it('pedido em andamento não duplica', async () => {
    let soltar: (r: LeadSummary) => void = () => {};
    leadSummary.mockReturnValue(new Promise<LeadSummary>((r) => { soltar = r; }));

    const a = lerResumoDoLead('v1');
    const b = lerResumoDoLead('v1');
    soltar(resumo('Rafael'));
    const [ra, rb] = await Promise.all([a, b]);
    expect(leadSummary).toHaveBeenCalledTimes(1);
    expect(ra).toBe(rb);
  });

  it('erro não fica guardado', async () => {
    leadSummary.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce(resumo('Juliana'));

    await expect(lerResumoDoLead('v1')).rejects.toThrow('404');
    expect(resumoGuardado('v1')).toBeUndefined();
    const depois = await lerResumoDoLead('v1');
    expect(depois.contact?.name).toBe('Juliana');
    expect(leadSummary).toHaveBeenCalledTimes(2);
  });

  it('resumoGuardado devolve o que está valendo e esquece o vencido', async () => {
    let agora = 0;
    leadSummary.mockResolvedValue(resumo('Bruna'));
    await lerResumoDoLead('v1', () => agora);
    expect(resumoGuardado('v1', () => agora)?.contact?.name).toBe('Bruna');
    agora = RESUMO_VALE_MS + 1;
    expect(resumoGuardado('v1', () => agora)).toBeUndefined();
  });
});
