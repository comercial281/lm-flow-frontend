import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Secao, Secoes } from './Secao';
import { Campo, CampoTexto, CampoTextoLongo } from './Campo';
import EnvioDeImagem from './EnvioDeImagem';

describe('Secao', () => {
  it('mostra o título, a frase e os campos', () => {
    render(
      <Secoes>
        <Secao titulo="Contato" descricao="Aparece no rodapé do site." acao={<button type="button">Ligar</button>}>
          <p>campos aqui</p>
        </Secao>
      </Secoes>,
    );
    expect(screen.getByRole('heading', { name: 'Contato' })).toBeTruthy();
    expect(screen.getByText('Aparece no rodapé do site.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ligar' })).toBeTruthy();
    expect(screen.getByText('campos aqui')).toBeTruthy();
  });
});

describe('Campo', () => {
  it('o rótulo fica ligado ao campo, com ajuda e erro', () => {
    render(<CampoTexto id="c-email" rotulo="E-mail" valor="" aoMudar={() => {}}
      ajuda="Aparece no rodapé." erro="Falta o @." />);
    const campo = screen.getByLabelText('E-mail');
    expect(campo.tagName).toBe('INPUT');
    expect(screen.getByText('Aparece no rodapé.')).toBeTruthy();
    expect(screen.getByText('Falta o @.')).toBeTruthy();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe('c-email-ajuda c-email-erro');
  });

  it('o campo é grande (≈ 44px) e devolve o texto digitado', async () => {
    const aoMudar = vi.fn();
    function Montar() {
      const [v, setV] = useState('');
      return <CampoTexto id="c-nome" rotulo="Nome" valor={v} aoMudar={x => { aoMudar(x); setV(x); }} />;
    }
    render(<Montar />);
    const campo = screen.getByLabelText('Nome');
    expect(campo.className).toContain('h-11');
    await userEvent.type(campo, 'Imob');
    expect(aoMudar).toHaveBeenLastCalledWith('Imob');
  });

  it('variante de texto longo usa textarea', () => {
    render(<CampoTextoLongo id="c-end" rotulo="Endereço" valor="Rua A" aoMudar={() => {}} rows={2} />);
    const campo = screen.getByLabelText('Endereço') as HTMLTextAreaElement;
    expect(campo.tagName).toBe('TEXTAREA');
    expect(campo.value).toBe('Rua A');
  });

  it('aviso âmbar aparece sem erro', () => {
    render(<Campo id="x" rotulo="Algo" aviso="Confira."><input id="x" /></Campo>);
    expect(screen.getByLabelText('Algo')).toBeTruthy();
    expect(screen.getByText('Confira.').className).toContain('amber');
  });
});

const arquivo = (nome = 'logo.png', tipo = 'image/png') => new File(['x'], nome, { type: tipo });

function Envio({ enviar = vi.fn().mockResolvedValue(undefined), aoRemover = vi.fn(), url = null as string | null }) {
  return (
    <EnvioDeImagem rotulo="Logo do site" url={url} enviar={enviar} aoRemover={aoRemover}
      confirmacao={{ titulo: 'Remover o logo', descricao: 'O site fica sem logo.' }} />
  );
}

describe('EnvioDeImagem', () => {
  it('vazia: clicar na caixa abre o seletor de arquivo', async () => {
    render(<Envio />);
    const input = screen.getByLabelText('Escolher arquivo: logo do site') as HTMLInputElement;
    const clique = vi.spyOn(input, 'click');
    expect(screen.getByText('Arraste a imagem aqui ou clique para enviar')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar logo do site' }));
    expect(clique).toHaveBeenCalled();
    expect(input.accept).not.toContain('svg');
    // A frase de formatos aceitos é a descrição do botão.
    const botao = screen.getByRole('button', { name: 'Enviar logo do site' });
    expect(document.getElementById(botao.getAttribute('aria-describedby')!)?.textContent).toBe('PNG, JPG ou WEBP, até 8 MB.');
  });

  it('escolher o arquivo chama o envio', async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);
    render(<Envio enviar={enviar} />);
    const f = arquivo();
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: logo do site'), f);
    await waitFor(() => expect(enviar).toHaveBeenCalledWith(f));
  });

  it('soltar o arquivo na caixa chama o envio', async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);
    render(<Envio enviar={enviar} />);
    const f = arquivo('icone.webp', 'image/webp');
    fireEvent.drop(screen.getByRole('button', { name: 'Enviar logo do site' }), { dataTransfer: { files: [f] } });
    await waitFor(() => expect(enviar).toHaveBeenCalledWith(f));
  });

  it('enquanto sobe, mostra Enviando...', async () => {
    let terminar: () => void = () => {};
    const enviar = vi.fn(() => new Promise<void>(r => { terminar = r; }));
    render(<Envio enviar={enviar} />);
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: logo do site'), arquivo());
    expect(await screen.findByText('Enviando...')).toBeTruthy();
    terminar();
    await waitFor(() => expect(screen.queryByText('Enviando...')).toBeNull());
  });

  it('com imagem: mostra a imagem inteira, Trocar e Remover', () => {
    render(<Envio url="https://cdn/logo.png" />);
    const img = screen.getByRole('img', { name: 'Logo do site' }) as HTMLImageElement;
    expect(img.src).toBe('https://cdn/logo.png');
    expect(img.className).toContain('object-contain');
    expect(screen.getByRole('button', { name: 'Trocar logo do site' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remover logo do site' })).toBeTruthy();
  });

  it('Remover pede confirmação e só então grava', async () => {
    const aoRemover = vi.fn();
    render(<Envio url="https://cdn/logo.png" aoRemover={aoRemover} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remover logo do site' }));
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText('O site fica sem logo.')).toBeTruthy();
    expect(aoRemover).not.toHaveBeenCalled();
    await userEvent.click(dialogo.getByRole('button', { name: 'Remover' }));
    expect(aoRemover).toHaveBeenCalledTimes(1);
  });

  it('Cancelar na confirmação não remove', async () => {
    const aoRemover = vi.fn();
    render(<Envio url="https://cdn/logo.png" aoRemover={aoRemover} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remover logo do site' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(aoRemover).not.toHaveBeenCalled();
  });

  it('falha no envio mostra o aviso', async () => {
    render(<Envio enviar={vi.fn().mockRejectedValue(new Error('500'))} />);
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: logo do site'), arquivo());
    expect(await screen.findByText('Não foi possível enviar a imagem. Tente de novo.')).toBeTruthy();
  });

  it('arquivo que não é imagem aceita é recusado sem enviar', async () => {
    const enviar = vi.fn();
    render(<Envio enviar={enviar} />);
    fireEvent.drop(screen.getByRole('button', { name: 'Enviar logo do site' }), {
      dataTransfer: { files: [arquivo('contrato.pdf', 'application/pdf')] },
    });
    expect(await screen.findByText('Use uma imagem PNG, JPG ou WEBP.')).toBeTruthy();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('SVG é recusado (o site não mostraria)', async () => {
    const enviar = vi.fn();
    render(<Envio enviar={enviar} />);
    fireEvent.drop(screen.getByRole('button', { name: 'Enviar logo do site' }), {
      dataTransfer: { files: [arquivo('logo.svg', 'image/svg+xml')] },
    });
    expect(await screen.findByText('Use uma imagem PNG, JPG ou WEBP.')).toBeTruthy();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('arquivo maior que o limite é recusado sem enviar', async () => {
    const enviar = vi.fn();
    render(<Envio enviar={enviar} />);
    const grande = arquivo();
    Object.defineProperty(grande, 'size', { value: 9 * 1024 * 1024 });
    fireEvent.drop(screen.getByRole('button', { name: 'Enviar logo do site' }), { dataTransfer: { files: [grande] } });
    expect(await screen.findByText('A imagem passa de 8 MB. Use uma menor.')).toBeTruthy();
    expect(enviar).not.toHaveBeenCalled();
  });
});
