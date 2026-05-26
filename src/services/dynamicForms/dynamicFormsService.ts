import api from '@/services/core/api';

export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  textarea: 'Texto longo',
  number: 'Número inteiro',
  decimal: 'Número decimal',
  date: 'Data',
  datetime: 'Data e hora',
  email: 'E-mail',
  phone: 'Telefone',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  cep: 'CEP',
  currency: 'Valor (R$)',
  select: 'Seleção única',
  multiselect: 'Seleção múltipla',
  radio: 'Opção (radio)',
  checkbox: 'Caixas de seleção',
  boolean: 'Sim/Não',
  file: 'Arquivo',
  address: 'Endereço',
  signature: 'Assinatura',
};

export const ROLE_TYPE_LABELS: Record<string, string> = {
  buyer: 'Comprador',
  seller: 'Vendedor',
  tenant: 'Inquilino',
  landlord: 'Proprietário',
  guarantor: 'Fiador',
  agent: 'Corretor',
  other: 'Outro',
};

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

export const SUBMISSION_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export interface FormField {
  id: string;
  name: string;
  label: string;
  help_text?: string | null;
  field_type: string;
  required: boolean;
  position: number;
  placeholder?: string | null;
  default_value?: string | null;
  options?: string[] | null;
  validation?: Record<string, unknown> | null;
}

export interface DynamicForm {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  role_type?: string | null;
  active: boolean;
  is_system: boolean;
  field_count: number;
  submissions_count: number;
  fields?: FormField[];
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  id: string;
  dynamic_form_id: string;
  contact_id?: string | null;
  data: Record<string, unknown>;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DynamicFormFormData {
  name: string;
  slug?: string;
  description?: string;
  role_type?: string;
  active?: boolean;
}

export interface FormFieldFormData {
  name: string;
  label: string;
  help_text?: string;
  field_type: string;
  required?: boolean;
  position?: number;
  placeholder?: string;
  default_value?: string;
  options?: string[];
}

export const dynamicFormsService = {
  async list(params?: { active?: boolean; role_type?: string; with_fields?: boolean }): Promise<{ data: DynamicForm[]; meta: { total: number } }> {
    const res = await api.get('/dynamic_forms', { params });
    return res.data as { data: DynamicForm[]; meta: { total: number } };
  },

  async get(id: string): Promise<DynamicForm> {
    const res = await api.get(`/dynamic_forms/${id}`);
    return (res.data as { data: DynamicForm }).data;
  },

  async create(data: DynamicFormFormData): Promise<DynamicForm> {
    const res = await api.post('/dynamic_forms', { dynamic_form: data });
    return (res.data as { data: DynamicForm }).data;
  },

  async update(id: string, data: Partial<DynamicFormFormData>): Promise<DynamicForm> {
    const res = await api.put(`/dynamic_forms/${id}`, { dynamic_form: data });
    return (res.data as { data: DynamicForm }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/dynamic_forms/${id}`);
  },

  async addField(formId: string, data: FormFieldFormData): Promise<FormField> {
    const res = await api.post(`/dynamic_forms/${formId}/add_field`, { field: data });
    return (res.data as { data: FormField }).data;
  },

  async removeField(formId: string, fieldId: string): Promise<void> {
    await api.delete(`/dynamic_forms/${formId}/remove_field/${fieldId}`);
  },

  async submit(formId: string, contactId: string | undefined, data: Record<string, unknown>): Promise<FormSubmission> {
    const res = await api.post(`/dynamic_forms/${formId}/submit`, { contact_id: contactId, data });
    return (res.data as { data: FormSubmission }).data;
  },
};
