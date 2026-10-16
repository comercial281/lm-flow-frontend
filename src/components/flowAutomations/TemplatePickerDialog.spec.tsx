import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const templates = vi.hoisted(() => vi.fn());
const applyTemplate = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { templates, applyTemplate },
}));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError } }));

import { TemplatePickerDialog } from './TemplatePickerDialog';

const MODELOS = [
  {
    key: 'nova_tentativa', name: 'Primeiro contato com nova tentativa', description: 'Manda e tenta de novo.',
    category: 'primeiro_contato', category_label: 'Primeiro contato', icon: 'repeat', when: 'Lead de formulário chega',
    preview: [
      { kind: 'send_whatsapp', send_from: 'owner', text: 'Oi {{nome}}!' },
      { kind: 'wait_for_reply', minutes: 30 },
      { kind: 'send_whatsapp', send_from: 'owner', text: 'Conseguiu ver?', branch: 'no_reply' },
    ],
    adjust: [{ title: 'Revise a primeira mensagem', pending: false }],
  },
  {
    key: 'roleta', name: 'Distribuir lead de campanha na roleta', description: 'Fila da roleta.',
    category: 'distribuicao', category_label: 'Distribuição', icon: 'shuffle', when: 'Lead chama no WhatsApp pelo anúncio',
    preview: [{ kind: 'lead_action', action_type: 'assign_via_roleta', label: 'Oferece pela roleta' }],
    adjust: [{ title: 'Escolha a roleta', hint: 'O lead entra na fila.', pending: true }],
  },
];

const renderDialog = (props: Partial<Parameters<typeof TemplatePickerDialog>[0]> = {}) => {
  const onApplied = vi.fn();
  render(
    <TemplatePickerDialog open onClose={vi.fn()} title="Modelos de automação" description="Escolha." onApplied={onApplied} {...props} />,
  );
  return { onApplied };
};

beforeEach(() => {
  templates.mockReset();
  applyTemplate.mockReset();
  toastError.mockReset();
});

describe('TemplatePickerDialog', () => {
  it('agrupa a lista e mostra o primeiro modelo inteiro: quando começa, passos e o que ajustar', async () => {
    templates.mockResolvedValue(MODELOS);
    renderDialog();
    const lista = await screen.findByRole('listbox', { name: 'Modelos' });
    expect(within(lista).getByRole('group', { name: 'Primeiro contato' })).toBeTruthy();
    expect(within(lista).getByRole('group', { name: 'Distribuição' })).toBeTruthy();
    expect(within(lista).getByRole('option', { name: /Primeiro contato com nova tentativa/ }).getAttribute('aria-selected')).toBe('true');

    const sequencia = screen.getByRole('list', { name: /Sequência do modelo Primeiro contato com nova tentativa/ });
    expect(sequencia.textContent).toContain('Quando: Lead de formulário chega');
    expect(sequencia.textContent).toContain('Pelo número do responsável');
    expect(sequencia.textContent).toContain('Aguarda a resposta por 30 minutos');
    expect(sequencia.textContent).toContain('Se não responder');
    expect(screen.getByText('Revise a primeira mensagem')).toBeTruthy();
  });

  it('escolher outro modelo troca a prévia e marca o que é obrigatório', async () => {
    templates.mockResolvedValue(MODELOS);
    renderDialog();
    fireEvent.click(await screen.findByRole('option', { name: /Distribuir lead/ }));
    expect(screen.getByRole('list', { name: /Sequência do modelo Distribuir/ }).textContent).toContain('Oferece pela roleta');
    expect(screen.getByText('Escolha a roleta')).toBeTruthy();
    expect(screen.getByText('Obrigatório')).toBeTruthy();
  });

  it('a busca filtra e, sem resultado, oferece limpar', async () => {
    templates.mockResolvedValue(MODELOS);
    renderDialog();
    const busca = await screen.findByRole('textbox', { name: 'Buscar modelo' });
    fireEvent.change(busca, { target: { value: 'roleta' } });
    expect(screen.queryByRole('option', { name: /nova tentativa/ })).toBeNull();
    expect(screen.getByRole('option', { name: /Distribuir lead/ })).toBeTruthy();
    fireEvent.change(busca, { target: { value: 'xyz' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]);
    expect(screen.getByRole('option', { name: /nova tentativa/ })).toBeTruthy();
  });

  it('abre com o modelo pedido escolhido', async () => {
    templates.mockResolvedValue(MODELOS);
    renderDialog({ initialKey: 'roleta' });
    expect((await screen.findByRole('option', { name: /Distribuir lead/ })).getAttribute('aria-selected')).toBe('true');
  });

  it('"Usar este modelo" cria o escolhido e devolve o fluxo', async () => {
    templates.mockResolvedValue(MODELOS);
    applyTemplate.mockResolvedValue({ id: 'f1' });
    const { onApplied } = renderDialog({ kind: 'automation' });
    fireEvent.click(await screen.findByRole('option', { name: /Distribuir lead/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar este modelo' }));
    await waitFor(() => expect(applyTemplate).toHaveBeenCalledWith('roleta'));
    expect(onApplied).toHaveBeenCalledWith({ id: 'f1' });
    expect(templates).toHaveBeenCalledWith('automation');
  });

  it('gestor na aba Da equipe: aplica com { team: true }; em Minhas, { team: false }', async () => {
    templates.mockResolvedValue(MODELOS);
    applyTemplate.mockResolvedValue({ id: 'f1' });
    for (const team of [true, false]) {
      applyTemplate.mockClear();
      const { unmount } = render(<TemplatePickerDialog open onClose={vi.fn()} title="Modelos de automação" description="Escolha." onApplied={vi.fn()} team={team} />);
      const botoes = await screen.findAllByRole('button', { name: 'Usar este modelo' });
      fireEvent.click(botoes[botoes.length - 1]);
      await waitFor(() => expect(applyTemplate).toHaveBeenCalledWith('nova_tentativa', { team }));
      unmount();
    }
  });

  it('falha ao criar mostra o motivo e não fecha', async () => {
    templates.mockResolvedValue(MODELOS);
    applyTemplate.mockRejectedValue(new Error('x'));
    const { onApplied } = renderDialog({ applyError: 'Não deu pra criar.' });
    fireEvent.click(await screen.findByRole('button', { name: 'Usar este modelo' }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('erro ao carregar é erro, com tentar de novo (nunca lista vazia)', async () => {
    templates.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(MODELOS);
    renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('listbox', { name: 'Modelos' })).toBeTruthy();
  });
});
