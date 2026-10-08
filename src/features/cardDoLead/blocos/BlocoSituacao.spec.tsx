// ResponsavelComFoto: a foto é do responsável ATUAL, não de item.assignee.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsavelComFoto } from './BlocoSituacao';

vi.mock('@/components/chat/contact/ContactAvatar', () => ({
  default: ({ contact }: { contact: { name: string; avatar_url: string | null } }) => (
    <div data-testid="foto" data-nome={contact.name} data-url={contact.avatar_url ?? ''} />
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
});
