import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

const getAll = vi.hoisted(() => vi.fn());
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({ roletaConfigService: { getAll } }));
vi.mock('@/store/appDataStore', () => ({ useAppDataStore: (f: (s: unknown) => unknown) => f({ account: { name: 'Bloco Imob' } }) }));
import Identidade from './Identidade';

beforeEach(() => { getAll.mockReset(); getAll.mockResolvedValue([{ id: 'r1', inbox_id: 'inbox-1', is_active: true }]); });

describe('Identidade', () => {
  it('2 personas (O corretor · Consultora da imobiliária); IA "dono" antiga aparece como Consultora', () => {
    render(<Identidade agent={agenteDeTeste({ persona_kind: 'owner' })} inboxes={[]} gravar={gravarDeTeste('identidade')} irPara={vi.fn()} diagnostico={null} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Consultora da imobiliária' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/Dono da imobiliária/)).toBeNull();
  });

  it('trocar pra Consultora grava a persona, tira a voz de corretor e leva o lead pra roleta do número', async () => {
    const gravar = gravarDeTeste('identidade');
    render(<Identidade agent={agenteDeTeste({ handoff_target: 'number_owner', handoff_user_id: null })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    await screen.findByRole('radio', { name: 'O corretor' });
    await new Promise((r) => setTimeout(r, 0)); // roletas carregadas
    await userEvent.click(screen.getByRole('radio', { name: 'Consultora da imobiliária' }));
    expect(gravar).toHaveBeenCalledWith({
      persona_kind: 'assistant', transfer_config: { mode: 'checklist', required_questions: ['Renda'] },
      handoff_target: 'roleta', handoff_roleta_config_id: 'r1', handoff_user_id: null,
    }, ['transfer_config.voice']);
  });

  // Revisão final da onda 3 (M3): o clique antes de a lista de roletas chegar
  // gravava a roleta vazia mesmo com roleta no número.
  it('persona escolhida antes de as roletas chegarem espera a lista e grava a roleta do número', async () => {
    let soltar: (v: unknown) => void = () => {};
    getAll.mockReturnValue(new Promise((res) => { soltar = res; }));
    const gravar = gravarDeTeste('identidade');
    render(<Identidade agent={agenteDeTeste({ handoff_target: 'number_owner', handoff_user_id: null })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Consultora da imobiliária' }));
    expect(gravar).not.toHaveBeenCalled();
    soltar([{ id: 'r1', inbox_id: 'inbox-1', is_active: true }]);
    await waitFor(() => expect(gravar).toHaveBeenCalledWith(expect.objectContaining({ handoff_target: 'roleta', handoff_roleta_config_id: 'r1' }), ['transfer_config.voice']));
  });

  it('nomes gravam ao sair; o balão usa o nome que o lead vê e a imobiliária', async () => {
    const gravar = gravarDeTeste('identidade');
    render(<><Identidade agent={agenteDeTeste({ persona_kind: 'assistant', lead_facing_name: null })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>);
    await userEvent.type(screen.getByLabelText('Nome que o lead vê'), 'Sara');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenCalledWith({ lead_facing_name: 'Sara' });
    expect(screen.getByText(/Bloco Imob/)).toBeInTheDocument();
  });

  it('corretor num número sem dono: aviso vermelho', () => {
    render(<Identidade agent={agenteDeTeste({ number_owner_id: null })} inboxes={[]} gravar={gravarDeTeste('identidade')} irPara={vi.fn()} diagnostico={null} />);
    expect(screen.getByText(/não tem corretor dono/)).toBeInTheDocument();
  });
});
