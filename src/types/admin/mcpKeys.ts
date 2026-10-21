// src/types/admin/mcpKeys.ts
// Admin → Plataforma → Chaves do MCP. Espelha Api::V1::Super::McpKeysController.
export interface ChaveMcp {
  id: string;
  name: string;
  key_prefix: string;
  created_by_email: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  active: boolean;
  /** "Pode editar modelos": a única chave que muda os 4 modelos da IA Vendedora pelo MCP. */
  can_edit_models: boolean;
}

/** Só a resposta de "gerar" traz o endereço completo (com a chave). */
export interface ChaveMcpGerada extends ChaveMcp { url: string }
