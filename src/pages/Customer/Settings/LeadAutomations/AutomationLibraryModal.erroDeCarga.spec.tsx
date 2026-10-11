import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AutomationLibraryModal from './AutomationLibraryModal';

const getAll = vi.hoisted(() => vi.fn());
vi.mock('@/services/automationTemplates/automationTemplatesService', async orig => {
  const real = await orig<typeof import('@/services/automationTemplates/automationTemplatesService')>();
  return { ...real, automationTemplatesService: { getAll, apply: vi.fn() } };
});
vi.mock('@/services/core/api', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const modelo = { id: 't1', name: 'Boas-vindas', category: 'lead', description: null, position: 1, meta: {} };
const abrir = () => render(<AutomationLibraryModal open onClose={() => {}} onApplied={() => {}} />);

beforeEach(() => getAll.mockReset());

describe('AutomationLibraryModal · erro de carga', () => {
  it('carga que falha mostra o erro com Tentar de novo, não "Nenhum modelo"', async () => {
    getAll.mockRejectedValueOnce(new Error('rede'));
    abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum modelo/)).toBeNull();
    getAll.mockResolvedValueOnce([modelo]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Boas-vindas')).toBeInTheDocument();
  });

  it('Tentar de novo duas vezes seguidas não duplica a lista', async () => {
    getAll.mockRejectedValueOnce(new Error('rede'));
    abrir();
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    getAll.mockResolvedValue([modelo]);
    await userEvent.dblClick(botao);
    expect(await screen.findAllByText('Boas-vindas')).toHaveLength(1);
  });
});
