import api from '@/services/core/api';
import type {
  FlowAutomation,
  FlowAutomationFolder,
  SaveFlowPayload,
  TestRunResult,
} from '@/types/flowAutomations';

// Envelope do backend: { success: true, data: T } — mesmo padrão de
// messageFunnelsService (feedback_response_envelope_pattern).
function unwrap<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

class FlowAutomationsService {
  private get baseUrl(): string {
    return '/flow_automations';
  }

  async list(params: { search?: string; folderId?: string | null } = {}): Promise<FlowAutomation[]> {
    const response = await api.get(this.baseUrl, {
      params: {
        ...(params.search ? { search: params.search } : {}),
        ...(params.folderId !== undefined ? { folder_id: params.folderId ?? '' } : {}),
      },
    });
    return unwrap<FlowAutomation[]>(response);
  }

  async get(id: string): Promise<FlowAutomation> {
    return unwrap<FlowAutomation>(await api.get(`${this.baseUrl}/${id}`));
  }

  async create(payload: { name: string; folder_id?: string | null }): Promise<FlowAutomation> {
    return unwrap<FlowAutomation>(await api.post(this.baseUrl, payload));
  }

  async update(id: string, payload: Partial<Pick<FlowAutomation, 'name' | 'folder_id' | 'trigger' | 'reentry_window_hours' | 'max_depth'>>): Promise<FlowAutomation> {
    return unwrap<FlowAutomation>(await api.patch(`${this.baseUrl}/${id}`, payload));
  }

  async destroy(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async saveFlow(id: string, payload: SaveFlowPayload): Promise<FlowAutomation> {
    return unwrap<FlowAutomation>(await api.put(`${this.baseUrl}/${id}/save_flow`, payload));
  }

  async movePositions(id: string, positions: Array<{ id: string; pos_x: number; pos_y: number }>): Promise<void> {
    await api.patch(`${this.baseUrl}/${id}/move_nodes`, { positions });
  }

  async toggle(id: string): Promise<FlowAutomation> {
    return unwrap<FlowAutomation>(await api.post(`${this.baseUrl}/${id}/toggle`));
  }

  async archive(id: string): Promise<FlowAutomation> {
    return unwrap<FlowAutomation>(await api.post(`${this.baseUrl}/${id}/archive`));
  }

  async unarchive(id: string): Promise<FlowAutomation> {
    return unwrap<FlowAutomation>(await api.post(`${this.baseUrl}/${id}/unarchive`));
  }

  async duplicate(id: string): Promise<FlowAutomation> {
    return unwrap<FlowAutomation>(await api.post(`${this.baseUrl}/${id}/duplicate`));
  }

  async testRun(id: string, params: { contact_id?: string; test_contact?: Record<string, string>; forced?: Record<string, 'yes' | 'no'> } = {}): Promise<TestRunResult> {
    return unwrap<TestRunResult>(await api.post(`${this.baseUrl}/${id}/test_run`, params));
  }
}

class FlowAutomationFoldersService {
  private get baseUrl(): string {
    return '/flow_automation_folders';
  }

  async list(): Promise<FlowAutomationFolder[]> {
    return unwrap<FlowAutomationFolder[]>(await api.get(this.baseUrl));
  }

  async create(payload: { name: string; color?: string; position?: number }): Promise<FlowAutomationFolder> {
    return unwrap<FlowAutomationFolder>(await api.post(this.baseUrl, { flow_automation_folder: payload }));
  }

  async update(id: string, payload: Partial<{ name: string; color: string; position: number }>): Promise<FlowAutomationFolder> {
    return unwrap<FlowAutomationFolder>(await api.patch(`${this.baseUrl}/${id}`, { flow_automation_folder: payload }));
  }

  async destroy(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }
}

export const flowAutomationsService = new FlowAutomationsService();
export const flowAutomationFoldersService = new FlowAutomationFoldersService();
