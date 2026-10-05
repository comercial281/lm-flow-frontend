import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({ uploadBook: vi.fn(), removeBook: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
const avisos = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: avisos }));
vi.mock('@/components/properties/PropertyBookDialog', () => ({
  default: ({ onClose }: { onClose: () => void }) => <div role="dialog">Diálogo do book<button onClick={onClose}>fechar</button></div>,
}));

import BlocoDoBook, { validarBook } from './BlocoDoBook';
import type { Property } from '@/services/properties/propertiesService';

const imovel = (extra: Partial<Property> = {}) => ({ id: 'p1', title: 'Residencial Sol', has_book: false, ...extra }) as Property;
const pdf = (nome = 'book.pdf') => new File(['x'], nome, { type: 'application/pdf' });
const entrada = () => screen.getByTestId('entrada-do-book') as HTMLInputElement;

function montar(props: Partial<React.ComponentProps<typeof BlocoDoBook>> = {}) {
  const aoMudarBook = vi.fn();
  const aoMudarImovel = vi.fn();
  render(<BlocoDoBook kind="development" editando={null} book={null} aoMudarBook={aoMudarBook} aoMudarImovel={aoMudarImovel} {...props} />);
  return { aoMudarBook, aoMudarImovel };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('validarBook', () => {
  it('aceita PDF e recusa outro tipo ou mais de 200 MB', () => {
    expect(validarBook(pdf())).toBeNull();
    expect(validarBook(new File(['x'], 'a.png', { type: 'image/png' }))).toMatch(/PDF/);
    const grande = pdf();
    Object.defineProperty(grande, 'size', { value: 200 * 1024 * 1024 + 1 });
    expect(validarBook(grande)).toMatch(/200 MB/);
  });
});

describe('BlocoDoBook', () => {
  it('criação de empreendimento: PDF válido vira book escolhido', () => {
    const { aoMudarBook } = montar();
    expect(screen.getByText('O book é o PDF que a IA e o corretor mandam no chat.')).toBeInTheDocument();
    const f = pdf();
    fireEvent.change(entrada(), { target: { files: [f] } });
    expect(aoMudarBook).toHaveBeenCalledWith(f);
  });

  it('arquivo não PDF e arquivo acima de 200 MB não chamam e avisam', () => {
    const { aoMudarBook } = montar();
    fireEvent.change(entrada(), { target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] } });
    const grande = pdf();
    Object.defineProperty(grande, 'size', { value: 201 * 1024 * 1024 });
    fireEvent.change(entrada(), { target: { files: [grande] } });
    expect(aoMudarBook).not.toHaveBeenCalled();
    expect(avisos.error).toHaveBeenCalledTimes(2);
  });

  it('criação com book escolhido mostra nome e tamanho e o Remover limpa', async () => {
    const f = pdf('planta.pdf');
    Object.defineProperty(f, 'size', { value: 12.3 * 1024 * 1024 });
    const { aoMudarBook } = montar({ book: f });
    expect(screen.getByText('planta.pdf')).toBeInTheDocument();
    expect(screen.getByText('12,3 MB')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(aoMudarBook).toHaveBeenCalledWith(null);
  });

  it('revenda sem book não renderiza nada', () => {
    montar({ kind: 'resale' });
    expect(screen.queryByText('Book')).not.toBeInTheDocument();
  });

  it('revenda com book: só Ver e Remover', () => {
    montar({ kind: 'resale', editando: imovel({ has_book: true, book_file_name: 'b.pdf' }) });
    expect(screen.getByRole('button', { name: 'Ver book' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trocar' })).not.toBeInTheDocument();
  });

  it('edição com book: Ver abre o diálogo', async () => {
    montar({ editando: imovel({ has_book: true, book_file_name: 'b.pdf' }) });
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver book' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('edição com book: Remover confirma, remove e devolve o imóvel', async () => {
    const devolvido = imovel({ has_book: false });
    svc.removeBook.mockResolvedValue(devolvido);
    const { aoMudarImovel } = montar({ editando: imovel({ has_book: true, book_file_name: 'b.pdf' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(svc.removeBook).not.toHaveBeenCalled();
    expect(await screen.findByText(/Remover o book de/)).toBeInTheDocument();
    const botoes = screen.getAllByRole('button', { name: 'Remover' });
    await userEvent.click(botoes[botoes.length - 1]);
    await waitFor(() => expect(svc.removeBook).toHaveBeenCalledWith('p1'));
    expect(aoMudarImovel).toHaveBeenCalledWith(devolvido);
  });

  it('edição com book: Trocar sobe e devolve o imóvel', async () => {
    const devolvido = imovel({ has_book: true });
    svc.uploadBook.mockResolvedValue(devolvido);
    const { aoMudarImovel } = montar({ editando: imovel({ has_book: true, book_file_name: 'b.pdf' }) });
    const f = pdf();
    fireEvent.change(entrada(), { target: { files: [f] } });
    await waitFor(() => expect(aoMudarImovel).toHaveBeenCalledWith(devolvido));
    expect(svc.uploadBook).toHaveBeenCalledWith('p1', f, expect.any(Function));
    expect(avisos.success).toHaveBeenCalledWith('Book atualizado');
  });

  it('edição de empreendimento sem book: Subir grava na hora', async () => {
    const devolvido = imovel({ has_book: true });
    svc.uploadBook.mockResolvedValue(devolvido);
    const { aoMudarImovel } = montar({ editando: imovel() });
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    fireEvent.change(entrada(), { target: { files: [pdf()] } });
    await waitFor(() => expect(aoMudarImovel).toHaveBeenCalledWith(devolvido));
  });

  it('durante o envio mostra o andamento e trava os botões; erro avisa', async () => {
    let falhar!: (e: unknown) => void;
    svc.uploadBook.mockImplementation((_i, _f, onProgress) => {
      onProgress(40);
      return new Promise((_, rej) => { falhar = rej; });
    });
    montar({ editando: imovel({ has_book: true, book_file_name: 'b.pdf' }) });
    fireEvent.change(entrada(), { target: { files: [pdf()] } });
    expect(await screen.findByText(/Enviando… 40%/)).toBeInTheDocument();
    for (const nome of ['Ver book', 'Trocar', 'Remover']) {
      expect(screen.getByRole('button', { name: nome })).toBeDisabled();
    }
    falhar(new Error('x'));
    await waitFor(() => expect(avisos.error).toHaveBeenCalledWith('Não consegui enviar o book'));
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeEnabled();
  });
});
