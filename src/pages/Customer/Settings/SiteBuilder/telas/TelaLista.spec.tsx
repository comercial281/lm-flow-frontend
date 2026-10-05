import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaLista from './TelaLista';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { LISTA_FABRICA, type ListaConfig } from '@/features/siteBuilder/public/listaConfig';

function Montar({ espiao, lista = LISTA_FABRICA }: { espiao: (f: Partial<SiteFormData>) => void; lista?: ListaConfig }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', listing: lista });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaLista site={null} siteForm={form} setF={setF} />;
}

const ultima = (espiao: ReturnType<typeof vi.fn>): ListaConfig => espiao.mock.lastCall![0].listing;

describe('TelaLista', () => {
  it('"Ordem padrão" tem as 4 opções; escolher uma manda o listing inteiro', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} lista={{ default_sort: 'recent', card_layout: 'rows' }} />);
    const seletor = screen.getByLabelText('Ordem padrão') as HTMLSelectElement;

    expect([...seletor.options].map(o => [o.value, o.textContent])).toEqual([
      ['recent', 'Mais recentes'], ['price_asc', 'Menor preço'], ['price_desc', 'Maior preço'], ['area_desc', 'Maior área'],
    ]);
    expect(seletor.value).toBe('recent');

    await userEvent.selectOptions(seletor, 'price_desc');
    expect(ultima(espiao)).toEqual({ default_sort: 'price_desc', card_layout: 'rows' });
  });

  it('as miniaturas trocam card_layout e marcam a escolhida', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const grade = screen.getByRole('button', { name: 'Grade' });
    const linhas = screen.getByRole('button', { name: 'Linhas largas' });
    expect(grade).toHaveAttribute('aria-pressed', 'true');
    expect(linhas).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(linhas);
    expect(ultima(espiao)).toEqual({ default_sort: 'recent', card_layout: 'rows' });
    expect(linhas).toHaveAttribute('aria-pressed', 'true');
    expect(grade).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Um imóvel por linha\. Foto à esquerda, dados ao lado e preço com os botões à direita no computador \(embaixo dos dados no tablet\)/)).toBeTruthy();

    await userEvent.click(grade);
    expect(ultima(espiao)).toEqual({ default_sort: 'recent', card_layout: 'grid' });
  });

  it('sem listing no formulário (servidor velho), mostra o padrão de fábrica', () => {
    render(<TelaLista site={null} siteForm={{ name: 'Imob' }} setF={vi.fn()} />);

    expect((screen.getByLabelText('Ordem padrão') as HTMLSelectElement).value).toBe('recent');
    expect(screen.getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true');
  });
});
