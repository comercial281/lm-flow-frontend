import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Bastidores from './Bastidores';
import type { Backstage } from '@/types/demoRoom';

const base: Backstage = {
  stage_name: 'Qualificação', temperature: 'quente', intent: 'moradia', caminho: 'Moradia',
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
});
