import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaFicha from './TelaFicha';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { FICHA_FABRICA, type FichaConfigDoAdmin } from '@/features/siteBuilder/public/fichaConfig';

const FABRICA: FichaConfigDoAdmin = { ...FICHA_FABRICA, email_copy: [] };

function Montar({ espiao, ficha = FABRICA }: { espiao: (f: Partial<SiteFormData>) => void; ficha?: FichaConfigDoAdmin }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', property_page: ficha });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <MemoryRouter><TelaFicha site={null} siteForm={form} setF={setF} /></MemoryRouter>;
}

const ultima = (espiao: ReturnType<typeof vi.fn>): FichaConfigDoAdmin => espiao.mock.lastCall![0].property_page;
const caixinha = (nome: string | RegExp) => screen.getByRole('checkbox', { name: nome });
const marcada = (nome: string | RegExp) => caixinha(nome).getAttribute('aria-checked') === 'true'
  || caixinha(nome).getAttribute('data-state') === 'checked';

describe('TelaFicha', () => {
  it('abre em Imóveis com as 4 caixinhas da revenda, todas marcadas, cada uma com a frase do site', () => {
    render(<Montar espiao={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Imóveis' })).toHaveAttribute('aria-selected', 'true');
    const painel = within(screen.getByRole('tabpanel', { name: 'Imóveis' }));
    expect(painel.getAllByRole('checkbox').map(c => c.getAttribute('id')))
      .toEqual(['ficha-resale-map', 'ficha-resale-popular_badge', 'ficha-resale-values', 'ficha-resale-similar']);
    for (const nome of ['Mapa', 'Selo Muito procurado', 'Condomínio, IPTU e valor do m²', 'Você também pode gostar']) {
      expect(marcada(nome)).toBe(true);
    }
    expect(caixinha('Mapa')).toHaveAccessibleDescription(/O endereço exato do imóvel não aparece/);
    expect(caixinha('Selo Muito procurado')).toHaveAccessibleDescription(/mais de 30 visitas nos últimos 30 dias/);
  });

  it('Empreendimentos mostra as 6 caixinhas dele (construtora só com nome e site)', async () => {
    render(<Montar espiao={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Empreendimentos' }));

    const painel = within(screen.getByRole('tabpanel', { name: 'Empreendimentos' }));
    expect(painel.getAllByRole('checkbox')).toHaveLength(6);
    expect(painel.getByRole('checkbox', { name: 'Fase da obra e previsão de entrega' })).toBeTruthy();
    expect(painel.getByRole('checkbox', { name: 'Tipologias disponíveis' })).toBeTruthy();
    expect(caixinha('Construtora')).toHaveAccessibleDescription(/Telefone, CNPJ e contato nunca aparecem/);
    expect(screen.queryByRole('checkbox', { name: 'Condomínio, IPTU e valor do m²' })).toBeNull();
  });

  it('desmarcar uma caixinha manda o property_page INTEIRO, com a lista de e-mails', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} ficha={{ ...FABRICA, email_copy: ['dono@imob.com'] }} />);

    await userEvent.click(caixinha('Mapa'));

    expect(espiao).toHaveBeenCalledTimes(1);
    expect(ultima(espiao)).toEqual({
      resale: { map: false, popular_badge: true, values: true, similar: true },
      development: FICHA_FABRICA.development,
      financing_badges: true,
      email_copy: ['dono@imob.com'],
    });
  });

  it('a caixinha do empreendimento não mexe na da revenda', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Empreendimentos' }));
    await userEvent.click(caixinha('Mapa'));

    expect(ultima(espiao).development.map).toBe(false);
    expect(ultima(espiao).resale.map).toBe(true);
  });

  it('os selos de financiamento valem pros dois e ficam fora das abas', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const selos = caixinha('Mostrar os selos de financiamento');
    expect(within(screen.getByRole('tabpanel')).queryByRole('checkbox', { name: 'Mostrar os selos de financiamento' })).toBeNull();

    await userEvent.click(selos);

    expect(ultima(espiao)).toEqual({ ...FABRICA, financing_badges: false });
  });

  it('e-mails da cópia: até 3; no 3º o botão "Adicionar e-mail" some', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    expect(screen.getByText(/os contatos chegam só no CRM/)).toBeTruthy();

    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: /Adicionar e-mail/ }));

    expect(ultima(espiao).email_copy).toEqual(['', '', '']);
    expect(screen.getAllByLabelText(/^E-mail \d$/)).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Adicionar e-mail/ })).toBeNull();
  });

  it('com 3 e-mails gravados não dá pra pôr um 4º', () => {
    render(<Montar espiao={vi.fn()} ficha={{ ...FABRICA, email_copy: ['a@imob.com', 'b@imob.com', 'c@imob.com'] }} />);

    expect((screen.getByLabelText('E-mail 3') as HTMLInputElement).value).toBe('c@imob.com');
    expect(screen.queryByLabelText('E-mail 4')).toBeNull();
    expect(screen.queryByRole('button', { name: /Adicionar e-mail/ })).toBeNull();
  });

  it('e-mail inválido avisa em âmbar quando a pessoa sai do campo; corrigido, o aviso some', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByRole('button', { name: /Adicionar e-mail/ }));
    const campo = screen.getByLabelText('E-mail 1');

    await userEvent.type(campo, 'joao@imob');
    expect(screen.queryByText(/não parece certo/)).toBeNull(); // enquanto digita, não acusa
    expect(ultima(espiao).email_copy).toEqual(['joao@imob']);

    fireEvent.blur(campo);
    const aviso = screen.getByText(/Esse e-mail não parece certo e não vai ser salvo/);
    expect(aviso.className).toMatch(/amber/);
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(/não parece certo/);

    await userEvent.type(campo, '.com.br');
    fireEvent.blur(campo);
    expect(screen.queryByText(/não parece certo/)).toBeNull();
    expect(ultima(espiao).email_copy).toEqual(['joao@imob.com.br']);
  });

  it('remover um e-mail preenchido pede confirmação; cancelar mantém', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} ficha={{ ...FABRICA, email_copy: ['a@imob.com', 'b@imob.com'] }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remover e-mail 1' }));
    let dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText(/a@imob\.com deixa de receber a cópia/)).toBeTruthy();
    await userEvent.click(dialogo.getByRole('button', { name: 'Cancelar' }));
    expect(espiao).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Remover e-mail 1' }));
    dialogo = within(screen.getByRole('dialog'));
    await userEvent.click(dialogo.getByRole('button', { name: 'Remover' }));
    expect(ultima(espiao).email_copy).toEqual(['b@imob.com']);
  });

  it('o botão de remover tem nome e dica', () => {
    render(<Montar espiao={vi.fn()} ficha={{ ...FABRICA, email_copy: ['a@imob.com'] }} />);
    expect(screen.getByRole('button', { name: 'Remover e-mail 1' })).toHaveAttribute('title', 'Remover e-mail 1');
  });

  it('a frase da cópia diz que o contato continua indo pro funil e pra roleta', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(screen.getByText(
      'Cada contato feito na página de um imóvel também chega nesses e-mails. Ele continua indo pro funil e pra roleta normalmente.',
    )).toBeTruthy();
  });
});
