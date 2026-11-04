import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IaDaCampanha, OpcaoDeIa } from '@/services/campanhas/campanhasService';
import { opcoesDaTela } from '@/features/campanhas/qualIaAtende';
import QuemAtende, { type QuemAtendeProps } from './QuemAtende';

const dono = (o: Partial<IaDaCampanha> = {}): IaDaCampanha => ({
  sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null, ...o,
});
const OPCOES: OpcaoDeIa[] = [
  { sales_agent_id: 'a1', number_id: null, label: 'Agente A', serves_all: false, locked: null, enabled: true },
  { sales_agent_id: 'b1', number_id: null, label: 'Agente B', serves_all: false, locked: null, enabled: true },
];
const mostrar = (donos: IaDaCampanha[], extra: Partial<QuemAtendeProps> = {}) => {
  const props: QuemAtendeProps = {
    donos, opcoes: opcoesDaTela(OPCOES, donos), podeMexer: true, aoEscolher: vi.fn(), aoTirar: vi.fn(), ...extra,
  };
  render(<QuemAtende {...props} />);
  return props;
};
const RODAPE = 'As regras da IA ficam em IA Vendedora > Configurar > Campanhas e gatilhos.';

describe('QuemAtende', () => {
  it('broad: nome e motivo, sem botão nenhum', () => {
    mostrar([dono({ kind: 'broad', reason: 'atende todo lead que entra no funil Leads (Marketing)', removable: false })]);
    expect(screen.getByText('Agente A')).toBeInTheDocument();
    expect(screen.getByText('Atende todo lead que entra no funil Leads (Marketing)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tirar a IA/ })).toBeNull();
  });

  it('campaign removível mostra Tirar a IA e chama aoTirar', () => {
    const d = dono({ kind: 'campaign', reason: 'esta campanha está na lista dela', removable: true });
    const p = mostrar([d]);
    fireEvent.click(screen.getByRole('button', { name: /^Tirar a IA/ }));
    expect(p.aoTirar).toHaveBeenCalledWith(d);
  });

  it('dois botões Tirar se distinguem pelo nome da IA (aria-label), com o texto visível igual', () => {
    const a = dono({ kind: 'campaign', reason: 'esta campanha está na lista dela', removable: true });
    const b = dono({ sales_agent_id: 'b1', name: 'Agente B', kind: 'campaign', reason: 'esta campanha está na lista dela', removable: true });
    const p = mostrar([a, b]);
    const botoes = screen.getAllByRole('button', { name: /^Tirar a IA/ });
    expect(botoes.map((x) => x.textContent)).toEqual(['Tirar a IA', 'Tirar a IA']);
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a IA Agente B' }));
    expect(p.aoTirar).toHaveBeenCalledWith(b);
  });

  it('campaign sem removable (false) não mostra Tirar', () => {
    mostrar([dono({ kind: 'campaign', reason: 'esta campanha está na lista dela', removable: false })]);
    expect(screen.queryByRole('button', { name: /^Tirar a IA/ })).toBeNull();
  });

  it('depends: mostra o motivo, sem Tirar, e a própria IA continua no seletor', () => {
    mostrar([dono({ kind: 'depends', reason: 'pode atender se a conversa trouxer a palavra casa', removable: false })]);
    expect(screen.getByText('Pode atender se a conversa trouxer a palavra casa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tirar a IA/ })).toBeNull();
    expect(screen.getByRole('option', { name: 'Agente A' })).toBeInTheDocument();
  });

  it('sem dono: "Sem IA" e o seletor; Pôr chama aoEscolher com a chave', () => {
    const p = mostrar([]);
    expect(screen.getByText('Sem IA')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pôr numa IA'), { target: { value: 'b1|' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr' }));
    expect(p.aoEscolher).toHaveBeenCalledWith('b1|');
  });

  it('servidor antigo (sem kind): sem note mostra Tirar; com note não', () => {
    mostrar([dono()]);
    expect(screen.getByRole('button', { name: /^Tirar a IA/ })).toBeInTheDocument();
  });
  it('servidor antigo (sem kind): com note, nome e nota, sem Tirar', () => {
    mostrar([dono({ note: 'atende todo anúncio' })]);
    expect(screen.getByText('Agente A · atende todo anúncio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tirar a IA/ })).toBeNull();
  });

  it('formulário novo: diz que a escolha grava no Criar; existente diz que vale na hora', () => {
    mostrar([], { novo: true });
    expect(screen.getByText('A escolha grava junto quando você clicar em Criar.')).toBeInTheDocument();
    expect(screen.queryByText(/vale na hora/)).toBeNull();
  });
  it('existente diz que vale na hora', () => {
    mostrar([]);
    expect(screen.getByText(/vale na hora/)).toBeInTheDocument();
  });

  it('rodapé fixo', () => {
    mostrar([]);
    expect(screen.getByText(RODAPE)).toBeInTheDocument();
  });

  it('sem permissão: sem seletor nem Tirar', () => {
    mostrar([dono({ kind: 'campaign', removable: true })], { podeMexer: false });
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Tirar a IA/ })).toBeNull();
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
