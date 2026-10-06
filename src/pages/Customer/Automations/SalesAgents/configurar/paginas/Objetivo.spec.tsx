import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Objetivo from './Objetivo';

describe('Objetivo', () => {
  it('2 cartões e a linha da conversa (Agenda só com visita)', () => {
    render(<Objetivo agent={agenteDeTeste({ reach: 'qualify' })} inboxes={[]} gravar={gravarDeTeste('objetivo')} irPara={vi.fn()} diagnostico={null} />);
    expect(screen.getByRole('radio', { name: 'Qualificar e passar' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Agenda a visita')).toBeNull();
  });

  it('"Qualificar e passar" com o critério "Visita marcada" corrige o critério pro das obrigatórias (mantém o resumo)', async () => {
    const gravar = gravarDeTeste('objetivo');
    render(<Objetivo agent={agenteDeTeste({ reach: 'visit', transfer_config: { mode: 'pos_visita', briefing_enabled: false } })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Qualificar e passar' }));
    expect(gravar).toHaveBeenCalledWith(
      { reach: 'qualify', booking_enabled: false, transfer_config: { mode: 'checklist', briefing_enabled: false } },
      ['transfer_config.mode'],
    );
  });
});
