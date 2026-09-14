import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalAdPlanCard from './PortalAdPlanCard';
import type { PortalAdType } from '@/services/portals/portalsService';

const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/portals/portalsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/portals/portalsService');
  return {
    ...actual,
    portalsService: { updateSettings: (...a: unknown[]) => mocks.updateSettings(...a) },
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => mocks.toastSuccess(...a),
    error: (...a: unknown[]) => mocks.toastError(...a),
    warning: vi.fn(),
  },
}));

const tipos: PortalAdType[] = [
  { key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: null, count: 10 },
  { key: 'premium', label: 'Destaque', feed_value: 'PREMIUM', limit: 5, count: 2 },
];

/**
 * *Plano de anúncios*: a cota por tipo e o investimento mensal, gravados no
 * mesmo PUT de configuração. Vazio e 0 são "ilimitado", que o servidor grava
 * como 0.
 */
describe('PortalAdPlanCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSettings.mockResolvedValue({});
  });

  it('abre com a cota atual de cada tipo e "0 = ilimitado" onde não há cota', () => {
    render(<PortalAdPlanCard portalKey="portal_zap" adTypes={tipos} settings={{ monthly_investment: '3593.45' }} />);

    expect(screen.getByLabelText('Padrão')).toHaveValue(null);
    expect(screen.getByLabelText('Destaque')).toHaveValue(5);
    expect(screen.getAllByText('0 = ilimitado')).toHaveLength(1);
    expect(screen.getByLabelText('Valor mensal do investimento (R$)')).toHaveValue('3593,45');
  });

  it('salva ad_plan e investimento numa requisição, com vazio/0 virando 0 (ilimitado)', async () => {
    const usuario = userEvent.setup();
    const onSaved = vi.fn();
    render(<PortalAdPlanCard portalKey="portal_zap" adTypes={tipos} onSaved={onSaved} />);

    await usuario.clear(screen.getByLabelText('Destaque'));
    await usuario.type(screen.getByLabelText('Destaque'), '40');
    await usuario.type(screen.getByLabelText('Padrão'), '0');
    await usuario.type(screen.getByLabelText('Valor mensal do investimento (R$)'), '3.593,45');

    await usuario.click(screen.getByRole('button', { name: 'Salvar plano' }));

    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(1));
    expect(mocks.updateSettings).toHaveBeenCalledWith('portal_zap', {
      ad_plan: { standard: 0, premium: 40 },
      monthly_investment: '3593.45',
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Plano salvo');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('investimento em branco viaja como nulo', async () => {
    const usuario = userEvent.setup();
    render(<PortalAdPlanCard portalKey="portal_zap" adTypes={tipos} settings={{ monthly_investment: '100.00' }} />);

    await usuario.clear(screen.getByLabelText('Valor mensal do investimento (R$)'));
    await usuario.click(screen.getByRole('button', { name: 'Salvar plano' }));

    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(1));
    expect(mocks.updateSettings.mock.calls[0][1]).toMatchObject({ monthly_investment: null });
  });

  it('investimento que não é número avisa e não envia', async () => {
    const usuario = userEvent.setup();
    render(<PortalAdPlanCard portalKey="portal_zap" adTypes={tipos} />);

    await usuario.type(screen.getByLabelText('Valor mensal do investimento (R$)'), 'mil reais');
    await usuario.click(screen.getByRole('button', { name: 'Salvar plano' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Valor mensal inválido — use números, como 3.593,45'));
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it('erro do servidor aparece com a mensagem dele (nos dois formatos da API)', async () => {
    const usuario = userEvent.setup();
    mocks.updateSettings
      .mockRejectedValueOnce({
        response: { status: 422, data: { success: false, error: { code: 'INVALID', message: 'Cota inválida para Destaque' } } },
      })
      .mockRejectedValueOnce({
        response: { status: 403, data: { error: 'Forbidden', message: 'Seu cargo não permite esta ação' } },
      });
    render(<PortalAdPlanCard portalKey="portal_zap" adTypes={tipos} />);

    await usuario.click(screen.getByRole('button', { name: 'Salvar plano' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Cota inválida para Destaque'));

    await usuario.click(screen.getByRole('button', { name: 'Salvar plano' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Seu cargo não permite esta ação'));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
