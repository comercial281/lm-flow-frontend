import apiClient from '@/services/core/api';

export interface WhatsappSendResult {
  sent: boolean;
  skipped?: string;
  http?: string | number;
  jid?: string;
  instance?: string;
  error?: string;
}

export interface CentralInstance {
  name: string;
  connected: boolean;
}

export interface MemberAccessConfig {
  template: string;
  instance: string;
  enabled: boolean;
  default_template: string;
}

const clientInstancesService = {
  // Instancias Evolution centrais da Leal Midia (remetentes) — reusa o endpoint dos comunicados.
  centralInstances: () =>
    apiClient.get<{ data: CentralInstance[] }>('/super/pooled_tenants/instances'),

  // Config global do "acesso por WhatsApp" (template + instancia padrao + on/off)
  getMemberAccessConfig: () =>
    apiClient.get<{ data: MemberAccessConfig }>('/super/member_access_config'),

  saveMemberAccessConfig: (payload: Partial<Pick<MemberAccessConfig, 'template' | 'instance' | 'enabled'>>) =>
    apiClient.put<{ data: MemberAccessConfig }>('/super/member_access_config', payload),
};

export default clientInstancesService;
