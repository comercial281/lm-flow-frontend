// Sobre o negócio (spec do funil §5.3): edita na hora, sem botão Salvar.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlocoSobreONegocio from './BlocoSobreONegocio';

const s = vi.hoisted(() => ({ salvar: vi.fn(), toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: s.toastError, success: vi.fn() } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({ pipelinesService: { updateItemBusiness: s.salvar } }));

function montar(preco: string | null = null, data: string | null = null) {
  const aoSalvar = vi.fn();
  render(<BlocoSobreONegocio pipelineId="p1" itemId="i1" preco={preco} data={data} aoSalvar={aoSalvar} />);
  return { aoSalvar };
}

beforeEach(() => {
  s.salvar.mockReset();
  s.toastError.mockReset();
});

describe('BlocoSobreONegocio', () => {
  it('mostra o preço com o formato da casa e a data em dia/mês/ano', () => {
    montar('450000.0', '2026-12-20');
    expect(screen.getByRole('heading', { name: 'Sobre o negócio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /450\.000/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20/12/2026' })).toBeInTheDocument();
  });

  it('vazio convida a preencher', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Adicionar preço' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar data' })).toBeInTheDocument();
  });

  it('preço: digitar e sair do campo grava, sem Salvar', async () => {
    s.salvar.mockResolvedValue({ id: 'i1', estimated_value: '450000.0' });
    const { aoSalvar } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar preço' }));
    const campo = screen.getByRole('textbox', { name: 'Preço estimado' });

    fireEvent.change(campo, { target: { value: '450.000' } });
    fireEvent.blur(campo);

    await waitFor(() => expect(s.salvar).toHaveBeenCalledWith('p1', 'i1', { estimated_value: 450000 }));
    expect(aoSalvar).toHaveBeenCalledWith({ estimated_value: '450000.0' });
  });

  it('preço: Esc desiste sem gravar', async () => {
    montar('100000.0');
    await userEvent.click(screen.getByRole('button', { name: /100\.000/ }));
    const campo = screen.getByRole('textbox', { name: 'Preço estimado' });

    fireEvent.change(campo, { target: { value: '200.000' } });
    fireEvent.keyDown(campo, { key: 'Escape' });

    expect(s.salvar).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Preço estimado' })).toBeNull();
  });

  it('preço: apagar tudo limpa', async () => {
    s.salvar.mockResolvedValue({ id: 'i1', estimated_value: null });
    const { aoSalvar } = montar('100000.0');
    await userEvent.click(screen.getByRole('button', { name: /100\.000/ }));
    const campo = screen.getByRole('textbox', { name: 'Preço estimado' });

    fireEvent.change(campo, { target: { value: '' } });
    fireEvent.blur(campo);

    await waitFor(() => expect(s.salvar).toHaveBeenCalledWith('p1', 'i1', { estimated_value: null }));
    expect(aoSalvar).toHaveBeenCalledWith({ estimated_value: null });
  });

  it('preço igual ao de antes não grava', async () => {
    montar('100000.0');
    await userEvent.click(screen.getByRole('button', { name: /100\.000/ }));
    fireEvent.blur(screen.getByRole('textbox', { name: 'Preço estimado' }));

    expect(s.salvar).not.toHaveBeenCalled();
  });

  it('data: escolher no calendário grava na hora', async () => {
    s.salvar.mockResolvedValue({ id: 'i1', expected_close_on: '2026-12-20' });
    const { aoSalvar } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar data' }));

    fireEvent.change(screen.getByLabelText('Data de fechamento esperada'), { target: { value: '2026-12-20' } });

    await waitFor(() => expect(s.salvar).toHaveBeenCalledWith('p1', 'i1', { expected_close_on: '2026-12-20' }));
    expect(aoSalvar).toHaveBeenCalledWith({ expected_close_on: '2026-12-20' });
  });

  it('data: o x limpa', async () => {
    s.salvar.mockResolvedValue({ id: 'i1', expected_close_on: null });
    montar(null, '2026-12-20');
    await userEvent.click(screen.getByRole('button', { name: 'Limpar data de fechamento' }));

    await waitFor(() => expect(s.salvar).toHaveBeenCalledWith('p1', 'i1', { expected_close_on: null }));
  });

  it('falha ao gravar avisa e não muda a tela', async () => {
    s.salvar.mockRejectedValue(new Error('fora'));
    const { aoSalvar } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar preço' }));
    const campo = screen.getByRole('textbox', { name: 'Preço estimado' });

    fireEvent.change(campo, { target: { value: '9' } });
    fireEvent.blur(campo);

    await waitFor(() => expect(s.toastError).toHaveBeenCalledWith('Não consegui salvar o preço estimado.'));
    expect(aoSalvar).not.toHaveBeenCalled();
  });
});
