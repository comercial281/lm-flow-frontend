import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), groups: vi.fn(), test: vi.fn() }));
vi.mock('@/services/superAdmin/aiVisitNoticeService', () => ({ aiVisitNoticeService: svc }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AiVisitNoticeSection from './AiVisitNoticeSection';

const alfa = { schema: 'tenant_a', slug: 'a', name: 'Imobiliária Alfa', enabled: false, group_jids: [] as string[] };
const beta = { schema: 'tenant_b', slug: 'b', name: 'Imobiliária Beta', enabled: true, group_jids: [] as string[] };
const config = (clients = [alfa, beta]) =>
  ({ template: 'Visita de {lead}', default_template: 'Visita de {lead}', instance: 'LM01', vars: ['lead'], clients, history: [] });

describe('IA Vendedora → Aviso de visita', () => {
  beforeEach(() => Object.values(svc).forEach((f) => f.mockReset()));

  it('erro ao carregar aparece como erro com tentar de novo', async () => {
    svc.load.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(config());
    const user = userEvent.setup();
    render(<AiVisitNoticeSection />);
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Imobiliária Alfa')).toBeInTheDocument();
  });

  it('ligar grava só a imobiliária que mudou e relê o destino na hora', async () => {
    svc.load.mockResolvedValue(config());
    svc.save.mockResolvedValue(config([{ ...alfa, enabled: true }, beta]));
    svc.groups.mockResolvedValue({ schema: 'tenant_a', enabled: true, reason: null, selected: [], groups: [] });
    const user = userEvent.setup();
    render(<AiVisitNoticeSection />);
    await user.click(await screen.findByRole('switch', { name: 'Aviso de visita de Imobiliária Alfa' }));
    await waitFor(() => expect(svc.save).toHaveBeenCalledWith({ tenants: { tenant_a: { enabled: true, group_jids: [] } } }));
    await waitFor(() => expect(svc.groups).toHaveBeenCalledWith('tenant_a'));
  });

  it('servidor recusou: a chave volta sozinha', async () => {
    svc.load.mockResolvedValue(config());
    svc.save.mockRejectedValue(new Error('recusado'));
    const user = userEvent.setup();
    render(<AiVisitNoticeSection />);
    const chave = await screen.findByRole('switch', { name: 'Aviso de visita de Imobiliária Alfa' });
    await user.click(chave);
    await waitFor(() => expect(chave).not.toBeChecked());
    expect(svc.groups).not.toHaveBeenCalled();
  });

  it('sem imobiliária: vazio; busca sem resultado oferece limpar', async () => {
    svc.load.mockResolvedValueOnce(config([]));
    const { unmount } = render(<AiVisitNoticeSection />);
    expect(await screen.findByText('Nenhuma imobiliária ainda')).toBeInTheDocument();
    unmount();

    svc.load.mockResolvedValueOnce(config());
    const user = userEvent.setup();
    render(<AiVisitNoticeSection />);
    await user.type(await screen.findByRole('searchbox', { name: 'Buscar imobiliária' }), 'zzz');
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('Imobiliária Beta')).toBeInTheDocument();
  });
});
