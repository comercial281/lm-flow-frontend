import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContactForm from './ContactForm';
import type { Contact } from '@/types/contacts';

// Nome, telefone e e-mail não mudam depois do cadastro (decisão do dono,
// 02/10/2026). Telefone/e-mail só o gestor corrige, em lead cadastrado à mão:
// quem diz é o servidor, pelo `identity_correctable` do contato.

vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/useAccountUsers', () => ({ useAccountUsers: () => ({ users: [] }) }));
vi.mock('@/services/contacts', () => ({ labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('./CompanyMultiSelect', () => ({ default: () => null }));
vi.mock('./CustomAttributes', () => ({ default: () => null }));
vi.mock('./ContactLabels', () => ({ default: () => null }));

beforeAll(() => {
  // O seletor do formulário mede o tamanho; o jsdom não tem ResizeObserver.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const contato = (extra: Partial<Contact> = {}) =>
  ({
    id: 'c1',
    name: 'Ana Teste',
    type: 'person',
    email: 'ana@teste.com',
    phone_number: '+5511900000001',
    additional_attributes: {},
    custom_attributes: {},
    labels: [],
    ...extra,
  }) as unknown as Contact;

const abrir = (c: Contact | null, isNew = false) =>
  render(<ContactForm contact={c} isNew={isNew} onSubmit={vi.fn()} onCancel={vi.fn()} />);

describe('Formulário de contato · nome, telefone e e-mail travados', () => {
  it('editando: nome e e-mail travados quando o servidor não libera', () => {
    abrir(contato());

    expect(screen.getByDisplayValue('Ana')).toBeDisabled();
    expect(screen.getByDisplayValue('ana@teste.com')).toBeDisabled();
    expect(screen.getByText('Nome, telefone e e-mail não mudam depois do cadastro.')).toBeInTheDocument();
  });

  it('editando: gestor em lead manual corrige o e-mail, mas o nome continua travado', () => {
    abrir(contato({ identity_correctable: true }));

    expect(screen.getByDisplayValue('Ana')).toBeDisabled();
    expect(screen.getByDisplayValue('ana@teste.com')).not.toBeDisabled();
  });

  it('cadastro novo: tudo aberto', () => {
    abrir(null, true);

    expect(screen.getByPlaceholderText('form.fields.email.placeholder')).not.toBeDisabled();
    expect(screen.queryByText(/não mudam depois do cadastro/)).not.toBeInTheDocument();
  });
});
