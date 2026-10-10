import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkAddPeople from './BulkAddPeople';

const s = vi.hoisted(() => ({ bulkAdd: vi.fn(), can: vi.fn() }));

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: s.can }) }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ currentUser: { id: 'me', name: 'Eu' } }) }));
vi.mock('@/services/users', () => ({ usersService: { bulkAdd: s.bulkAdd } }));

const members = [{ id: 'me', name: 'Eu', email: 'eu@x.com', role: { key: 'admin', name: 'admin', chave_role: 'admin' } }] as any;

function open() {
  const p = { open: true, roles: [], members, onClose: vi.fn(), onDone: vi.fn() };
  render(<BulkAddPeople {...(p as any)} />);
  return p;
}
const colar = async (texto: string) => {
  await userEvent.click(screen.getByLabelText('Colar da planilha'));
  await userEvent.paste(texto);
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar as linhas coladas' }));
};

describe('BulkAddPeople', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.can.mockReturnValue(true);
  });

  it('colar da planilha preenche a tabela e lista as linhas com erro', async () => {
    open();
    await colar('Nome;E-mail;Celular\nAna;ana@x.com;11940871974\nBia;sem-arroba;');
    expect(screen.getByLabelText('Nome da pessoa 1')).toHaveValue('Ana');
    expect(screen.getByLabelText('E-mail da pessoa 1')).toHaveValue('ana@x.com');
    expect(screen.getByText('Linha 3: e-mail inválido')).toBeInTheDocument();
  });

  it('mais de 50 pessoas bloqueia com a frase do servidor', async () => {
    open();
    const linhas = Array.from({ length: 51 }, (_, i) => `P${i};p${i}@x.com;`).join('\n');
    await colar(linhas);
    expect(screen.getByText('Adicione até 50 pessoas de uma vez.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Só cadastrar' })).toBeDisabled();
  });

  it('sem linha válida os botões ficam parados e dizem por quê', () => {
    open();
    expect(screen.getByText('Preencha pelo menos uma pessoa com e-mail válido.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Só cadastrar' })).toBeDisabled();
  });

  it('cadastrar e enviar acesso manda cargo e send_access, e mostra o resultado por pessoa', async () => {
    s.bulkAdd.mockResolvedValue({
      invited: [
        { id: '1', name: 'Ana', email: 'ana@x.com', access: 'sent' },
        { id: '2', name: 'Caio', email: 'caio@x.com', access: 'skipped' },
      ],
      skipped: [{ email: 'bia@x.com', reason: 'exists' }, { email: 'dud@x.com', reason: 'invalid', message: 'O e-mail dud@x.com não existe.' }],
      refused: [{ email: 'leo@x.com', message: 'E-mail reservado.' }],
    });
    const p = open();
    await colar('Ana;ana@x.com;11940871974\nCaio;caio@x.com;');
    await userEvent.click(screen.getByRole('button', { name: /Cadastrar e enviar acesso/ }));
    await waitFor(() => expect(s.bulkAdd).toHaveBeenCalled());
    expect(s.bulkAdd).toHaveBeenCalledWith({
      people: [
        { name: 'Ana', email: 'ana@x.com', whatsapp_number: '11940871974' },
        { name: 'Caio', email: 'caio@x.com', whatsapp_number: '' },
      ],
      chave_role: 'agent',
      send_access: true,
    });
    expect(await screen.findByText('Cadastro criado · link enviado')).toBeInTheDocument();
    expect(screen.getByText('Cadastro criado · sem celular — use Copiar link na ficha')).toBeInTheDocument();
    expect(screen.getByText('Já existia')).toBeInTheDocument();
    expect(screen.getByText('O e-mail dud@x.com não existe.')).toBeInTheDocument();
    expect(screen.getByText('Recusada: E-mail reservado.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onDone).toHaveBeenCalled();
  });

  it('Só cadastrar manda send_access falso; sem users.send_access o outro botão some', async () => {
    s.can.mockImplementation((r: string, a: string) => !(r === 'users' && a === 'send_access'));
    s.bulkAdd.mockResolvedValue({ invited: [{ id: '1', name: 'Ana', email: 'ana@x.com', access: 'skipped' }], skipped: [], refused: [] });
    open();
    expect(screen.queryByRole('button', { name: /Cadastrar e enviar acesso/ })).not.toBeInTheDocument();
    await colar('Ana;ana@x.com;11940871974');
    await userEvent.click(screen.getByRole('button', { name: 'Só cadastrar' }));
    await waitFor(() => expect(s.bulkAdd).toHaveBeenCalledWith(expect.objectContaining({ send_access: false })));
    expect(await screen.findByText('Cadastro criado · link não enviado')).toBeInTheDocument();
  });

  it('cargo recusado pelo servidor mostra a frase e não sai da tela', async () => {
    s.bulkAdd.mockRejectedValue({ response: { status: 403, data: { error: { message: 'Seu cargo não pode dar um cargo com mais permissões que o seu.' } } } });
    open();
    await colar('Ana;ana@x.com;');
    await userEvent.click(screen.getByRole('button', { name: 'Só cadastrar' }));
    expect(await screen.findByText(/Seu cargo não pode dar um cargo/)).toBeInTheDocument();
    expect(screen.getByLabelText('Colar da planilha')).toBeInTheDocument();
  });
});
