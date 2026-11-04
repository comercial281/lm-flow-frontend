import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { IaDaCampanha } from '@/services/campanhas/campanhasService';
import QuemAtende, { type QuemAtendeProps } from './QuemAtende';

const dono = (o: Partial<IaDaCampanha> = {}): IaDaCampanha => ({
  sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null, ...o,
});
const mostrar = (donos: IaDaCampanha[], extra: Partial<QuemAtendeProps> = {}) => {
  const props: QuemAtendeProps = { donos, linkDaIa: '/ia-vendedora', ...extra };
  render(<MemoryRouter><QuemAtende {...props} /></MemoryRouter>);
  return props;
};
const AVISO_DA_LISTA = 'IA que usa lista de formulários só atende depois de marcar este formulário nela.';

describe('QuemAtende (só leitura)', () => {
  it('mostra o nome e o motivo, sem seletor, sem Pôr e sem Tirar', () => {
    mostrar([dono({ kind: 'campaign', reason: 'esta campanha está na lista dela', removable: true })]);
    expect(screen.getByText('Agente A')).toBeInTheDocument();
    expect(screen.getByText('Esta campanha está na lista dela')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pôr' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Tirar a IA/ })).toBeNull();
    expect(screen.queryByText(/vale na hora/)).toBeNull();
  });

  it('o link "Configurar na IA" vai pro endereço que o pai mandou', () => {
    mostrar([dono()], { linkDaIa: '/ia-vendedora?ia=a1&tela=configurar&pagina=campanhas' });
    expect(screen.getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', '/ia-vendedora?ia=a1&tela=configurar&pagina=campanhas');
  });

  it('sem link (sem permissão de ver a IA): nenhum link', () => {
    mostrar([dono()], { linkDaIa: null });
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('servidor antigo (sem reason): nome e nota', () => {
    mostrar([dono({ note: 'atende todo anúncio' })]);
    expect(screen.getByText('Agente A · atende todo anúncio')).toBeInTheDocument();
  });

  it('ficha existente sem dono: "Sem IA", sem aviso de formulário novo', () => {
    mostrar([]);
    expect(screen.getByText('Sem IA')).toBeInTheDocument();
    expect(screen.queryByText(AVISO_DA_LISTA)).toBeNull();
  });

  it('formulário novo sem cópia: avisa que IA de lista precisa marcar o formulário, e que IA por funil ou anúncio segue atendendo; sem "Sem IA"', () => {
    mostrar([], { novo: true });
    expect(screen.getByText(AVISO_DA_LISTA)).toBeInTheDocument();
    expect(screen.getByText(/IA que atende por funil ou por todo anúncio continua atendendo/)).toBeInTheDocument();
    expect(screen.queryByText('Sem IA')).toBeNull();
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(screen.getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', '/ia-vendedora');
  });

  it('formulário novo vindo de cópia: mostra a IA da ficha copiada antes do Criar, sem o aviso da lista', () => {
    mostrar([], { novo: true, daCopia: 'Agente B · Ana' });
    expect(screen.getByText('Vem da ficha copiada: Agente B · Ana')).toBeInTheDocument();
    expect(screen.getByText(/grava junto quando você clicar em Criar/i)).toBeInTheDocument();
    expect(screen.queryByText(AVISO_DA_LISTA)).toBeNull();
  });

  it('409: mostra a frase e Mover / Deixar como está', () => {
    const aoMover = vi.fn(); const aoDeixar = vi.fn();
    mostrar([], { movendo: { chave: 'b1|', frase: 'Esta campanha sai da IA Agente A.' }, aoMover, aoDeixar });
    expect(screen.getByText('Esta campanha sai da IA Agente A.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));
    expect(aoMover).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Deixar como está' }));
    expect(aoDeixar).toHaveBeenCalled();
  });

  it('mostra o aviso do servidor e quem ficou sem IA', () => {
    mostrar([], { aviso: 'Atenção X', ficouSemIa: ['Formulário Teste'] });
    expect(screen.getByText('Atenção X')).toBeInTheDocument();
    expect(screen.getByText(/Ficou sem IA: Formulário Teste/)).toBeInTheDocument();
  });
});
