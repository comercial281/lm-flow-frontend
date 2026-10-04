import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaDados from './TelaDados';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';

function Montar({ espiao = vi.fn(), inicial = {} }: { espiao?: (f: Partial<SiteFormData>) => void; inicial?: Partial<SiteFormData> }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', ...inicial });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaDados site={null} siteForm={form} setF={setF} />;
}

const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement;

describe('TelaDados', () => {
  it('cada campo diz onde aparece no site', () => {
    render(<Montar />);
    expect(screen.getByRole('heading', { name: 'Contato' })).toBeTruthy();
    expect(screen.getByText(/botão verde do WhatsApp/)).toBeTruthy();
    expect(campo('Endereço').tagName).toBe('TEXTAREA');
  });

  it('WhatsApp tem máscara e grava só os dígitos com o 55, como antes', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.type(campo('WhatsApp'), '11987654321');
    expect(campo('WhatsApp').value).toBe('+55 11 98765 4321');
    expect(espiao).toHaveBeenLastCalledWith({ contact_whatsapp: '5511987654321' });
  });

  it('WhatsApp gravado aparece com a máscara e não vira alteração ao abrir', () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ contact_whatsapp: '5511987654321' }} />);
    expect(campo('WhatsApp').value).toBe('+55 11 98765 4321');
    expect(espiao).not.toHaveBeenCalled();
  });

  it('Telefone tem máscara e grava o texto como aparece no site', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.type(campo('Telefone'), '1133334444');
    expect(campo('Telefone').value).toBe('(11) 3333-4444');
    expect(espiao).toHaveBeenLastCalledWith({ contact_phone: '(11) 3333-4444' });
    await userEvent.type(campo('Telefone'), '5');
    expect(espiao).toHaveBeenLastCalledWith({ contact_phone: '(11) 33334-4445' });
  });

  it('Telefone antigo não vira alteração ao abrir a tela', () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ contact_phone: '+55 11 3333-4444' }} />);
    expect(campo('Telefone').value).toBe('(11) 3333-4444');
    expect(espiao).not.toHaveBeenCalled();
  });

  it('e-mail sem cara de e-mail ganha aviso; e-mail certo, não', async () => {
    render(<Montar />);
    await userEvent.type(campo('E-mail'), 'contato.imob.com');
    expect(screen.getByText(/Isso não parece um e-mail/)).toBeTruthy();
    await userEvent.clear(campo('E-mail'));
    await userEvent.type(campo('E-mail'), 'contato@imob.com.br');
    expect(screen.queryByText(/Isso não parece um e-mail/)).toBeNull();
  });

  it('telefone com ramal: abrir não grava e o campo fica sem máscara, com aviso', () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ contact_phone: '(11) 3333-4444 ramal 21' }} />);
    expect(campo('Telefone').value).toBe('(11) 3333-4444 ramal 21');
    expect(screen.getByText('Esse telefone tem mais de um número ou ramal. Ele aparece no site do jeito que está escrito.')).toBeTruthy();
    expect(espiao).not.toHaveBeenCalled();
  });

  it('telefone com dois números: abrir não grava e nada é cortado', () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ contact_phone: '(11) 3333-4444 / (11) 99999-8888' }} />);
    expect(campo('Telefone').value).toBe('(11) 3333-4444 / (11) 99999-8888');
    expect(espiao).not.toHaveBeenCalled();
  });

  it('telefone sem máscara: o que a pessoa digita grava do jeito que está escrito', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ contact_phone: '0800 123 4567' }} />);
    await userEvent.type(campo('Telefone'), ' (SAC)');
    expect(espiao).toHaveBeenLastCalledWith({ contact_phone: '0800 123 4567 (SAC)' });
    // Continua sem máscara enquanto a pessoa digita.
    expect(campo('Telefone').value).toBe('0800 123 4567 (SAC)');
  });

  it('WhatsApp sem o 55: avisa, não corrige sozinho e abrir não grava', () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ contact_whatsapp: '11987654321' }} />);
    const aviso = screen.getByText(/Falta o código do país \(55\)/);
    expect(espiao).not.toHaveBeenCalled();
    expect(campo('WhatsApp').getAttribute('aria-describedby')).toContain(aviso.id);
  });

  it('WhatsApp com o 55 não tem aviso e a ajuda está ligada ao campo', () => {
    render(<Montar inicial={{ contact_whatsapp: '5511987654321' }} />);
    expect(screen.queryByText(/Falta o código do país/)).toBeNull();
    expect(campo('WhatsApp').getAttribute('aria-describedby')).toBe('dados-whatsapp-ajuda');
  });
});
