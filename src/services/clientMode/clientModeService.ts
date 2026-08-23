import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { ClientModeTenant } from '@/store/clientModeStore';

// ─────────────────────────────────────────────────────────────────────────────
// Serviço do Modo Cliente.
//
// Estas chamadas são de SUPER-ADMIN e precisam SEMPRE do token RAIZ, sem header
// X-Tenant (rodam no schema public, onde vive `saas_tenants`). Por isso NÃO usam
// a instância `api` (que, em modo cliente, já carrega o token/slug do cliente) —
// montam um axios cru com o token raiz explícito.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `${import.meta.env.VITE_API_URL}/api/v1`;

function rootAuth() {
  const token =
    useAuthStore.getState().accessToken ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('access_token');
  if (!token) throw new Error('Sessão raiz ausente — refaça login como super-admin.');
  return { Authorization: `Bearer ${token}` };
}

export interface PooledTenant {
  id: string;
  name: string;
  slug: string;
  schema_name: string;
  status: string;
  members?: number;
  login_url?: string;
  settings?: { enabled_features?: Record<string, boolean> } & Record<string, unknown>;
}

/** Lista os clientes (tenants) do pool. Só super-admin. */
export async function listPooledTenants(): Promise<PooledTenant[]> {
  const r = await axios.get(`${BASE}/super/pooled_tenants`, { headers: rootAuth() });
  return r.data?.data || [];
}

/**
 * Cunha um token válido DENTRO do schema do cliente, via o mesmo endpoint SSO
 * do "Entrar 1-clique". O backend devolve uma URL `.../sso?token=XXX`; extraímos
 * o token cru pra usar como Bearer no Modo Cliente (sem redirecionar).
 */
export async function mintClientToken(tenantId: string): Promise<string> {
  const r = await axios.post(
    `${BASE}/super/pooled_tenants/${tenantId}/sso`,
    {},
    { headers: rootAuth() },
  );
  const url: string | undefined = r.data?.data?.url;
  const direct: string | undefined = r.data?.data?.token;
  const token = direct || extractTokenFromUrl(url);
  if (!token) throw new Error('Não consegui gerar o acesso ao cliente (token ausente).');
  return token;
}

function extractTokenFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const q = url.split('?')[1] || '';
    const params = new URLSearchParams(q);
    return params.get('token');
  } catch {
    return null;
  }
}

export function tenantToClientMode(t: PooledTenant): ClientModeTenant {
  return { id: t.id, slug: t.slug, schema: t.schema_name, name: t.name };
}

// ─── Requisições escopadas a um tenant específico (pro "aplicar em massa") ────
// Usam um token cunhado DENTRO do tenant + X-Tenant do slug, sem depender do
// estado global do Modo Cliente. Assim o loop pode falar com N clientes.

async function tenantRequest<T = unknown>(
  token: string,
  slug: string,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  body?: unknown,
): Promise<T> {
  const r = await axios.request<T>({
    method,
    url: `${BASE}${path}`,
    data: body,
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant': slug },
  });
  return r.data;
}

export interface RemoteSequence {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  stop_on_reply: boolean;
  business_hours_only: boolean;
  steps: Array<{
    position: number;
    delay_minutes: number;
    message_type: string;
    content?: string;
    media_url?: string | null;
    media_caption?: string | null;
    tag_on_send?: string | null;
    move_to_stage_slug?: string | null;
  }>;
}

/** Lista as sequências de follow-up de um cliente (via token do próprio cliente). */
export async function listTenantSequences(token: string, slug: string): Promise<RemoteSequence[]> {
  const data = await tenantRequest<{ data: RemoteSequence[] }>(token, slug, 'get', '/followup_sequences');
  return data?.data || [];
}

/** Cria uma sequência de follow-up dentro de um cliente, replicando os steps. */
export async function createTenantSequence(
  token: string,
  slug: string,
  seq: RemoteSequence,
): Promise<void> {
  const payload = {
    followup_sequence: {
      name: seq.name,
      slug: seq.slug,
      description: seq.description ?? '',
      is_active: seq.is_active,
      stop_on_reply: seq.stop_on_reply,
      business_hours_only: seq.business_hours_only,
      followup_steps_attributes: (seq.steps || []).map(s => ({
        position: s.position,
        delay_minutes: s.delay_minutes,
        message_type: s.message_type,
        content: s.content ?? '',
        media_url: s.media_url ?? null,
        media_caption: s.media_caption ?? null,
        tag_on_send: s.tag_on_send ?? null,
        move_to_stage_slug: s.move_to_stage_slug ?? null,
      })),
    },
  };
  await tenantRequest(token, slug, 'post', '/followup_sequences', payload);
}
