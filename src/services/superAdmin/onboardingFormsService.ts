import axios from 'axios';
import api from '@/services/core/api';

// Cliente sem auth pro link público de onboarding (rota /api/public/v1, truly public).
const publicApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/public/v1`,
  headers: { 'Content-Type': 'application/json' },
});

// Épico E — form builder universal de onboarding. Super-admin cria o form, envia o
// link público ao cliente, e a resposta cai na Área do Admin.
// Backend super: /api/v1/super/onboarding_forms. Público: /api/public/v1/onboarding_forms/:token.

export interface FormFieldConditional {
  field?: string;
  op?: 'eq' | 'neq' | 'filled';
  value?: string;
}

export interface OnboardingField {
  id: string;
  name: string;
  label: string;
  help_text?: string | null;
  field_type: string;
  required: boolean;
  position: number;
  placeholder?: string | null;
  options?: string[] | null;
  conditional?: FormFieldConditional | Record<string, never>;
}

export interface OnboardingForm {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  folder?: string | null;
  tags: string[];
  archived: boolean;
  field_count: number;
  submissions_count: number;
  fields?: OnboardingField[];
  public_token?: string | null;
  public_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingSubmission {
  id: string;
  data: Record<string, unknown>;
  status: string;
  submitted_at?: string | null;
  created_at: string;
  attachments?: Array<{ filename: string; url: string | null }>;
}

interface Env<T> { success: boolean; data: T; error?: string }

export const FIELD_TYPES: Array<{ value: string; label: string }> = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção única' },
  { value: 'multiselect', label: 'Seleção múltipla' },
  { value: 'checkbox', label: 'Caixas de seleção' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'file', label: 'Arquivo' },
];

export const onboardingFormsService = {
  async list(archived = false): Promise<OnboardingForm[]> {
    const res = await api.get('/super/onboarding_forms', { params: { archived } });
    return (res.data as Env<OnboardingForm[]>).data;
  },
  async get(id: string): Promise<OnboardingForm> {
    const res = await api.get(`/super/onboarding_forms/${id}`);
    return (res.data as Env<OnboardingForm>).data;
  },
  async create(input: { name: string; description?: string }): Promise<OnboardingForm> {
    const res = await api.post('/super/onboarding_forms', input);
    return (res.data as Env<OnboardingForm>).data;
  },
  async update(id: string, patch: Partial<Pick<OnboardingForm, 'name' | 'description' | 'active' | 'folder' | 'tags'>>): Promise<OnboardingForm> {
    const res = await api.put(`/super/onboarding_forms/${id}`, patch);
    return (res.data as Env<OnboardingForm>).data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/super/onboarding_forms/${id}`);
  },
  async duplicate(id: string): Promise<OnboardingForm> {
    const res = await api.post(`/super/onboarding_forms/${id}/duplicate`);
    return (res.data as Env<OnboardingForm>).data;
  },
  async archive(id: string): Promise<void> {
    await api.post(`/super/onboarding_forms/${id}/archive`);
  },
  async unarchive(id: string): Promise<void> {
    await api.post(`/super/onboarding_forms/${id}/unarchive`);
  },
  async generateLink(id: string): Promise<{ public_token: string; public_url: string }> {
    const res = await api.post(`/super/onboarding_forms/${id}/generate_link`);
    return (res.data as Env<{ public_token: string; public_url: string }>).data;
  },
  async submissions(id: string): Promise<OnboardingSubmission[]> {
    const res = await api.get(`/super/onboarding_forms/${id}/submissions`);
    return (res.data as Env<OnboardingSubmission[]>).data;
  },
  async addField(formId: string, field: Partial<OnboardingField>): Promise<OnboardingField> {
    const res = await api.post(`/super/onboarding_forms/${formId}/fields`, field);
    return (res.data as Env<OnboardingField>).data;
  },
  async updateField(formId: string, fieldId: string, patch: Partial<OnboardingField>): Promise<OnboardingField> {
    const res = await api.patch(`/super/onboarding_forms/${formId}/fields/${fieldId}`, patch);
    return (res.data as Env<OnboardingField>).data;
  },
  async removeField(formId: string, fieldId: string): Promise<void> {
    await api.delete(`/super/onboarding_forms/${formId}/fields/${fieldId}`);
  },
};

// Cliente público (sem auth) — usado pela página /formulario/:token.
export const publicOnboardingService = {
  async get(token: string): Promise<{ id: string; name: string; description?: string; fields: OnboardingField[] }> {
    const res = await publicApi.get(`/onboarding_forms/${token}`);
    return (res.data as Env<{ id: string; name: string; description?: string; fields: OnboardingField[] }>).data;
  },
  async submit(token: string, data: Record<string, unknown>, files?: Record<string, File>): Promise<{ id: string }> {
    if (files && Object.keys(files).length > 0) {
      const fd = new FormData();
      fd.append('data', JSON.stringify(data));
      for (const [field, file] of Object.entries(files)) fd.append(`file_${field}`, file);
      const res = await publicApi.post(`/onboarding_forms/${token}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return (res.data as Env<{ id: string }>).data;
    }
    const res = await publicApi.post(`/onboarding_forms/${token}/submit`, { data });
    return (res.data as Env<{ id: string }>).data;
  },
};
