import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';

const svc = vi.hoisted(() => ({ criar: vi.fn(), salvar: vi.fn(), apagar: vi.fn(), trocarEndereco: vi.fn(), mandarTeste: vi.fn(), envios: vi.fn() }));
vi.mock('@/services/externalLeadPages/externalLeadPagesService', () => ({ externalLeadPagesService: svc }));
const props = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn() }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: props }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 1, whatsapp_number: '+5511999990000' } }) }));
const perm = vi.hoisted(() => ({ editar: true }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => perm.editar }));
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
  perm.editar = true;
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
    svc.envios.mockResolvedValue([{ at: '2026-11-10T16:40:00Z', name: 'Maria', phone: '+5511988887777', outcome: 'rejected', summary: 'WhatsApp incompleto' }]);
    montar(pagina());
    expect(await screen.findByText('WhatsApp incompleto')).toBeInTheDocument();
    expect(screen.getByText('Recusado')).toBeInTheDocument();
  });

  it('envio com erro aparece como "Erro" e o desfecho que não veio como "Processando"', async () => {
    svc.envios.mockResolvedValue([
      { at: '2026-11-10T16:40:00Z', name: 'Maria', phone: '+5511988887777', outcome: 'failed', summary: 'Erro ao processar o envio' },
      { at: '2026-11-10T16:41:00Z', name: 'Joao', phone: '+5511977776666', outcome: null, summary: '' },
    ]);
    montar(pagina());
    expect(await screen.findByText('Erro ao processar o envio')).toBeInTheDocument();
    expect(screen.getByText('Erro')).toBeInTheDocument();
    expect(screen.getByText('Processando')).toBeInTheDocument();
  });

  it('422 com details.field stage_id leva o foco à etapa e traz o aviso pra vista', async () => {
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    svc.salvar.mockRejectedValue({ response: { data: { error: { code: 'VALIDATION_ERROR', message: 'Etapa não pertence ao funil', details: { field: 'stage_id' } } } } });
    montar(pagina());
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Etapa não pertence ao funil')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('destino_etapa')));
    expect(rolar).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('lead de teste: avisa que usa o salvo e trava enquanto o formulário tem mudança não salva', async () => {
    montar(pagina());
    expect(await screen.findByText('Usa o que está salvo nesta página.')).toBeInTheDocument();
    const botao = screen.getByRole('button', { name: 'Mandar lead de teste' });
    expect(botao).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/Nome da página/), { target: { value: 'LP Outra' } });
    expect(botao).toBeDisabled();
    expect(screen.getByText('Salve antes de testar.')).toBeInTheDocument();
  });

  it('página nova: a segunda etiqueta nasce com o nome curto, em minúsculas, e dá pra tirar', async () => {
    svc.criar.mockResolvedValue(pagina({ id: 'n', name: 'LP Nova' }));
    montar(null);
    fireEvent.change(screen.getByLabelText(/Nome da página/), { target: { value: '  LP Nova Do Centro  ' } });
    expect(screen.getByText('lp nova do centro')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Funil/), { target: { value: 'f1' } });
    fireEvent.change(screen.getByLabelText(/^Etapa/), { target: { value: 'e1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(svc.criar).toHaveBeenCalled());
    expect(svc.criar.mock.calls[0][0].labels).toEqual(['site', 'lp nova do centro']);
  });

  it('o texto de Quem assume muda com a escolha', async () => {
    montar(pagina());
    expect(screen.getByText(/O lead é oferecido a um corretor da fila assim que chega/)).toBeInTheDocument();
  });

  it('sem permissão de editar: sem Salvar, sem Trocar endereço, sem Mandar teste, sem Excluir', async () => {
    perm.editar = false;
    montar(pagina());
    expect(await screen.findByText(/Você pode ver esta página, mas não mudar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trocar endereço' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mandar lead de teste' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir página' })).toBeNull();
    expect(screen.getByLabelText(/Nome da página/)).toBeDisabled();
  });
});
