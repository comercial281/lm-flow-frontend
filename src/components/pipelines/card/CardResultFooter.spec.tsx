// src/components/pipelines/card/CardResultFooter.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { listOptionsService } from '@/services/listOptions/listOptionsService';
import type { PipelineItem } from '@/types/analytics';
import CardResultFooter from './CardResultFooter';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({ pipelinesService: { setItemStatus: vi.fn() } }));
vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: { list: vi.fn() } }));

const card = (extra: Partial<PipelineItem> = {}) =>
  ({ id: 'i1', pipeline_id: 'p1', stage_id: 's2', status: 'open', contact: { id: 'c1', name: 'Maria Souza' }, ...extra }) as PipelineItem;

describe('rodapé Ganho | Perdido do card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOptionsService.list).mockResolvedValue([
      { id: 'm1', list_key: 'loss_reasons', label: 'Adiou a compra', position: 1, active: true, meta_exclusion: false },
    ] as never);
  });

  // Um cliente caiu nisso na call: funil sem coluna Venda/Desqualificado deixava
  // os botões apagados. Agora a situação é do card — não depende de etapa.
  it('Ganho grava pela situação do card e devolve o card atualizado', async () => {
    vi.mocked(pipelinesService.setItemStatus).mockResolvedValue(card({ status: 'won' }));
    const onMudou = vi.fn();
    render(<CardResultFooter item={card()} onMudou={onMudou} />);

    await userEvent.click(screen.getByRole('button', { name: 'Ganho' }));

    expect(pipelinesService.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'won' });
    await waitFor(() => expect(onMudou).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: 'won' })));
    expect(await screen.findByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
  });

  it('Perdido pergunta o motivo antes de gravar', async () => {
    vi.mocked(pipelinesService.setItemStatus).mockResolvedValue(card({ status: 'lost' }));
    const onMudou = vi.fn();
    render(<CardResultFooter item={card()} onMudou={onMudou} />);

    await userEvent.click(screen.getByRole('button', { name: 'Perdido' }));
    expect(screen.getByRole('dialog', { name: 'Por que este lead foi perdido?' })).toBeInTheDocument();
    expect(pipelinesService.setItemStatus).not.toHaveBeenCalled();

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Motivo' }), 'm1');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como perdido' }));

    expect(pipelinesService.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'lost', reason_option_id: 'm1' });
    await waitFor(() => expect(onMudou).toHaveBeenCalledWith(expect.objectContaining({ status: 'lost' })));
  });

  it('card fechado: selo + Reabrir, e somem Ganho/Perdido', async () => {
    vi.mocked(pipelinesService.setItemStatus).mockResolvedValue(card({ status: 'open' }));
    render(<CardResultFooter item={card({ status: 'lost', lost_reason: { id: 'm1', label: 'Adiou a compra' } })} />);

    expect(screen.getByText('Perdido')).toHaveAttribute('data-situacao', 'lost');
    expect(screen.queryByRole('button', { name: 'Ganho' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    expect(pipelinesService.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'open' });
  });

  it('gravando: tudo trava (clique duplo não sai)', async () => {
    vi.mocked(pipelinesService.setItemStatus).mockReturnValue(new Promise(() => {}));
    render(<CardResultFooter item={card()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ganho' }));
    expect(screen.getByRole('button', { name: 'Ganho' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Perdido' })).toBeDisabled();
    expect(pipelinesService.setItemStatus).toHaveBeenCalledTimes(1);
  });

  it('bloqueado por fora (Etapa gravando): botões travados, e avisa quando ele mesmo grava', async () => {
    const { rerender } = render(<CardResultFooter item={card()} bloqueado />);
    expect(screen.getByRole('button', { name: 'Ganho' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Perdido' })).toBeDisabled();

    vi.mocked(pipelinesService.setItemStatus).mockReturnValue(new Promise(() => {}));
    const onSalvando = vi.fn();
    rerender(<CardResultFooter item={card()} onSalvando={onSalvando} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ganho' }));
    expect(onSalvando).toHaveBeenLastCalledWith(true);
  });
});
