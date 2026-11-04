import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IgnoredLeadForm } from '@/services/leadAds/leadAdsFormsService';
import PraResolver from './PraResolver';

const f = (extra: Partial<IgnoredLeadForm> = {}): IgnoredLeadForm => ({ form_id: 'f1', form_name: 'Castelo', lead_count: 5, recent_count: 3, last_lead_at: null, ...extra });
const props = { fichaDesligada: () => false, nomeDaPagina: () => null, aoPlugar: vi.fn() };

describe('PraResolver', () => {
  it('sem item, não desenha nada', () => {
    const { container } = render(<PraResolver {...props} formularios={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Plugar chama com o formulário da linha', () => {
    const aoPlugar = vi.fn();
    render(<PraResolver {...props} aoPlugar={aoPlugar} formularios={[f()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plugar Castelo' }));
    expect(aoPlugar).toHaveBeenCalledWith(expect.objectContaining({ form_id: 'f1' }));
  });

  it('o texto dos 2 dias só aparece com recent_count > 0', () => {
    const { rerender } = render(<PraResolver {...props} formularios={[f()]} />);
    expect(screen.getByText(/Plugue em até 2 dias/)).toBeInTheDocument();
    rerender(<PraResolver {...props} formularios={[f({ recent_count: undefined })]} />);
    expect(screen.queryByText(/Plugue em até 2 dias/)).toBeNull();
    expect(screen.getByText('5 leads esperando')).toBeInTheDocument();
  });

  it('ficha desligada ganha o selo; página só quando pedida', () => {
    render(<PraResolver {...props} fichaDesligada={() => true} nomeDaPagina={() => 'Página Um'} formularios={[f()]} />);
    expect(screen.getByText('Ficha desligada')).toBeInTheDocument();
    expect(screen.getByText('Página Um')).toBeInTheDocument();
  });

  it('nome comprido quebra dentro da linha, sem truncar', () => {
    const nome = 'Formulário '.repeat(20).trim();
    render(<PraResolver {...props} formularios={[f({ form_name: nome })]} />);
    expect(screen.getByText(nome)).toHaveClass('break-words');
  });

  it('sem permissão de criar ficha, Plugar não aparece (a lista fica só informando)', () => {
    render(<PraResolver {...props} podePlugar={false} formularios={[f()]} />);
    expect(screen.getByText('Castelo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Plugar/ })).toBeNull();
  });

  it('quem não importa leads (não é super-admin) lê que os antigos pedem o suporte da LM', () => {
    render(<PraResolver {...props} pedeSuporte formularios={[f()]} />);
    expect(screen.getByText(/Os mais antigos só entram por importação manual: peça pro suporte da LM\./)).toBeInTheDocument();
    expect(screen.getByText(/2 leads só entram por importação manual: peça pro suporte da LM/)).toBeInTheDocument();
  });

  it('super-admin não é mandado ao suporte', () => {
    render(<PraResolver {...props} formularios={[f()]} />);
    expect(screen.queryByText(/suporte da LM/)).toBeNull();
  });
});
