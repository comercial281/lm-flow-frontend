import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

const listar = vi.hoisted(() => vi.fn());
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: listar } }));
import Catalogo from './Catalogo';

beforeEach(() => { listar.mockReset(); listar.mockResolvedValue({ data: [] }); });

describe('Catálogo', () => {
  it('tipo de venda em botões: Lançamento (padrão) apaga a chave; outro grava a subchave', async () => {
    const gravar = gravarDeTeste('catalogo');
    render(<Catalogo agent={agenteDeTeste({ playbook: {} })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    expect(screen.getByRole('radio', { name: 'Lançamento' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Usado ou pronto' }));
    expect(gravar).toHaveBeenCalledWith({ playbook: { vars: { tipo_venda: 'usado' } } }, ['playbook.vars.tipo_venda']);
  });

  it('as 4 chaves do que ela pode usar; o book mostra a regra', async () => {
    const gravar = gravarDeTeste('catalogo');
    render(<Catalogo agent={agenteDeTeste()} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    ['Consultar o cadastro', 'Oferecer outras opções', 'Fotos e vídeo', 'Book do imóvel'].forEach((n) => expect(screen.getByRole('switch', { name: n })).toBeChecked());
    expect(screen.getByLabelText('Quando ela pode mandar o book')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Fotos e vídeo' }));
    expect(gravar).toHaveBeenCalledWith({ rich_media_enabled: false });
  });

  // Revisão final da onda 3 (M9): antes de a lista chegar, o código salvo não é
  // "fora dos ativos" — ninguém sabe ainda.
  it('imóvel padrão: só diz "não está entre os ativos" depois de a lista chegar', async () => {
    let soltar: (v: unknown) => void = () => {};
    listar.mockReturnValue(new Promise((res) => { soltar = res; }));
    render(<Catalogo agent={agenteDeTeste({ default_property_code: 'AP0566' })} inboxes={[]} gravar={gravarDeTeste('catalogo')} irPara={vi.fn()} diagnostico={null} />);
    expect(screen.getByLabelText('Imóvel padrão')).toHaveValue('AP0566');
    expect(screen.queryByText(/não está entre os ativos/)).toBeNull();
    soltar({ data: [{ code: 'CA0100', title: 'Casa' }] });
    expect(await screen.findByRole('option', { name: 'AP0566 (não está entre os ativos)' })).toBeInTheDocument();
  });

  it('imóvel padrão: com a lista chegada e o código nela, aparece o nome', async () => {
    listar.mockResolvedValue({ data: [{ code: 'AP0566', title: 'Apto Centro' }] });
    render(<Catalogo agent={agenteDeTeste({ default_property_code: 'AP0566' })} inboxes={[]} gravar={gravarDeTeste('catalogo')} irPara={vi.fn()} diagnostico={null} />);
    expect(await screen.findByRole('option', { name: 'AP0566 · Apto Centro' })).toBeInTheDocument();
    expect(screen.queryByText(/não está entre os ativos/)).toBeNull();
  });
});
