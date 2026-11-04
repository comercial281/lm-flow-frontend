import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';
import TabelaDeFormularios, { OutrosFormularios } from './TabelaDeFormularios';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ficha = (extra: Partial<LeadAdsFormConfig> = {}): LeadAdsFormConfig => ({
  id: 'c1', form_id: 'f1', form_name: 'Castelo', meta_page_id: null, page_name: null, pipeline_id: 'p', pipeline_stage_id: 's', label_ids: [],
  default_assignee_id: null, roleta_config_id: null, property_id: null, match_keyword: null, after_hours_message: null, is_active: true, created_at: '2026-10-01', ...extra,
});
const item = (extra: Partial<ItemDeCampanha> = {}): ItemDeCampanha => ({
  key: 'form:f1', kind: 'form', label: 'Castelo', form_config_id: 'c1', link_id: null, keyword_rule: false, property_ids: [], sells_scope: 'catalog', sells_listing_kind: null,
  offer_condition: null, audience_intents: [], leads_count: 81, last_lead_at: null, ad_title: null, ad_body: null, campaign_name: null, match_kind: null, match_value: null,
  is_active: true, agents: [], ...extra,
});
const base = {
  fichas: [ficha()], listaPronta: true, nomeDaFicha: (c: LeadAdsFormConfig) => c.form_name, destino: () => 'Vendas → Novo', quemAssume: () => 'Assume: Ana',
  nomeDaPagina: () => null, podeEditar: true, podeLigar: true, aoAbrir: vi.fn(), aoLigar: vi.fn().mockResolvedValue(undefined),
};

describe('TabelaDeFormularios', () => {
  it('colunas do spec e a linha completa', () => {
    render(<TabelaDeFormularios {...base} itens={[item({ agents: [{ sales_agent_id: 'a', name: 'IA Um', sales_agent_number_id: null, number_label: null, whole_number: false, note: null, reason: 'atende todo lead do funil' }] })]} />);
    for (const c of ['Formulário', 'Imóvel', 'Funil e quem assume', 'Quem atende', 'Leads em 90 dias', 'Ativo']) expect(screen.getAllByText(c).length).toBeGreaterThan(0);
    const linha = screen.getByTestId('linha-do-formulario');
    expect(within(linha).getByText('81 leads')).toBeInTheDocument();
    expect(within(linha).getByText('Todo o catálogo')).toBeInTheDocument();
    expect(within(linha).getByText('IA Um · Atende todo lead do funil')).toBeInTheDocument();
    expect(within(linha).getByText('Assume: Ana')).toBeInTheDocument();
  });

  it('clicar na linha abre; Editar abre uma vez só; a chave não abre', () => {
    const aoAbrir = vi.fn();
    render(<TabelaDeFormularios {...base} aoAbrir={aoAbrir} itens={[item()]} />);
    fireEvent.click(screen.getByTestId('linha-do-formulario'));
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar Castelo' }));
    expect(aoAbrir).toHaveBeenCalledTimes(2);
  });

  it('lista não chegou: nem "0 leads" nem "Sem IA", só traço', () => {
    render(<TabelaDeFormularios {...base} listaPronta={false} />);
    const linha = screen.getByTestId('linha-do-formulario');
    expect(within(linha).queryByText(/lead/i, { selector: 'div' })).toBeNull();
    expect(within(linha).queryByText('Sem IA')).toBeNull();
    expect(within(linha).queryByText(/^0 leads/)).toBeNull();
  });

  it('lista pronta e ninguém atende: "Sem IA"', () => {
    render(<TabelaDeFormularios {...base} itens={[item({ leads_count: 0 })]} />);
    expect(screen.getByText('Sem IA')).toBeInTheDocument();
    expect(screen.getByText('0 leads')).toBeInTheDocument();
  });

  it('só leitura vê "Ver" e a chave travada', () => {
    render(<TabelaDeFormularios {...base} podeEditar={false} podeLigar={false} itens={[item()]} />);
    expect(screen.getByRole('button', { name: 'Ver Castelo' })).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('ficha desligada ganha o selo', () => {
    render(<TabelaDeFormularios {...base} fichas={[ficha({ is_active: false })]} itens={[item()]} />);
    expect(screen.getByText('Ficha desligada')).toBeInTheDocument();
  });
});

describe('OutrosFormularios', () => {
  it('recolhido até abrir', () => {
    const aoPlugar = vi.fn();
    render(<OutrosFormularios mostrarPagina={false} aoPlugar={aoPlugar} formularios={[{ id: 'x', name: 'Novo', status: 'ACTIVE', leads_count: 0 }]} />);
    expect(screen.queryByText('Novo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /ainda sem ficha/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Plugar Novo' }));
    expect(aoPlugar).toHaveBeenCalled();
  });
  it('sem formulário, não desenha nada', () => {
    const { container } = render(<OutrosFormularios mostrarPagina={false} aoPlugar={vi.fn()} formularios={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sem permissão de criar ficha, o Plugar dos outros formulários não aparece', () => {
    render(<OutrosFormularios mostrarPagina={false} aoPlugar={vi.fn()} podePlugar={false} formularios={[{ id: 'x', name: 'Novo', status: 'ACTIVE', leads_count: 0 }]} />);
    fireEvent.click(screen.getByRole('button', { name: /ainda sem ficha/ }));
    expect(screen.getByText('Novo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plugar Novo' })).toBeNull();
  });
});
