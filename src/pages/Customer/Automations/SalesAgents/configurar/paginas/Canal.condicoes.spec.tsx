// Canal com o bloco de condições DE VERDADE (o Canal.spec troca o bloco por um
// marcador). Confere a regra da gravação na hora nas condições: só condição
// completa vai pro servidor. Condição em branco (palavra vazia, formulário sem
// marcar, coluna sem escolher) não deixa NENHUM lead passar no servidor
// (SalesAgents::TriggerGate), e numa IA ligada isso perde lead.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

vi.mock('@/services/leadAds/leadAdsFormsService', () => ({ leadAdsFormsService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [] }), getPipelineStages: vi.fn().mockResolvedValue({ data: [] }) },
}));
import Canal from './Canal';

// O `gravar` de teste devolvendo a IA "salva" pra página, como a casca faz.
function abrir(inicial: SalesAgent) {
  const gravar = gravarDeTeste('canal');
  function Casca() {
    const [agent, setAgent] = useState(inicial);
    const gravarEAplicar = async (...args: Parameters<typeof gravar>) => {
      const ok = await gravar(...args);
      const m = args[0];
      if (ok) setAgent((a) => ({ ...a, ...m }));
      return ok;
    };
    return <><Canal agent={agent} inboxes={[]} gravar={gravarEAplicar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>;
  }
  render(<Casca />);
  return gravar;
}

const tipos = () => screen.getAllByRole('combobox').filter((c) => (c as HTMLSelectElement).value !== 'contains' && (c as HTMLSelectElement).value !== 'equals');

describe('Canal · condições gravam só quando completas', () => {
  it('"Só alguns" → "Adicionar condição" não grava a condição em branco; grava quando a palavra é escrita', async () => {
    const gravar = abrir(agenteDeTeste({ triggers: [] }));
    await userEvent.click(screen.getByRole('radio', { name: 'Só alguns' }));
    await userEvent.click(screen.getByRole('button', { name: /Adicionar condição/ }));
    expect(gravar).not.toHaveBeenCalled();
    // A linha em branco fica na tela pra ser preenchida.
    const palavra = screen.getByPlaceholderText('palavra (ex: fluxoimob)');
    await userEvent.type(palavra, 'casa');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar).toHaveBeenCalledWith({ triggers: [{ type: 'keyword', value: 'casa', match_type: 'contains' }] });
    expect(screen.getByPlaceholderText('palavra (ex: fluxoimob)')).toHaveValue('casa');
  });

  it('trocar o tipo de uma linha nova não grava até preencher; a linha em branco sobrevive à gravação das outras', async () => {
    const gravar = abrir(agenteDeTeste({ triggers: [{ type: 'tag', value: 'vip' }], trigger_match_mode: 'all' }));
    await userEvent.click(screen.getByRole('button', { name: /Adicionar condição/ }));
    await userEvent.selectOptions(tipos()[1], 'form');
    await userEvent.selectOptions(tipos()[1], 'pipeline_stage');
    expect(gravar).not.toHaveBeenCalled();
    // Mexer na condição completa grava só ela; a linha nova continua na tela.
    const etiqueta = screen.getByPlaceholderText('etiqueta (ex: vip)');
    await userEvent.type(etiqueta, '2');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenLastCalledWith({ triggers: [{ type: 'tag', value: 'vip2' }] });
    expect(screen.getAllByRole('button', { name: 'Remover condição' })).toHaveLength(2);
    expect((tipos()[1] as HTMLSelectElement).value).toBe('pipeline_stage');
  });

  it('tirar a última condição grava "todos", e as condições continuam abertas pra escolher outra', async () => {
    const gravar = abrir(agenteDeTeste({ triggers: [{ type: 'tag', value: 'vip' }] }));
    await userEvent.click(screen.getByRole('button', { name: 'Remover condição' }));
    expect(gravar).toHaveBeenCalledWith({ triggers: [] });
    expect(screen.getByRole('button', { name: /Adicionar condição/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Só alguns' })).toHaveAttribute('aria-checked', 'true');
  });
});
