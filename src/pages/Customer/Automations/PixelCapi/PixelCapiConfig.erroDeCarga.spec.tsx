import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PixelCapiConfig from './PixelCapiConfig';

const s = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/capi/capiConfigService', async orig => {
  const real = await orig<typeof import('@/services/capi/capiConfigService')>();
  return { ...real, capiConfigService: { get: s.get, update: vi.fn(), testConnection: vi.fn() } };
});

const CONFIG = {
  id: 'cfg1', is_enabled: true, pixel_id: '1543903880225628', access_token_set: true, test_event_code: null,
  default_currency: 'BRL', stage_map: {}, status_map: {}, known_events: ['Lead'], intents: ['none'],
  pipelines: [], updated_at: '2026-10-07T10:00:00Z',
};

beforeEach(() => s.get.mockReset());

describe('Pixel/CAPI · erro de carga', () => {
  it('carga que falha mostra o erro com Tentar de novo, não o formulário em branco', async () => {
    s.get.mockRejectedValueOnce(new Error('rede'));
    render(<PixelCapiConfig />);
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText('Pixel / Conversões (CAPI)')).toBeNull();
    expect(screen.queryByRole('button', { name: /Salvar/ })).toBeNull();
    s.get.mockResolvedValueOnce(CONFIG);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Pixel / Conversões (CAPI)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar/ })).toBeInTheDocument();
  });

  it('Tentar de novo duas vezes seguidas não duplica a tela', async () => {
    s.get.mockRejectedValueOnce(new Error('rede'));
    render(<PixelCapiConfig />);
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    s.get.mockResolvedValue(CONFIG);
    await userEvent.dblClick(botao);
    expect(await screen.findAllByText('Pixel / Conversões (CAPI)')).toHaveLength(1);
  });
});
