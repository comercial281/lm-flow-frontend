import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

const voices = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, voices } };
});
const openSupport = vi.hoisted(() => vi.fn());
vi.mock('@/components/support/openSupport', () => ({ openSupport }));
import Personalidade from './Personalidade';

const VOZES = [
  { id: 'sergio', nome: 'Sergio', descricao: 'Masculina, grave e clara', genero: 'masculina', preview_url: 'https://x/s.mp3' },
  { id: 'ana', nome: 'Ana', descricao: 'Feminina, calorosa', genero: 'feminina', preview_url: null },
];

beforeEach(() => { voices.mockReset().mockResolvedValue(VOZES); openSupport.mockReset(); });

const abrir = (agent = agenteDeTeste()) => {
  const gravar = gravarDeTeste('personalidade');
  render(<Personalidade agent={agent} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
  return gravar;
};

describe('Personalidade', () => {
  it('ligar o áudio grava o modo "quando o lead mandar áudio" se estava "nunca"', async () => {
    const gravar = abrir(agenteDeTeste({ audio_enabled: false, audio_mode: 'never' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Responder em áudio' }));
    expect(gravar).toHaveBeenCalledWith({ audio_enabled: true, audio_mode: 'mirror' });
  });

  it('vozes do catálogo com "Ouvir"; escolher grava; voz própria aparece como "Voz própria"', async () => {
    const gravar = abrir(agenteDeTeste({ audio_enabled: true, audio_mode: 'mirror', audio_voice_id: 'combinada-123' }));
    expect(await screen.findByRole('radio', { name: 'Sergio' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Voz própria' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Ouvir Ana' })).toBeDisabled(); // sem amostra
    await userEvent.click(screen.getByRole('radio', { name: 'Sergio' }));
    expect(gravar).toHaveBeenCalledWith({ audio_voice_id: 'sergio' });
  });

  it('"Falar com a equipe" abre o chat de suporte', async () => {
    abrir(agenteDeTeste({ audio_enabled: true }));
    await userEvent.click(await screen.findByRole('button', { name: 'Falar com a equipe' }));
    expect(openSupport).toHaveBeenCalled();
  });

  it('curtidas: emojis em etiquetas gravam a lista', async () => {
    const gravar = abrir(agenteDeTeste({ reaction_enabled: true, reaction_emojis: ['👍'] }));
    await userEvent.click(screen.getByRole('button', { name: 'Usar ❤️' }));
    expect(gravar).toHaveBeenCalledWith({ reaction_emojis: ['👍', '❤️'] });
  });
});
