import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

// O Select do design system é Radix (2.2.6): jsdom não implementa estas três
// APIs de ponteiro, e sem elas abrir o menu/escolher item estoura.
beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// Canais → Colaboradores com a regra do dono (fase 2b.1). O campo que se
// chamava "Responsável da instância" é o DONO DO NÚMERO: com a regra ligada ele
// explica o que faz, e o dono não sai de Colaboradores — o servidor não o deixa
// sair, e uma caixinha que desmarca e volta marcada sozinha é a cicatriz de
// sempre desta tela.
//
// L4: mock ESTÁVEL de useLanguage — o `t` recriado a cada render faz o
// `loadData` do componente (que depende de `t`) recarregar em laço.
const t = vi.hoisted(() => (key: string) => key);
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t }),
}));
const getAll = vi.hoisted(() => vi.fn());
const getMembers = vi.hoisted(() => vi.fn());
const updateMembers = vi.hoisted(() => vi.fn());
vi.mock('@/services/channels/agentsService', () => ({ default: { getAll } }));
vi.mock('@/services/channels/inboxMembersService', () => ({ default: { get: getMembers, update: updateMembers } }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useClientToggle: () => false }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CollaboratorsForm from './CollaboratorsForm';

const agente = (id: string, name: string) => ({
  id, name, email: `${id}@imob.test`, availability_status: 'online', role: 'agent',
});

beforeEach(() => {
  getAll.mockReset().mockResolvedValue([agente('u-ana', 'Ana'), agente('u-joao', 'João')]);
  getMembers.mockReset().mockResolvedValue([agente('u-joao', 'João')]);
  updateMembers.mockReset().mockResolvedValue({});
});

describe('CollaboratorsForm — Dono do número', () => {
  it('com a regra: explica o dono e mostra o selo no dono', async () => {
    render(<CollaboratorsForm inboxId="inbox-1" ownerUserId="u-ana" numberOwnerRule onOwnerChange={vi.fn()} />);

    // L5: acha a pessoa pela linha da lista (o <h5> de CollaboratorsForm) — o
    // SelectValue do dono também mostra "Ana" e duplicaria o texto solto.
    expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByText(
      'Quem escreve neste número vai direto pro dono. Sem dono, o número é da imobiliária e quem escreve entra na roleta.',
    )).toBeInTheDocument();
    expect(screen.getByText('Dono do número')).toBeInTheDocument();
  });

  it('com a regra: clicar no dono não o tira, e o salvar manda o dono junto', async () => {
    render(<CollaboratorsForm inboxId="inbox-1" ownerUserId="u-ana" numberOwnerRule onOwnerChange={vi.fn()} />);

    await userEvent.click(await screen.findByRole('heading', { name: 'Ana' }));
    await userEvent.click(screen.getByRole('button', { name: 'settings.collaborators.agents.buttons.update' }));

    expect(updateMembers).toHaveBeenCalledWith('inbox-1', expect.arrayContaining(['u-ana', 'u-joao']));
  });

  it('sem a regra: o texto de sempre (o nome novo vem do pt-BR), sem selo, e o dono sai se desmarcado', async () => {
    getMembers.mockResolvedValue([agente('u-ana', 'Ana'), agente('u-joao', 'João')]);
    render(<CollaboratorsForm inboxId="inbox-1" ownerUserId="u-ana" numberOwnerRule={false} onOwnerChange={vi.fn()} />);

    expect(await screen.findByText('settings.collaborators.owner.description')).toBeInTheDocument();
    expect(screen.queryByText('Dono do número')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('heading', { name: 'Ana' }));
    await userEvent.click(screen.getByRole('button', { name: 'settings.collaborators.agents.buttons.update' }));

    expect(updateMembers).toHaveBeenCalledWith('inbox-1', ['u-joao']);
  });

  it('fala número, nunca instância, nos textos que ela escreve', async () => {
    // L15: com `t` devolvendo a chave, este caso confere só o texto LITERAL
    // (numberTexts.ts), não os valores pt-BR trocados na mesma task.
    const { container } = render(
      <CollaboratorsForm inboxId="inbox-1" ownerUserId={null} numberOwnerRule onOwnerChange={vi.fn()} />,
    );

    await screen.findByRole('heading', { name: 'Ana' });
    expect(container.textContent).not.toMatch(/instância|inbox|caixa de entrada/i);
  });

  // Revisão da B4, item 1: trava só o dono EFETIVO — o mesmo que o servidor
  // protege. Dono gravado com `shared: true` (conta da Leal Mídia) não é
  // efetivo (E1): pode ser desmarcado como qualquer colaborador, e não ganha
  // o selo "Dono do número".
  it('com a regra e cartão: dono gravado com shared true (conta da Leal Mídia) não fica travado nem com selo', async () => {
    getMembers.mockResolvedValue([agente('u-ana', 'Ana'), agente('u-joao', 'João')]);
    render(
      <CollaboratorsForm
        inboxId="inbox-1"
        ownerUserId="u-ana"
        numberOwnerRule
        numberCard={{ owner: { id: 'u-ana', name: 'Ana', active: true }, shared: true }}
        onOwnerChange={vi.fn()}
      />,
    );

    await screen.findByRole('heading', { name: 'Ana' });
    expect(screen.queryByText('Dono do número')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('heading', { name: 'Ana' }));
    await userEvent.click(screen.getByRole('button', { name: 'settings.collaborators.agents.buttons.update' }));

    expect(updateMembers).toHaveBeenCalledWith('inbox-1', ['u-joao']);
  });

  // Revisão da B4, item 4: a recusa do servidor ao escolher dono (ex.: número
  // que a roleta divide com 2+ corretores) mostra o motivo DELE, não a frase
  // genérica.
  it('com a regra: salvar dono com 422 mostra a mensagem do servidor', async () => {
    const mensagemDoServidor =
      'Este número está na roleta "Vendas" com 2 corretores. Tire-os da roleta antes de pôr um dono.';
    const onOwnerChange = vi.fn().mockRejectedValue({
      response: { data: { error: { message: mensagemDoServidor } } },
    });
    render(<CollaboratorsForm inboxId="inbox-1" ownerUserId={null} numberOwnerRule onOwnerChange={onOwnerChange} />);

    await screen.findByRole('heading', { name: 'Ana' });
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Ana' }));

    await waitFor(() => expect(onOwnerChange).toHaveBeenCalledWith('u-ana'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(mensagemDoServidor));
  });
});
