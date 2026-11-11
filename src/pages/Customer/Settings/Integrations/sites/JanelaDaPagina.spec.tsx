import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';

const svc = vi.hoisted(() => ({ criar: vi.fn(), salvar: vi.fn(), apagar: vi.fn(), trocarEndereco: vi.fn(), mandarTeste: vi.fn(), envios: vi.fn() }));
vi.mock('@/services/externalLeadPages/externalLeadPagesService', () => ({ externalLeadPagesService: svc }));
const props = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn() }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: props }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'u1', whatsapp_number: '+5511999990000' } }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import JanelaDaPagina from './JanelaDaPagina';

const recursos = {
  funis: [{ id: 'f1', name: 'Vendas' }],
  etapas: { f1: [{ id: 'e1', name: 'Novo' }] },
  equipe: [{ id: 'u1', name: 'Ana Lima', whatsapp: '+5511999990000' }],
  roletas: [{ id: 'r1', display_name: 'Roleta Centro', is_active: true, inbox_id: 'i', distribution_mode: 'rodizio', timeout_minutes: 5, gestor_whatsapp_number: '' }],
} as never;

const pagina = (extra: Partial<PaginaDeSite> = {}): PaginaDeSite => ({
  id: 'a', name: 'LP Centro', active: true, pipeline_id: 'f1', stage_id: 'e1', roleta_config_id: 'r1', default_assignee_id: null,
  property_id: null, labels: ['site'], endpoint_url: 'https://api.exemplo.com.br/hook/abc', last_received_at: null, leads_30d: 0,
  last_delivery: null, rejected_last_24h: 0, ...extra,
});

const fechar = vi.fn();
const mudou = vi.fn();
const montar = (p: PaginaDeSite | null) => render(<JanelaDaPagina pagina={p} recursos={recursos} aoFechar={fechar} aoMudou={mudou} />);

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  props.list.mockReset().mockResolvedValue({ data: [], meta: { total: 0 } });
  props.get.mockReset();
  svc.envios.mockResolvedValue([]);
  fechar.mockReset(); mudou.mockReset(); toast.error.mockReset(); toast.success.mockReset();
});

describe('JanelaDaPagina', () => {
  it('criar sem funil leva o foco ao Funil e não chama criar', async () => {
    montar(null);
    fireEvent.change(screen.getByLabelText(/Nome da página/), { target: { value: 'LP Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('destino_funil')));
    expect(svc.criar).not.toHaveBeenCalled();
  });

  it('salvar com roleta manda roleta_config_id e default_assignee_id null', async () => {
    svc.salvar.mockResolvedValue(pagina({ name: 'LP Centro 2' }));
    montar(pagina());
    fireEvent.change(screen.getByLabelText(/Nome da página/), { target: { value: 'LP Centro 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.salvar).toHaveBeenCalled());
    const [id, corpo] = svc.salvar.mock.calls[0];
    expect(id).toBe('a');
    expect(corpo).toMatchObject({ name: 'LP Centro 2', roleta_config_id: 'r1', default_assignee_id: null, pipeline_id: 'f1', stage_id: 'e1' });
    await waitFor(() => expect(mudou).toHaveBeenCalled());
  });

  it('trocar endereço só chama o servidor depois de confirmar', async () => {
    svc.trocarEndereco.mockResolvedValue({ endpoint_url: 'https://api.exemplo.com.br/hook/novo' });
    montar(pagina());
    fireEvent.click(screen.getByRole('button', { name: 'Trocar endereço' }));
    expect(svc.trocarEndereco).not.toHaveBeenCalled();
    expect(screen.getByText(/O endereço antigo para de funcionar agora\. Cole o novo na página\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar agora' }));
    await waitFor(() => expect(svc.trocarEndereco).toHaveBeenCalledWith('a'));
    expect(await screen.findByText('https://api.exemplo.com.br/hook/novo')).toBeInTheDocument();
  });

  it('mandar teste usa o WhatsApp preenchido e mostra o resumo no topo da lista', async () => {
    svc.mandarTeste.mockResolvedValue({ outcome: 'entered', summary: 'Entrou em Vendas › Novo, oferecido a Ana Lima' });
    montar(pagina());
    const campo = (await screen.findByLabelText('WhatsApp que vai receber o teste')) as HTMLInputElement;
    expect(campo.value).toBe('+5511999990000');
    fireEvent.click(screen.getByRole('button', { name: 'Mandar lead de teste' }));
    await waitFor(() => expect(svc.mandarTeste).toHaveBeenCalledWith('a', '+5511999990000'));
    expect(await screen.findByText('Entrou em Vendas › Novo, oferecido a Ana Lima')).toBeInTheDocument();
    await waitFor(() => expect(svc.envios).toHaveBeenCalledTimes(2));
  });

  it('envio recusado aparece com o motivo', async () => {
    svc.envios.mockResolvedValue([{ at: '2026-11-10T16:40:00Z', name: 'Maria', phone: '+5511988887777', outcome: 'failed', summary: 'WhatsApp incompleto' }]);
    montar(pagina());
    expect(await screen.findByText('WhatsApp incompleto')).toBeInTheDocument();
  });
});
