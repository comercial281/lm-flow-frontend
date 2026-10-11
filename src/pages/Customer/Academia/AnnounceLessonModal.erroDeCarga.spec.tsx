import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnounceLessonModal from './AnnounceLessonModal';

const s = vi.hoisted(() => ({
  config: vi.fn(), instances: vi.fn(), groups: vi.fn(), preview: vi.fn(),
}));
vi.mock('@/services/academy/academyAnnouncementsService', () => ({
  academyAnnouncementsService: {
    config: s.config, instances: s.instances, groups: s.groups, preview: s.preview,
    saveConfig: vi.fn(), send: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const CONFIG = {
  template: 'Aula nova: {{titulo}}', instance: 'lm', enabled: true, groups: [], default_template: '', variables: [],
  history: [{ at: '2026-10-10T12:00:00Z', lesson_id: 'x', titulo: 'Aula antiga', curso: 'c', instance: 'lm', by: 'Tony', sent: 1, total: 1, groups: [] }],
};
const aula = { id: 'l1', titulo: 'Aula 1' };

beforeEach(() => {
  s.config.mockReset();
  s.instances.mockReset().mockResolvedValue({ data: { data: [] } });
  s.groups.mockReset().mockResolvedValue({ data: { data: [], hidden: 0 } });
  s.preview.mockReset().mockResolvedValue({ data: { data: { text: 'prévia' } } });
});

describe('AnnounceLessonModal · erro de carga', () => {
  it('carga que falha mostra o erro com Tentar de novo, não "Nenhum aviso enviado"', async () => {
    s.config.mockRejectedValueOnce(new Error('rede'));
    render(<AnnounceLessonModal lesson={aula} courseId="c1" onClose={() => {}} />);
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum aviso/)).toBeNull();
    s.config.mockResolvedValueOnce({ data: { data: CONFIG } });
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/Ver os últimos avisos \(1\)/)).toBeInTheDocument();
  });

  it('Tentar de novo duas vezes seguidas não duplica a tela', async () => {
    s.config.mockRejectedValueOnce(new Error('rede'));
    render(<AnnounceLessonModal lesson={aula} courseId="c1" onClose={() => {}} />);
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    s.config.mockResolvedValue({ data: { data: CONFIG } });
    await userEvent.dblClick(botao);
    expect(await screen.findAllByText(/Ver os últimos avisos/)).toHaveLength(1);
  });
});
