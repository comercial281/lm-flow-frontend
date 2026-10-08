// src/pages/Customer/Pipelines/quadro/usePipelineFilters.spec.tsx
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS } from './enderecoDoQuadro';
import { usePipelineFilters } from './usePipelineFilters';

const STAGES = [
  { id: 's1', name: 'Novo', items: [{ id: 'a', contact: { name: 'Maria Souza' } }] },
  { id: 's2', name: 'Proposta', items: [{ id: 'b', contact: { name: 'João Lima' } }] },
] as unknown as PipelineStage[];

const emEndereco = (inicio: string) =>
  function Envelope({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[inicio]}>{children}</MemoryRouter>;
  };

const usar = () => {
  const filtros = usePipelineFilters(STAGES);
  const { search } = useLocation();
  return { ...filtros, endereco: new URLSearchParams(search) };
};

const idsVisiveis = (stages: PipelineStage[]) => stages.flatMap(s => (s.items || []).map((i: PipelineItem) => i.id));

describe('usePipelineFilters (aba e filtros no endereço)', () => {
  // Review Focus 5: F5 e link mandado abrem igual.
  it('F5: a aba e os filtros do endereço já valem, e o card continua no endereço', () => {
    const { result } = renderHook(usar, { wrapper: emEndereco('/pipelines/p1?aba=perdidos&etapas=s2&card=i3') });
    expect(result.current.aba).toBe('perdidos');
    expect(result.current.filtros.etapas).toEqual(['s2']);
    expect(idsVisiveis(result.current.filteredStages)).toEqual(['b']);
    expect(result.current.totalVisivel).toBe(1);
    expect(result.current.quantosFiltros).toBe(1);
    expect(result.current.endereco.get('card')).toBe('i3');
  });

  it('trocar de aba mantém card, etapa e filtros; Abertos some do endereço', () => {
    const { result } = renderHook(usar, { wrapper: emEndereco('/pipelines/p1?card=i3&etapa=s2&etiq=Meta') });
    act(() => result.current.setAba('ganhos'));
    expect(result.current.endereco.get('aba')).toBe('ganhos');
    expect(result.current.endereco.get('card')).toBe('i3');
    expect(result.current.endereco.get('etapa')).toBe('s2');
    expect(result.current.endereco.getAll('etiq')).toEqual(['Meta']);
    act(() => result.current.setAba('abertos'));
    expect(result.current.endereco.has('aba')).toBe(false);
  });

  it('aplicar grava os filtros; limpar tira só os filtros (aba e card ficam)', () => {
    const { result } = renderHook(usar, { wrapper: emEndereco('/pipelines/p1?aba=todos&card=i3') });
    act(() => result.current.aplicar({ ...FILTROS_VAZIOS, largados: 14, resp: ['u1'] }));
    expect(result.current.endereco.get('largados')).toBe('14');
    expect(result.current.endereco.getAll('resp')).toEqual(['u1']);
    act(() => result.current.limpar());
    expect(result.current.endereco.toString()).toBe('card=i3&aba=todos');
  });

  it('a busca filtra e não vai pro endereço', () => {
    const { result } = renderHook(usar, { wrapper: emEndereco('/pipelines/p1') });
    act(() => result.current.setBusca('joão'));
    expect(idsVisiveis(result.current.filteredStages)).toEqual(['b']);
    expect(result.current.endereco.toString()).toBe('');
  });
});
