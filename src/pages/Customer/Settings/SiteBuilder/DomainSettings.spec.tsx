import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SiteDomainState } from '@/services/siteBuilder/siteBuilderService';
import DomainSettings from './DomainSettings';

// Domínio próprio com a prova de posse (11/10/2026): Passo 1 (código TXT do
// site) e Passo 2 (apontar o DNS), o ✓ quando o código é achado, "Em uso por
// outro site", "paramos de conferir" e o servidor anterior, que não manda
// `ownership` e deixa a tela como era.

const mocks = vi.hoisted(() => ({
  getDomain: vi.fn(),
  connectDomain: vi.fn(),
  verifyDomain: vi.fn(),
  disconnectDomain: vi.fn(),
}));

vi.mock('@/services/siteBuilder/siteBuilderService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/siteBuilder/siteBuilderService')>();
  return { ...real, siteBuilderService: { ...real.siteBuilderService, ...mocks } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DOMINIO = 'imobexemplo.com.br';

const apontamento = [
  { domain: DOMINIO, type: 'A', name: '@', value: '76.76.21.21' },
  { domain: `www.${DOMINIO}`, type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' },
];

const prova = {
  type: 'TXT', name: '_lmflow', host: `_lmflow.${DOMINIO}`, value: 'lmflow-site=7K2QX9MD4PTA',
  verified: false, verified_at: null, checked_at: null,
  auto_check_until: new Date(Date.now() + 20 * 86_400_000).toISOString(),
};

function estado(extra: Partial<SiteDomainState>): SiteDomainState {
  return {
    configured: true, domain: DOMINIO, status: 'pending_verification', status_label: 'Aguardando a prova de posse',
    verified: false, dns_records: apontamento, verification: [], checked_at: new Date().toISOString(),
    ownership: prova, dns_missing_since: null, ...extra,
  };
}

async function abrir(dados: SiteDomainState) {
  mocks.getDomain.mockResolvedValue(dados);
  render(<DomainSettings siteId="s1" />);
  await screen.findByText('Domínio próprio');
}

describe('DomainSettings · prova de posse', () => {
  beforeEach(() => { Object.values(mocks).forEach(m => m.mockReset()); });

  it('antes de conectar avisa que serão dois registros', async () => {
    await abrir(estado({ status: 'none', status_label: 'Nenhum domínio conectado', domain: null, ownership: null }));

    expect(screen.getByText(/você cria dois registros no DNS: um prova que o domínio é seu/)).toBeTruthy();
  });

  it('sem a prova: mostra os dois passos juntos, com o código TXT e os registros de apontamento', async () => {
    await abrir(estado({}));

    expect(screen.getByText('Aguardando a prova de posse')).toBeTruthy();
    const passo1 = screen.getByRole('region', { name: 'Passo 1' });
    expect(within(passo1).getByText('Passo 1 · Provar que o domínio é seu')).toBeTruthy();
    expect(within(passo1).getByText('_lmflow')).toBeTruthy();
    expect(within(passo1).getByText('lmflow-site=7K2QX9MD4PTA')).toBeTruthy();
    expect(within(passo1).getByText(`_lmflow.${DOMINIO}`)).toBeTruthy();
    expect(within(passo1).getByText(/Esse código é só deste site/)).toBeTruthy();

    const passo2 = screen.getByRole('region', { name: 'Passo 2' });
    expect(within(passo2).getByText('Passo 2 · Apontar o domínio pro site')).toBeTruthy();
    expect(within(passo2).getByText('76.76.21.21')).toBeTruthy();
    expect(within(passo2).getByText(/não mexa nos registros MX/)).toBeTruthy();

    expect(screen.getByText(/O LM Flow confere sozinho, mesmo com esta tela fechada/)).toBeTruthy();
    expect(screen.queryByText(/outra conta Vercel/)).toBeNull();
    expect(screen.queryByText(/Paramos de conferir sozinhos/)).toBeNull();
  });

  it('código achado: o Passo 1 ganha o ✓ e o selo vira Aguardando o DNS apontar', async () => {
    await abrir(estado({
      status: 'pending_dns', status_label: 'Aguardando o DNS apontar',
      ownership: { ...prova, verified: true, verified_at: new Date().toISOString() },
    }));

    expect(screen.getByText('Aguardando o DNS apontar')).toBeTruthy();
    const passo1 = screen.getByRole('region', { name: 'Passo 1' });
    expect(within(passo1).getByText('Domínio comprovado')).toBeTruthy();
    expect(within(passo1).queryByText('lmflow-site=7K2QX9MD4PTA')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Passo 2' })).getByText('cname.vercel-dns.com')).toBeTruthy();
  });

  it('o texto da outra conta Vercel só aparece quando a Vercel pede a prova dela', async () => {
    await abrir(estado({
      status_label: 'Aguardando a verificação da Vercel',
      ownership: { ...prova, verified: true },
      verification: [{ type: 'TXT', name: `_vercel.${DOMINIO}`, value: 'vc-domain-verify=abc' }],
    }));

    expect(screen.getByText(/outra conta Vercel/)).toBeTruthy();
    expect(screen.getByText('vc-domain-verify=abc')).toBeTruthy();
  });

  it('em uso por outro site: frase do suporte, sem passos e sem Verificar agora', async () => {
    await abrir(estado({ status: 'taken', status_label: 'Em uso por outro site', dns_records: [],
      ownership: { ...prova, auto_check_until: null } }));

    expect(screen.getAllByText('Em uso por outro site').length).toBeGreaterThan(0);
    expect(screen.getByText(/comprovado por outro site do LM Flow. Se ele é seu, fale com o suporte/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Passo 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Verificar agora/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Desconectar/ })).toBeTruthy();
  });

  it('depois de 30 dias: paramos de conferir sozinhos', async () => {
    await abrir(estado({ ownership: { ...prova, auto_check_until: new Date(Date.now() - 86_400_000).toISOString() } }));

    expect(screen.getByText(/Paramos de conferir sozinhos. Depois de criar o registro, clique em Verificar agora./))
      .toBeTruthy();
  });

  it('domínio que parou de apontar e voltou pro endereço lmflow', async () => {
    await abrir(estado({
      status: 'pending_dns', status_label: 'Aguardando o DNS apontar',
      ownership: { ...prova, verified: true }, dns_missing_since: '2026-10-09T12:00:00Z',
    }));

    expect(screen.getByText('Seu domínio parou de apontar pro site em 09/10.')).toBeTruthy();
    expect(screen.getByText(/o site e os links de imóvel usam o endereço lmflow/)).toBeTruthy();
  });

  it('Verificar agora chama o servidor e mostra o novo estado', async () => {
    await abrir(estado({}));
    mocks.verifyDomain.mockResolvedValue(estado({
      status: 'pending_dns', status_label: 'Aguardando o DNS apontar', ownership: { ...prova, verified: true },
    }));

    await userEvent.click(screen.getByRole('button', { name: /Verificar agora/ }));

    expect(mocks.verifyDomain).toHaveBeenCalledWith('s1');
    expect(await screen.findByText('Domínio comprovado')).toBeTruthy();
  });

  it('servidor anterior (sem ownership): a tela sai como antes', async () => {
    await abrir(estado({
      status: 'pending_dns', status_label: 'Aguardando o DNS apontar', ownership: undefined,
      dns_missing_since: undefined,
    }));

    expect(screen.getByText('Falta o cliente apontar o domínio')).toBeTruthy();
    expect(screen.getByText('76.76.21.21')).toBeTruthy();
    expect(screen.getByText(/Verificando sozinho a cada 15s/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Passo 1' })).toBeNull();
    expect(screen.queryByText(/lmflow-site=/)).toBeNull();
  });
});
