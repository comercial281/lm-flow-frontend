import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TelaAnuncie from './TelaAnuncie';
import { listingFrom } from '@/features/siteBuilder/portalPages';

vi.mock('@/services/siteBuilder/siteBuilderService', () => ({ siteBuilderService: { testListingEmail: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const montar = (emailsText: string) => render(
  <TelaAnuncie site={null} listingPage={{ ...listingFrom(null), enabled: true }} setListingPage={vi.fn()}
    emailsText={emailsText} setEmailsText={vi.fn()} alterado={false} marcarAlterado={vi.fn()} />,
);

describe('TelaAnuncie', () => {
  it('sem e-mail, o aviso fica no próprio campo e fala de Contatos do site', () => {
    montar('');
    const aviso = screen.getByText(/Sem e-mail de destino a ficha fica guardada em Contatos do site/);
    expect(screen.getByLabelText('Quem recebe a ficha por e-mail').getAttribute('aria-describedby')).toContain(aviso.id);
  });

  it('com e-mail, sem aviso', () => {
    montar('dono@imob.com');
    expect(screen.queryByText(/Sem e-mail de destino/)).toBeNull();
  });
});
