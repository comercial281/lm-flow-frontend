import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WhatsappOficial from './WhatsappOficial';

const s = vi.hoisted(() => ({ numeros: vi.fn(), navegar: vi.fn() }));
vi.mock('react-router-dom', async orig => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => s.navegar,
}));
vi.mock('@/services/broadcasts/broadcastsService', () => ({
  broadcastsService: {
    whatsappCloudOptions: s.numeros,
    whatsappCloudMetrics: vi.fn().mockResolvedValue({ totals: { sent: 0, delivered: 0, cost: 0 }, channels: [] }),
  },
}));
vi.mock('@/components/channels/settings/MessageTemplateForm', () => ({ default: () => <div>form de modelos</div> }));

const numero = { inbox_id: 'i1', name: 'Oficial 1', phone_number: '5511999990000', templates: [] };
const tela = () => render(<MemoryRouter><WhatsappOficial /></MemoryRouter>);

beforeEach(() => {
  s.numeros.mockReset();
  s.navegar.mockReset();
});

describe('WhatsApp Oficial', () => {
  it('sem número oficial mostra só o estado vazio com o botão pra conectar', async () => {
    s.numeros.mockResolvedValue([]);
    tela();
    expect(await screen.findByText('Nenhum número oficial conectado.')).toBeInTheDocument();
    expect(screen.queryByText('Modelos')).toBeNull();
    expect(screen.queryByText('Métricas')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Conectar número oficial' }));
    expect(s.navegar).toHaveBeenCalledWith('/channels');
  });

  it('com um número mostra o nome e as três partes', async () => {
    s.numeros.mockResolvedValue([numero]);
    tela();
    expect(await screen.findByText('Oficial 1')).toBeInTheDocument();
    expect(screen.getByText('Números oficiais')).toBeInTheDocument();
    expect(screen.getByText('Modelos')).toBeInTheDocument();
    expect(screen.getByText('Métricas')).toBeInTheDocument();
    expect(screen.getByText('form de modelos')).toBeInTheDocument();
  });

  it('erro ao carregar mostra o erro e Tentar de novo recupera', async () => {
    s.numeros.mockRejectedValueOnce(new Error('rede'));
    tela();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum número oficial conectado.')).toBeNull();
    s.numeros.mockResolvedValueOnce([numero]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Oficial 1')).toBeInTheDocument();
  });
});
