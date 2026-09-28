import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NumberCard from './NumberCard';
import type { NumberCardData } from '@/features/numbers/types';

// "O número tem cara" (spec 2b): nome, telefone de verdade, conectado ou não,
// o dono (ou da imobiliária), em qual roleta e qual IA — num lugar só.
function card(over: Partial<NumberCardData> = {}): NumberCardData {
  return {
    inbox_id: 'i1', name: 'WhatsApp da Ana', phone: '+5511912341234', connection: 'connected',
    number_owner_rule: true, owner: { id: 'u1', name: 'Ana', active: true }, shared: false,
    roletas: ['Vendas'], ai: ['Sara'], ...over,
  };
}

describe('NumberCard', () => {
  it('mostra tudo num lugar só', () => {
    render(<NumberCard card={card()} />);

    expect(screen.getByText('WhatsApp da Ana')).toBeInTheDocument();
    expect(screen.getByText('(11) 91234-1234')).toBeInTheDocument();
    expect(screen.getByText('conectado')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Número de Ana: quem escreve nele vai direto pra Ana')).toBeInTheDocument();
    expect(screen.getByText('Vendas')).toBeInTheDocument();
    expect(screen.getByText('Sara')).toBeInTheDocument();
  });

  // Review Focus 1: dono desativado — o número vale como da imobiliária, e a
  // explicação diz roleta, não "vai direto pra Ana".
  // G2: o texto neutro de gênero é "o cadastro de Ana está desativado".
  it('dona desativada: da imobiliária, com o motivo, e a frase da roleta', () => {
    render(<NumberCard card={card({ owner: { id: 'u1', name: 'Ana', active: false }, shared: true })} />);

    expect(screen.getByText('Da imobiliária (compartilhado) — o cadastro de Ana está desativado')).toBeInTheDocument();
    expect(screen.getByText('Número da imobiliária: quem escreve entra na roleta')).toBeInTheDocument();
  });

  it('sem a regra: mostra o nome gravado e não promete nada', () => {
    render(<NumberCard card={card({ number_owner_rule: false })} />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText(/quem escreve/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Da imobiliária/)).not.toBeInTheDocument();
  });

  it('sem roleta, sem IA e sem telefone: diz, não some', () => {
    render(<NumberCard card={card({ phone: null, roletas: [], ai: [], connection: 'disconnected' })} />);

    expect(screen.getByText('sem telefone gravado')).toBeInTheDocument();
    expect(screen.getByText('desconectado')).toBeInTheDocument();
    expect(screen.getByText('em nenhuma roleta')).toBeInTheDocument();
    expect(screen.getByText('nenhuma IA atende aqui')).toBeInTheDocument();
  });

  it('fala número, nunca instância, inbox ou caixa de entrada', () => {
    const { container } = render(<NumberCard card={card({ owner: null, shared: true })} />);
    expect(container.textContent).not.toMatch(/instância|inbox|caixa de entrada/i);
  });
});
