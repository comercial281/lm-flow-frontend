import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeloDoFollowup from './SeloDoFollowup';

describe('SeloDoFollowup', () => {
  it('mostra Follow-up ativo', () => {
    render(<SeloDoFollowup followup={{ state: 'active', flow_name: 'Pós-visita', reason: null }} />);
    const selo = screen.getByText('Follow-up ativo');
    expect(selo).toHaveAttribute('title', 'Pós-visita');
    expect(selo).toHaveAttribute('data-followup', 'active');
  });

  it('nome mascarado vai no title como veio', () => {
    render(<SeloDoFollowup followup={{ state: 'active', flow_name: 'Follow-up de Ana', flow_masked: true, reason: null }} />);
    expect(screen.getByText('Follow-up ativo')).toHaveAttribute('title', 'Follow-up de Ana');
  });

  it('mostra Pausado com o motivo no title', () => {
    render(<SeloDoFollowup followup={{ state: 'paused', flow_name: 'Pós-visita', reason: 'Número desconectado' }} />);
    const selo = screen.getByText('Pausado');
    expect(selo).toHaveAttribute('title', 'Número desconectado');
    expect(selo).toHaveAttribute('data-followup', 'paused');
  });

  it('não mostra nada sem follow-up', () => {
    const { container } = render(<SeloDoFollowup followup={null} />);
    expect(container).toBeEmptyDOMElement();
    const { container: c2 } = render(<SeloDoFollowup followup={undefined} />);
    expect(c2).toBeEmptyDOMElement();
  });
});
