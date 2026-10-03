// Ida e volta da revisão: "Revisar" leva para a página de edição (a janela
// some) e a volta com ?importar=1 reabre a MESMA lista do lote, mesmo com o
// lote já concluído — sem repetir o aviso de "Lote concluído".
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const imports = vi.hoisted(() => ({ get: vi.fn() }));
const avisos = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/services/propertyImports/propertyImportsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/propertyImports/propertyImportsService')>();
  return { ...real, propertyImportsService: { ...real.propertyImportsService, ...imports } };
});
vi.mock('sonner', () => ({ toast: avisos }));

import PropertyImportDialog from './PropertyImportDialog';

const lote = {
  id: 'b1', status: 'completed', total_items: 1, processed_items: 1, success_items: 1, error_items: 0,
  created_at: '', updated_at: '',
  items: [{
    id: 'i1', position: 1, source_type: 'file', file_name: 'book-vista.pdf', status: 'created', attempts: 1,
    missing_fields: [], extracted_summary: {},
    property: { id: 'p1', code: 'EM0007', title: 'Vista Taquaral', status: 'draft', has_price: true },
  }],
};

const janela = (extra: Partial<Parameters<typeof PropertyImportDialog>[0]> = {}) => {
  const props = { open: true, onClose: vi.fn(), onManual: vi.fn(), onReview: vi.fn(), onChanged: vi.fn(), ...extra };
  return { props, ...render(<PropertyImportDialog {...props} />) };
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  imports.get.mockResolvedValue(lote);
});

describe('PropertyImportDialog: volta da revisão', () => {
  it('Revisar → volta com ?importar=1 mostra de novo a lista do lote concluído', async () => {
    // Lote em andamento: a janela acompanha e ele termina.
    sessionStorage.setItem('lmflow.property_import.batch_id', 'b1');
    const ida = janela();
    expect(await screen.findByText('Vista Taquaral')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(ida.props.onReview).toHaveBeenCalledWith('p1');
    ida.unmount(); // a lista de Imóveis sai: o cadastro é outra página

    vi.clearAllMocks();
    imports.get.mockResolvedValue(lote);
    const volta = janela({ retomarRevisao: true });
    expect(await screen.findByText('Vista Taquaral')).toBeInTheDocument();
    expect(imports.get).toHaveBeenCalledTimes(1);
    expect(imports.get).toHaveBeenCalledWith('b1');
    expect(avisos.success).not.toHaveBeenCalled();
    expect(volta.props.onChanged).not.toHaveBeenCalled();
  });

  it('abrir sem ser volta da revisão não reabre o lote revisado', async () => {
    sessionStorage.setItem('lmflow.property_import.review_batch_id', 'b1');
    janela();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(imports.get).not.toHaveBeenCalled();
    expect(screen.queryByText('Vista Taquaral')).toBeNull();
  });

  it('fechar a janela esquece o lote revisado', async () => {
    sessionStorage.setItem('lmflow.property_import.review_batch_id', 'b1');
    const { props } = janela({ retomarRevisao: true });
    expect(await screen.findByText('Vista Taquaral')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalled();
    expect(sessionStorage.getItem('lmflow.property_import.review_batch_id')).toBeNull();
  });
});
