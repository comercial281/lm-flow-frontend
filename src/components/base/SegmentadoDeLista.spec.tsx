// src/components/base/SegmentadoDeLista.spec.tsx
// Filtro rápido de Conversas e Contatos (peça 6 do GLOSSARIO), Vidro violeta.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Archive } from 'lucide-react';
import SegmentadoDeLista from './SegmentadoDeLista';

type Id = 'todas' | 'minhas' | 'arquivadas';
const OPCOES: { id: Id; rotulo: string; icone?: typeof Archive; laranja?: boolean }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'minhas', rotulo: 'Minhas' },
  { id: 'arquivadas', rotulo: 'Arquivadas', icone: Archive, laranja: true },
];

function montar(valor: Id, aoEscolher = vi.fn()) {
  render(<SegmentadoDeLista rotulo="Filtrar conversas" opcoes={OPCOES} valor={valor} aoEscolher={aoEscolher} />);
  return aoEscolher;
}

describe('SegmentadoDeLista', () => {
  it('marca a opção ativa com aria-pressed', () => {
    montar('todas');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Minhas' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicar escolhe a opção', async () => {
    const aoEscolher = montar('todas');
    await userEvent.click(screen.getByRole('button', { name: 'Minhas' }));
    expect(aoEscolher).toHaveBeenCalledWith('minhas');
  });

  it('Arquivadas ativa fica laranja, sem degradê', () => {
    montar('arquivadas');
    const botao = screen.getByRole('button', { name: 'Arquivadas' });
    expect(botao).toHaveAttribute('data-laranja');
    expect(botao).toHaveClass('bg-orange-100', 'text-orange-700', 'dark:bg-orange-950/40', 'dark:text-orange-400');
  });

  it('o grupo tem nome pra leitor de tela', () => {
    montar('todas');
    expect(screen.getByRole('group', { name: 'Filtrar conversas' })).toHaveClass('segmentado');
  });

  it('a opção ativa (não laranja) leva o degradê da marca e o grupo tem canto de 13 px', () => {
    const css = readFileSync(resolve(__dirname, '../../styles/globals.css'), 'utf8');
    const ativa = css.slice(css.indexOf(".segmentado-opcao[aria-pressed='true']:not([data-laranja]) {"));
    expect(ativa).toMatch(/^[^}]*background-image: linear-gradient\(135deg, #4b2fe2 0%, #8c60f4 100%\)/);
    const grupo = css.slice(css.indexOf('.segmentado {'));
    expect(grupo).toMatch(/^[^}]*border-radius: 13px/);
  });
});
