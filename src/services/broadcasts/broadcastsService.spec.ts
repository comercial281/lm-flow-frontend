import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { broadcastsService } from './broadcastsService';

vi.mock('@/services/core/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

describe('broadcastsService (opção Automação)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('automationOptions chama GET /broadcasts/automation_options e devolve a lista', async () => {
    const option = {
      id: 'f1',
      name: 'Boas-vindas',
      team: true,
      owner_name: null,
      number_mode: 'fixed',
      inbox_id: 'i1',
      inbox_name: 'Número 1',
      first_step: { kind: 'text', text: 'Oi', config: {} },
      more_blocks: 2,
      trigger_data: ['visita'],
    };
    vi.mocked(api.get).mockResolvedValue({ data: { data: [option] } } as never);

    const res = await broadcastsService.automationOptions();

    expect(api.get).toHaveBeenCalledWith('/broadcasts/automation_options');
    expect(res).toEqual([option]);
  });

  it('automationOptions devolve lista vazia sem dados', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} } as never);
    expect(await broadcastsService.automationOptions()).toEqual([]);
  });

  it('audiencePreviewFull manda flow_automation_id, include_passed e restart_running', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          count: 5,
          excluded: { opt_out: 1, in_this_flow: 2, already_passed: 3 },
          eta: {},
          flow: { passed: 3, passed_error: 1, running: 2, first_time: 4 },
          forced_inbox: { inbox_id: 'i1', name: 'Número 1' },
        },
      },
    } as never);

    const res = await broadcastsService.audiencePreviewFull('p1', { mode: 'pipeline' } as never, 'i1', {
      flow_automation_id: 'f1',
      include_passed: true,
      restart_running: false,
    });

    expect(api.post).toHaveBeenCalledWith('/broadcasts/audience_preview', {
      pipeline_id: 'p1',
      audience: { mode: 'pipeline' },
      inbox_id: 'i1',
      flow_automation_id: 'f1',
      include_passed: true,
      restart_running: false,
    });
    expect(res.flow).toEqual({ passed: 3, passed_error: 1, running: 2, first_time: 4 });
    expect(res.forced_inbox).toEqual({ inbox_id: 'i1', name: 'Número 1' });
    expect(res.excluded.in_this_flow).toBe(2);
    expect(res.excluded.already_passed).toBe(3);
    expect(res.excluded.busy).toBe(0);
  });

  it('audiencePreviewFull sem automação mantém o corpo antigo e não inventa flow', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { count: 2, excluded: {}, eta: {} } } } as never);

    const res = await broadcastsService.audiencePreviewFull('p1', { mode: 'pipeline' } as never, 'i1');

    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('flow_automation_id');
    expect(body).not.toHaveProperty('include_passed');
    expect(res.flow).toBeUndefined();
    expect(res.forced_inbox).toBeNull();
  });
});
