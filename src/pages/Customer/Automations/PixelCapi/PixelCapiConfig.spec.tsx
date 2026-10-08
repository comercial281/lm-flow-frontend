// Pixel/CAPI por situação (spec do funil §3.4): a Meta é avisada ao MARCAR Ganho
// ou Perdido no card, não ao entrar nas etapas finais (Concluída/Cancelada) —
// que saem do mapa por etapa.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PixelCapiConfig from './PixelCapiConfig';

const s = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), testConnection: vi.fn() }));
vi.mock('@/services/capi/capiConfigService', async orig => {
  const real = await orig<typeof import('@/services/capi/capiConfigService')>();
  return { ...real, capiConfigService: { get: s.get, update: s.update, testConnection: s.testConnection } };
});

const LEAD = { event_name: 'Lead', enabled: true, to_client: true, intent: 'none' as const };
const COMPRA = { event_name: 'Purchase', enabled: true, to_client: true, intent: 'lookalike' as const };

const CONFIG = {
  id: 'cfg1',
  is_enabled: true,
  pixel_id: '1543903880225628',
  access_token_set: true,
  test_event_code: null,
  default_currency: 'BRL',
  stage_map: { s1: LEAD, s9: COMPRA },
  status_map: { won: COMPRA },
  known_events: ['Lead', 'Purchase', 'Desqualificado'],
  intents: ['lookalike', 'exclusion', 'none'],
  pipelines: [{
    id: 'p1',
    name: 'Leads (Marketing)',
    stages: [
      { id: 's1', name: 'Novo', position: 1, final: null },
      { id: 's9', name: 'Concluído', position: 9, final: 'won' },
      { id: 's10', name: 'Desqualificado', position: 10, final: 'lost' },
    ],
  }],
  updated_at: '2026-10-07T10:00:00Z',
};

beforeEach(() => {
  s.get.mockReset().mockResolvedValue(CONFIG);
  s.update.mockReset().mockImplementation(async (data: Record<string, unknown>) => ({ ...CONFIG, ...data }));
});

describe('Pixel/CAPI · situação do card', () => {
  it('mostra "Ao marcar Ganho" e "Ao marcar Perdido" com a regra gravada', async () => {
    render(<PixelCapiConfig />);

    expect(await screen.findByText('Ao marcar Ganho')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Evento: Ao marcar Ganho' })).toHaveValue('Purchase');
    expect(screen.getByRole('combobox', { name: 'Evento: Ao marcar Perdido' })).toHaveValue('');
    expect(screen.getByText(/Perdido só avisa a Meta quando o motivo da perda/)).toBeInTheDocument();
  });

  it('o mapa por etapa não oferece as etapas finais (pelo tipo)', async () => {
    render(<PixelCapiConfig />);

    expect(await screen.findByRole('combobox', { name: 'Evento: Novo' })).toHaveValue('Lead');
    expect(screen.queryByRole('combobox', { name: 'Evento: Concluído' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Evento: Desqualificado' })).toBeNull();
  });

  it('Salvar manda o status_map (só o que tem evento) e mantém a regra guardada da etapa final', async () => {
    render(<PixelCapiConfig />);
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Evento: Ao marcar Perdido' }), 'Desqualificado');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(s.update).toHaveBeenCalledTimes(1));
    expect(s.update.mock.calls[0][0]).toMatchObject({
      status_map: {
        won: COMPRA,
        lost: { event_name: 'Desqualificado', enabled: true, to_client: true, intent: 'none' },
      },
      // A regra da etapa final fica: quem a converte em "Ao marcar Ganho" é a passagem (P2-T16).
      stage_map: { s1: LEAD, s9: COMPRA },
    });
  });

  it('"Não disparar" tira a situação do status_map', async () => {
    render(<PixelCapiConfig />);
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Evento: Ao marcar Ganho' }), '');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(s.update).toHaveBeenCalledTimes(1));
    expect(s.update.mock.calls[0][0].status_map).toEqual({});
  });
});
