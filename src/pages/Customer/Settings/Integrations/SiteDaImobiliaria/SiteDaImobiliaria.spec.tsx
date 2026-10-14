// src/pages/Customer/Settings/Integrations/SiteDaImobiliaria/SiteDaImobiliaria.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SiteDaImobiliaria from './SiteDaImobiliaria';

const servico = vi.hoisted(() => ({ get: vi.fn(), previa: vi.fn(), confirmar: vi.fn(), atualizarAgora: vi.fn(), desligar: vi.fn() }));
vi.mock('@/services/properties/siteFeedService', () => ({ siteFeedService: servico, default: servico }));
const pode = vi.hoisted(() => ({ valor: true }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => pode.valor }));

const abrir = () => render(<MemoryRouter><SiteDaImobiliaria /></MemoryRouter>);
const previa = {
  format: 'vrsync', provider: 'ImobiBrasil', total: 220, shrunk: false,
  counts: { create: 219, update: 1, unchanged: 0, inactivate: 0, reactivate: 0, skip: 0 },
  warnings: [{ key: 'sem_tipo', count: 2, text: '2 imóveis sem tipo: entram como Outro' }],
  sample: [{ code: '4327', title: 'Sobrado', type_label: 'sobrado', price_label: 'R$ 960.000', city: 'São Paulo', photos: 18, action: 'create' }],
};

describe('Site da imobiliária', () => {
  beforeEach(() => { vi.clearAllMocks(); pode.valor = true; });

  it('sem configuração: lê o arquivo, mostra a prévia e confirma', async () => {
    servico.get.mockResolvedValue({ configured: false, state: 'off' });
    servico.previa.mockResolvedValue(previa);
    servico.confirmar.mockResolvedValue({ configured: true, state: 'waiting', url: 'https://x.com/a.xml' });
    abrir();
    fireEvent.change(await screen.findByLabelText('Endereço do arquivo de imóveis'), { target: { value: 'https://x.com/a.xml' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ler arquivo' }));
    expect(await screen.findByText('Vai criar 219 · atualizar 1')).toBeInTheDocument();
    expect(screen.getByText('2 imóveis sem tipo: entram como Outro')).toBeInTheDocument();
    expect(screen.getByText('Sobrado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    await waitFor(() => expect(servico.confirmar).toHaveBeenCalledWith('https://x.com/a.xml', { mesmoAssim: false }));
  });

  it('erro da prévia aparece com a frase do servidor', async () => {
    servico.get.mockResolvedValue({ configured: false, state: 'off' });
    servico.previa.mockRejectedValue({ response: { data: { error: { message: 'Não reconhecemos esse arquivo.' } } } });
    abrir();
    fireEvent.change(await screen.findByLabelText('Endereço do arquivo de imóveis'), { target: { value: 'https://x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ler arquivo' }));
    expect(await screen.findByText('Não reconhecemos esse arquivo.')).toBeInTheDocument();
  });

  it('ligado: situação, última mudança e Atualizar agora', async () => {
    servico.get.mockResolvedValue({ configured: true, enabled: true, state: 'ok', url: 'https://x.com/a.xml', last_count: 220,
      last_checked_at: new Date().toISOString(), last_summary: { create: 3, inactivate: 1 } });
    servico.atualizarAgora.mockResolvedValue({ configured: true, state: 'ok' });
    abrir();
    expect(await screen.findByText('Lendo')).toBeInTheDocument();
    expect(screen.getByText(/3 novos · 1 saiu/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    await waitFor(() => expect(servico.atualizarAgora).toHaveBeenCalled());
  });

  it('sem permissão: vê a situação, sem os botões', async () => {
    pode.valor = false;
    servico.get.mockResolvedValue({ configured: true, enabled: true, state: 'ok', url: 'https://x.com/a.xml', last_count: 220 });
    abrir();
    expect(await screen.findByText('Lendo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Endereço do arquivo de imóveis')).not.toBeInTheDocument();
  });

  it('carga falhou: erro com Tentar de novo, sem formulário', async () => {
    servico.get.mockRejectedValue(new Error('x'));
    abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Endereço do arquivo de imóveis')).not.toBeInTheDocument();
  });
});
