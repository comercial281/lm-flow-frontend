import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AutomationsLayout from './AutomationsLayout';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

// G8 (Fase 1 — Cargos, task B5): quando a lista de abas fica vazia SÓ por
// causa do cargo (o plano do cliente libera setor, mas nenhum deles é do
// cargo), a tela mostra o aviso do cargo — não "Nenhuma automação disponível
// neste plano." (essa frase é só para quando o PLANO não libera setor nenhum).

vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useTenantFeatures: () => ({ features: {} }),
}));

vi.mock('@/hooks/useIsSuperAdmin', () => ({
  useIsSuperAdmin: () => false,
}));

const podeMock = vi.fn();
vi.mock('@/hooks/useCan', () => ({
  useCan: () => podeMock,
}));

// jsdom não implementa scrollTo — o componente chama mainRef.current?.scrollTo
// para zerar a rolagem a cada troca de aba, sem relação com o que este spec
// confere.
window.HTMLElement.prototype.scrollTo = vi.fn();

const montar = () =>
  render(<AutomationsLayout />, {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/automations']}>{children}</MemoryRouter>,
  });

describe('AutomationsLayout — vazio pelo cargo x vazio pelo plano', () => {
  it('cargo sem nenhum dos setores mostra o aviso do cargo, não a frase de plano', () => {
    podeMock.mockReturnValue(false);
    montar();
    expect(screen.getByRole('status')).toHaveTextContent(NO_ACCESS_MESSAGE);
    expect(screen.queryByText('Nenhuma automação disponível neste plano.')).toBeNull();
  });

  it('cargo com pelo menos um setor liberado não mostra o aviso do cargo', () => {
    podeMock.mockReturnValue(true);
    montar();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Nenhuma automação disponível neste plano.')).toBeNull();
  });
});
