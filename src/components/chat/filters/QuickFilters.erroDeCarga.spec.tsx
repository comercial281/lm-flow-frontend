import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickFilters from './QuickFilters';

const labels = vi.hoisted(() => vi.fn());
const users = vi.hoisted(() => vi.fn());
vi.mock('@/services/chat/chatService', () => ({ default: { getAvailableLabels: labels } }));
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: users } }));
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: vi.fn().mockResolvedValue([]) },
  roletaLabel: (r: { name: string }) => r.name,
}));

beforeEach(() => {
  labels.mockReset();
  users.mockReset();
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const abrir = async () => {
  render(<QuickFilters filters={[]} inboxOptions={[]} onApply={() => {}} onOpenAdvanced={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /Filtros/ }));
};

describe('QuickFilters · erro de carga', () => {
  it('etiquetas que falham mostram o erro com Tentar de novo, não o vazio', async () => {
    labels.mockRejectedValueOnce(new Error('rede'));
    users.mockResolvedValue({ data: [{ id: 'u1', name: 'Ana' }] });
    await abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/^Nenhuma etiqueta/)).toBeNull();
    labels.mockResolvedValueOnce([{ id: 1, title: 'quente' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await userEvent.click((await screen.findAllByRole('combobox'))[0]);
    expect(await screen.findByRole('option', { name: 'quente' })).toBeInTheDocument();
    expect(labels).toHaveBeenCalledTimes(2);
  });

  it('Tentar de novo duas vezes seguidas não duplica a lista', async () => {
    labels.mockRejectedValueOnce(new Error('rede'));
    users.mockResolvedValue({ data: [{ id: 'u1', name: 'Ana' }] });
    await abrir();
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    labels.mockResolvedValue([{ id: 1, title: 'quente' }]);
    await userEvent.dblClick(botao);
    await userEvent.click((await screen.findAllByRole('combobox'))[0]);
    expect(await screen.findAllByRole('option', { name: 'quente' })).toHaveLength(1);
  });

  it('erro nos responsáveis não apaga as etiquetas que carregaram', async () => {
    labels.mockResolvedValue([{ id: 1, title: 'quente' }]);
    users.mockRejectedValue(new Error('rede'));
    await abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    await userEvent.click((await screen.findAllByRole('combobox'))[0]);
    expect(await screen.findByRole('option', { name: 'quente' })).toBeInTheDocument();
  });
});
