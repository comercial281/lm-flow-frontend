// src/components/base/Seletor.spec.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Seletor } from './Seletor';

// O Select do design system é Radix: o jsdom não tem estas três APIs de
// ponteiro, e sem elas abrir a lista estoura (mesmo polyfill do
// CollaboratorsForm.owner.spec).
beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// Simula a tela: toque (celular) ou ponteiro fino (computador).
let avisar: (() => void) | null = null;
let toque = false;
function simularTela(comToque: boolean) {
  toque = comToque;
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() { return toque; },
    media: '(pointer: coarse)',
    addEventListener: (_: string, cb: () => void) => { avisar = cb; },
    removeEventListener: () => { avisar = null; },
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => {
  // @ts-expect-error: o jsdom não tem matchMedia; voltamos a não ter.
  delete window.matchMedia;
  avisar = null;
});

function Filtro({ inicial = '', onEscolha = (_: string) => {} }) {
  const [v, setV] = useState(inicial);
  return (
    <>
      <label htmlFor="tipo">Tipo</label>
      <Seletor id="tipo" value={v} onChange={e => { setV(e.target.value); onEscolha(e.target.value); }}>
        <option value="">Tipo de negócio</option>
        <option value="sale">Venda</option>
        <option value="rent">Locação</option>
      </Seletor>
    </>
  );
}

describe('Seletor no celular (e sem matchMedia)', () => {
  it('sem matchMedia desenha o select nativo e escolhe como sempre', async () => {
    const escolha = vi.fn();
    render(<Filtro onEscolha={escolha} />);
    const caixa = screen.getByLabelText('Tipo');
    expect(caixa.tagName).toBe('SELECT');
    await userEvent.selectOptions(caixa, 'rent');
    expect(escolha).toHaveBeenCalledWith('rent');
  });

  it('com toque também é nativo', () => {
    simularTela(true);
    render(<Filtro />);
    expect(screen.getByLabelText('Tipo').tagName).toBe('SELECT');
  });

  it('bare no nativo devolve o select com a className da tela, sem invólucro', () => {
    const { container } = render(
      <Seletor bare value="a" onChange={() => {}} className="text-xs pl-2">
        <option value="a">A</option>
      </Seletor>,
    );
    const select = container.querySelector('select')!;
    expect(select.className).toBe('text-xs pl-2');
    expect(select.parentElement).toBe(container);
  });

  it('nativo: a seta resiste a style com o atalho background', () => {
    const { container } = render(
      <Seletor value="a" onChange={() => {}} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid red' }}>
        <option value="a">A</option>
      </Seletor>,
    );
    const select = container.querySelector('select')!;
    expect(select.style.backgroundImage).toContain('data:image/svg+xml');
    expect(select.style.backgroundColor).toBe('rgba(255, 255, 255, 0.05)');
  });

  it('escuro no nativo não vaza para o <select> (sem aviso do React)', () => {
    const aviso = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <>
        <Seletor escuro value="a" onChange={() => {}}><option value="a">A</option></Seletor>
        <Seletor escuro bare value="a" onChange={() => {}}><option value="a">A</option></Seletor>
      </>,
    );
    expect(container.querySelectorAll('select')).toHaveLength(2);
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });

  it('nativo sem bare é um select só, com a className da tela e a seta de fundo', () => {
    const { container } = render(
      <Seletor value="a" onChange={() => {}} className="w-full flex-1"><option value="a">A</option></Seletor>,
    );
    const select = container.firstElementChild as HTMLElement;
    expect(select.tagName).toBe('SELECT');
    expect(container.children).toHaveLength(1);
    expect(select.className.split(/\s+/)).toEqual(expect.arrayContaining(['w-full', 'flex-1', 'pr-8']));
    expect(select.style.backgroundImage).toContain('data:image/svg+xml');
  });
});

describe('Seletor no computador', () => {
  beforeEach(() => simularTela(false));

  it('desenha a lista do produto e mostra a opção vazia pelo rótulo', () => {
    render(<Filtro />);
    const caixa = screen.getByLabelText('Tipo');
    expect(caixa.tagName).toBe('BUTTON');
    expect(caixa).toHaveTextContent('Tipo de negócio');
  });

  it('escolher devolve e.target.value; voltar pra vazia devolve ""', async () => {
    const escolha = vi.fn();
    render(<Filtro onEscolha={escolha} />);
    await userEvent.click(screen.getByLabelText('Tipo'));
    await userEvent.click(await screen.findByRole('option', { name: 'Locação' }));
    expect(escolha).toHaveBeenLastCalledWith('rent');
    expect(screen.getByLabelText('Tipo')).toHaveTextContent('Locação');

    await userEvent.click(screen.getByLabelText('Tipo'));
    await userEvent.click(await screen.findByRole('option', { name: 'Tipo de negócio' }));
    expect(escolha).toHaveBeenLastCalledWith('');
  });

  it('valor numérico mostra o rótulo e devolve texto', async () => {
    const mudou = vi.fn();
    render(
      <Seletor aria-label="Dia" value={2} onChange={e => mudou(e.target.value)}>
        <option value={1}>Segunda</option>
        <option value={2}>Terça</option>
      </Seletor>,
    );
    expect(screen.getByLabelText('Dia')).toHaveTextContent('Terça');
    await userEvent.click(screen.getByLabelText('Dia'));
    await userEvent.click(await screen.findByRole('option', { name: 'Segunda' }));
    expect(mudou).toHaveBeenCalledWith('1');
  });

  it('valor que não casa mostra a primeira opção e não dispara onChange', () => {
    const mudou = vi.fn();
    render(
      <Seletor aria-label="Número" value="sumiu" onChange={mudou}>
        <option value="a">Loja</option>
        <option value="b">Centro</option>
      </Seletor>,
    );
    expect(screen.getByLabelText('Número')).toHaveTextContent('Loja');
    expect(mudou).not.toHaveBeenCalled();
  });

  it('optgroup vira grupo com título; opção desligada não escolhe', async () => {
    const mudou = vi.fn();
    render(
      <Seletor aria-label="Quem" value="" onChange={e => mudou(e.target.value)}>
        <option value="">Ninguém</option>
        <optgroup label="Roletas">
          <option value="r1">Roleta Centro</option>
          <option value="r2" disabled>Roleta Pausada</option>
        </optgroup>
      </Seletor>,
    );
    await userEvent.click(screen.getByLabelText('Quem'));
    expect(await screen.findByText('Roletas')).toBeInTheDocument();
    const pausada = screen.getByRole('option', { name: 'Roleta Pausada' });
    expect(pausada).toHaveAttribute('data-disabled');
    await userEvent.click(screen.getByRole('option', { name: 'Roleta Centro' }));
    expect(mudou).toHaveBeenCalledWith('r1');
  });

  it('a lista abre por cima de modal e mapa', async () => {
    render(<Filtro />);
    await userEvent.click(screen.getByLabelText('Tipo'));
    const lista = await screen.findByRole('listbox');
    expect(lista.className).toContain('z-[1200]');
  });

  it('altura: h-9 por padrão e a classe da tela troca', () => {
    render(
      <>
        <Seletor aria-label="Padrão" value="a" onChange={() => {}}><option value="a">A</option></Seletor>
        <Seletor aria-label="Miúda" value="a" onChange={() => {}} className="h-7 text-xs"><option value="a">A</option></Seletor>
      </>,
    );
    // Compara por classe inteira: "data-[size=default]:h-9" do design system
    // contém "h-9" como pedaço de texto, mas não é a classe h-9.
    const classes = (nome: string) => screen.getByLabelText(nome).className.split(/\s+/);
    expect(classes('Padrão')).toContain('h-9');
    expect(screen.getByLabelText('Padrão')).toHaveAttribute('data-size', 'livre');
    expect(classes('Miúda')).toContain('h-7');
    expect(classes('Miúda')).not.toContain('h-9');
  });

  it('bare: sem a seta do design system, com a className da tela', () => {
    render(
      <Seletor bare aria-label="Status" value="a" onChange={() => {}} className="text-[10px] pl-1.5">
        <option value="a">Novo</option>
      </Seletor>,
    );
    const caixa = screen.getByLabelText('Status');
    expect(caixa.className).toContain('text-[10px]');
    expect(caixa.className).toContain('[&>svg:last-child]:hidden');
  });

  it('bare: no escuro o hover mantém o fundo colorido de quem chama', () => {
    render(
      <Seletor bare aria-label="Status" value="a" onChange={() => {}}
        className="rounded-md bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
        <option value="a">Visto</option>
      </Seletor>,
    );
    const classes = screen.getByLabelText('Status').className.split(/\s+/);
    expect(classes).toContain('dark:hover:bg-sky-900/30');
    expect(classes).not.toContain('dark:hover:bg-input/50');
    expect(classes).not.toContain('dark:hover:bg-transparent');
  });

  it('bare sem fundo: hover escuro transparente, sem o do design system', () => {
    render(
      <Seletor bare aria-label="Campo" value="a" onChange={() => {}} className="lmf-campo-controle">
        <option value="a">A</option>
      </Seletor>,
    );
    const classes = screen.getByLabelText('Campo').className.split(/\s+/);
    expect(classes).toContain('dark:hover:bg-transparent');
    expect(classes).not.toContain('dark:hover:bg-input/50');
  });

  it('escuro: a lista aberta sai no tema escuro, mesmo com o app no claro', async () => {
    render(
      <Seletor escuro aria-label="Canal" value="" onChange={() => {}}>
        <option value="">Selecionar...</option>
        <option value="wa">WhatsApp</option>
      </Seletor>,
    );
    await userEvent.click(screen.getByLabelText('Canal'));
    const lista = await screen.findByRole('listbox');
    expect(lista).toHaveClass('dark');
    expect(lista.className).toContain('z-[1200]');
  });

  it('sem escuro, a lista segue o tema do app', async () => {
    render(<Filtro />);
    await userEvent.click(screen.getByLabelText('Tipo'));
    expect(await screen.findByRole('listbox')).not.toHaveClass('dark');
  });

  it('desligado não abre', async () => {
    render(<Seletor aria-label="X" value="a" onChange={() => {}} disabled><option value="a">A</option></Seletor>);
    expect(screen.getByLabelText('X')).toBeDisabled();
    await userEvent.click(screen.getByLabelText('X'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('troca de modo com a tela aberta (iPad que conecta mouse)', () => {
    render(<Filtro />);
    expect(screen.getByLabelText('Tipo').tagName).toBe('BUTTON');
    act(() => { toque = true; avisar?.(); });
    expect(screen.getByLabelText('Tipo').tagName).toBe('SELECT');
  });

  // Formulário enviado pelo navegador (FormData, validação nativa): tem que
  // receber o mesmo que o <select> mandaria — nunca o valor interno da opção vazia.
  function Formulario({ valor, obrigatorio = false }: { valor: string; obrigatorio?: boolean }) {
    return (
      <form data-testid="form">
        <Seletor aria-label="Tipo" name="tipo" required={obrigatorio} value={valor} onChange={() => {}}>
          <option value="">Tipo de negócio</option>
          <option value="sale">Venda</option>
          <optgroup label="Outros"><option value="rent">Locação</option></optgroup>
        </Seletor>
      </form>
    );
  }
  const form = () => screen.getByTestId('form') as HTMLFormElement;

  it('no envio pelo navegador, a opção vazia vai como "" e a escolhida pelo valor', () => {
    const { rerender } = render(<Formulario valor="" />);
    expect(new FormData(form()).getAll('tipo')).toEqual(['']);
    rerender(<Formulario valor="rent" />);
    expect(new FormData(form()).getAll('tipo')).toEqual(['rent']);
  });

  it('obrigatório barra a opção vazia, como o nativo', () => {
    const { rerender } = render(<Formulario valor="" obrigatorio />);
    expect(form().checkValidity()).toBe(false);
    rerender(<Formulario valor="sale" obrigatorio />);
    expect(form().checkValidity()).toBe(true);
  });
});
