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

  // 22/10/2026: as chaves de "passar direto" entraram na Passagem imediata (eram uma
  // seção à parte que repetia a mesma pergunta), e "Pediu ligação" virou parte de
  // "falar com uma pessoa": quem pede ligação cai em pediu_humano e passa de qualquer jeito.
  describe('Passagem imediata única', () => {
    const base = { mode: 'checklist', required_questions: ['Renda'], voice: 'first_person' };
    const nomes = ['Lead irritado', 'Pediu pra falar com uma pessoa ou pediu ligação', 'Perguntou se é robô',
      'Recusou mandar documento', 'Perguntou o que ela não sabe'];

    it('uma seção só, com as 5 chaves ligadas por padrão', () => {
      abrir();
      expect(screen.queryByText('Passa direto, mesmo faltando pergunta')).not.toBeInTheDocument();
      expect(screen.getAllByRole('switch')).toHaveLength(6); // 5 + lead frio
      for (const n of nomes) expect(screen.getByRole('switch', { name: n })).toHaveAttribute('aria-checked', 'true');
    });

    it('a chave de pessoa ou ligação grava as duas coisas no mesmo clique', async () => {
      const gravar = abrir();
      await userEvent.click(screen.getByRole('switch', { name: 'Pediu pra falar com uma pessoa ou pediu ligação' }));
      expect(gravar).toHaveBeenLastCalledWith(
        { escalate_on_human_request: false, transfer_config: { ...base, early_handoff: { pediu_ligacao: false } } },
        ['transfer_config.early_handoff'],
      );
    });

    it('não perde a outra chave já desligada', async () => {
      const gravar = abrir({ transfer_config: { ...base, early_handoff: { nao_sei: false } } });
      expect(screen.getByRole('switch', { name: 'Perguntou o que ela não sabe' })).toHaveAttribute('aria-checked', 'false');
      await userEvent.click(screen.getByRole('switch', { name: 'Recusou mandar documento' }));
      expect(gravar).toHaveBeenLastCalledWith(
        { transfer_config: { ...base, early_handoff: { nao_sei: false, recusou_documento: false } } },
        ['transfer_config.early_handoff'],
      );
    });

    it('trocar o "Quando ela passa" não apaga early_handoff', async () => {
      const gravar = abrir({ transfer_config: { ...base, early_handoff: { pediu_ligacao: false } } });
      await userEvent.click(screen.getByRole('radio', { name: 'Ela decide' }));
      const [patch, campos] = gravar.mock.calls[gravar.mock.calls.length - 1];
      expect(patch.transfer_config?.early_handoff).toEqual({ pediu_ligacao: false });
      expect(campos).toEqual(['transfer_config.mode', 'transfer_config.min_temperature']);
    });

    it('fora do checklist só as 3 de sempre aparecem', () => {
      abrir({ transfer_config: { mode: 'temperatura' } });
      expect(screen.queryByRole('switch', { name: 'Recusou mandar documento' })).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Perguntou o que ela não sabe' })).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Pediu pra falar com uma pessoa ou pediu ligação' })).toBeInTheDocument();
    });
  });
});
