import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaBusca from './TelaBusca';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { HOME_FABRICA, TITULO_CAPA_FABRICA } from '@/features/siteBuilder/public/homeConfig';

function Montar({ espiao }: { espiao: (f: Partial<SiteFormData>) => void }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', home: HOME_FABRICA });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaBusca site={null} siteForm={form} setF={setF} />;
}

describe('TelaBusca', () => {
  it('título de fábrica aparece como dica e campo vazio grava null', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByLabelText('Título') as HTMLInputElement;
    expect(campo.value).toBe('');
    expect(campo.placeholder).toBe(TITULO_CAPA_FABRICA);
    await userEvent.type(campo, 'x');
    expect(espiao).toHaveBeenLastCalledWith({ home: { ...HOME_FABRICA, search: { ...HOME_FABRICA.search, title: 'x' } } });
    await userEvent.clear(campo);
    expect(espiao).toHaveBeenLastCalledWith({ home: { ...HOME_FABRICA, search: { ...HOME_FABRICA.search, title: null } } });
  });

  it('desmarcar Alugar manda o home inteiro com a aba desligada', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByLabelText('Alugar'));
    expect(espiao).toHaveBeenCalledWith({
      home: { ...HOME_FABRICA, search: { ...HOME_FABRICA.search, tabs: { sale: true, rent: false, launch: true } } },
    });
  });

  it('marcar Faixa de preço põe price nos campos na ordem fixa', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByLabelText('Faixa de preço'));
    expect(espiao).toHaveBeenCalledWith({
      home: { ...HOME_FABRICA, search: { ...HOME_FABRICA.search, fields: ['type', 'city', 'neighborhood', 'price', 'bedrooms', 'code'] } },
    });
  });
});
