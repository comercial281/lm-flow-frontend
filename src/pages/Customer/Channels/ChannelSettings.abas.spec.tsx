import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';

// Criar número → a tela do canal abre em Configuração com o QR
// (`?tab=configuration&connect=1`). O endereço escolhe a aba só na chegada:
// antes, ele puxava de volta a cada clique e o gestor não conseguia sair de
// Configuração pra marcar os Colaboradores sem sair da tela.
const t = vi.hoisted(() => (key: string) => key);
const s = vi.hoisted(() => ({ getById: vi.fn() }));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t }) }));
vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({ can: () => true, isReady: true }),
}));
vi.mock('@/services/channels/inboxesService', () => ({ default: { getById: s.getById } }));
vi.mock('@/services/numbers/numbersService', () => ({
  default: { numberCard: () => Promise.resolve(null) },
}));
vi.mock('@/components/numbers/NumberCard', () => ({ default: () => null }));
vi.mock('@/features/numbers/useNumberOwnerRule', () => ({
  ownerRuleForChannel: () => null,
  useNumberOwnerRule: () => null,
}));
vi.mock('@/features/numbers/usePreviousOwnerPrompt', () => ({
  usePreviousOwnerPrompt: () => ({ dialog: null, ask: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// Igual ao de verdade: ao abrir, tira o `connect=1` do endereço e deixa o `tab`.
function ConfigurationForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('connect') !== '1') return;
    const params = new URLSearchParams(searchParams);
    params.delete('connect');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);
  return <div>conexão do número</div>;
}
vi.mock('@/components/channels', () => ({
  BasicSettingsForm: () => <div>dados do canal</div>,
  WebWidgetAdvancedForm: () => null,
  SenderSettingsForm: () => null,
  AuthorizationBanners: () => null,
  CollaboratorsForm: () => <div>lista de colaboradores</div>,
  PreChatForm: () => null,
  WidgetBuilderForm: () => null,
  ConfigurationForm,
  MessageTemplateForm: () => <div>modelos de mensagem</div>,
}));

import ChannelSettings from './ChannelSettings';

function Endereco() {
  return <output aria-label="endereço">{useLocation().search}</output>;
}

const tela = (endereco: string) =>
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/channels/:id/settings" element={<><ChannelSettings /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  s.getById.mockResolvedValue({
    data: {
      id: 77,
      name: 'Ana',
      channel_type: 'Channel::Whatsapp',
      provider: 'evolution',
      provider_config: { instance_name: 'lmf_imob_ana' },
      phone_number: '+5511999990000',
    },
  });
});

describe('Canal · aba pedida pelo endereço', () => {
  it('chega em Configuração quando o endereço pede (criar número → QR)', async () => {
    tela('/channels/77/settings?tab=configuration&connect=1');
    expect(await screen.findByText('conexão do número')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'settings.tabs.configuration' })).toHaveAttribute('aria-selected', 'true');
  });

  it('depois de chegar em Configuração, Colaboradores abre e fica', async () => {
    tela('/channels/77/settings?tab=configuration&connect=1');
    await screen.findByText('conexão do número');
    // A pessoa clica depois que a Configuração já tirou o `connect=1`; o
    // `?tab=configuration` continua no endereço, que é o que prendia a aba.
    await waitFor(() => expect(screen.getByLabelText('endereço')).toHaveTextContent(/^\?tab=configuration$/));

    await userEvent.click(screen.getByRole('tab', { name: 'settings.tabs.collaborators' }));

    expect(await screen.findByText('lista de colaboradores')).toBeInTheDocument();
    expect(screen.queryByText('conexão do número')).toBeNull();
    expect(screen.getByRole('tab', { name: 'settings.tabs.collaborators' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sem aba no endereço, abre na primeira e troca normalmente', async () => {
    tela('/channels/77/settings');
    expect(await screen.findByText('dados do canal')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'settings.tabs.collaborators' }));

    expect(await screen.findByText('lista de colaboradores')).toBeInTheDocument();
  });
});
