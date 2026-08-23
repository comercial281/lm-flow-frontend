// Espaço — entry do módulo "Notion por tenant" dentro do LM Flow.
// Porte fiel do DashNotion do LM Hub; troca só a camada de dados (API Rails),
// a identidade e o transporte de realtime.
//
// Dois modos:
//   - mode="auth"   → usuário LOGADO do tenant (rota privada /espaco).
//                     Identidade = usuário logado; role 'admin' (edita tudo).
//   - mode="public" → link anônimo por token (rota pública /espaco/:token).
//                     Identidade = 'Convidado'; role 'client'.
//
// react-query: o LM Flow não usa por padrão; envolvemos SÓ a árvore do Espaço
// num QueryClientProvider próprio pra reusar os hooks useDashNotion quase intactos.

import { useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { getTenantSlug } from '@/services/core/tenant'
import DashNotion from './DashNotion'
import type { EspacoMode } from './espacoClient'

interface EspacoProps {
  mode: EspacoMode
  /** Só no modo público: token do link (vem da rota /espaco/:token). */
  token?: string
}

export default function Espaco({ mode, token }: EspacoProps) {
  // Um QueryClient por montagem do módulo (isolado do resto do app).
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
        },
      }),
    [],
  )

  const currentUser = useAuthStore(s => s.currentUser)

  // Identidade + chave de cache por modo.
  const { effToken, role, authorName } = useMemo(() => {
    if (mode === 'public') {
      return {
        effToken: token ?? '',
        role: 'client' as const,
        authorName: 'Convidado',
      }
    }
    // Autenticado: nome do usuário logado; token = slug do tenant só pra cache.
    const name =
      currentUser?.name ||
      (currentUser as { full_name?: string } | null)?.full_name ||
      currentUser?.email ||
      'Você'
    return {
      effToken: getTenantSlug() ?? 'me',
      role: 'admin' as const,
      authorName: name,
    }
  }, [mode, token, currentUser])

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-full min-h-0 p-4">
        <DashNotion mode={mode} token={effToken} role={role} authorName={authorName} />
      </div>
    </QueryClientProvider>
  )
}
