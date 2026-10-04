import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { useRef, useState } from 'react';

// Automações · sprint 4 (04/10/2026), seção A: as peças do layout novo do
// construtor, uma a uma.

vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn() },
}));

import { FlowBlocksPanel } from './FlowBlocksPanel';
import { FlowSidePanel } from './FlowSidePanel';
import { VariableChipBar } from './VariableChipBar';
import { PEDIDO_DESCARTAR_PAINEL, useSidePanel } from './useSidePanel';
import { readBlocksOpen, saveBlocksOpen } from '@/features/flowAutomations/blocksPanelState';

const originalMatchMedia = window.matchMedia;
function screenWidth(mobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('painel Blocos', () => {
  it('mostra as quatro seções e filtra pela busca, sem ligar pra acento', () => {
    render(<FlowBlocksPanel onPick={() => {}} onClose={() => {}} />);
    ['Mensagem pro lead', 'Lead', 'Avisos', 'Controle'].forEach(section => {
      expect(screen.getByRole('region', { name: section })).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Buscar blocos'), { target: { value: 'audio' } });
    expect(screen.getByRole('button', { name: /Mandar áudio/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Esperar/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Buscar blocos'), { target: { value: 'xyz' } });
    expect(screen.getByText('Nenhum bloco com esse nome.')).toBeTruthy();
  });

  it('clicar escolhe o bloco; o X fecha', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<FlowBlocksPanel onPick={onPick} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Aguardar resposta/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kind: 'wait_for_reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar os blocos' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('lembra se ficou aberto ou fechado', () => {
    saveBlocksOpen(false);
    expect(readBlocksOpen()).toBe(false);
    saveBlocksOpen(true);
    expect(readBlocksOpen()).toBe(true);
  });
});

describe('painel lateral', () => {
  it('no computador fica ao lado do canvas; no celular, tela cheia', () => {
    screenWidth(false);
    const { unmount } = render(<FlowSidePanel title="Esperar" onClose={() => {}}><p>campos</p></FlowSidePanel>);
    expect(screen.getByRole('dialog').getAttribute('data-layout')).toBe('lateral');
    expect(screen.getByRole('dialog').className).toContain('w-[420px]');
    unmount();
    screenWidth(true);
    render(<FlowSidePanel title="Esperar" onClose={() => {}}><p>campos</p></FlowSidePanel>);
    expect(screen.getByRole('dialog').getAttribute('data-layout')).toBe('tela-cheia');
    expect(screen.getByRole('dialog').className).toContain('fixed inset-0');
  });

  it('o painel Blocos também vira tela cheia no celular', () => {
    screenWidth(true);
    render(<FlowBlocksPanel onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId('painel-blocos').getAttribute('data-layout')).toBe('tela-cheia');
  });

  it('cabeçalho com nome e frase; Esc e o X fecham', () => {
    const onClose = vi.fn();
    render(
      <FlowSidePanel title="Esperar" description="Segura o fluxo." onClose={onClose} footer={<button>Salvar</button>}>
        <input aria-label="campo" />
      </FlowSidePanel>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Esperar' });
    expect(within(dialog).getByText('Segura o fluxo.')).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText('campo'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o painel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('troca de painel', () => {
  it('com rascunho mexido, pergunta antes; sem, troca direto', async () => {
    const confirmar = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useSidePanel(confirmar));
    await act(async () => {
      await result.current.request({ type: 'node', id: 'a' });
    });
    expect(confirmar).not.toHaveBeenCalled();
    act(() => result.current.setDirty(true));
    await act(async () => {
      await result.current.request({ type: 'trigger' });
    });
    expect(confirmar).toHaveBeenCalledWith(PEDIDO_DESCARTAR_PAINEL);
    expect(result.current.panel).toEqual({ type: 'node', id: 'a' });
    confirmar.mockResolvedValue(true);
    await act(async () => {
      await result.current.request(null);
    });
    expect(result.current.panel).toBeNull();
    expect(result.current.dirty).toBe(false);
  });
});

function MessageBox({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <textarea aria-label="Mensagem" ref={ref} value={text} onChange={e => setText(e.target.value)} />
      <VariableChipBar targetRef={ref} value={text} onChange={setText} />
    </>
  );
}

describe('variáveis em botõezinhos', () => {
  it('um clique põe a variável onde o cursor está', () => {
    render(<MessageBox initial="Oi , tudo bem?" />);
    const box = screen.getByLabelText('Mensagem') as HTMLTextAreaElement;
    box.setSelectionRange(3, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Nome' }));
    expect(box.value).toBe('Oi {{nome}}, tudo bem?');
    fireEvent.click(screen.getByRole('button', { name: 'Corretor' }));
    expect(box.value).toContain('{{corretor}}');
  });

  it('no modo "pôr no fim" (tela de regras) só avisa quem chama', () => {
    const onInsert = vi.fn();
    render(<VariableChipBar onInsert={onInsert} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link do card' }));
    expect(onInsert).toHaveBeenCalledWith('{{link_do_card}}');
  });
});
