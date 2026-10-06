import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: vi.fn().mockResolvedValue({ data: [{ id: 'f1', name: 'Vendas' }] }),
    getPipelineStages: vi.fn().mockResolvedValue({ data: [{ id: 's1', name: 'Em atendimento' }, { id: 's2', name: 'Com corretor' }] }),
  },
}));
import Funil from './Funil';

describe('Funil', () => {
  it('6 momentos em fileira, na ordem da conversa; escolher coluna grava o mapa', async () => {
    const gravar = gravarDeTeste('funil');
    render(<Funil agent={agenteDeTeste({ pipeline_move_enabled: true, pipeline_id: 'f1', pipeline_stage_map: {} })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} aoChaveGerada={vi.fn()} />);
    const momentos = screen.getAllByRole('listitem');
    expect(momentos.map((m) => m.querySelector('[data-momento]')?.textContent)).toEqual([
      'Descobrindo o que o lead quer', 'Qualificando', 'Pronto para visita', 'Combinando dia e hora', 'Visita agendada', 'Passou pro corretor',
    ]);
    await screen.findAllByRole('option', { name: 'Com corretor' });
    await userEvent.selectOptions(screen.getByLabelText('Passou pro corretor'), 's2');
    expect(gravar).toHaveBeenCalledWith({ pipeline_stage_map: { transferir: 's2' } });
  });

  it('trocar de funil zera o mapa (as colunas são de outro funil)', async () => {
    const gravar = gravarDeTeste('funil');
    render(<Funil agent={agenteDeTeste({ pipeline_move_enabled: true, pipeline_id: null })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} aoChaveGerada={vi.fn()} />);
    await screen.findByRole('option', { name: 'Vendas' });
    await userEvent.selectOptions(screen.getByLabelText('Funil'), 'f1');
    expect(gravar).toHaveBeenCalledWith({ pipeline_id: 'f1', pipeline_stage_map: {} });
  });
});
