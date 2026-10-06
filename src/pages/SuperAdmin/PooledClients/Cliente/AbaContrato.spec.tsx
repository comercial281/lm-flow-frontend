// src/pages/SuperAdmin/PooledClients/Cliente/AbaContrato.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiX = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: apiX }));
const api = apiX;

const toastX = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastX }));

import AbaContrato from './AbaContrato';

const cliente = { id: 'c1', name: '016', slug: 'x', schema_name: 'tenant_x', status: 'active', members: 2, login_url: '',
  max_whatsapp_channels: 5, ai_leads_included: null, ai_lead_overage_price_brl: 2.49,
  settings: { whatsapp_reminder_group_jid: '123@g.us', whatsapp_logs_group_jid: '' } };

const clienteComPacote = { ...cliente, package: { id: 'p1', name: 'Completo' }, package_diff_count: 2,
  package_diff: { features: [{ key: 'bolsao', label: 'Bolsão', tenant: false, package: true }], limits: [{ key: 'max_whatsapp_channels', tenant: 3, package: 5 }] } };

describe('Aba Contrato (limites)', () => {
  beforeEach(() => { apiX.get.mockReset(); apiX.post.mockReset(); apiX.patch.mockReset(); });

  it('trocar pacote mostra o que muda e avisa os ajustes desfeitos', async () => {
    apiX.get.mockResolvedValue({ data: { data: [{ id: 'p2', name: 'Essencial', clients_count: 0, features_on: 3, limits: {} }] } });
    apiX.post.mockImplementation((_url: string, body: { dry_run?: boolean }) => Promise.resolve({ data: body.dry_run
      ? { data: { changes: { features: [{ key: 'disparos', label: 'Disparos', tenant: true, package: false }], limits: [{ key: 'max_whatsapp_channels', tenant: 5, package: 2 }] }, undone: 2 } }
      : { data: { ...clienteComPacote, package: { id: 'p2', name: 'Essencial' } }, undone: 2 } }));
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={aoMudar} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Trocar pacote' }));
    await user.selectOptions(await screen.findByLabelText('Novo pacote'), 'p2');
    expect(await screen.findByText('desliga Disparos')).toBeInTheDocument();
    expect(screen.getByText('números de WhatsApp 5 → 2')).toBeInTheDocument();
    expect(screen.getByText('Os 2 ajustes manuais deste cliente serão desfeitos.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Trocar' }));
    await waitFor(() => expect(apiX.post).toHaveBeenLastCalledWith('/super/pooled_tenants/c1/assign_package', { package_id: 'p2', dry_run: false }));
    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
  });

  it('Voltar ao pacote mostra a prévia e só aplica ao confirmar', async () => {
    apiX.post.mockImplementation((_url: string, body: { dry_run?: boolean }) => Promise.resolve({ data: body.dry_run
      ? { data: { changes: { features: [{ key: 'bolsao', label: 'Bolsão', tenant: false, package: true }], limits: [] }, undone: 1 } }
      : { data: { ...clienteComPacote, package_diff_count: 0 }, undone: 1 } }));
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={aoMudar} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Voltar ao pacote' }));
    expect(await screen.findByText('liga Bolsão')).toBeInTheDocument();
    expect(screen.getByText('O 1 ajuste manual deste cliente será desfeito.')).toBeInTheDocument();
    expect(apiX.post).toHaveBeenCalledTimes(1);
    await user.click(screen.getAllByRole('button', { name: 'Voltar ao pacote' }).at(-1)!);
    await waitFor(() => expect(apiX.post).toHaveBeenLastCalledWith('/super/pooled_tenants/c1/reset_to_package', { dry_run: false }));
    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
  });

  it('sem ajustes manuais, o aviso não aparece', async () => {
    apiX.post.mockResolvedValue({ data: { data: { changes: { features: [{ key: 'bolsao', label: 'Bolsão', tenant: false, package: true }], limits: [] }, undone: 0 } } });
    const user = userEvent.setup();
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Voltar ao pacote' }));
    expect(await screen.findByText('liga Bolsão')).toBeInTheDocument();
    expect(screen.queryByText(/ajuste/)).not.toBeInTheDocument();
  });

  it('prévia antiga que chega depois não vence a mais nova', async () => {
    apiX.get.mockResolvedValue({ data: { data: [{ id: 'p2', name: 'B', clients_count: 0, features_on: 1, limits: {} }, { id: 'p3', name: 'C', clients_count: 0, features_on: 1, limits: {} }] } });
    let soltaP2!: (v: unknown) => void;
    apiX.post.mockImplementation((_u: string, body: { package_id: string; dry_run: boolean }) => body.package_id === 'p2'
      ? new Promise((r) => { soltaP2 = r; })
      : Promise.resolve({ data: { data: { changes: { features: [{ key: 'x', label: 'Novo', tenant: false, package: true }], limits: [] }, undone: 0 } } }));
    const user = userEvent.setup();
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Trocar pacote' }));
    const lista = await screen.findByLabelText('Novo pacote');
    await user.selectOptions(lista, 'p2');
    await user.selectOptions(lista, 'p3');
    expect(await screen.findByText('liga Novo')).toBeInTheDocument();
    soltaP2({ data: { data: { changes: { features: [{ key: 'y', label: 'Velho', tenant: true, package: false }], limits: [] }, undone: 0 } } });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('desliga Velho')).not.toBeInTheDocument();
    expect(screen.getByText('liga Novo')).toBeInTheDocument();
  });

  it('lista de pacotes que falha mostra erro com Tentar de novo', async () => {
    apiX.get.mockRejectedValueOnce(new Error('x')).mockResolvedValue({ data: { data: [] } });
    const user = userEvent.setup();
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Trocar pacote' }));
    expect(await screen.findByText('Não deu pra carregar os pacotes.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    await waitFor(() => expect(screen.queryByText('Não deu pra carregar os pacotes.')).not.toBeInTheDocument());
  });

  it('prévia que falha mostra erro com Tentar de novo', async () => {
    apiX.post.mockRejectedValueOnce(new Error('x')).mockResolvedValue({ data: { data: { changes: { features: [], limits: [] }, undone: 0 } } });
    const user = userEvent.setup();
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Voltar ao pacote' }));
    expect(await screen.findByText('Não deu pra ver o que muda.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByText('Nenhuma função ou limite muda.')).toBeInTheDocument();
  });

  it('cliente Personalizado não tem Voltar ao pacote', () => {
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar ao pacote' })).not.toBeInTheDocument();
  });

  it('limite diferente do pacote aparece ≠ pacote', () => {
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getAllByText('≠ pacote').length).toBeGreaterThan(0);
  });


  it('salva os limites reenviando os grupos do estado', async () => {
    api.patch.mockResolvedValue({ data: { data: { ...cliente, max_whatsapp_channels: 2 } } });
    const aoMudar = vi.fn();
    render(<AbaContrato cliente={cliente as any} aoMudar={aoMudar} recarregar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limites' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/super/pooled_tenants/c1', expect.objectContaining({
      name: '016', max_whatsapp_channels: 2, ai_leads_included: null, ai_lead_overage_price_brl: 2.49,
      whatsapp_reminder_group_jid: '123@g.us', whatsapp_logs_group_jid: '',
    })));
    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
  });

  it('depois de salvar os limites recarrega a página (≠ pacote e contador acompanham)', async () => {
    api.patch.mockResolvedValue({ data: { data: { ...cliente, max_whatsapp_channels: 2 } } });
    const recarregar = vi.fn();
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={recarregar} />);
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limites' }));
    await waitFor(() => expect(recarregar).toHaveBeenCalledTimes(1));
  });

  it('salvar que falha não recarrega', async () => {
    api.patch.mockRejectedValue({ response: { data: { error: 'não' } } });
    const recarregar = vi.fn();
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={recarregar} />);
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limites' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(recarregar).not.toHaveBeenCalled();
  });

  it('campo de números vazio ou inválido desabilita Salvar e não chama o servidor', () => {
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    const salvar = screen.getByRole('button', { name: 'Salvar limites' });
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: '' } });
    expect(salvar).toBeDisabled();
    expect(screen.getByText(/número inteiro/)).toBeInTheDocument();
    fireEvent.click(salvar);
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: 'abc' } });
    expect(salvar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Números de WhatsApp'), { target: { value: '0' } });
    expect(salvar).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Preço do excedente (R$)'), { target: { value: '-1' } });
    expect(salvar).toBeDisabled();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('mostra os limites novos quando o cliente é atualizado por fora', () => {
    const { rerender } = render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    rerender(<AbaContrato cliente={{ ...cliente, max_whatsapp_channels: 9, ai_leads_included: 100 } as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getByLabelText('Números de WhatsApp')).toHaveValue('9');
    expect(screen.getByLabelText('Franquia de leads da IA')).toHaveValue('100');
  });
});

describe('Aba Contrato (receita)', () => {
  beforeEach(() => { apiX.get.mockReset(); apiX.post.mockReset(); apiX.patch.mockReset(); toastX.error.mockReset(); toastX.success.mockReset(); });

  const comPreco = { ...clienteComPacote, package: { id: 'p1', name: 'Completo', price_brl: 1500 } };

  it('cota do plano com o preço do pacote; salvar manda tipo e origem com os grupos, sem mexer no valor digitado', async () => {
    apiX.patch.mockResolvedValue({ data: { data: { ...comPreco, settings: { ...comPreco.settings, client_kind: 'performance', revenue_source: 'package' } } } });
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<AbaContrato cliente={comPreco as any} aoMudar={aoMudar} recarregar={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Tipo'), 'performance');
    expect(screen.getByRole('radio', { name: /Cota do plano: Completo — R\$\s1\.500,00\/mês/ })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Cota do plano: Completo/ }));
    await user.click(screen.getByRole('button', { name: 'Salvar receita' }));
    await waitFor(() => expect(apiX.patch).toHaveBeenCalledWith('/super/pooled_tenants/c1', expect.objectContaining({
      client_kind: 'performance', revenue_source: 'package', whatsapp_reminder_group_jid: '123@g.us' })));
    expect(apiX.patch.mock.calls[0][1]).not.toHaveProperty('revenue_brl');
    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
  });

  it('sem preço no pacote, a cota fica desabilitada com o motivo', () => {
    render(<AbaContrato cliente={clienteComPacote as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Cota do plano' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Cota do plano' })).toHaveAccessibleDescription('O pacote Completo não tem preço do plano.');
    expect(screen.getByText('O pacote Completo não tem preço do plano.')).toBeInTheDocument();
  });

  it('valor digitado: texto torto trava o salvar; 1.500,00 vai como número', async () => {
    apiX.patch.mockResolvedValue({ data: { data: cliente } });
    const user = userEvent.setup();
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getByText('O cliente não tem pacote.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Valor digitado' }));
    const campo = screen.getByLabelText('Valor por mês (R$)');
    await user.type(campo, 'abc');
    expect(screen.getByRole('button', { name: 'Salvar receita' })).toBeDisabled();
    await user.clear(campo);
    await user.type(campo, '1.500,00');
    await user.click(screen.getByRole('button', { name: 'Salvar receita' }));
    await waitFor(() => expect(apiX.patch).toHaveBeenCalledWith('/super/pooled_tenants/c1', expect.objectContaining({
      client_kind: null, revenue_source: 'manual', revenue_brl: 1500 })));
  });

  it('422 do servidor aparece como toast com a mensagem dele', async () => {
    apiX.patch.mockRejectedValue({ response: { data: { error: 'Receita: informe um valor (0 ou mais).' } } });
    const user = userEvent.setup();
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: 'Valor digitado' }));
    await user.type(screen.getByLabelText('Valor por mês (R$)'), '10');
    await user.click(screen.getByRole('button', { name: 'Salvar receita' }));
    await waitFor(() => expect(toastX.error).toHaveBeenCalledWith('Receita: informe um valor (0 ou mais).'));
  });

  it('zero digitado vai como 0 e vazio vai como null', async () => {
    apiX.patch.mockResolvedValue({ data: { data: cliente } });
    const user = userEvent.setup();
    render(<AbaContrato cliente={cliente as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: 'Valor digitado' }));
    await user.type(screen.getByLabelText('Valor por mês (R$)'), '0');
    await user.click(screen.getByRole('button', { name: 'Salvar receita' }));
    await waitFor(() => expect(apiX.patch.mock.calls[0][1]).toEqual(expect.objectContaining({ revenue_source: 'manual', revenue_brl: 0 })));
    await user.clear(screen.getByLabelText('Valor por mês (R$)'));
    await user.click(screen.getByRole('button', { name: 'Salvar receita' }));
    await waitFor(() => expect(apiX.patch.mock.calls[1][1]).toEqual(expect.objectContaining({ revenue_source: 'manual', revenue_brl: null })));
  });

  it('rerender com outro pacote/preço mantém o valor digitado e atualiza a cota', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AbaContrato cliente={comPreco as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: 'Valor digitado' }));
    await user.type(screen.getByLabelText('Valor por mês (R$)'), '900');
    const outro = { ...comPreco, package: { id: 'p2', name: 'Essencial', price_brl: 700 } };
    rerender(<AbaContrato cliente={outro as any} aoMudar={vi.fn()} recarregar={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /Cota do plano: Essencial — R\$\s700,00\/mês/ })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Valor digitado' }));
    expect(screen.getByLabelText('Valor por mês (R$)')).toHaveValue('900');
  });
});
