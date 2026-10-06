import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Criterio from './Criterio';

const abrir = (extra = {}) => {
  const gravar = gravarDeTeste('criterio');
  render(<Criterio agent={agenteDeTeste(extra)} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
  return gravar;
};

describe('Critério', () => {
  it('Lead quente grava o modo com Quente de partida e mostra Morno/Quente', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Lead quente' }));
    expect(gravar).toHaveBeenCalledWith(
      { transfer_config: { mode: 'temperatura', min_temperature: 'hot', required_questions: ['Renda'], voice: 'first_person' } },
      ['transfer_config.mode', 'transfer_config.min_temperature'],
    );
  });

  it('"Visita marcada" travado quando o objetivo não é visita', () => {
    abrir({ reach: 'qualify' });
    expect(screen.getByRole('radio', { name: 'Visita marcada' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('opção antiga só aparece pra quem tem, marcada "(opção antiga)"', () => {
    abrir({ transfer_config: { mode: 'sem_resposta' } });
    expect(screen.getByRole('radio', { name: 'Só quando ela não souber responder (opção antiga)' })).toHaveAttribute('aria-checked', 'true');
  });

  it('lead frio e as 3 chaves da passagem imediata gravam na hora', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('switch', { name: 'Passar também lead frio ou curioso' }));
    expect(gravar).toHaveBeenLastCalledWith({ crm_policy: { cold: true, capture: false, invalid: true } }, ['crm_policy.cold']);
    await userEvent.click(screen.getByRole('switch', { name: 'Perguntou se é robô' }));
    expect(gravar).toHaveBeenLastCalledWith({ escalate_on_ai_detected: false });
  });
});
