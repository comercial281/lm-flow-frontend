// DashNotion — "Notion por cliente" DENTRO do dash publico /share.
// Raiz auto-suficiente: sidebar + area de pagina/database, navegacao por ESTADO
// local (sem react-router, igual ao NotionEmbed do CRM). Toda a identidade e o
// acesso vem do `token` (backend resolve o client_id); `role`/`authorName` sao
// so pra UI/autoria/presenca.
//
// Uso:
//   <DashNotion token={token} role={role} authorName={name} />

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Settings2 } from 'lucide-react'
import { DashNotionProvider } from './dashContext'
import type { EspacoMode } from './espacoClient'
import { useSpace } from './useDashNotion'
import DashSidebar from './DashSidebar'
import DashDatabaseView from './views/DashDatabaseView'
import PageView from './page/PageView'
import PagePeekModal from './page/PagePeekModal'
import EspacoGerir from './EspacoGerir'

interface DashNotionProps {
  mode: EspacoMode
  token: string
  role: 'admin' | 'client'
  authorName: string
}

export default function DashNotion({ mode, token, role, authorName }: DashNotionProps) {
  return (
    <DashNotionProvider mode={mode} token={token} role={role} authorName={authorName}>
      <DashNotionInner />
    </DashNotionProvider>
  )
}

function DashNotionInner() {
  // Provisiona o espaco (cria se vazio) e da as bases/paginas iniciais.
  const { data: space, isLoading, isError } = useSpace()

  // Base ativa por ID; pagina cheia; peek. Tudo em estado local.
  const [databaseId, setDatabaseId] = useState<string | null>(null)
  const [fullPageId, setFullPageId] = useState<string | null>(null)
  const [peekId, setPeekId] = useState<string | null>(null)
  // Painel Gerir (gestao) — so admin. O role vem do backend (op tree/provision).
  const [showGerir, setShowGerir] = useState(false)
  const isAdmin = space?.role === 'admin'

  // Ao carregar, abre a primeira base (se houver) e nenhuma pagina.
  useEffect(() => {
    if (databaseId || !space) return
    const primeira = space.databases.find(d => !d.is_archived)
    if (primeira) setDatabaseId(primeira.id)
  }, [space, databaseId])

  const openPageFull = useCallback((id: string) => { setPeekId(null); setFullPageId(id) }, [])
  const openDatabase = useCallback((id: string) => {
    setFullPageId(null); setPeekId(null); setDatabaseId(id)
  }, [])
  const openRow = useCallback((id: string) => setPeekId(id), [])

  // Mencao de pagina clicada no editor -> abre em tela cheia.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ pageId: string }>).detail?.pageId
      if (id) openPageFull(id)
    }
    window.addEventListener('lm-notion:open-page', onOpen)
    return () => window.removeEventListener('lm-notion:open-page', onOpen)
  }, [openPageFull])

  return (
    <div className="flex h-full min-h-0 rounded-lm-lg border border-lm-border bg-lm-card overflow-hidden">
      <DashSidebar
        activePageId={fullPageId ?? peekId ?? null}
        activeDatabaseId={fullPageId ? null : databaseId}
        onOpenPage={openPageFull}
        onOpenDatabase={openDatabase}
      />

      <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        {isAdmin && (
          <div className="shrink-0 flex items-center justify-end px-4 pt-3">
            <button
              onClick={() => setShowGerir(v => !v)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lm-sm border transition-colors ${
                showGerir
                  ? 'bg-lm-neon/15 border-lm-neon/40 text-lm-neon'
                  : 'bg-lm-card2 border-lm-border text-lm-muted hover:text-lm-primary'
              }`}
              title="Gerir o Espaço (admin)"
            >
              <Settings2 size={13} />
              Gerir
            </button>
          </div>
        )}
        {showGerir ? (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <EspacoGerir />
          </div>
        ) : fullPageId ? (
          <>
            <div className="shrink-0 px-6 pt-4">
              <button
                onClick={() => setFullPageId(null)}
                className="inline-flex items-center gap-1 text-xs text-lm-subtle hover:text-lm-primary"
              >
                <ChevronLeft size={13} />
                Voltar
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <PageView pageId={fullPageId} mode="full" onOpenPage={openPageFull} />
            </div>
          </>
        ) : isLoading ? (
          <div className="flex-1 grid place-items-center text-xs text-lm-subtle">Carregando...</div>
        ) : isError ? (
          <div className="flex-1 grid place-items-center text-xs text-lm-subtle">
            Nao foi possivel carregar o espaco.
          </div>
        ) : databaseId ? (
          <DashDatabaseView databaseId={databaseId} onOpenPage={openRow} />
        ) : (
          <div className="flex-1 grid place-items-center">
            <div className="text-center">
              <p className="text-sm text-lm-muted">Nenhuma base ainda</p>
              <p className="text-xs text-lm-subtle mt-1">Crie uma base ou uma pagina na barra lateral.</p>
            </div>
          </div>
        )}
      </main>

      {peekId && (
        <PagePeekModal
          pageId={peekId}
          onClose={() => setPeekId(null)}
          onExpand={() => openPageFull(peekId)}
          onOpenPage={openPageFull}
        />
      )}
    </div>
  )
}
