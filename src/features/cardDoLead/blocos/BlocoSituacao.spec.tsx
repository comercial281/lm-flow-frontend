// ResponsavelComFoto: a foto é do responsável ATUAL, não de item.assignee.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsavelComFoto } from './BlocoSituacao';

vi.mock('@/components/chat/contact/ContactAvatar', () => ({
  default: ({ contact, iconeSemNome }: { contact: { name: string; avatar_url: string | null }; iconeSemNome?: { displayName?: string } }) => (
    <div data-testid="foto" data-nome={contact.name} data-url={contact.avatar_url ?? ''} data-icone={iconeSemNome?.displayName ?? ''} />
  ),
}));
vi.mock('@/components/pipelines/card/CamposDaSituacao', () => ({
  CampoEtapa: () => null,
  CampoResponsavel: () => <div data-testid="campo-responsavel" />,
}));
vi.mock('@/components/roleta/OfferActions', () => ({ default: () => null }));
vi.mock('@/components/pipelines/card/ColocarNoFunil', () => ({ default: () => null }));

const card = (id: string) => ({
  item: { assignee: { id: 'u1', name: 'Ana', avatar_url: 'ana.png' } },
  responsavel: {
    id,
    salvando: false,
    trocar: vi.fn(),
    usuarios: [
      { id: 'u1', name: 'Ana', avatar_url: 'ana.png' },
      { id: 'u2', name: 'Bruno', avatar_url: 'bruno.png' },
    ],
  },
}) as never;

describe('ResponsavelComFoto', () => {
  it('após Trocar, a foto acompanha o novo responsável (não o item.assignee antigo)', () => {
    render(<ResponsavelComFoto card={card('u2')} />);
    const foto = screen.getByTestId('foto');
    expect(foto).toHaveAttribute('data-nome', 'Bruno');
    expect(foto).toHaveAttribute('data-url', 'bruno.png');
  });

  it('sem responsável: sem foto emprestada do assignee antigo', () => {
    render(<ResponsavelComFoto card={card('')} />);
    expect(screen.getByTestId('foto')).toHaveAttribute('data-url', '');
  });

  it('responsável atual fora da lista de usuários: cai na foto do assignee do card', () => {
    const c = card('u1') as unknown as { responsavel: { usuarios: unknown[] } };
    c.responsavel.usuarios = [{ id: 'u2', name: 'Bruno', avatar_url: 'bruno.png' }];
    render(<ResponsavelComFoto card={c as never} />);
    const foto = screen.getByTestId('foto');
    expect(foto).toHaveAttribute('data-nome', 'Ana');
    expect(foto).toHaveAttribute('data-url', 'ana.png');
  });
});

// Revisão de 10/10/2026: o corretor não lê a lista de pessoas; a foto usa o
// mesmo nome do campo — o do card ou, em reserva, o da conversa.
describe('ResponsavelComFoto sem a lista de pessoas (corretor)', () => {
  const doCorretor = (item: unknown, id: string) => ({
    item,
    responsavel: { id, salvando: false, trocar: vi.fn(), usuarios: [] },
  }) as never;

  it('responsável da conversa: a foto leva o nome e a foto dele', () => {
    render(<ResponsavelComFoto card={doCorretor({ conversation: { id: 77, assignee: { id: 'u9', name: 'Bruno Silva', avatar_url: 'b.png' } } }, 'u9')} />);
    const foto = screen.getByTestId('foto');
    expect(foto).toHaveAttribute('data-nome', 'Bruno Silva');
    expect(foto).toHaveAttribute('data-url', 'b.png');
  });

  it('com responsável sem nome conhecido, nunca "Sem responsável" ao lado, e o ícone é de pessoa', () => {
    render(<ResponsavelComFoto card={doCorretor({}, 'u9')} />);
    const foto = screen.getByTestId('foto');
    expect(foto).not.toHaveAttribute('data-nome', 'Sem responsável');
    expect(foto).toHaveAttribute('data-icone', 'User');
  });

  it('sem responsável: "Sem responsável"', () => {
    render(<ResponsavelComFoto card={doCorretor({}, '')} />);
    expect(screen.getByTestId('foto')).toHaveAttribute('data-nome', 'Sem responsável');
  });
});
