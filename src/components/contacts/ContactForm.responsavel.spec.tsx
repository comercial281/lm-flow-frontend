import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ContactForm from './ContactForm';
import type { Contact } from '@/types/contacts';

// O contato que vem do painel da conversa não traz o dono. Mandar
// default_assignee_id: null apagava o responsável do lead no servidor: o
// formulário só manda o responsável quando ele mudou.

const corretorLogado = vi.hoisted(() => ({ atual: null as { id: string; name: string } | null }));

vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/useAccountUsers', () => ({
  useAccountUsers: () => ({ users: [{ id: '7', name: 'Bruna Corretora' }, { id: '8', name: 'Caio Corretor' }] }),
}));
vi.mock('@/features/contatos/useCorretorLogado', () => ({ useCorretorLogado: () => corretorLogado.atual }));
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: vi.fn().mockResolvedValue([]) },
  roletaLabel: (r: { display_name?: string }) => r.display_name ?? 'Roleta',
}));
vi.mock('@/services/contacts', () => ({ labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('./CustomAttributes', () => ({ default: () => null }));
vi.mock('./ContactLabels', () => ({ default: () => null }));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  corretorLogado.atual = null;
});

const contato = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    name: 'Ana',
    type: 'person',
    phone_number: '+5511999990000',
    additional_attributes: {},
    custom_attributes: {},
    labels: [],
    ...extra,
  }) as unknown as Contact;

const salvar = (c: Contact) => {
  const onSubmit = vi.fn();
  render(<ContactForm contact={c} isNew={false} onSubmit={onSubmit} onCancel={vi.fn()} />);
  return onSubmit;
};

describe('Formulário de contato · o responsável só vai quando mudou', () => {
  it('editar sem mexer no responsável não manda default_assignee_id (contato sem o campo)', () => {
    const onSubmit = salvar(contato());
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('default_assignee_id');
  });

  it('gestor que salva sem mexer, com dono gravado, também não manda', () => {
    const onSubmit = salvar(contato({ default_assignee_id: 7 }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('default_assignee_id');
  });

  it('corretor editando nunca manda default_assignee_id', () => {
    corretorLogado.atual = { id: '7', name: 'Bruna Corretora' };
    const onSubmit = salvar(contato({ default_assignee_id: 7 }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('default_assignee_id');
  });

  it('gestor que troca o responsável manda o novo', () => {
    const onSubmit = salvar(contato({ default_assignee_id: 7 }));
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'corretor:8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ default_assignee_id: '8' }));
  });

  it('gestor que escolhe dono num contato sem dono manda o escolhido', () => {
    const onSubmit = salvar(contato());
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'corretor:8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ default_assignee_id: '8' }));
  });
});
