import api from '@/services/core/api';

export interface Contract {
  id: string;
  status: 'draft' | 'generating' | 'awaiting_signature' | 'signed' | 'rejected' | 'error';
  proposal_id: string;
  contract_template_id?: string | null;
  document_url?: string | null;
  signature_request_id?: string | null;
  signature_url_client?: string | null;
  signature_url_lm?: string | null;
  signed_at?: string | null;
  error_message?: string | null;
  proposal?: {
    id: string;
    proposal_type: 'purchase' | 'rent';
    contact?: { id: string; name: string } | null;
    property?: { id: string; title: string } | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  proposal_type?: 'purchase' | 'rent' | null;
  is_default: boolean;
  active: boolean;
  variables: string[];
  file_url?: string | null;
  file_attached: boolean;
  created_at: string;
  updated_at: string;
}

const BASE = '/contracts';
const TEMPLATES_BASE = '/contract_templates';

export const contractsService = {
  async list(params: Record<string, string | number | boolean | undefined> = {}): Promise<{ data: Contract[]; meta: { total: number } }> {
    const res = await api.get(BASE, { params });
    return res.data as { data: Contract[]; meta: { total: number } };
  },

  async get(id: string): Promise<Contract> {
    const res = await api.get(`${BASE}/${id}`);
    return (res.data as { data: Contract }).data;
  },

  async generate(proposalId: string, contractTemplateId?: string): Promise<void> {
    await api.post(BASE, { proposal_id: proposalId, contract_template_id: contractTemplateId });
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE}/${id}`);
  },
};

export const contractTemplatesService = {
  async list(params: Record<string, string | boolean | undefined> = {}): Promise<{ data: ContractTemplate[] }> {
    const res = await api.get(TEMPLATES_BASE, { params });
    return res.data as { data: ContractTemplate[] };
  },

  async create(name: string, proposalType?: 'purchase' | 'rent'): Promise<ContractTemplate> {
    const res = await api.post(TEMPLATES_BASE, { contract_template: { name, proposal_type: proposalType } });
    return (res.data as { data: ContractTemplate }).data;
  },

  async update(id: string, data: Partial<Pick<ContractTemplate, 'name' | 'proposal_type' | 'is_default' | 'active'>>): Promise<ContractTemplate> {
    const res = await api.put(`${TEMPLATES_BASE}/${id}`, { contract_template: data });
    return (res.data as { data: ContractTemplate }).data;
  },

  async upload(id: string, file: File): Promise<ContractTemplate> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`${TEMPLATES_BASE}/${id}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return (res.data as { data: ContractTemplate }).data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${TEMPLATES_BASE}/${id}`);
  },
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft:               'Rascunho',
  generating:          'Gerando...',
  awaiting_signature:  'Aguardando assinatura',
  signed:              'Assinado',
  rejected:            'Recusado',
  error:               'Erro',
};

export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft:               'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  generating:          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  awaiting_signature:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  signed:              'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected:            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  error:               'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
