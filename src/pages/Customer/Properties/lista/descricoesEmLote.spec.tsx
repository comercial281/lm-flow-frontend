// Janela "Geração de descrições em lote": o aviso de que a descrição antiga é
// trocada, o texto "já tem descrição", o Selecionar todos e o Gerar.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Property } from '@/services/properties/propertiesService';
import JanelaDescricoesEmLote from './JanelaDescricoesEmLote';

const imovel = (id: string, code: string, description: string | null) =>
  ({ id, code, title: `Imóvel ${code}`, property_type: 'apartment', description }) as unknown as Property;

const IMOVEIS = [imovel('1', 'AP01', 'Texto antigo'), imovel('2', 'AP02', null), imovel('3', 'AP03', null)];

function Casa({ aoGerar = () => {}, onSel }: { aoGerar?: (ids: string[]) => void; onSel?: (s: Set<string>) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  onSel?.(sel);
  return (
    <JanelaDescricoesEmLote aberta aoMudarAberta={() => {}} imoveis={IMOVEIS}
      selecionados={sel} aoMudarSelecao={setSel} gerando={false} resultados={null}
      aoGerar={() => aoGerar(Array.from(sel))} />
  );
}

describe('Descrições em lote', () => {
  it('imóvel com descrição mostra "já tem descrição"', () => {
    render(<Casa />);
    expect(screen.getAllByText('já tem descrição')).toHaveLength(1);
    expect(screen.getByText('Imóvel que já tem descrição ganha uma nova no lugar.')).toBeInTheDocument();
  });

  it('Selecionar todos marca os da página', async () => {
    render(<Casa />);
    expect(screen.getByText('0 selecionados')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }));
    expect(screen.getByText('3 selecionados')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').every(c => c.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(screen.getByRole('button', { name: 'Desselecionar todos' })).toBeInTheDocument();
  });

  it('Gerar chama a ação com os selecionados', async () => {
    const aoGerar = vi.fn();
    render(<Casa aoGerar={aoGerar} />);
    expect(screen.getByRole('button', { name: /Gerar/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /AP02/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /AP03/ }));
    await userEvent.click(screen.getByRole('button', { name: /Gerar 2 descrições/ }));
    expect(aoGerar).toHaveBeenCalledWith(['2', '3']);
  });
});
