import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({ getOriginOptions: vi.fn(), addOrigin: vi.fn(), removeOrigin: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/services/roletaConfig/roletaConfigService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { ...real.roletaConfigService, ...svc } };
});
import OrigensBloco from './OrigensBloco';
import type { RoletaOrigin } from '@/services/roletaConfig/roletaConfigService';

const origens: RoletaOrigin[] = [
  { kind: 'meta_form', ref_id: 'f1', label: '21/08 - ALMA' },
  { kind: 'meta_form_keyword', ref_id: 'k1', label: 'ZONA', matches: [{ form_id: 'a', form_name: 'ZONA SUL' }, { form_id: 'b', form_name: 'ZONA OESTE' }] },
  { kind: 'sales_agent', ref_id: 's1', label: 'Sofia' },
];
const opcoes = [
  { kind: 'meta_form', ref_id: 'f1', label: '21/08 - ALMA', roleta_config_id: 'r1', roleta_name: 'Team Pinot' },
  { kind: 'meta_form', ref_id: 'f2', label: 'Alma Garden', roleta_config_id: null, roleta_name: null },
  { kind: 'meta_form', ref_id: 'f3', label: 'Casa Verde', roleta_config_id: null, roleta_name: null },
  { kind: 'landing', ref_id: 'l1', label: 'Lançamento Alma', roleta_config_id: 'r2', roleta_name: 'Zona Norte' },
  { kind: 'portal_sale', ref_id: 'p1', label: 'ZAP', roleta_config_id: null, roleta_name: null },
];

const recarregar = vi.fn();
const abrir = (lista = origens) => render(<OrigensBloco roletaId="r1" origens={lista} recarregar={recarregar} />);

// O balão do botão de ícone (Radix) mede o tamanho com o ResizeObserver, que o jsdom não tem.
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.clearAllMocks();
  recarregar.mockResolvedValue(undefined);
  svc.getOriginOptions.mockResolvedValue(opcoes);
  svc.addOrigin.mockResolvedValue({});
  svc.removeOrigin.mockResolvedValue(undefined);
});

describe('De onde vem o lead', () => {
  it('uma origem por linha, com o tipo em frase', () => {
    abrir();
    expect(screen.getByText('Formulário do Meta · "21/08 - ALMA"')).toBeInTheDocument();
    expect(screen.getByText('Formulário do Meta · nome contém "ZONA"')).toBeInTheDocument();
    expect(screen.getByText('IA Vendedora · Sofia')).toBeInTheDocument();
  });

  it('"nome contém" mostra quantos formulários pega e abre a lista', async () => {
    abrir();
    const botao = screen.getByRole('button', { name: /pega 2 formulários hoje/ });
    expect(screen.queryByText('ZONA OESTE')).toBeNull();
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('ZONA OESTE')).toBeInTheDocument();
  });

  it('tirar a origem vale na hora e recarrega a lista', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a origem IA Vendedora · Sofia' }));
    await waitFor(() => expect(svc.removeOrigin).toHaveBeenCalledWith('r1', { kind: 'sales_agent', ref_id: 's1' }));
    expect(recarregar).toHaveBeenCalled();
  });

  it('sem origem, diz que a roleta não recebe lead', () => {
    abrir([]);
    expect(screen.getByText('Nenhuma origem ainda. Sem origem, a roleta não recebe lead.')).toBeInTheDocument();
  });

  it('adicionar: escolhe o tipo e depois o item', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar origem' }));
    await userEvent.click(await screen.findByRole('button', { name: /Formulário do Meta/ }));
    // o que já está nesta roleta aparece travado
    expect(screen.getByRole('button', { name: /21\/08 - ALMA/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Alma Garden/ }));
    await waitFor(() => expect(svc.addOrigin).toHaveBeenCalledWith('r1', { kind: 'meta_form', ref_id: 'f2' }));
    expect(recarregar).toHaveBeenCalled();
  });

  it('item de outra roleta pergunta "Trazer pra esta roleta?" antes', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar origem' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Landing/ }));
    await userEvent.click(screen.getByRole('button', { name: /Lançamento Alma/ }));
    expect(screen.getByText('Trazer pra esta roleta?')).toBeInTheDocument();
    expect(svc.addOrigin).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Trazer' }));
    await waitFor(() => expect(svc.addOrigin).toHaveBeenCalledWith('r1', { kind: 'landing', ref_id: 'l1' }));
  });

  it('"nome contém" mostra na hora o que a palavra pega', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar origem' }));
    await userEvent.click(await screen.findByRole('button', { name: /Formulário do Meta/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Pelo nome do formulário' }));
    await userEvent.type(screen.getByLabelText('O nome do formulário contém'), 'alma');
    expect(screen.getByText('Pega 2 formulários hoje:')).toBeInTheDocument();
    expect(screen.getByText('Alma Garden')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(svc.addOrigin).toHaveBeenCalledWith('r1', { kind: 'meta_form_keyword', keyword: 'alma' }));
  });

  it('barreira D9: o conflito do servidor aparece na janela e ela não fecha', async () => {
    svc.addOrigin.mockRejectedValue({
      response: { status: 422, data: { error: 'Conflito', conflict: { form_name: 'Alma Garden', roleta_name: 'Zona Norte' } } },
    });
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar origem' }));
    await userEvent.click(await screen.findByRole('button', { name: /Formulário do Meta/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Pelo nome do formulário' }));
    await userEvent.type(screen.getByLabelText('O nome do formulário contém'), 'alma{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('O formulário "Alma Garden" já é pego por outra regra "nome contém", na roleta Zona Norte.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(recarregar).not.toHaveBeenCalled();
  });

  it('portal mostra venda e locação no item', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar origem' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Portal/ }));
    expect(screen.getByText('ZAP (venda)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('button', { name: /^Site/ })).toBeInTheDocument();
  });
});
