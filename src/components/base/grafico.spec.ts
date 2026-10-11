import { describe, it, expect } from 'vitest';
import { CORES_DO_GRAFICO, EIXO_DO_GRAFICO, CANTOS_DA_BARRA, DICA_DO_GRAFICO, CLASSE_DA_DICA } from './grafico';

describe('gráfico da casa (peça 21)', () => {
  it('as cores das séries são as do tema, nunca hex fixo', () => {
    expect(CORES_DO_GRAFICO).toEqual(['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']);
    expect(JSON.stringify({ EIXO_DO_GRAFICO, DICA_DO_GRAFICO })).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('segue o desenho do Painel: eixo de 11 px sem linha, barra com cantos de 4 px no topo, dica com cantos de 10 px', () => {
    expect(EIXO_DO_GRAFICO).toMatchObject({ tick: { fontSize: 11 }, tickLine: false, axisLine: false });
    expect(CANTOS_DA_BARRA).toEqual([4, 4, 0, 0]);
    expect(DICA_DO_GRAFICO.contentStyle).toMatchObject({ borderRadius: 10 });
    expect(CLASSE_DA_DICA).toContain('rounded-[10px]');
    expect(CLASSE_DA_DICA).toContain('border');
  });
});
