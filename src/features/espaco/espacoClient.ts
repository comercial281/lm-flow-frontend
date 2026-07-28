// Espaço — cliente de dados. Porte do dashNotionClient do LM Hub (que batia na
// edge function `share-notion`); aqui bate na API Rails do LM Flow.
//
// Dois modos:
//   - 'auth'   → usuário LOGADO do tenant. Usa a instância axios central
//                (`@/services/core/api`, baseURL /api/v1) que já injeta
//                Authorization + X-Tenant + refresh. Corpo: { op, ...payload }.
//   - 'public' → link público anônimo por token. Instância sem auth em
//                /api/public/v1 (mesma convenção do onboarding público).
//                Corpo: { token, op, ...payload }.
//
// NOTA: no LM Hub o campo era `action`; aqui o backend espera `op`.
// As respostas são iguais às do share-notion (corpo cru, sem envelope).

import axios from 'axios'
import api from '@/services/core/api'

export type EspacoMode = 'auth' | 'public'

// Cliente sem auth pro link público (rota truly public /api/public/v1/espaco).
const espacoPublicApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/public/v1`,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Chama uma op do módulo Espaço.
 * Em erro lança Error com `name` = código do backend (invalid_token,
 * token_expired, dash_paused, client_inactive, not_found, forbidden,
 * server_error), preservando o contrato do share-notion.
 */
export async function call<T = unknown>(
  mode: EspacoMode,
  token: string,
  op: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  try {
    if (mode === 'public') {
      const { data } = await espacoPublicApi.post('/espaco', { token, op, ...payload })
      return data as T
    }
    const { data } = await api.post('/espaco', { op, ...payload })
    return data as T
  } catch (e) {
    let code = 'server_error'
    if (axios.isAxiosError(e)) {
      const body = e.response?.data as { error?: string } | undefined
      code = body?.error ?? (e.response ? `http_${e.response.status}` : 'network_error')
    }
    const err = new Error(code)
    err.name = code
    throw err
  }
}
