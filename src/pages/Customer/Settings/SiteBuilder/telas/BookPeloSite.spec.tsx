import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import TelaFicha from './TelaFicha';
import type { BookFlow, SiteFormData, Site } from '@/services/siteBuilder/siteBuilderService';
import { FICHA_FABRICA, type FichaConfigDoAdmin } from '@/features/siteBuilder/public/fichaConfig';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const getBookFlow = vi.fn();
const putBookFlow = vi.fn();
vi.mock('@/services/siteBuilder/siteBuilderService', async orig => ({
  ...(await orig<object>()),
  siteBuilderService: { getBookFlow: (...a: unknown[]) => getBookFlow(...a), putBookFlow: (...a: unknown[]) => putBookFlow(...a) },
}));
const listAgentes = vi.fn();
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ default: { list: () => listAgentes() } }));
vi.mock('@/components/numbers/SendFromField', () => ({
  default: ({ scope, onChange }: { scope: string; onChange: (v: { send_from: string; send_from_inbox_id: string }) => void }) => (
    <button type="button" data-scope={scope} onClick={() => onChange({ send_from: 'number', send_from_inbox_id: 'inbox-9' })}>Escolher número</button>
  ),
}));

const MSG = 'Oi {{nome}}! Aqui está o book do {{imovel}}. Qualquer dúvida é só me chamar por aqui.';
const flow = (p: Partial<BookFlow> = {}): BookFlow => ({
  ligado: false, fluxo_id: null, personalizado: false, fluxo_ligado: false, send_from: '', send_from_inbox_id: null,
  mensagem: MSG, ia_assume: true, existe: false, ...p,
});
const FABRICA: FichaConfigDoAdmin = { ...FICHA_FABRICA, email_copy: ['a@imob.com'] };

function Montar({ espiao, semMarcar, ficha = FABRICA }: { espiao: ReturnType<typeof vi.fn>; semMarcar: ReturnType<typeof vi.fn>; ficha?: FichaConfigDoAdmin }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', property_page: ficha });
  return (
    <MemoryRouter>
      <TelaFicha site={{ id: 'site-1' } as Site} siteForm={form}
        setF={f => { espiao(f); setForm(p => ({ ...p, ...f })); }}
        aplicarSemMarcar={f => { semMarcar(f); setForm(p => ({ ...p, ...f })); }} />
    </MemoryRouter>
  );
}

async function abrir(ficha?: FichaConfigDoAdmin) {
  const espiao = vi.fn(); const semMarcar = vi.fn();
  render(<Montar espiao={espiao} semMarcar={semMarcar} ficha={ficha} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Empreendimentos' }));
  await waitFor(() => expect(getBookFlow).toHaveBeenCalled());
  return { espiao, semMarcar };
}
const ligada = (ficha = FABRICA): FichaConfigDoAdmin => ({ ...ficha, development: { ...ficha.development, book_button: true } });

beforeEach(() => {
  vi.clearAllMocks();
  getBookFlow.mockResolvedValue(flow());
  listAgentes.mockResolvedValue([{ id: 'a1', enabled: true }]);
});

describe('Receber o book no WhatsApp', () => {
  it('só aparece na aba Empreendimentos', () => {
    render(<Montar espiao={vi.fn()} semMarcar={vi.fn()} />);
    expect(screen.queryByRole('switch', { name: 'Receber o book no WhatsApp' })).toBeNull();
  });

  it('ligar chama o PUT na hora (ligado:true), mostra os campos e NÃO marca a ficha como alterada', async () => {
    putBookFlow.mockResolvedValue(flow({ ligado: true, existe: true, fluxo_id: 'f1', fluxo_ligado: true }));
    const { espiao, semMarcar } = await abrir();
    expect(screen.queryByText('Salvar o envio do book')).toBeNull();

    await userEvent.click(screen.getByRole('switch', { name: 'Receber o book no WhatsApp' }));

    expect(putBookFlow).toHaveBeenCalledWith('site-1', expect.objectContaining({ ligado: true, mensagem: MSG }));
    expect(await screen.findByRole('button', { name: 'Salvar o envio do book' })).toBeTruthy();
    expect(screen.getByLabelText('Mensagem')).toHaveValue(MSG);
    expect(espiao).not.toHaveBeenCalled();
    // property_page inteiro, com e-mails, só que sem passar pelo setF que marca a ficha.
    expect(semMarcar.mock.lastCall![0].property_page.development.book_button).toBe(true);
    expect(semMarcar.mock.lastCall![0].property_page.email_copy).toEqual(['a@imob.com']);
  });

  it('desligar manda ligado:false', async () => {
    getBookFlow.mockResolvedValue(flow({ ligado: true, existe: true, fluxo_id: 'f1', fluxo_ligado: true }));
    putBookFlow.mockResolvedValue(flow({ existe: true, fluxo_id: 'f1' }));
    await abrir(ligada());

    await userEvent.click(screen.getByRole('switch', { name: 'Receber o book no WhatsApp' }));

    expect(putBookFlow).toHaveBeenCalledWith('site-1', expect.objectContaining({ ligado: false }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar o envio do book' })).toBeNull());
  });

  it('fluxo personalizado: só o aviso e o link pro construtor, sem campos', async () => {
    getBookFlow.mockResolvedValue(flow({ ligado: true, existe: true, personalizado: true, fluxo_id: 'f7', fluxo_ligado: true }));
    await abrir(ligada());

    expect(await screen.findByText(/Este fluxo foi personalizado no construtor/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver no construtor' })).toHaveAttribute('href', '/automations/flow-builder/f7');
    expect(screen.queryByLabelText('Mensagem')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar o envio do book' })).toBeNull();
  });

  it('fluxo desligado no construtor com a chave ligada: aviso e "Ligar o fluxo" manda ligado:true', async () => {
    getBookFlow.mockResolvedValue(flow({ ligado: true, existe: true, fluxo_id: 'f1', fluxo_ligado: false }));
    putBookFlow.mockResolvedValue(flow({ ligado: true, existe: true, fluxo_id: 'f1', fluxo_ligado: true }));
    await abrir(ligada());

    expect(await screen.findByText(/O fluxo está desligado no construtor: o botão aparece, mas o book não é enviado/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Ligar o fluxo' }));

    expect(putBookFlow).toHaveBeenCalledWith('site-1', expect.objectContaining({ ligado: true }));
    await waitFor(() => expect(screen.queryByText(/O fluxo está desligado/)).toBeNull());
  });

  it('422 (sem número): toast com a mensagem do servidor e a chave volta', async () => {
    putBookFlow.mockRejectedValue({ response: { status: 422, data: { error: { message: 'Conecte um número antes.' } } } });
    const { semMarcar } = await abrir();
    const chave = screen.getByRole('switch', { name: 'Receber o book no WhatsApp' });

    await userEvent.click(chave);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Conecte um número antes.'));
    expect(semMarcar).not.toHaveBeenCalled();
    expect(chave).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('button', { name: 'Salvar o envio do book' })).toBeNull();
  });

  it('salvar o envio manda número, mensagem e IA; o seletor usa o escopo do construtor', async () => {
    getBookFlow.mockResolvedValue(flow({ ligado: true, existe: true, fluxo_id: 'f1', fluxo_ligado: true }));
    putBookFlow.mockResolvedValue(flow({ ligado: true, existe: true, fluxo_id: 'f1', fluxo_ligado: true, ia_assume: false }));
    await abrir(ligada());

    const escolher = await screen.findByRole('button', { name: 'Escolher número' });
    expect(escolher).toHaveAttribute('data-scope', 'lead_automation_rules');
    await userEvent.click(escolher);
    const msg = screen.getByLabelText('Mensagem');
    await userEvent.clear(msg);
    await userEvent.type(msg, 'Segue o book');
    await userEvent.click(await screen.findByRole('radio', { name: 'Não' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o envio do book' }));

    expect(putBookFlow).toHaveBeenCalledWith('site-1', {
      ligado: true, send_from: 'number', send_from_inbox_id: 'inbox-9', mensagem: 'Segue o book', ia_assume: false,
    });
  });

  it('sem IA ligada no cliente, a pergunta da IA Vendedora some', async () => {
    listAgentes.mockResolvedValue([{ id: 'a1', enabled: false }]);
    getBookFlow.mockResolvedValue(flow({ ligado: true, existe: true, fluxo_id: 'f1', fluxo_ligado: true }));
    await abrir(ligada());

    await screen.findByRole('button', { name: 'Salvar o envio do book' });
    expect(screen.queryByText(/a IA Vendedora assume a conversa/)).toBeNull();
  });
});
