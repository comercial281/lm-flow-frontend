import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { GruposLiberadosBloco } from './GruposLiberadosBloco';

const svc = vi.hoisted(() => ({ dadosDeProvisionamento: vi.fn() }));
vi.mock('@/services/superAdmin/clientesService', () => ({ clientesService: svc }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const central = [
  { jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia' },
  { jid: '333@g.us', name: 'LM FLOW LOGS' },
];
const base = { id: 't1', name: 'APTO PREMIUM' } as never;
const legado = { reminder: '', logs: '' };

describe('bloco Grupos WhatsApp (lista liberada)', () => {
  beforeEach(() => { svc.dadosDeProvisionamento.mockReset().mockResolvedValue({ whatsapp_groups: central, templates: [] }); });

  it('cliente não mapeado mostra o aviso e pré-preenche a sugestão ao montar a lista', async () => {
    const patch = vi.fn().mockResolvedValue({});
    render(<GruposLiberadosBloco cliente={{ ...base, settings: {} }} groupJids={legado} patch={patch} />);

    expect(screen.getByText(/Ainda não mapeado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Montar lista' }));
    await waitFor(() => expect(screen.getByText('APTO PREMIUM x Leal Mídia')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith({
      allowed_whatsapp_groups: [{ jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia', kind: 'cliente' }],
      whatsapp_reminder_group_jid: '', whatsapp_logs_group_jid: '',
    }));
  });

  it('adiciona um grupo interno e remove outro', async () => {
    const patch = vi.fn().mockResolvedValue({});
    const settings = { allowed_whatsapp_groups: [{ jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia', kind: 'cliente' }] };
    render(<GruposLiberadosBloco cliente={{ ...base, settings }} groupJids={legado} patch={patch} />);

    expect(screen.getByText('Com o cliente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    fireEvent.click(await screen.findByRole('option', { name: 'LM FLOW LOGS' }));
    expect(screen.getByRole('option', { name: 'LM FLOW LOGS' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'logs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover APTO PREMIUM x Leal Mídia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.objectContaining({
      allowed_whatsapp_groups: [{ jid: '333@g.us', name: 'LM FLOW LOGS', kind: 'logs' }],
    })));
  });

  it('a busca filtra pelo nome ou número; Enter escolhe o primeiro e Incluir põe na lista', async () => {
    svc.dadosDeProvisionamento.mockResolvedValue({ whatsapp_groups: [
      ...central,
      { jid: '444@g.us', name: 'PANDORA | LEAL MÍDIA [#185]' },
      { jid: '555@g.us', name: 'ALEX I. [13/10 às 11h] | LEAL MÍDIA' },
    ], templates: [] });
    const settings = { allowed_whatsapp_groups: [] };
    render(<GruposLiberadosBloco cliente={{ ...base, settings }} groupJids={legado} patch={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    const busca = await screen.findByRole('textbox', { name: 'Buscar grupo' });
    const grupos = () => within(screen.getByRole('listbox', { name: 'Grupo' })).queryAllByRole('option').map(o => o.textContent);
    expect(grupos()).toEqual([
      'APTO PREMIUM x Leal Mídia', 'PANDORA | LEAL MÍDIA [#185]', 'LM FLOW LOGS', 'ALEX I. [13/10 às 11h] | LEAL MÍDIA',
    ]);

    fireEvent.change(busca, { target: { value: '185' } });
    expect(grupos()).toEqual(['PANDORA | LEAL MÍDIA [#185]']);
    expect(screen.getByRole('button', { name: 'Incluir' })).toBeDisabled();
    fireEvent.keyDown(busca, { key: 'Enter' });
    expect(screen.getByRole('option', { name: 'PANDORA | LEAL MÍDIA [#185]' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    expect(screen.getByText('PANDORA | LEAL MÍDIA [#185]')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Buscar grupo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Buscar grupo' }), { target: { value: 'nada disso' } });
    expect(grupos()).toEqual([]);
    expect(screen.getByText('Nenhum grupo com esse nome.')).toBeInTheDocument();
  });

  it('Adicionar grupo busca a lista de novo a cada clique (grupo novo aparece sem recarregar a página)', async () => {
    const settings = { allowed_whatsapp_groups: [] };
    render(<GruposLiberadosBloco cliente={{ ...base, settings }} groupJids={legado} patch={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    await screen.findByRole('option', { name: 'LM FLOW LOGS' });
    expect(screen.queryByRole('option', { name: 'NOVO CLIENTE - LEAL MÍDIA [#186]' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    svc.dadosDeProvisionamento.mockResolvedValue({ whatsapp_groups: [
      ...central, { jid: '666@g.us', name: 'NOVO CLIENTE - LEAL MÍDIA [#186]' },
    ], templates: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    expect(await screen.findByRole('option', { name: 'NOVO CLIENTE - LEAL MÍDIA [#186]' })).toBeInTheDocument();
    expect(svc.dadosDeProvisionamento).toHaveBeenCalledTimes(2);
  });

  it('lista vazia pede confirmação: cancelar não grava, confirmar grava []', async () => {
    const patch = vi.fn().mockResolvedValue({});
    const settings = { allowed_whatsapp_groups: [{ jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia', kind: 'cliente' }] };
    render(<GruposLiberadosBloco cliente={{ ...base, settings }} groupJids={legado} patch={patch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remover APTO PREMIUM x Leal Mídia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
    expect(await screen.findByText('Salvar sem nenhum grupo?')).toBeInTheDocument();
    expect(screen.getByText('Este cliente deixa de ver qualquer grupo da central.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Salvar sem nenhum grupo?')).toBeNull());
    expect(patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar sem grupo' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.objectContaining({ allowed_whatsapp_groups: [] })));
  });

  it('falha ao listar a central: mantém não mapeado, mostra o erro e não oferece salvar', async () => {
    svc.dadosDeProvisionamento.mockRejectedValue(new Error('x'));
    const patch = vi.fn();
    render(<GruposLiberadosBloco cliente={{ ...base, settings: {} }} groupJids={legado} patch={patch} />);
    fireEvent.click(screen.getByRole('button', { name: 'Montar lista' }));
    await waitFor(() => expect(screen.getByText('Não consegui listar os grupos do número operacional agora.')).toBeInTheDocument());
    expect(screen.getByText(/Ainda não mapeado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar lista' })).toBeNull();
  });

  it('central sem grupo nenhum: mantém não mapeado e avisa', async () => {
    svc.dadosDeProvisionamento.mockResolvedValue({ whatsapp_groups: [], templates: [] });
    render(<GruposLiberadosBloco cliente={{ ...base, settings: {} }} groupJids={legado} patch={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Montar lista' }));
    await waitFor(() => expect(screen.getByText('O número operacional não devolveu grupo nenhum.')).toBeInTheDocument());
    expect(screen.getByText(/Ainda não mapeado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar lista' })).toBeNull();
  });
});
