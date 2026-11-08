// src/types/admin/mcpKeys.ts
// Admin → Plataforma → Chaves do MCP. Espelha Api::V1::Super::McpKeysController.
export type PerfilChaveMcp = 'operator' | 'owner' | 'agent';

export interface ChaveMcp {
  id: string;
  name: string;
  key_prefix: string;
  created_by_email: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  active: boolean;
  profile: PerfilChaveMcp;
  /** Vencimento: operador e dono 90 dias, agente 30, contados da criação. Não renova. */
  expires_at: string | null;
  expired: boolean;
  /** Clientes (schema_name) que a chave alcança. Nulo = todos. */
  tenant_schemas: string[] | null;
  /** IPs aceitos. Nulo = livre. */
  allowed_ips: string[] | null;
  /** A chave também funciona dentro do endereço (conector do navegador ou celular). */
  url_allowed: boolean;
}

/** Só a resposta de "gerar" traz a chave crua, o endereço e o cabeçalho. */
export interface ChaveMcpGerada extends ChaveMcp { key: string; url: string; header: string }

export interface ClienteMcp { schema_name: string; slug: string; name: string }

export interface NovaChaveMcp {
  name: string;
  profile: PerfilChaveMcp;
  tenant_schemas?: string[];
  allowed_ips?: string[];
  url_allowed?: boolean;
}
