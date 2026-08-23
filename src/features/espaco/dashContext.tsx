// Espaço — contexto do módulo. Identidade e transporte de dados.
//   - mode: 'auth' (usuário logado do tenant) | 'public' (link anônimo por token);
//   - token: chave do link público (só usado no modo 'public'; no 'auth' é o
//     slug do tenant, apenas pra chave de cache do react-query);
//   - role: 'admin' | 'client' (admin edita tudo; client conforme backend);
//   - authorName: nome exibido em presença/autoria;
//   - meId: id aleatório de sessão (crypto.randomUUID), usado onde o CRM usava
//     profile.id (presença da colaboração, cor do cursor).

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import { call as rawCall, type EspacoMode } from './espacoClient'

interface DashCtx {
  mode: EspacoMode
  token: string
  role: 'admin' | 'client'
  authorName: string
  meId: string
  /** call já com mode + token amarrados. */
  call: <T = unknown>(op: string, payload?: Record<string, unknown>) => Promise<T>
}

const Ctx = createContext<DashCtx | null>(null)

export function DashNotionProvider({
  mode, token, role, authorName, children,
}: {
  mode: EspacoMode
  token: string
  role: 'admin' | 'client'
  authorName: string
  children: ReactNode
}) {
  // id de sessão estável enquanto o espaço estiver aberto.
  const meIdRef = useRef<string>(crypto.randomUUID())

  const value = useMemo<DashCtx>(() => ({
    mode,
    token,
    role,
    authorName,
    meId: meIdRef.current,
    call: (op, payload) => rawCall(mode, token, op, payload),
  }), [mode, token, role, authorName])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDashCtx(): DashCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDashCtx precisa estar dentro de <DashNotionProvider>')
  return ctx
}
