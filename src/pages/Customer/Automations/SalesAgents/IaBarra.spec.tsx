import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import IaBarra, { type IaBarraProps } from './IaBarra';

// As listas suspensas são Radix: abrem no pointerdown, que o fireEvent.click do
// jsdom não produz. O userEvent simula o ponteiro inteiro.
const ia = (id: string, name: string, extra: Partial<SalesAgent> = {}) =>
  ({ id, name, enabled: true, inbox_id: 'inbox-1', triggers: [], trigger_keyword: null, trigger_match_mode: 'any', ...extra }) as SalesAgent;
const VENDAS = ia('ia-1', 'IA de Vendas');
const DEMO = ia('ia-2', 'IA Demo', { inbox_id: null });

function abrir(extra: Partial<IaBarraProps> = {}) {
  const props: IaBarraProps = {
    agents: [VENDAS, DEMO], selecionada: VENDAS, situacao: { tipo: 'atendendo', frase: 'Atendendo' },
    tela: 'visao-geral', insights: true, podeCriar: true, podeExcluir: true, equipe: false, verMotor: false,
    aoIr: vi.fn(), aoTrocarIa: vi.fn(), aoCriar: vi.fn(), aoDuplicar: vi.fn(), aoExcluir: vi.fn(),
    aoTestar: vi.fn(), aoLigar: vi.fn().mockResolvedValue(undefined), travaDoLigar: null, aoCorrigirLigar: vi.fn(),
    ...extra,
  };
  render(<IaBarra {...props} />);
  return props;
}

describe('IaBarra (onda 3)', () => {
  it('só a bolinha do veredito, com a frase no title e pro leitor de tela', () => {
    abrir({ situacao: { tipo: 'parada', frase: 'Parada: falta o número' } });
    const selo = screen.getAllByRole('status')[0];
    expect(selo).toHaveAttribute('title', 'Parada: falta o número');
    expect(within(selo).getByText('Parada: falta o número')).toHaveClass('sr-only');
  });

  it('menu com 3 itens: Painel ▾, Configurar, Ensinar (Testar e Diagnóstico saíram)', () => {
    abrir();
    const menu = screen.getByRole('navigation', { name: 'Menu da IA Vendedora' });
    expect(within(menu).getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['Painel', 'Configurar', 'Ensinar']);
  });

  it('Testar é botão e abre a janela', async () => {
    const props = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Testar' }));
    expect(props.aoTestar).toHaveBeenCalled();
  });

  it('chave Ligada grava na hora', async () => {
    const props = abrir({ selecionada: ia('ia-1', 'IA de Vendas', { enabled: false }) });
    await userEvent.click(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' }));
    expect(props.aoLigar).toHaveBeenCalledWith(true);
  });

  it('Ligar travado: chave desabilitada com o motivo, e o clique leva à página que corrige', async () => {
    const props = abrir({
      selecionada: ia('ia-1', 'IA de Vendas', { enabled: false }),
      travaDoLigar: { motivo: 'Falta o número de WhatsApp.', pagina: 'canal' },
    });
    expect(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Não dá pra ligar: Falta o número de WhatsApp. Abrir Canal' }));
    expect(props.aoCorrigirLigar).toHaveBeenCalledWith('canal');
  });

  it('desligar nunca trava', () => {
    abrir({ travaDoLigar: { motivo: 'Falta o número de WhatsApp.', pagina: 'canal' } });
    expect(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' })).not.toBeDisabled();
  });

  it('"⋯": Duplicar e Excluir pra quem pode; Motor e Diagnóstico só pra equipe', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(await screen.findByRole('menuitem', { name: /Duplicar esta IA/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Motor/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Diagnóstico/ })).toBeNull();
  });

  it('equipe vê Motor e Diagnóstico no "⋯"', async () => {
    const props = abrir({ equipe: true, verMotor: true });
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Diagnóstico/ }));
    expect(props.aoIr).toHaveBeenCalledWith('diagnostico');
  });

  // Divergência 3 (ruling F5): o cliente com `ia_playbook` vê o Motor, nunca o Diagnóstico.
  it('cliente com o roteiro liberado vê o Motor, sem o Diagnóstico', async () => {
    const props = abrir({ verMotor: true });
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(screen.queryByRole('menuitem', { name: /Diagnóstico/ })).toBeNull();
    await userEvent.click(await screen.findByRole('menuitem', { name: /Motor/ }));
    expect(props.aoIr).toHaveBeenCalledWith('motor');
  });

  it('sem poder criar nem excluir, a equipe ainda tem o "⋯" (Motor e Diagnóstico)', async () => {
    abrir({ podeCriar: false, podeExcluir: false, equipe: true, verMotor: true });
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(await screen.findByRole('menuitem', { name: /Motor/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Duplicar/ })).toBeNull();
  });
});
