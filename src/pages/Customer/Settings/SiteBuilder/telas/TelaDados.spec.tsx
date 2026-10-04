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
});
