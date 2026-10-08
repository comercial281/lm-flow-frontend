// src/features/pipelines/situacao/MarcarPerdidoDialog.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { listOptionsService } from '@/services/listOptions/listOptionsService';
import MarcarPerdidoDialog from './MarcarPerdidoDialog';

vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: { list: vi.fn() } }));

const motivo = (id: string, label: string, active = true) =>
  ({ id, list_key: 'loss_reasons', label, position: 1, active, meta_exclusion: false });

function abrir(props: Partial<Parameters<typeof MarcarPerdidoDialog>[0]> = {}) {
  const aoConfirmar = vi.fn();
  const aoFechar = vi.fn();
  render(
    <MarcarPerdidoDialog aberto nomeDoLead="Maria Souza" salvando={false} aoFechar={aoFechar} aoConfirmar={aoConfirmar} {...props} />,
  );
  return { aoConfirmar, aoFechar };
}

describe('MarcarPerdidoDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pede o motivo (só os ativos) e manda motivo e comentário', async () => {
    vi.mocked(listOptionsService.list).mockResolvedValue([
      motivo('m1', 'Adiou a compra'), motivo('m2', 'Comprou com concorrente'), motivo('m3', 'Motivo velho', false),
    ] as never);
    const { aoConfirmar } = abrir();

    expect(screen.getByRole('dialog', { name: 'Por que este lead foi perdido?' })).toBeInTheDocument();
    const motivoCampo = await screen.findByRole('combobox', { name: 'Motivo' });
    expect(listOptionsService.list).toHaveBeenCalledWith('loss_reasons');
    expect(screen.queryByRole('option', { name: 'Motivo velho' })).toBeNull();

    const marcar = screen.getByRole('button', { name: 'Marcar como perdido' });
    expect(marcar).toBeDisabled();

    await userEvent.selectOptions(motivoCampo, 'm1');
    await userEvent.type(screen.getByRole('textbox', { name: 'Comentário' }), 'Volta em março');
    await userEvent.click(marcar);

    expect(aoConfirmar).toHaveBeenCalledWith('m1', 'Volta em março');
  });

  it('não carregou: diz que é erro e deixa tentar de novo (não confunde com lista vazia)', async () => {
    vi.mocked(listOptionsService.list).mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce([motivo('m1', 'Adiou a compra')] as never);
    abrir();

    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('combobox', { name: 'Motivo' })).toBeInTheDocument();
    expect(listOptionsService.list).toHaveBeenCalledTimes(2);
  });

  it('sem motivo ativo: explica onde cadastrar e não deixa marcar', async () => {
    vi.mocked(listOptionsService.list).mockResolvedValue([motivo('m3', 'Arquivado', false)] as never);
    abrir();
    expect(await screen.findByText(/Nenhum motivo de perda ativo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar como perdido' })).toBeDisabled();
  });

  it('gravando: os dois botões travam', async () => {
    vi.mocked(listOptionsService.list).mockResolvedValue([motivo('m1', 'Adiou a compra')] as never);
    abrir({ salvando: true });
    await screen.findByRole('combobox', { name: 'Motivo' });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Marcar como perdido/ })).toBeDisabled();
  });

  it('Cancelar fecha sem gravar', async () => {
    vi.mocked(listOptionsService.list).mockResolvedValue([] as never);
    const { aoFechar, aoConfirmar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
    expect(aoConfirmar).not.toHaveBeenCalled();
  });
});
