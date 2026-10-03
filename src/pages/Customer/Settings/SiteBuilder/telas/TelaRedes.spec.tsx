import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaRedes from './TelaRedes';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';

function Montar({ espiao }: { espiao: (f: Partial<SiteFormData>) => void }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', social_links: {} });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaRedes site={null} siteForm={form} setF={setF} />;
}

describe('TelaRedes', () => {
  it('digitar já marca o formulário como alterado; ao sair do campo vira link', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByLabelText('Instagram') as HTMLInputElement;
    await userEvent.type(campo, '@imob');
    expect(espiao).toHaveBeenLastCalledWith({ social_links: { instagram: '@imob' } });
    expect(campo.value).toBe('@imob');
    fireEvent.blur(campo);
    expect(espiao).toHaveBeenLastCalledWith({ social_links: { instagram: 'https://instagram.com/imob' } });
    expect(campo.value).toBe('https://instagram.com/imob');
  });

  it('apagar o campo tira a rede da lista ao sair', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByLabelText('Instagram');
    await userEvent.type(campo, 'x');
    await userEvent.clear(campo);
    fireEvent.blur(campo);
    expect(espiao).toHaveBeenLastCalledWith({ social_links: {} });
  });
});
