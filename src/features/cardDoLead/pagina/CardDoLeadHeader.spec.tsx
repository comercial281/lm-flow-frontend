// Topo da página do card (11/10/2026, "cartão da pessoa"): quem é, os dados da
// pessoa e as ações num cartão só. A caixa "Dados da pessoa" saiu da Ficha.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardDoLeadHeader, { desdeQuandoNoFunil } from './CardDoLeadHeader';

vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/chat/contact/ContactAvatar', () => ({
  default: ({ contact }: { contact: { name: string } }) => <span data-testid="foto">{contact.name}</span>,
}));

const setCorrigindo = vi.fn();
const cardFalso = (extra: Record<string, unknown> = {}) => ({
  nomeExibido: 'Eliete Souza',
  avatarContact: { id: 'c1', name: 'Eliete Souza', avatar_url: null, thumbnail: null },
  contato: { id: 'c1', name: 'Eliete Souza' },
  corrigivel: false,
  identidade: { telefone: '5511987654321', email: 'eliete.souza@gmail.com', setCorrigindo },
  origem: 'Meta · Formulário Lançamento',
  dadosDaOrigem: null,
  roletaDoLead: 'Roleta Plantão',
  ...extra,
}) as never;

describe('desdeQuandoNoFunil', () => {
  it('a data do card e há quanto tempo', () => {
    const agora = new Date('2026-10-10T15:00:00Z');
    expect(desdeQuandoNoFunil('2026-09-26T15:00:00Z', agora)).toBe('Entrou no funil em 26/09 · há 14 dias');
  });

  it('sem data: nada (o cabeçalho fica sem a linha)', () => {
    expect(desdeQuandoNoFunil(null)).toBeUndefined();
    expect(desdeQuandoNoFunil('não é data')).toBeUndefined();
  });
});

describe('CardDoLeadHeader', () => {
  it('nome como título, foto no lugar da barrinha e a linha de desde quando', () => {
    render(<CardDoLeadHeader card={cardFalso()} criadoEm="2026-09-26T15:00:00Z" acoes={null} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Eliete Souza' })).toBeInTheDocument();
    expect(screen.getByTestId('foto')).toHaveTextContent('Eliete Souza');
    expect(screen.getByText(/^Entrou no funil em 26\/09 · /)).toBeInTheDocument();
  });

  it('dados da pessoa no topo: telefone, e-mail, origem e roleta', () => {
    render(<CardDoLeadHeader card={cardFalso()} acoes={null} />);
    const dados = screen.getByRole('group', { name: 'Dados da pessoa' });

    expect(within(dados).getByText('Telefone').nextSibling).toHaveTextContent('(11) 98765-4321');
    expect(within(dados).getByText('E-mail').nextSibling).toHaveTextContent('eliete.souza@gmail.com');
    expect(within(dados).getByText('Origem').nextSibling).toHaveTextContent('Meta · Formulário Lançamento');
    expect(within(dados).getByText('Roleta').nextSibling).toHaveTextContent('Roleta Plantão');
  });

  it('sem roleta, o campo não aparece; sem telefone e e-mail, o traço', () => {
    render(
      <CardDoLeadHeader
        card={cardFalso({ roletaDoLead: null, origem: null, identidade: { telefone: '', email: '', setCorrigindo } })}
        acoes={null}
      />,
    );
    const dados = screen.getByRole('group', { name: 'Dados da pessoa' });

    expect(within(dados).queryByText('Roleta')).toBeNull();
    expect(within(dados).getByText('Telefone').nextSibling).toHaveTextContent('—');
    expect(within(dados).getByText('E-mail').nextSibling).toHaveTextContent('—');
    expect(within(dados).getByText('Origem').nextSibling).toHaveTextContent('—');
  });

  it('o lápis de corrigir só aparece quando o servidor deixa', async () => {
    const { unmount } = render(<CardDoLeadHeader card={cardFalso()} acoes={null} />);
    expect(screen.queryByRole('button', { name: 'Corrigir telefone ou e-mail' })).toBeNull();
    unmount();

    render(<CardDoLeadHeader card={cardFalso({ corrigivel: true })} acoes={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir telefone ou e-mail' }));
    expect(setCorrigindo).toHaveBeenCalledWith(true);
  });

  it('as ações entram no cartão', () => {
    render(<CardDoLeadHeader card={cardFalso()} acoes={<button type="button">Ganho</button>} />);
    expect(screen.getByRole('button', { name: 'Ganho' })).toBeInTheDocument();
  });

  it('lead sem contato: sem foto, volta a barrinha', () => {
    render(<CardDoLeadHeader card={cardFalso({ avatarContact: null, contato: null })} acoes={null} />);
    expect(screen.queryByTestId('foto')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Eliete Souza' })).toBeInTheDocument();
  });
});
