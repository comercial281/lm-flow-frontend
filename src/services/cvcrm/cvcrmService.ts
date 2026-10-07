import api from '@/services/core/api';

// Integrações → CVCRM (06/10/2026): a conexão do cliente com o CVCRM dele, uma por
// cliente, usada pelas IAs que mandam o lead pro CVCRM. O token entra e nunca volta.

export interface CvcrmStatus {
  connected: boolean;
  subdomain: string | null;
  email: string | null;
  /** 'unreadable' = o token guardado não abre mais: troque. */
  token_state: 'none' | 'ready' | 'unreadable';
  connected_at: string | null;
  /** A mídia do CVCRM em que caem os leads do LM Flow: número (o certo) ou nome. */
  midia: string | null;
  agents_using: number;
}

export interface CvcrmConexaoNova {
  subdomain: string;
  email: string;
  token: string;
}

const BASE = '/cvcrm_connection';

export const cvcrmService = {
  async get(): Promise<CvcrmStatus> {
    const res = await api.get(BASE);
    return (res.data as { data: CvcrmStatus }).data;
  },

  /** Testa com o CVCRM e grava. Erro = a frase do servidor (token errado, sem permissão…). */
  async connect(dados: CvcrmConexaoNova): Promise<CvcrmStatus & { empreendimentos_count: number }> {
    const res = await api.put(BASE, dados);
    return (res.data as { data: CvcrmStatus & { empreendimentos_count: number } }).data;
  },

  /** Grava só a mídia (sem pedir o token de novo). Vazio tira a mídia. */
  async setMidia(midia: string): Promise<CvcrmStatus> {
    const res = await api.put(BASE, { midia });
    return (res.data as { data: CvcrmStatus }).data;
  },

  async disconnect(): Promise<CvcrmStatus> {
    const res = await api.delete(BASE);
    return (res.data as { data: CvcrmStatus }).data;
  },
};

export default cvcrmService;
