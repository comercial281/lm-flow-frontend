import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PainelDeLeads from './PainelDeLeads';

// Painel "Escolher leads" da opção "Lista de leads" (passo 1 do disparo).
// Nomes e telefones de exemplo, sem dado de cliente (repo público).

const s = vi.hoisted(() => ({ leads: vi.fn() }));
vi.mock('@/services/broadcasts/broadcastsService', async orig => {
  const real = await orig<typeof import('@/services/broadcasts/broadcastsService')>();
  return { ...real, broadcastsService: { ...real.broadcastsService, leadOptions: s.leads } };
});

const lead = (n: number, etapa = 'Novo lead') => ({
  contact_id: `c${n}`,
  name: `Pessoa Exemplo ${n}`,
  phone: `551190000000${n}`,
  stage_name: etapa,
  labels: [],
});
const pagina = (leads: ReturnType<typeof lead>[], total = leads.length, page = 1) => ({
  data: leads,
  meta: { total, page, per_page: 20 },
});

function Painel({ inicio = [] as string[], aoFechar = vi.fn(), aoMudar = vi.fn() }) {
  const [marcados, setMarcados] = useState<string[]>(inicio);
  return (
    <PainelDeLeads
      aberto
      pipelineId="p1"
      marcados={marcados}
      aoMudar={ids => { aoMudar(ids); setMarcados(ids); }}
      aoFechar={aoFechar}
      etapas={[{ id: 'e1', name: 'Visita marcada' } as never]}
      etiquetas={[{ title: 'quente' }]}
    />
  );
}

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  s.leads.mockReset().mockResolvedValue(pagina([lead(1), lead(2, 'Visita marcada'), lead(3)]));
});

describe('PainelDeLeads', () => {
  it('lead sem nome mostra o telefone uma vez só', async () => {
    s.leads.mockResolvedValue(pagina([{ ...lead(1), name: '' }]));
    render(<Painel />);
    const painel = await screen.findByRole('dialog', { name: 'Escolher leads' });
    await within(painel).findByText('(11) 90000-0001');
    expect(within(painel).getAllByText('(11) 90000-0001')).toHaveLength(1);
  });

  it('lista os leads do funil com a etapa e marca um a um', async () => {
    render(<Painel />);
    const painel = await screen.findByRole('dialog', { name: 'Escolher leads' });
    expect(s.leads).toHaveBeenCalledWith({ pipeline_id: 'p1', q: undefined, stage_id: undefined, label: undefined, page: 1 });
    const linha = await within(painel).findByRole('checkbox', { name: /Pessoa Exemplo 2/ });
    expect(linha).toHaveAccessibleName(/\(11\) 90000-0002/);
    expect(within(painel).getAllByText('Visita marcada').length).toBeGreaterThan(0);
    expect(within(painel).getByText('marcados').parentElement).toHaveTextContent('0 marcados');

    await userEvent.click(linha);
    expect(linha).toHaveAttribute('data-state', 'checked');
    expect(within(painel).getByText('marcado').parentElement).toHaveTextContent('1 marcado');
  });

  it('a busca espera parar de digitar e chama a lista com q', async () => {
    render(<Painel />);
    await screen.findByRole('checkbox', { name: /Pessoa Exemplo 1/ });
    s.leads.mockClear();
    await userEvent.type(screen.getByPlaceholderText('Buscar por nome ou telefone'), 'exemplo 3');
    expect(s.leads).not.toHaveBeenCalled();
    await waitFor(() => expect(s.leads).toHaveBeenCalledWith(expect.objectContaining({ q: 'exemplo 3', page: 1 })));
    expect(s.leads).toHaveBeenCalledTimes(1);
  });

  it('filtro de etapa e de etiqueta vão pra lista', async () => {
    render(<Painel />);
    await screen.findByRole('checkbox', { name: /Pessoa Exemplo 1/ });
    expect(screen.getByLabelText('Etapa')).toHaveDisplayValue('Etapa: todas');
    expect(screen.getByLabelText('Etiqueta')).toHaveDisplayValue('Etiqueta: todas');
    await userEvent.selectOptions(screen.getByLabelText('Etapa'), 'e1');
    await waitFor(() => expect(s.leads).toHaveBeenLastCalledWith(expect.objectContaining({ stage_id: 'e1' })));
    await userEvent.selectOptions(screen.getByLabelText('Etiqueta'), 'quente');
    await waitFor(() => expect(s.leads).toHaveBeenLastCalledWith(expect.objectContaining({ stage_id: 'e1', label: 'quente' })));
  });

  it('"Marcar os N desta página" marca a página toda e, de novo, desmarca só ela', async () => {
    const aoMudar = vi.fn();
    render(<Painel inicio={['c9']} aoMudar={aoMudar} />);
    const todos = await screen.findByRole('checkbox', { name: 'Marcar os 3 desta página' });
    await userEvent.click(todos);
    expect(aoMudar).toHaveBeenLastCalledWith(['c9', 'c1', 'c2', 'c3']);
    expect(todos).toHaveAttribute('data-state', 'checked');
    await userEvent.click(todos);
    expect(aoMudar).toHaveBeenLastCalledWith(['c9']);
  });

  it('com 1 lead na página o alternador fala no singular', async () => {
    s.leads.mockResolvedValue(pagina([lead(1)], 1, 1));
    render(<Painel />);
    expect(await screen.findByRole('checkbox', { name: 'Marcar o lead desta página' })).toBeInTheDocument();
  });

  it('marcação continua ao trocar de página', async () => {
    s.leads.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(page === 2 ? pagina([lead(4)], 21, 2) : pagina([lead(1), lead(2)], 21, 1)),
    );
    render(<Painel />);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Pessoa Exemplo 1/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Pessoa Exemplo 4/ }));
    expect(screen.getByText('marcados').parentElement).toHaveTextContent('2 marcados');
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(await screen.findByRole('checkbox', { name: /Pessoa Exemplo 1/ })).toHaveAttribute('data-state', 'checked');
  });

  it('funil sem lead com telefone e busca sem resultado têm frases próprias', async () => {
    s.leads.mockResolvedValue(pagina([]));
    render(<Painel />);
    expect(await screen.findByText('Nenhum lead com telefone neste funil.')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Buscar por nome ou telefone'), 'ninguém');
    expect(await screen.findByText('Nenhum lead encontrado.')).toBeInTheDocument();
  });

  it('falha ao carregar mostra o erro e Tentar de novo recupera', async () => {
    s.leads.mockRejectedValueOnce(new Error('rede'));
    render(<Painel />);
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('checkbox', { name: /Pessoa Exemplo 1/ })).toBeInTheDocument();
  });

  it('Pronto fecha o painel', async () => {
    const aoFechar = vi.fn();
    render(<Painel aoFechar={aoFechar} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pronto' }));
    expect(aoFechar).toHaveBeenCalled();
  });
});
