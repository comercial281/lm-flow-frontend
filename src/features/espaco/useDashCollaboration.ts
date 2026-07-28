// Espaço — colaboração em tempo real (dois cursores + edição simultânea).
// Porte do useDashCollaboration do LM Hub, adaptado ao LM Flow:
//   (1) identidade vem de authorName + meId (crypto.randomUUID por sessão),
//       não de useAuth().profile;
//   (2) canal de broadcast namespaced por TENANT: `espaco_ydoc:${ns}:${pageId}`
//       (ns = slug do subdomínio; no público cai no token) — não vaza entre tenants;
//   (3) persistência do ydoc pela API Rails (ydoc_get / ydoc_save), não supabase.from.
// O TRANSPORTE Yjs reusa a MESMA instância supabase-js que o LM Flow já tem
// configurada (supabaseLmHub) só como barramento de broadcast — o conteúdo nunca
// toca o supabase. Se o cliente não estiver configurado ou o Realtime não
// conectar, cai pro editor solo (sem realtime).

import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import {
  Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates,
} from 'y-protocols/awareness'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc } from '@blocknote/core/yjs'
import { supabaseLmHub as supabase, LMHUB_CONFIGURED } from '@/lib/supabaseLmHub'
import { getTenantSlug } from '@/services/core/tenant'
import { notionSchema } from '@/features/espaco/internal/editor/schema'
import { useDashCtx } from './dashContext'

const FRAG = 'blocknote'
const PERSIST_MS = 1500

type EstadoColab =
  | { estado: 'carregando' }
  | { estado: 'solo' }
  | {
      estado: 'pronto'
      fragment: Y.XmlFragment
      awareness: Awareness
      user: { name: string; color: string }
      peers: { id: string; name: string; color: string }[]
    }

/** Cor estavel por usuario (mesma do CRM). */
const CORES = ['#7C3AED', '#2563EB', '#059669', '#DB2777', '#D97706', '#0891B2', '#DC2626', '#7C3AED']
function corDe(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return CORES[Math.abs(h) % CORES.length]
}

function toB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s)
}
function fromB64(str: string): Uint8Array {
  const s = atob(str)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

export function useDashCollaboration(
  pageId: string,
  initialBlocks: unknown[],
  enabled: boolean,
): EstadoColab {
  const { authorName, meId: sessionId, token, call } = useDashCtx()
  // Realtime só existe se houver um supabase-js configurado (barramento de
  // broadcast). Sem ele, o editor funciona solo (persistência ainda via API).
  const realtimeOn = enabled && LMHUB_CONFIGURED
  const [estado, setEstado] = useState<EstadoColab>(
    realtimeOn ? { estado: 'carregando' } : { estado: 'solo' },
  )
  const blocksRef = useRef(initialBlocks)
  blocksRef.current = initialBlocks

  useEffect(() => {
    if (!realtimeOn) { setEstado({ estado: 'solo' }); return }

    // Namespace por tenant pra broadcast não vazar entre tenants. No modo
    // público (sem subdomínio) cai no token do link.
    const ns = getTenantSlug() || token || 'default'

    let cancelado = false
    const ydoc = new Y.Doc()
    const awareness = new Awareness(ydoc)
    // Cada aba/sessao e um "peer" proprio (sem profile.id no dash).
    const meId = `${sessionId}-${pageId}`
    const user = { name: authorName || 'Alguem', color: corDe(meId) }
    awareness.setLocalStateField('user', user)

    const canal = supabase.channel(`espaco_ydoc:${ns}:${pageId}`, {
      config: { broadcast: { self: false }, presence: { key: meId } },
    })

    let persistTimer: ReturnType<typeof setTimeout> | null = null
    const REMOTO = { remote: true }

    function persistir() {
      const state = toB64(Y.encodeStateAsUpdate(ydoc))
      void call('ydoc_save', { page_id: pageId, state }).catch(() => {})
    }
    function agendarPersist() {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(persistir, PERSIST_MS)
    }

    function onDocUpdate(update: Uint8Array, origin: unknown) {
      if (origin === REMOTO) return
      void canal.send({ type: 'broadcast', event: 'y-update', payload: { u: toB64(update) } })
      agendarPersist()
    }
    ydoc.on('update', onDocUpdate)

    function onAwareness({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) {
      const changed = [...added, ...updated, ...removed]
      const upd = encodeAwarenessUpdate(awareness, changed)
      void canal.send({ type: 'broadcast', event: 'y-awareness', payload: { u: toB64(upd) } })
    }
    awareness.on('update', onAwareness)

    let peersAtuais: { id: string; name: string; color: string }[] = []
    function setEstadoPronto(peers: { id: string; name: string; color: string }[]) {
      peersAtuais = peers
      setEstado({ estado: 'pronto', fragment: ydoc.getXmlFragment(FRAG), awareness, user, peers })
    }
    function atualizarPeers() {
      const st = canal.presenceState() as Record<string, { id: string; name: string; color: string }[]>
      const vistos = new Map<string, { id: string; name: string; color: string }>()
      for (const arr of Object.values(st)) for (const p of arr) {
        if (p?.id && p.id !== meId) vistos.set(p.id, p)
      }
      if (!cancelado) setEstadoPronto([...vistos.values()])
    }

    canal
      .on('broadcast', { event: 'y-update' }, ({ payload }) => {
        try { Y.applyUpdate(ydoc, fromB64(payload.u), REMOTO) } catch { /* ignora */ }
      })
      .on('broadcast', { event: 'y-awareness' }, ({ payload }) => {
        try { applyAwarenessUpdate(awareness, fromB64(payload.u), REMOTO) } catch { /* ignora */ }
      })
      .on('broadcast', { event: 'y-sync-request' }, () => {
        void canal.send({ type: 'broadcast', event: 'y-update', payload: { u: toB64(Y.encodeStateAsUpdate(ydoc)) } })
      })
      .on('presence', { event: 'sync' }, atualizarPeers)
      .on('presence', { event: 'join' }, atualizarPeers)
      .on('presence', { event: 'leave' }, atualizarPeers)

    async function boot() {
      // 1) Estado CRDT salvo, se houver.
      let tinhaEstado = false
      try {
        const { state } = await call<{ state: string | null }>('ydoc_get', { page_id: pageId })
        if (cancelado) return
        if (state) { Y.applyUpdate(ydoc, fromB64(state), REMOTO); tinhaEstado = true }
      } catch { /* segue e semeia do content */ }
      if (cancelado) return

      // 2) Sem estado (ou vazio) e com content -> semeia do JSON e salva.
      const fragVazio = ydoc.getXmlFragment(FRAG).length === 0
      if (fragVazio && Array.isArray(blocksRef.current) && blocksRef.current.length > 0) {
        try {
          const tmp = BlockNoteEditor.create({ schema: notionSchema })
          const blocks = blocksRef.current as Parameters<typeof tmp.replaceBlocks>[1]
          const seedState = Y.encodeStateAsUpdate(blocksToYDoc(tmp, blocks, FRAG))
          Y.applyUpdate(ydoc, seedState, REMOTO)
          if (!tinhaEstado) void call('ydoc_save', { page_id: pageId, state: toB64(seedState) }).catch(() => {})
        } catch { /* doc comeca vazio; content JSON segue salvo */ }
      }

      // 3) Assina o canal.
      canal.subscribe((status) => {
        if (cancelado) return
        if (status === 'SUBSCRIBED') {
          void canal.track({ id: meId, name: user.name, color: user.color })
          void canal.send({ type: 'broadcast', event: 'y-sync-request', payload: {} })
          setEstadoPronto(peersAtuais)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setEstado({ estado: 'solo' })
        }
      })
    }
    void boot()

    return () => {
      cancelado = true
      if (persistTimer) clearTimeout(persistTimer)
      try { persistir() } catch { /* ignore */ }
      ydoc.off('update', onDocUpdate)
      awareness.off('update', onAwareness)
      removeAwarenessStates(awareness, [ydoc.clientID], 'unmount')
      void supabase.removeChannel(canal)
      awareness.destroy()
      ydoc.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, realtimeOn, sessionId, authorName, token])

  return estado
}
