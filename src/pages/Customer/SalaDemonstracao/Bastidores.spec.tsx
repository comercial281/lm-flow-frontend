import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Bastidores from './Bastidores';
import type { Backstage } from '@/types/demoRoom';

const base: Backstage = {
  stage_name: 'Qualificação', temperature: 'hot', intent: 'moradia', caminho: 'Moradia',
  checklist: [], collected: null, summary: null, qualified: false, handoff: null,
};

describe('Bastidores', () => {
  it('sem dado mostra que a IA ainda está conhecendo o lead', () => {
    render(<Bastidores behind={null} />);
    expect(screen.getByText('A IA ainda está conhecendo o lead')).toBeInTheDocument();
  });

  it('mostra etapa, caminho, respostas e resumo', () => {
    render(<Bastidores behind={{
      ...base, summary: 'Quer apartamento perto do metrô',
      checklist: [{ pergunta: 'Região', resposta: 'Zona leste', obrigatoria: true }, { pergunta: 'Renda', resposta: null, obrigatoria: false }],
    }} />);
    expect(screen.getByText('Qualificação')).toBeInTheDocument();
    expect(screen.getByText('Moradia')).toBeInTheDocument();
    expect(screen.getByText('Região')).toBeInTheDocument();
    expect(screen.getByText('Zona leste')).toBeInTheDocument();
    expect(screen.getByText('Quer apartamento perto do metrô')).toBeInTheDocument();
  });

  it('com repasse mostra o cartão, o resumo e o motivo', () => {
    render(<Bastidores behind={{ ...base, handoff: { at: 'x', reason: 'Pediu visita', summary: 'Maria quer visitar sábado' } }} />);
    expect(screen.getByText('Aqui a IA passaria o lead pro corretor')).toBeInTheDocument();
    expect(screen.getByText('Maria quer visitar sábado')).toBeInTheDocument();
    expect(screen.getByText('Por que')).toBeInTheDocument();
    expect(screen.getByText('Pediu visita')).toBeInTheDocument();
  });

  it('sem repasse não mostra o cartão', () => {
    render(<Bastidores behind={base} />);
    expect(screen.queryByText('Aqui a IA passaria o lead pro corretor')).toBeNull();
  });

  it('aguenta o formato cru do servidor (checklist null) e mostra etapa, Quente, região e orçamento', () => {
    const cru = {
      stage_name: 'Novo', checklist: null, temperature: 'hot',
      collected: { regiao: 'Zona leste', orcamento: '250 mil' },
      intent: null, caminho: null, summary: null, qualified: null, handoff: null,
    } as unknown as Backstage;
    render(<Bastidores behind={cru} />);
    expect(screen.getByText('Novo')).toBeInTheDocument();
    expect(screen.getByText('Quente')).toBeInTheDocument();
    expect(screen.getByText('Região')).toBeInTheDocument();
    expect(screen.getByText('Zona leste')).toBeInTheDocument();
    expect(screen.getByText('Orçamento')).toBeInTheDocument();
    expect(screen.getByText('250 mil')).toBeInTheDocument();
  });

  it('temperatura sai em português, nunca o código', () => {
    const { rerender } = render(<Bastidores behind={{ ...base, temperature: 'warm' }} />);
    expect(screen.getByText('Morna')).toBeInTheDocument();
    rerender(<Bastidores behind={{ ...base, temperature: 'cold' }} />);
    expect(screen.getByText('Fria')).toBeInTheDocument();
    rerender(<Bastidores behind={{ ...base, temperature: 'unknown' }} />);
    expect(screen.getByText('Ainda não dá pra saber')).toBeInTheDocument();
    expect(screen.queryByText('unknown')).toBeNull();
  });

  it('só com o que a IA anotou (collected e intenção) já mostra os dados, com rótulo para chave desconhecida', () => {
    render(<Bastidores behind={{
      ...base, stage_name: null, temperature: null, caminho: null, intent: 'comprador',
      collected: { fgts: 'Tem', faixa_de_renda: '3 mil', vazio: '  ' },
    }} />);
    expect(screen.queryByText('A IA ainda está conhecendo o lead')).toBeNull();
    expect(screen.getByText('Procurando imóvel')).toBeInTheDocument();
    expect(screen.getByText('FGTS')).toBeInTheDocument();
    expect(screen.getByText('Tem')).toBeInTheDocument();
    expect(screen.getByText('Faixa de renda')).toBeInTheDocument();
    expect(screen.getByText('3 mil')).toBeInTheDocument();
    expect(screen.queryByText('Vazio')).toBeNull();
  });

  it('repasse sem resumo esconde "O que o corretor receberia"; sem motivo esconde "Por que"', () => {
    const { rerender } = render(<Bastidores behind={{ ...base, handoff: { at: 'x', reason: 'Pediu visita', summary: '' } }} />);
    expect(screen.queryByText('O que o corretor receberia')).toBeNull();
    expect(screen.getByText('Por que')).toBeInTheDocument();
    rerender(<Bastidores behind={{ ...base, handoff: { at: 'x', reason: '', summary: 'Maria quer visitar' } }} />);
    expect(screen.getByText('O que o corretor receberia')).toBeInTheDocument();
    expect(screen.queryByText('Por que')).toBeNull();
  });
});
