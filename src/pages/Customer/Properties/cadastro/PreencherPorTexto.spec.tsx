import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const servico = vi.hoisted(() => ({ parseText: vi.fn() }));
const avisos = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
const leitura = vi.hoisted(() => ({
  extractPdfText: vi.fn(), extractDocxText: vi.fn(), ocrImage: vi.fn(), ocrPdfScanned: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: avisos }));
vi.mock('./leituraDeArquivo', () => leitura);
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...servico } };
});
import PreencherPorTexto, { campoVazio } from './PreencherPorTexto';
import { FORMULARIO_VAZIO } from '@/features/properties/cadastro/formularioDoCadastro';
import { formularioNovo } from '@/features/properties/formularioPorTipo';

const novo = (kind: 'resale' | 'development', extra = {}) =>
  ({ ...FORMULARIO_VAZIO, ...formularioNovo(kind), ...extra }) as never;

function montar(form: never, over: Record<string, unknown> = {}) {
  const props = { setF: vi.fn(), aoMudarTexto: vi.fn(), aoEscolherBook: vi.fn(), temBook: false, texto: 'texto colado', ...over };
  render(<PreencherPorTexto form={form} {...props} />);
  return props;
}
async function abrirEPreencher() {
  await userEvent.click(screen.getByText('Preencher a partir de um texto'));
}

beforeEach(() => {
  vi.clearAllMocks();
  leitura.extractPdfText.mockResolvedValue('texto do book');
});

describe('campoVazio', () => {
  it('null e string vazia são vazios', () => {
    expect(campoVazio(novo('resale'), 'sale_price')).toBe(true);
    expect(campoVazio(novo('resale'), 'address_city')).toBe(true);
    expect(campoVazio(novo('resale', { sale_price: undefined }), 'sale_price')).toBe(true);
  });
  it('valor de fábrica conta como vazio', () => {
    expect(campoVazio(novo('resale'), 'property_type')).toBe(true);
    expect(campoVazio(novo('development'), 'transaction_type')).toBe(true);
  });
  it('valor digitado não é vazio', () => {
    expect(campoVazio(novo('resale', { sale_price: 400000 }), 'sale_price')).toBe(false);
    expect(campoVazio(novo('resale', { property_type: 'house' }), 'property_type')).toBe(false);
  });
});

describe('Preencher pelo texto só preenche vazio', () => {
  it('não troca o preço digitado, preenche quartos e o tipo de fábrica', async () => {
    servico.parseText.mockResolvedValue({ sale_price: 500000, bedrooms: 3, property_type: 'house' });
    const p = montar(novo('resale', { sale_price: 400000 }));
    await abrirEPreencher();
    await userEvent.click(screen.getByRole('button', { name: /^Preencher$/ }));
    await waitFor(() => expect(p.setF).toHaveBeenCalled());
    const patch = p.setF.mock.calls[0][0];
    expect(patch).not.toHaveProperty('sale_price');
    expect(patch.bedrooms).toBe(3);
    expect(patch.property_type).toBe('house');
  });
  it('não troca o tipo que o corretor já escolheu', async () => {
    servico.parseText.mockResolvedValue({ bedrooms: 3, property_type: 'house' });
    const p = montar(novo('resale', { property_type: 'land' }));
    await abrirEPreencher();
    await userEvent.click(screen.getByRole('button', { name: /^Preencher$/ }));
    await waitFor(() => expect(p.setF).toHaveBeenCalled());
    expect(p.setF.mock.calls[0][0]).not.toHaveProperty('property_type');
  });
  it('tudo já preenchido: aviso informativo, sem setF', async () => {
    servico.parseText.mockResolvedValue({ sale_price: 500000 });
    const p = montar(novo('resale', { sale_price: 400000 }));
    await abrirEPreencher();
    await userEvent.click(screen.getByRole('button', { name: /^Preencher$/ }));
    await waitFor(() => expect(avisos.info).toHaveBeenCalledWith('Os campos já estavam preenchidos; nada foi trocado.'));
    expect(p.setF).not.toHaveBeenCalled();
    expect(avisos.error).not.toHaveBeenCalled();
  });
  it('nada reconhecido: continua o erro de sempre', async () => {
    servico.parseText.mockResolvedValue({});
    montar(novo('resale'));
    await abrirEPreencher();
    await userEvent.click(screen.getByRole('button', { name: /^Preencher$/ }));
    await waitFor(() => expect(avisos.error).toHaveBeenCalledWith(expect.stringContaining('Não achei dados')));
  });
});

describe('PDF vira book', () => {
  const pdf = () => {
    const f = new File(['%PDF'], 'book.pdf', { type: 'application/pdf' });
    f.arrayBuffer = async () => new ArrayBuffer(4); // o jsdom não traz arrayBuffer()
    return f;
  };
  async function subir(form: never, over = {}) {
    servico.parseText.mockResolvedValue({});
    const p = montar(form, over);
    await userEvent.click(screen.getByText('Preencher a partir de um texto'));
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await userEvent.upload(input, pdf());
    await waitFor(() => expect(leitura.extractPdfText).toHaveBeenCalled());
    return p;
  }
  it('empreendimento: anexa o book', async () => {
    const p = await subir(novo('development'));
    expect(p.aoEscolherBook).toHaveBeenCalledTimes(1);
    expect(avisos.success).toHaveBeenCalledWith('Book anexado: ele sobe junto quando você cadastrar.');
  });
  it('já tem book: não troca', async () => {
    const p = await subir(novo('development'), { temBook: true });
    expect(p.aoEscolherBook).not.toHaveBeenCalled();
  });
  it('revenda: não anexa', async () => {
    const p = await subir(novo('resale'));
    expect(p.aoEscolherBook).not.toHaveBeenCalled();
  });
  it('anexa mesmo quando a extração não acha texto', async () => {
    leitura.extractPdfText.mockResolvedValue('');
    leitura.ocrPdfScanned.mockResolvedValue('');
    const p = montar(novo('development'));
    await userEvent.click(screen.getByText('Preencher a partir de um texto'));
    await userEvent.upload(document.querySelector('input[type=file]') as HTMLInputElement, pdf());
    await waitFor(() => expect(avisos.error).toHaveBeenCalled());
    expect(p.aoEscolherBook).toHaveBeenCalledTimes(1);
  });
});
