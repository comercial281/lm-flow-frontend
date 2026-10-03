import api from '@/services/core/api';
import type {
  FlowAutomation,
  FlowAutomationFolder,
  SaveFlowPayload,
  TestRunResult,
} from '@/types/flowAutomations';
import {
  formsFrom,
  questionsFrom,
  type FlowForm,
  type FormQuestionsResult,
  type FormSource,
} from '@/features/flowAutomations/formAnswer';
import { appliedFlowFrom, templatesFrom, type FlowTemplate } from '@/features/flowAutomations/templates';

// Envelope do backend: { success: true, data: T } — mesmo padrão de
// messageFunnelsService (feedback_response_envelope_pattern).
function unwrap<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

// As rotas novas da sprint 1 (formulários da condição): aceita com ou sem o
// envelope `{ data }`, porque o contrato descreve só o corpo.
function unwrapLoose(response: { data: unknown }): unknown {
  const body = response.data as { data?: unknown } | null;
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
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

  // Formulários pro critério "Resposta do formulário": os do anúncio (Meta) e os do site.
  async forms(): Promise<FlowForm[]> {
    return formsFrom(unwrapLoose(await api.get(`${this.baseUrl}/forms`)));
  }

  // Perguntas de um formulário. Falha do Meta volta com `error` em português (status 200).
  async formQuestions(source: FormSource, formId: string): Promise<FormQuestionsResult> {
    return questionsFrom(unwrapLoose(await api.get(`${this.baseUrl}/form_questions`, { params: { source, form_id: formId } })));
  }

  // Modelos (sprint 2): a lista e "usar o modelo", que cria o fluxo desligado.
  async templates(): Promise<FlowTemplate[]> {
    return templatesFrom((await api.get(`${this.baseUrl}/templates`)).data);
  }

  async applyTemplate(key: string): Promise<FlowAutomation> {
    return appliedFlowFrom<FlowAutomation>((await api.post(`${this.baseUrl}/templates/${encodeURIComponent(key)}/apply`)).data);
  }

  async update(id: string, payload: Partial<Pick<FlowAutomation, 'name' | 'folder_id' | 'trigger' | 'reentry_window_hours' | 'once_per_lead' | 'max_depth'>>): Promise<FlowAutomation> {
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
