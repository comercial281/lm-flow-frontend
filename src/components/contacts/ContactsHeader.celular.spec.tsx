// Raio-X do celular (10/10/2026): no celular, Contatos não oferece o Exportar.
// No computador nada muda.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { simularCelular } from '@/test/telaDeCelular';

vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: () => true, isReady: true }) }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));

import ContactsHeader from './ContactsHeader';

const nada = () => {};
const desenhar = () =>
  render(
    <ContactsHeader
      totalCount={3}
      selectedCount={0}
      searchValue=""
      onSearchChange={nada}
      onNewContact={nada}
      onExport={nada}
      onBulkDelete={nada}
      onMergeContacts={nada}
      onClearSelection={nada}
    />,
  );

let tela: ReturnType<typeof simularCelular> | null = null;
afterEach(() => {
  tela?.restaurar();
  tela = null;
});

describe('Contatos no celular', () => {
  it('celular: sem Exportar, com Novo contato', () => {
    tela = simularCelular();
    desenhar();
    expect(screen.queryByRole('button', { name: /Exportar/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Novo contato/ })).toBeInTheDocument();
  });

  it('computador: Exportar continua', () => {
    tela = simularCelular(false);
    desenhar();
    expect(screen.getByRole('button', { name: /Exportar/ })).toBeInTheDocument();
  });
});
