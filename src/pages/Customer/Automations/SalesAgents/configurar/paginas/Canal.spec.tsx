import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

vi.mock('../blocos/TriggersSection', () => ({ TriggersSection: () => <p>condições</p> }));
import Canal from './Canal';

const INBOXES = [{ id: 'inbox-1', name: 'Vendas (11) 98765-4321', oficial: false }, { id: 'inbox-2', name: 'Lançamentos', oficial: false }, { id: 'inbox-3', name: 'Oficial 1', oficial: true }];

function abrir(agent: SalesAgent = agenteDeTeste(), diagnostico: never | null = null) {
  const gravar = gravarDeTeste('canal');
  const irPara = vi.fn();
  render(<Canal agent={agent} inboxes={INBOXES} gravar={gravar} irPara={irPara} diagnostico={diagnostico} />);
  return { gravar, irPara };
}

describe('Canal · API oficial', () => {
  const AVISO = /Pela API oficial a IA responde normalmente quem chamar/;
  it('a opção do número oficial leva o sufixo; os outros não', async () => {
    abrir(agenteDeTeste({ inbox_id: null }));
    expect(screen.getByRole('option', { name: 'Oficial 1 (API oficial)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Lançamentos' })).toBeInTheDocument();
  });
  it('com o oficial escolhido mostra o aviso; com Evolution não', () => {
    abrir(agenteDeTeste({ inbox_id: 'inbox-3' }));
    expect(screen.getByText(AVISO)).toBeInTheDocument();
  });
  it('Evolution escolhido: sem aviso', () => {
    abrir(agenteDeTeste({ inbox_id: 'inbox-1' }));
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});

describe('Canal', () => {
  it('cartão do número com a situação do WhatsApp; Trocar grava na hora', async () => {
    const { gravar } = abrir(agenteDeTeste(), { items: [{ key: 'credentials', label: 'WhatsApp', status: 'ok', detail: '' }] } as never);
    expect(screen.getByText('Vendas (11) 98765-4321')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    await userEvent.selectOptions(screen.getByLabelText('Número de WhatsApp'), 'inbox-2');
    expect(gravar).toHaveBeenCalledWith({ inbox_id: 'inbox-2' });
  });

  it('Modo grava followup_only no clique', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Só follow-up' }));
    expect(gravar).toHaveBeenCalledWith({ followup_only: true });
  });

  it('"Só alguns" abre as condições sem gravar; "Todos os leads" limpa as condições', async () => {
    const { gravar } = abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Só alguns' }));
    expect(screen.getByText('condições')).toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();

    const outra = abrir(agenteDeTeste({ triggers: [{ type: 'tag', value: 'vip' }] }));
    await userEvent.click(screen.getAllByRole('radio', { name: 'Todos os leads' })[1]);
    expect(outra.gravar).toHaveBeenCalledWith({ triggers: [] });
  });

  it('a palavra antiga diz o que faz de verdade e sai com um clique', async () => {
    const { gravar } = abrir(agenteDeTeste({ trigger_keyword: 'call' }));
    expect(screen.getByText('Ela só entra quando o lead escreve "call".')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar essa regra' }));
    expect(gravar).toHaveBeenCalledWith({ trigger_keyword: null });
  });

  describe('situação do número (11/10/2026)', () => {
    const com = (status: string, detail = '') => ({ items: [{ key: 'credentials', label: 'WhatsApp', status, detail }] } as never);

    it('número novo, sem conversa ainda (ok): Conectado', () => {
      abrir(agenteDeTeste(), com('ok', 'Sem conversa neste canal ainda para conferir.'));
      expect(screen.getByText('Conectado')).toBeInTheDocument();
    });

    it('aviso (warning) não mostra Desconectado', () => {
      abrir(agenteDeTeste(), com('warning'));
      expect(screen.queryByText('Desconectado')).not.toBeInTheDocument();
    });

    it('erro de verdade mostra Desconectado', () => {
      abrir(agenteDeTeste(), com('error'));
      expect(screen.getByText('Desconectado')).toBeInTheDocument();
    });
  });
});
