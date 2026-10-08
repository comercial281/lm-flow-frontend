// src/pages/Customer/Pipelines/quadro/PainelDeFiltrosDoFunil.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { listOptionsService } from '@/services/listOptions/listOptionsService';
import type { PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS, type AbaDoQuadro, type FiltrosDoFunil } from './enderecoDoQuadro';
import PainelDeFiltrosDoFunil from './PainelDeFiltrosDoFunil';

vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: { list: vi.fn() } }));

const STAGES = [
  { id: 's1', name: 'Novo', items: [{ id: 'a', lead_origin: { source: 'meta_lead_ads' }, assignee: { id: 'u1', name: 'Ana' } }] },
  { id: 's2', name: 'Proposta', items: [{ id: 'b' }] },
] as unknown as PipelineStage[];

function abrir(aba: AbaDoQuadro = 'abertos', filtros: FiltrosDoFunil = FILTROS_VAZIOS) {
  const aoFiltrar = vi.fn();
  const aoFechar = vi.fn();
  render(
    <PainelDeFiltrosDoFunil aberto aoFechar={aoFechar} aba={aba} filtros={filtros} aoFiltrar={aoFiltrar}
      stages={STAGES} etiquetas={[{ name: 'Meta', color: '#000000' }]} />,
  );
  return { aoFiltrar, aoFechar, painel: screen.getByRole('dialog', { name: 'Filtros do funil' }) };
}

const SECOES = ['Criado em', 'Etapas', 'Origem', 'Responsável', 'Etiquetas', 'Motivo da perda', 'Largados', 'Tarefas', 'Colunas visíveis'];

describe('PainelDeFiltrosDoFunil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOptionsService.list).mockResolvedValue([
      { id: 'm1', list_key: 'loss_reasons', label: 'Adiou a compra', position: 1, active: true, meta_exclusion: false },
      { id: 'm9', list_key: 'loss_reasons', label: 'Preço', position: 2, active: false, meta_exclusion: false },
    ] as never);
  });

  it('as nove seções, na ordem da spec; Motivo da perda só em Perdidos e Todos', async () => {
    const { painel } = abrir('perdidos');
    expect(within(painel).getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(SECOES);
    expect(listOptionsService.list).toHaveBeenCalledWith('loss_reasons', { includeInactive: true });
    expect(await within(painel).findByRole('button', { name: 'Preço (arquivado)' })).toBeInTheDocument();
  });

  it('em Abertos não tem Motivo da perda nem pede a lista', () => {
    const { painel } = abrir('abertos');
    expect(within(painel).getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(SECOES.filter(s => s !== 'Motivo da perda'));
    expect(listOptionsService.list).not.toHaveBeenCalled();
  });

  it('escolhe e só aplica no Filtrar (e fecha)', async () => {
    const { painel, aoFiltrar, aoFechar } = abrir('perdidos');
    await userEvent.click(within(within(painel).getByRole('group', { name: 'Etapas' })).getByRole('button', { name: 'Proposta' }));
    await userEvent.click(within(within(painel).getByRole('group', { name: 'Responsável' })).getByRole('button', { name: 'Ana' }));
    await userEvent.click(await within(painel).findByRole('button', { name: 'Adiou a compra' }));
    await userEvent.click(within(within(painel).getByRole('group', { name: 'Tarefas' })).getByRole('button', { name: 'Atrasadas' }));
    expect(aoFiltrar).not.toHaveBeenCalled();

    await userEvent.click(within(painel).getByRole('button', { name: 'Filtrar' }));
    expect(aoFiltrar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS, etapas: ['s2'], resp: ['u1'], motivos: ['m1'], tarefas: ['atrasada'] });
    expect(aoFechar).toHaveBeenCalled();
  });

  it('Criado em: atalho preenche de/até; Largados com "Outro" vira o número digitado', async () => {
    const { painel, aoFiltrar } = abrir();
    await userEvent.click(within(painel).getByRole('button', { name: 'Hoje' }));
    expect((within(painel).getByLabelText('De') as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await userEvent.click(within(painel).getByRole('radio', { name: 'Outro' }));
    await userEvent.type(within(painel).getByRole('spinbutton', { name: 'Dias sem contato' }), '45');
    await userEvent.click(within(painel).getByRole('button', { name: 'Filtrar' }));
    const aplicado = aoFiltrar.mock.calls[0][0] as FiltrosDoFunil;
    expect(aplicado.largados).toBe(45);
    expect(aplicado.de).toBe(aplicado.ate);
  });

  it('Colunas visíveis: desmarcar esconde; marcar todas volta ao padrão (vazio)', async () => {
    const { painel, aoFiltrar } = abrir();
    const colunas = within(painel).getByRole('group', { name: 'Colunas visíveis' });
    expect(within(colunas).getByRole('button', { name: 'Novo' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(colunas).getByRole('button', { name: 'Novo' }));
    await userEvent.click(within(painel).getByRole('button', { name: 'Filtrar' }));
    expect(aoFiltrar).toHaveBeenLastCalledWith(expect.objectContaining({ colunas: ['s2'] }));
  });

  it('Limpar filtros aplica tudo vazio', async () => {
    const { painel, aoFiltrar } = abrir('abertos', { ...FILTROS_VAZIOS, etapas: ['s1'], largados: 7 });
    await userEvent.click(within(painel).getByRole('button', { name: 'Limpar filtros' }));
    expect(aoFiltrar).toHaveBeenCalledWith(FILTROS_VAZIOS);
  });
});
