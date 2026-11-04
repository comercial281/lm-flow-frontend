import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TelaGoogle from './TelaGoogle';

const comConta = { name: 'Imob', google: { indexable: false, search_console: 'AbC123_-xyzQ', bing: '', clarity: 'abcd1234ef', business_profile_url: '', creci: 'J-12345' } };

describe('TelaGoogle — contas do cliente', () => {
  it('ligar "Mostrar no Google" não apaga as contas já coladas', () => {
    const setF = vi.fn();
    render(<TelaGoogle site={null} siteForm={comConta} setF={setF} irPara={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(setF).toHaveBeenCalledWith({ google: expect.objectContaining({ indexable: true, creci: 'J-12345', search_console: 'AbC123_-xyzQ', clarity: 'abcd1234ef' }) });
  });

  it('colar a tag do Search Console grava o bloco inteiro', () => {
    const setF = vi.fn();
    render(<TelaGoogle site={null} siteForm={{ ...comConta, google: { ...comConta.google, indexable: true } }} setF={setF} irPara={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search Console (verificação do site)'), { target: { value: '<meta name="google-site-verification" content="Novo123_xyz" />' } });
    expect(setF).toHaveBeenCalledWith({ google: expect.objectContaining({ indexable: true, creci: 'J-12345', search_console: '<meta name="google-site-verification" content="Novo123_xyz" />' }) });
  });

  it('cada conta tem campo próprio e o que não dá pra ler aparece como erro', () => {
    render(<TelaGoogle site={null} siteForm={{ name: 'Imob', google: { indexable: true, creci: '<b>x</b>', business_profile_url: 'g.page/imob' } }} setF={vi.fn()} irPara={vi.fn()} />);
    expect(screen.getByLabelText('Bing (verificação do site)').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByLabelText('CRECI da imobiliária').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Perfil da Empresa no Google').getAttribute('aria-invalid')).toBe('true');
  });
});
