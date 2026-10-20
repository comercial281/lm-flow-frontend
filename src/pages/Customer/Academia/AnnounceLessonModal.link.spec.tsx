import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AnnounceLessonModal from './AnnounceLessonModal';

const s = vi.hoisted(() => ({ config: vi.fn(), preview: vi.fn() }));
vi.mock('@/services/academy/academyAnnouncementsService', () => ({
  academyAnnouncementsService: {
    config: s.config,
    instances: vi.fn().mockResolvedValue({ data: { data: [] } }),
    groups: vi.fn().mockResolvedValue({ data: { data: [], hidden: 0 } }),
    preview: s.preview,
    saveConfig: vi.fn(),
    send: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const CONFIG = {
  template: 'Aula nova: {{titulo}} {{link}}', instance: 'lm', enabled: true, groups: [],
  default_template: '', variables: [], history: [],
};

beforeEach(() => {
  s.config.mockReset().mockResolvedValue({ data: { data: CONFIG } });
  s.preview.mockReset().mockResolvedValue({ data: { data: { text: 'prévia' } } });
});

// O link da aula vai pros grupos de WhatsApp: com UUID, o WhatsApp lê "chave Pix"
// e o link para de abrir. Vai com o código (features/links/codigoDoLink.ts).
describe('AnnounceLessonModal · link da aula sem cara de chave Pix', () => {
  it('o caminho mandado pro servidor leva o código do curso e da aula', async () => {
    render(
      <AnnounceLessonModal
        lesson={{ id: '0b6f5c1a-3d2e-4f10-8a9b-c7d6e5f40312', titulo: 'Aula 1' }}
        courseId="829a6b1e-8259-4c3d-9e2f-0a1b2c3d4e5f"
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(s.preview).toHaveBeenCalled(), { timeout: 5000 });
    expect(s.preview.mock.calls[0][0].path).toBe('/academia/curso/H8PhzFPbgreJefMBgig7ux?lesson=2Qu7ReJ5bTo99bHR2atWs3');
  });
});
