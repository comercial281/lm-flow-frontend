import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ContactForm from './ContactForm';
import type { Contact } from '@/types/contacts';

// Nome só o responsável pelo lead ou o gestor muda (revisto em 11/10/2026);
// telefone/e-mail só o gestor corrige, em lead cadastrado à mão. Quem diz é o
// servidor, pelo `name_editable` e o `identity_correctable` do contato.
// E o cadastro enxuto da fase 4: responsável do corretor travado nele; gestor
// escolhe corretor ou roleta, obrigatório.

const corretorLogado = vi.hoisted(() => ({ atual: null as { id: string; name: string } | null }));

vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/useAccountUsers', () => ({
  useAccountUsers: () => ({ users: [{ id: 'u1', name: 'Bruna Corretora' }, { id: 'u2', name: 'Caio', deactivated: true }] }),
}));
vi.mock('@/features/contatos/useCorretorLogado', () => ({ useCorretorLogado: () => corretorLogado.atual }));
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: vi.fn().mockResolvedValue([{ id: 'r1', display_name: 'Roleta Centro', is_active: true }]) },
  roletaLabel: (r: { display_name?: string }) => r.display_name ?? 'Roleta',
}));
vi.mock('@/services/contacts', () => ({ labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [] }) } }));
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

beforeEach(() => {
  corretorLogado.atual = null;
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

const abrir = (c: Contact | null, isNew = false, onSubmit = vi.fn()) => {
  render(<ContactForm contact={c} isNew={isNew} onSubmit={onSubmit} onCancel={vi.fn()} />);
  return onSubmit;
};

describe('Formulário de contato · nome, telefone e e-mail travados', () => {
  it('editando: nome e e-mail travados quando o servidor não libera', () => {
    abrir(contato());

    expect(screen.getByDisplayValue('Ana Teste')).toBeDisabled();
    expect(screen.getByDisplayValue('ana@teste.com')).toBeDisabled();
    expect(
      screen.getByText('Só o responsável pelo lead ou o gestor muda o nome. Telefone e e-mail não mudam depois do cadastro.'),
    ).toBeInTheDocument();
  });

  it('editando: o responsável muda o nome, mas não o e-mail', () => {
    const onSubmit = abrir(contato({ name_editable: true }));

    expect(screen.getByDisplayValue('ana@teste.com')).toBeDisabled();
    expect(screen.getByText('Telefone e e-mail não mudam depois do cadastro.')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Ana Teste'), { target: { value: 'Ana Souza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Souza' }));
  });

  it('editando: nome apagado não salva', () => {
    const onSubmit = abrir(contato({ name_editable: true }));
    fireEvent.change(screen.getByDisplayValue('Ana Teste'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('editando: gestor em lead manual muda nome e e-mail', () => {
    abrir(contato({ name_editable: true, identity_correctable: true }));

    expect(screen.getByDisplayValue('Ana Teste')).not.toBeDisabled();
    expect(screen.getByDisplayValue('ana@teste.com')).not.toBeDisabled();
  });

  it('cadastro novo: tudo aberto', () => {
    abrir(null, true);

    expect(screen.getByLabelText('E-mail')).not.toBeDisabled();
    expect(screen.queryByText(/não mudam depois do cadastro/)).not.toBeInTheDocument();
  });
});

describe('Formulário de contato · cadastro enxuto', () => {
  it('não pergunta empresa, redes sociais, tipo, país nem cidade', () => {
    abrir(null, true);

    for (const fora of [/empresa/i, /linkedin/i, /instagram/i, /pa[ií]s/i, /cidade/i, /pessoa f[ií]sica/i]) {
      expect(screen.queryByText(fora)).not.toBeInTheDocument();
    }
  });

  it('gestor: sem escolher corretor ou roleta, não salva', () => {
    const onSubmit = abrir(null, true);
    fireEvent.change(screen.getByLabelText(/Nome/), { target: { value: 'Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contato' }));

    expect(screen.getByText('Escolha o corretor ou a roleta.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('gestor: o Responsável tem os grupos Corretores e Roleta, sem quem foi desativado', async () => {
    abrir(null, true);

    expect(screen.getByRole('group', { name: 'Corretores' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Roleta Centro' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Caio' })).not.toBeInTheDocument();
  });

  it('gestor: escolher a roleta manda roleta_config_id, sem dono', async () => {
    const onSubmit = abrir(null, true);
    fireEvent.change(screen.getByLabelText(/Nome/), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByPlaceholderText('(11) 99999-9999'), { target: { value: '11999998888' } });
    await screen.findByRole('option', { name: 'Roleta Centro' });
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'roleta:r1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contato' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria', roleta_config_id: 'r1', default_assignee_id: null }),
    );
  });

  it('edição não oferece roleta: ela só existe no cadastro', () => {
    abrir(contato({ default_assignee_id: null }), false);
    expect(screen.queryByRole('group', { name: 'Roleta' })).not.toBeInTheDocument();
  });

  it('corretor: ele mesmo é o responsável, travado, sem lista pra escolher', () => {
    corretorLogado.atual = { id: 'u1', name: 'Bruna Corretora' };
    abrir(null, true);

    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument();
    expect(screen.getByText('Bruna Corretora')).toBeInTheDocument();
  });
});
