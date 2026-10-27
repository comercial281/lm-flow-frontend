import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { useState } from 'react';
import type { TemplateVariable } from '@/types/messageFunnels';
import { BOOK_HELP } from '@/features/flowAutomations/book';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import MessageSequenceEditor, { newSequenceItem, type SequenceDraftItem } from './MessageSequenceEditor';

// Editor de sequência compartilhado (Disparo em massa, Funis de mensagem,
// Agendar envio e, desde o PR 8 do redesenho, o bloco Mensagem do construtor).

const VARS: TemplateVariable[] = [{ token: 'nome', placeholder: '{{nome}}', label: 'Nome' }];

const item = (patch: Partial<SequenceDraftItem>): SequenceDraftItem => ({ ...newSequenceItem(), ...patch });

type Extra = Partial<React.ComponentProps<typeof MessageSequenceEditor>>;

function Harness({ initial, onItems, extra = {} }: {
  initial: SequenceDraftItem[]; onItems?: (items: SequenceDraftItem[]) => void; extra?: Extra;
}) {
  const [items, setItems] = useState(initial);
  return (
    <MessageSequenceEditor
      items={items}
      onChange={next => {
        setItems(next);
        onItems?.(next);
      }}
      variables={VARS}
      {...extra}
    />
  );
}

describe('MessageSequenceEditor', () => {
  it('sem as props novas, igual a hoje: os botões de + Adicionar e as variáveis de dentro', () => {
    render(<Harness initial={[item({ uiKey: 't', text_content: 'Oi' })]} />);
    expect(screen.getByText('+ Adicionar:')).toBeInTheDocument();
    for (const label of ['Texto', 'Áudio', 'Imagem', 'Vídeo', 'Documento', 'Aguardar', 'Contato', 'Figurinha']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /Book do imóvel/ })).not.toBeInTheDocument();
    expect(screen.getByText('Inserir variável:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover pra cima' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicar' })).toBeInTheDocument();
    // O texto não tem troca de tipo (só a mídia tem, como sempre).
    expect(screen.queryByRole('combobox', { name: 'Tipo do item' })).not.toBeInTheDocument();
  });

  it('variáveis no padrão do construtor: Nome à vista, o resto em "Mais variáveis"', () => {
    const vars: TemplateVariable[] = [
      { token: 'nome', placeholder: '{{nome}}', label: 'Nome', builtin: true },
      { token: 'telefone', placeholder: '{{telefone}}', label: 'Telefone', builtin: true },
      { token: 'tem_creci', placeholder: '{{tem_creci}}', label: 'Tem Creci', builtin: false },
    ];
    const onItems = vi.fn();
    render(<Harness initial={[item({ uiKey: 't', text_content: 'Oi ' })]} onItems={onItems} extra={{ variables: vars }} />);
    expect(screen.getByRole('button', { name: 'Nome {{nome}}' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Telefone/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mais variáveis' }));
    expect(screen.getByText('Do lead')).toBeInTheDocument();
    expect(screen.getByText('Da imobiliária')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tem Creci/ }));
    expect((onItems.mock.calls.at(-1)![0] as SequenceDraftItem[])[0].text_content).toContain('{{tem_creci}}');
  });

  it('com extraKinds mostra + Book do imóvel e o item só tem legenda', () => {
    const onItems = vi.fn();
    render(<Harness initial={[item({ uiKey: 't', text_content: 'Oi' })]} onItems={onItems} extra={{ extraKinds: ['property_book'] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Book do imóvel' }));

    const added = onItems.mock.calls.at(-1)![0] as SequenceDraftItem[];
    expect(added).toHaveLength(2);
    expect(added[1].kind).toBe('property_book');

    const legenda = screen.getByPlaceholderText('Legenda (opcional)');
    expect(screen.getByText(BOOK_HELP)).toBeInTheDocument();
    // Nada de anexar arquivo nem caixa de texto no item do book.
    expect(screen.queryByRole('button', { name: /Anexar/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox').filter(el => el.tagName === 'TEXTAREA')).toHaveLength(1);

    fireEvent.change(legenda, { target: { value: 'Segue o book' } });
    expect((onItems.mock.calls.at(-1)![0] as SequenceDraftItem[])[1].media_caption).toBe('Segue o book');
  });

  it('com variableBar usa a barra de fora no texto e na legenda', () => {
    const onItems = vi.fn();
    const variableBar = vi.fn((p: { value: string; onChange: (next: string) => void }) => (
      <button type="button" onClick={() => p.onChange(`${p.value}{{nome}}`)}>barra de fora</button>
    ));
    render(
      <Harness
        initial={[
          item({ uiKey: 't', text_content: 'Oi ' }),
          item({ uiKey: 'f', kind: 'image', text_content: null, media_url: 'https://cdn/foto.jpg', media_filename: 'foto.jpg', media_caption: 'Fachada' }),
        ]}
        onItems={onItems}
        extra={{ variableBar }}
      />,
    );
    expect(screen.queryByText('Inserir variável:')).not.toBeInTheDocument();
    const barras = screen.getAllByRole('button', { name: 'barra de fora' });
    expect(barras).toHaveLength(2);
    const valores = variableBar.mock.calls.map(c => c[0].value);
    expect(valores).toContain('Oi ');
    expect(valores).toContain('Fachada');

    fireEvent.click(barras[0]);
    expect((onItems.mock.calls.at(-1)![0] as SequenceDraftItem[])[0].text_content).toBe('Oi {{nome}}');
    fireEvent.click(screen.getAllByRole('button', { name: 'barra de fora' })[1]);
    expect((onItems.mock.calls.at(-1)![0] as SequenceDraftItem[])[1].media_caption).toBe('Fachada{{nome}}');
  });

  it('com variableBar a legenda do book também usa a barra de fora', () => {
    const variableBar = vi.fn(() => <span>barra de fora</span>);
    render(
      <Harness
        initial={[item({ uiKey: 'b', kind: 'property_book', text_content: null, media_caption: 'Segue' })]}
        extra={{ variableBar, extraKinds: ['property_book'] }}
      />,
    );
    expect(screen.getByText('barra de fora')).toBeInTheDocument();
    expect(variableBar).toHaveBeenCalledWith(expect.objectContaining({ value: 'Segue' }));
  });

  it('guided esconde adicionar, duplicar e mover, e a espera não sai', () => {
    const onItems = vi.fn();
    render(
      <Harness
        initial={[
          item({ uiKey: 't', text_content: 'Oi' }),
          item({ uiKey: 'w', kind: 'delay', text_content: null, delay_seconds: 5 }),
          item({ uiKey: 'f', kind: 'image', text_content: null, media_url: 'https://cdn/foto.jpg', media_filename: 'foto.jpg' }),
        ]}
        onItems={onItems}
        extra={{ guided: true, extraKinds: ['property_book'] }}
      />,
    );
    expect(screen.queryByText('+ Adicionar:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book do imóvel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mover pra cima' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mover pra baixo' })).not.toBeInTheDocument();
    // Só as duas mensagens têm lixeira; a espera não.
    expect(screen.getAllByRole('button', { name: 'Remover' })).toHaveLength(2);
    // A espera só muda o tempo.
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '12' } });
    expect((onItems.mock.calls.at(-1)![0] as SequenceDraftItem[])[1]).toMatchObject({ kind: 'delay', delay_seconds: 12 });
  });

  it('guided: a mensagem troca de tipo (texto vira foto), a espera não tem troca', () => {
    const onItems = vi.fn();
    render(
      <Harness
        initial={[
          item({ uiKey: 't', text_content: 'Oi' }),
          item({ uiKey: 'w', kind: 'delay', text_content: null, delay_seconds: 5 }),
        ]}
        onItems={onItems}
        extra={{ guided: true }}
      />,
    );
    const tipos = screen.getAllByRole('combobox', { name: 'Tipo do item' });
    expect(tipos).toHaveLength(1);
    expect(within(tipos[0]).queryByRole('option', { name: 'Aguardar' })).not.toBeInTheDocument();
    fireEvent.change(tipos[0], { target: { value: 'image' } });
    const next = onItems.mock.calls.at(-1)![0] as SequenceDraftItem[];
    // O texto vira a legenda da foto (não se perde na troca).
    expect(next[0]).toMatchObject({ uiKey: 't', kind: 'image', media_url: null, media_caption: 'Oi' });
    expect(screen.getByRole('button', { name: /Anexar imagem/ })).toBeInTheDocument();
  });

  it('o arquivo que termina de subir não apaga o que foi digitado em outro item enquanto subia', async () => {
    const onItems = vi.fn();
    let finish!: (value: { url: string }) => void;
    const uploadMedia = vi.fn(() => new Promise<{ url: string }>(resolve => { finish = resolve; }));
    const { container } = render(
      <Harness
        initial={[
          item({ uiKey: 't', text_content: 'Oi' }),
          item({ uiKey: 'f', kind: 'image', text_content: null }),
        ]}
        onItems={onItems}
        extra={{ uploadMedia }}
      />,
    );
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(uploadMedia).toHaveBeenCalledWith(file);
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Oi, tudo bem?' } });
    await act(async () => {
      finish({ url: 'https://cdn/foto.jpg' });
    });
    const last = onItems.mock.calls.at(-1)![0] as SequenceDraftItem[];
    expect(last[0]).toMatchObject({ uiKey: 't', text_content: 'Oi, tudo bem?' });
    expect(last[1]).toMatchObject({ uiKey: 'f', media_url: 'https://cdn/foto.jpg', media_filename: 'foto.jpg' });
  });

  it('guided: a última mensagem não sai (o servidor recusa bloco só com espera)', () => {
    render(
      <Harness
        initial={[
          item({ uiKey: 't', text_content: 'Oi' }),
          item({ uiKey: 'w', kind: 'delay', text_content: null, delay_seconds: 5 }),
        ]}
        extra={{ guided: true }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remover' })).toBeDisabled();
  });
});
