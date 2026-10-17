import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { useRef, useState, type ComponentProps } from 'react';

// Automações · sprint 4 (04/10/2026), seção A: as peças do layout novo do
// construtor, uma a uma.

vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn() },
}));

import { BLOCK_DRAG_TYPE, FlowBlocksMenu } from './FlowBlocksMenu';
import { FlowBlockDialog } from './FlowBlockDialog';
import { RecolherVariaveisContext, VariableChipBar } from './VariableChipBar';
import { PEDIDO_DESCARTAR_PAINEL, useSidePanel } from './useSidePanel';

const menu = (props: Partial<ComponentProps<typeof FlowBlocksMenu>> = {}) => (
  <FlowBlocksMenu open onOpenChange={() => {}} onPick={() => {}} trigger={<button>Blocos</button>} {...props} />
);

describe('lista de blocos', () => {
  it('mostra as seis seções e filtra pela busca, sem ligar pra acento', () => {
    render(menu());
    ['Mensagem', 'Lead', 'IA', 'Distribuição', 'Notificação', 'Controle'].forEach(section => {
      expect(screen.getByRole('region', { name: section })).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Buscar blocos'), { target: { value: 'audio' } });
    expect(screen.getByRole('button', { name: /Mandar áudio/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Esperar/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Buscar blocos'), { target: { value: 'xyz' } });
    expect(screen.getByText('Nenhum bloco com esse nome.')).toBeTruthy();
  });

  it('clicar escolhe o bloco; fechada, a lista não aparece e não tem botão de fechar', () => {
    const onPick = vi.fn();
    const { rerender } = render(menu({ onPick }));
    expect(screen.queryByRole('button', { name: 'Fechar os blocos' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Aguardar resposta/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kind: 'wait_for_reply' }));
    rerender(menu({ open: false }));
    expect(screen.queryByTestId('painel-blocos')).toBeNull();
  });

  it('o bloco da lista é arrastável e leva a chave no arraste', () => {
    render(menu());
    const btn = screen.getByRole('button', { name: /Aguardar resposta/ }) as HTMLButtonElement;
    expect(btn.draggable).toBe(true);
    const setData = vi.fn();
    fireEvent.dragStart(btn, { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith(BLOCK_DRAG_TYPE, 'wait_for_reply');
  });
});

describe('janela do bloco', () => {
  it('ao abrir, o foco vai pro primeiro campo de texto, não pro primeiro botão', () => {
    render(
      <FlowBlockDialog title="Mensagem" onClose={vi.fn()}>
        <button type="button">Duplicar</button>
        <textarea aria-label="Texto da mensagem" />
      </FlowBlockDialog>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Texto da mensagem'));
  });

  it('sem campo de texto, o foco fica na regra da casa (primeiro focável)', () => {
    render(
      <FlowBlockDialog title="Fim" onClose={vi.fn()}>
        <input type="text" aria-label="travado" disabled />
        <button type="button">Escolher</button>
      </FlowBlockDialog>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Escolher' }));
  });

  it('a janela do bloco abre no meio, com título, descrição e rodapé', () => {
    render(
      <FlowBlockDialog title="Esperar" description="Para o fluxo por um tempo." onClose={vi.fn()} testId="painel-do-bloco"
        footer={<button>Salvar</button>}><p>campos</p></FlowBlockDialog>,
    );
    const janela = screen.getByRole('dialog', { name: 'Esperar' });
    expect(janela).toHaveAttribute('data-testid', 'painel-do-bloco');
    expect(within(janela).getByText('Para o fluxo por um tempo.')).toBeInTheDocument();
    expect(within(janela).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(janela.getAttribute('data-layout')).toBeNull();
  });

  it('size 2xl alarga a janela', () => {
    render(<FlowBlockDialog title="Mandar WhatsApp" size="2xl" onClose={vi.fn()}><p>x</p></FlowBlockDialog>);
    expect(screen.getByRole('dialog').className).toContain('max-w-2xl');
  });

  it('Esc e o X fecham pela mesma função', () => {
    const onClose = vi.fn();
    render(<FlowBlockDialog title="Esperar" onClose={onClose}><p>x</p></FlowBlockDialog>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
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
  it('recolhida: só Nome, Corretor e Imóvel; "Mais variáveis" mostra o resto em grupos', () => {
    render(
      <RecolherVariaveisContext.Provider value>
        <VariableChipBar onInsert={vi.fn()} />
      </RecolherVariaveisContext.Provider>,
    );
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual([
      expect.stringContaining('Nome'),
      expect.stringContaining('Corretor'),
      expect.stringContaining('Imóvel'),
      'Mais variáveis',
    ]);
    const mais = screen.getByRole('button', { name: 'Mais variáveis' });
    expect(mais.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(mais);
    expect(mais.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Do lead')).toBeInTheDocument();
    expect(screen.getByText('Da visita (só nos gatilhos de visita)')).toBeInTheDocument();
    expect(screen.getByText('Do anúncio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Campanha/ })).toBeInTheDocument();
  });

  it('recolhida: variável da imobiliária fica em "Da imobiliária" e insere o código', () => {
    const onInsert = vi.fn();
    render(
      <RecolherVariaveisContext.Provider value>
        <VariableChipBar
          onInsert={onInsert}
          variables={[
            { label: 'Nome', token: '{{nome}}', group: 'lead' },
            { label: 'Empreendimento', token: '{{empreendimento}}', custom: true },
          ]}
        />
      </RecolherVariaveisContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: /Empreendimento/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mais variáveis' }));
    expect(screen.getByText('Da imobiliária')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Empreendimento/ }));
    expect(onInsert).toHaveBeenCalledWith('{{empreendimento}}');
  });

  it('fora do construtor (sem o contexto) mostra todas, como antes', () => {
    render(<VariableChipBar onInsert={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Link do card/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais variáveis' })).toBeNull();
  });
});
