// DashNotion — pagina completa (capa, icone, titulo, painel de propriedades,
// editor, comentarios, backlinks). Duplicata adaptada de _internal/page/PageView.tsx.
// Sem SharePanel/favoritos e sem cronometro (a edge nao tem timer): a barra de
// tarefa mostra o seletor de coluna, arquivar/excluir e finalizar/reabrir, tudo
// via row_set_prop / page_archive / page_delete_forever.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Plus, Smile, X, Play, Pause, CheckCircle2, Archive, Trash2 } from 'lucide-react'
import {
  PROPERTY_TYPE_LABELS, opcaoDeConclusao, NOTION_COLORS,
  type PropertyType, type PageRow, type NotionProperty,
} from '@/features/espaco/internal/types'
import { resolveCellValue } from '@/features/espaco/internal/views/viewLib'
import { PROPERTY_ICONS } from '@/features/espaco/internal/props/propertyIcons'
import CoverImage from '@/features/espaco/internal/page/CoverImage'
import IconPicker from '@/features/espaco/internal/page/IconPicker'
import BasePageIcon from '@/features/espaco/internal/PageIcon'
import {
  useCreateProperty, usePage, useProperties, useRows, useSetPropValue,
  useSetRelation, useSnapshotVersion, useUpdatePage, useArchivePage, useDeletePageForever,
  useToggleTimer, useResetTimer, useToggleFinalizada, tempoTotalSegundos, formatarTempo,
} from '../useDashNotion'
import DashNotionEditor from '../DashNotionEditor'
import PropCell from '../props/PropCell'
import CoverPicker from './CoverPicker'
import CommentsPanel from './CommentsPanel'
import BacklinksPanel from './BacklinksPanel'
import PageHeaderMenu from './PageHeaderMenu'
import VersionHistory from './VersionHistory'

const TITLE_DEBOUNCE_MS = 600
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000

const NEW_PROP_TYPES: PropertyType[] = [
  'text', 'number', 'select', 'multi_select', 'status', 'date',
  'person', 'files', 'checkbox', 'url', 'email', 'phone',
]

interface PageViewProps {
  pageId: string
  mode?: 'full' | 'peek'
  onClose?: () => void
  onOpenPage?: (pageId: string) => void
}

export default function PageView({ pageId, mode = 'full', onOpenPage }: PageViewProps) {
  const { data: page, isLoading } = usePage(pageId)
  const updatePage = useUpdatePage()
  const snapshot = useSnapshotVersion()

  const [showVersions, setShowVersions] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  const databaseId = page?.database_id ?? null
  const { data: properties = [] } = useProperties(databaseId)
  const { data: rows = [] } = useRows(databaseId)
  const setPropValue = useSetPropValue()
  const setRelation = useSetRelation()
  const createProperty = useCreateProperty()

  const row = useMemo(() => rows.find(r => r.id === pageId), [rows, pageId])

  const [title, setTitle] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [repositioning, setRepositioning] = useState(false)
  const [draftPosition, setDraftPosition] = useState<number | null>(null)
  const [addingProp, setAddingProp] = useState(false)
  const [newPropName, setNewPropName] = useState('')
  const [newPropType, setNewPropType] = useState<PropertyType>('text')

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedTitle = useRef<string>('')
  const lastSnapshotAt = useRef<number>(0)
  const coverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!page) return
    setTitle(page.title)
    lastSavedTitle.current = page.title
  }, [page?.id])

  const autoGrow = useCallback(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => { autoGrow() }, [title, autoGrow])

  const commitTitle = useCallback((next: string) => {
    if (!page || next === lastSavedTitle.current) return
    lastSavedTitle.current = next
    updatePage.mutate({ id: page.id, title: next })
  }, [page?.id, updatePage])

  function onTitleChange(next: string) {
    setTitle(next)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => commitTitle(next), TITLE_DEBOUNCE_MS)
  }

  useEffect(() => () => { if (titleTimer.current) clearTimeout(titleTimer.current) }, [])

  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])

  const handleDirtyChange = useCallback((dirty: boolean) => {
    const atual = pageRef.current
    if (!dirty || !atual) return
    const now = Date.now()
    if (now - lastSnapshotAt.current < SNAPSHOT_INTERVAL_MS) return
    lastSnapshotAt.current = now
    snapshot.mutate({ page_id: atual.id })
  }, [snapshot])

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ pageId?: string }>).detail
      if (detail?.pageId) onOpenPage?.(detail.pageId)
    }
    window.addEventListener('lm-notion:open-page', onOpen)
    return () => window.removeEventListener('lm-notion:open-page', onOpen)
  }, [onOpenPage])

  useEffect(() => {
    if (!repositioning || !page) return
    function onMove(e: MouseEvent) {
      const el = coverRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pct = ((e.clientY - rect.top) / rect.height) * 100
      setDraftPosition(Math.max(0, Math.min(100, pct)))
    }
    function onUp() {
      setRepositioning(false)
      setDraftPosition(p => {
        if (p !== null && page) updatePage.mutate({ id: page.id, cover_position: Math.round(p) })
        return p
      })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [repositioning, page?.id, updatePage])

  if (isLoading) return <div className="p-8 text-sm text-lm-subtle">Carregando...</div>
  if (!page) return <div className="p-8 text-sm text-lm-subtle">Pagina nao encontrada.</div>

  const peek = mode === 'peek'
  const coverHeight = peek ? 180 : 240
  const position = draftPosition ?? page.cover_position ?? 50
  const contentWidth = page.full_width ? 'max-w-none' : 'max-w-3xl'
  const editable = !page.is_locked

  function addProperty() {
    const name = newPropName.trim()
    if (!name || !databaseId) return
    createProperty.mutate(
      { database_id: databaseId, name, type: newPropType, sort_order: properties.length },
      { onSuccess: () => { setNewPropName(''); setNewPropType('text'); setAddingProp(false) } },
    )
  }

  return (
    <div className="relative">
      {page.cover_url && (
        <div ref={coverRef} className="group/cover relative w-full select-none" style={{ height: coverHeight }}>
          <CoverImage
            cover={page.cover_url}
            position={position}
            className="h-full"
            style={repositioning ? { cursor: 'ns-resize' } : undefined}
          />
          <div className="absolute bottom-3 right-4 flex gap-1.5 opacity-0 transition group-hover/cover:opacity-100">
            {repositioning ? (
              <button
                type="button"
                onMouseUp={() => setRepositioning(false)}
                className="rounded-lm-sm bg-lm-card px-2 py-1 text-xs text-lm-primary shadow-lm-sm"
              >
                Solte para salvar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(true)}
                  className="rounded-lm-sm bg-lm-card px-2 py-1 text-xs text-lm-primary shadow-lm-sm hover:bg-lm-card2"
                >
                  Trocar capa
                </button>
                <button
                  type="button"
                  onMouseDown={() => setRepositioning(true)}
                  className="rounded-lm-sm bg-lm-card px-2 py-1 text-xs text-lm-primary shadow-lm-sm hover:bg-lm-card2"
                >
                  Reposicionar
                </button>
                <button
                  type="button"
                  onClick={() => { setDraftPosition(null); updatePage.mutate({ id: page.id, cover_url: null }) }}
                  className="rounded-lm-sm bg-lm-card px-2 py-1 text-xs text-lm-muted shadow-lm-sm hover:text-lm-danger"
                >
                  Remover
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`mx-auto w-full px-12 ${contentWidth} ${page.cover_url ? '' : 'pt-10'}`}>
        {page.icon && (
          <div className={`relative ${page.cover_url ? '-mt-8' : ''}`}>
            <button
              type="button"
              onClick={() => setShowIconPicker(true)}
              className="flex h-16 w-16 items-center justify-center rounded-lm-md text-[56px] leading-none transition hover:bg-lm-card2"
            >
              <IconGlyph icon={page.icon} />
            </button>
            {showIconPicker && (
              <div className="absolute left-0 top-full z-50 mt-1">
                <IconPicker
                  value={page.icon}
                  onPick={icon => updatePage.mutate({ id: page.id, icon })}
                  onClose={() => setShowIconPicker(false)}
                />
              </div>
            )}
          </div>
        )}

        <div className="group/head relative mt-2 flex h-7 items-center gap-2">
          {!page.icon && (
            <button
              type="button"
              onClick={() => setShowIconPicker(true)}
              className="inline-flex items-center gap-1 rounded-lm-sm px-1.5 py-1 text-xs text-lm-subtle opacity-0 transition hover:bg-lm-card2 hover:text-lm-primary group-hover/head:opacity-100"
            >
              <Smile className="h-3.5 w-3.5" />
              Adicionar icone
            </button>
          )}
          {!page.cover_url && (
            <button
              type="button"
              onClick={() => setShowCoverPicker(true)}
              className="inline-flex items-center gap-1 rounded-lm-sm px-1.5 py-1 text-xs text-lm-subtle opacity-0 transition hover:bg-lm-card2 hover:text-lm-primary group-hover/head:opacity-100"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Adicionar capa
            </button>
          )}

          {!page.icon && showIconPicker && (
            <div className="absolute left-0 top-full z-50 mt-1">
              <IconPicker
                value={page.icon}
                onPick={icon => updatePage.mutate({ id: page.id, icon })}
                onClose={() => setShowIconPicker(false)}
              />
            </div>
          )}
          {showCoverPicker && (
            <div className="absolute left-0 top-full z-50 mt-1">
              <CoverPicker
                onPick={cover => { setDraftPosition(null); updatePage.mutate({ id: page.id, cover_url: cover, cover_position: 50 }) }}
                onClose={() => setShowCoverPicker(false)}
              />
            </div>
          )}
        </div>

        <textarea
          ref={titleRef}
          value={title}
          readOnly={!editable}
          rows={1}
          placeholder="Sem titulo"
          onChange={e => onTitleChange(e.target.value)}
          onBlur={() => commitTitle(title)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitTitle(title)
              const el = document.querySelector<HTMLElement>('.bn-editor')
              el?.focus()
            }
          }}
          className="mt-1 w-full resize-none overflow-hidden bg-transparent font-bold leading-tight text-heading outline-none placeholder:text-lm-disabled"
          style={{ fontSize: '2.4rem' }}
        />

        {databaseId && (
          <div className="mt-4">
            {properties
              .filter(p => p.type !== 'title')
              .map(prop => {
                const Ico = PROPERTY_ICONS[prop.type]
                return (
                  <div key={prop.id} className="flex items-start gap-2 py-0.5">
                    <div className="flex w-[180px] shrink-0 items-center gap-1.5 py-1 text-sm text-lm-subtle">
                      <Ico className="h-4 w-4 shrink-0" />
                      <span className="truncate">{prop.name}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <PropCell
                        property={prop}
                        value={row ? resolveCellValue(row, prop, properties) : null}
                        pageId={pageId}
                        databaseId={databaseId}
                        relations={row?.relations?.[prop.id]}
                        variant="panel"
                        onChange={value => setPropValue.mutate({ page_id: pageId, property_id: prop.id, value, database_id: databaseId })}
                        onRelationChange={pageIds => setRelation.mutate({ property_id: prop.id, from_page_id: pageId, to_page_ids: pageIds, database_id: databaseId })}
                      />
                    </div>
                  </div>
                )
              })}

            {addingProp ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={newPropName}
                  onChange={e => setNewPropName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addProperty() }}
                  autoFocus
                  placeholder="Nome da propriedade"
                  className="w-[180px] rounded-lm-sm border border-lm-border bg-lm-bg px-2 py-1 text-sm text-lm-primary outline-none placeholder:text-lm-subtle focus:border-lm-neon"
                />
                <select
                  value={newPropType}
                  onChange={e => setNewPropType(e.target.value as PropertyType)}
                  className="rounded-lm-sm border border-lm-border bg-lm-bg px-2 py-1 text-sm text-lm-primary outline-none focus:border-lm-neon"
                >
                  {NEW_PROP_TYPES.map(t => (
                    <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addProperty}
                  disabled={!newPropName.trim()}
                  className="rounded-lm-sm bg-lm-neon px-2 py-1 text-xs text-lm-inverse disabled:opacity-50"
                >
                  Criar
                </button>
                <button
                  type="button"
                  aria-label="Cancelar"
                  onClick={() => { setAddingProp(false); setNewPropName('') }}
                  className="rounded-lm-sm p-1 text-lm-subtle hover:text-lm-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingProp(true)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lm-sm px-1.5 py-1 text-sm text-lm-subtle transition hover:bg-lm-card2 hover:text-lm-primary"
              >
                <Plus className="h-4 w-4" />
                Adicionar propriedade
              </button>
            )}
          </div>
        )}

        {databaseId && row && <BarraTarefa row={row} databaseId={databaseId} properties={properties} />}

        <hr className="my-4 border-lm-border" />

        <DashNotionEditor
          key={`${page.id}:${editorKey}`}
          pageId={page.id}
          initialContent={(page.content ?? []) as unknown[]}
          editable={editable}
          smallText={page.small_text}
          onDirtyChange={handleDirtyChange}
        />

        <CommentsPanel pageId={page.id} />
        <BacklinksPanel pageId={page.id} onOpenPage={onOpenPage} />

        <div className="h-16" />
      </div>

      {mode === 'full' && (
        <>
          <div className="absolute right-4 top-4 z-20 flex items-center gap-1">
            <PageHeaderMenu page={page} onOpenVersions={() => setShowVersions(true)} />
          </div>
          <VersionHistory
            page={page}
            open={showVersions}
            onClose={() => setShowVersions(false)}
            onRestored={() => setEditorKey(k => k + 1)}
          />
        </>
      )}
    </div>
  )
}

function IconGlyph({ icon }: { icon: string }) {
  return <BasePageIcon icon={icon} size={56} />
}

/**
 * Barra de tarefa (dash): seletor de coluna + cronometro (liga/para/zera) +
 * arquivar/excluir + finalizar/reabrir. Cronometro via timer_toggle/timer_reset;
 * finalizar via toggle_done (que tambem move a coluna). Igual ao CRM.
 */
function BarraTarefa({ row, databaseId, properties }: {
  row: PageRow; databaseId: string; properties: NotionProperty[]
}) {
  const setPropValue = useSetPropValue()
  const toggleTimer = useToggleTimer()
  const resetTimer = useResetTimer()
  const toggleFinal = useToggleFinalizada()
  const arquivar = useArchivePage()
  const excluir = useDeletePageForever()

  const [confirmando, setConfirmando] = useState(false)
  useEffect(() => {
    if (!confirmando) return
    const t = setTimeout(() => setConfirmando(false), 4000)
    return () => clearTimeout(t)
  }, [confirmando])

  const rodando = !!row.timer_started_at
  const [, forcar] = useState(0)
  useEffect(() => {
    if (!rodando) return
    const t = setInterval(() => forcar(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [rodando])

  const propConclusao = properties.find(p => opcaoDeConclusao(p))
  const done = opcaoDeConclusao(propConclusao ?? null)
  const finalizada = !!done && !!propConclusao && row.props[propConclusao.id] === done.id
  const voltarPara = propConclusao?.config?.options?.find(o => o.id !== done?.id) ?? null
  const total = tempoTotalSegundos(row)

  const colunas = propConclusao?.config?.options ?? []
  const colunaAtual = colunas.find(o => o.id === row.props[propConclusao?.id ?? ''])

  function setColuna(optionId: string | null) {
    if (!propConclusao) return
    setPropValue.mutate({ page_id: row.id, property_id: propConclusao.id, value: optionId, database_id: databaseId })
  }

  return (
    <div className="mt-4 space-y-2 rounded-lm-md border border-lm-border bg-lm-bg px-3 py-2">
      {propConclusao && colunas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-lm-subtle">Coluna:</span>
          {colunas.map(o => {
            const ativa = o.id === colunaAtual?.id
            const cores = NOTION_COLORS[o.color] ?? NOTION_COLORS.default
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setColuna(o.id)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition ${
                  ativa ? `${cores.bg} ${cores.text} ring-1 ring-lm-neon` : 'text-lm-subtle hover:bg-lm-card2'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cores.dot}`} />
                {o.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggleTimer.mutate({ page: row, database_id: databaseId })}
          className={`flex items-center gap-1.5 rounded-lm-sm px-2 py-1 text-xs transition ${
            rodando ? 'bg-lm-success/15 text-lm-success' : 'text-lm-muted hover:bg-lm-card2 hover:text-lm-primary'
          }`}
        >
          {rodando ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {rodando ? 'Parar' : 'Iniciar'} cronometro
        </button>

        <span className="text-sm tabular-nums text-lm-primary">{formatarTempo(total)}</span>

        {total > 0 && (
          <button
            type="button"
            onClick={() => resetTimer.mutate({ page_id: row.id, database_id: databaseId })}
            className="rounded-lm-sm px-1.5 py-1 text-xs text-lm-subtle hover:bg-lm-card2 hover:text-lm-primary"
          >
            Zerar
          </button>
        )}

        <span className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => arquivar.mutate({ id: row.id, database_id: databaseId })}
            className="flex items-center gap-1.5 rounded-lm-sm px-2 py-1 text-xs text-lm-muted transition hover:bg-lm-card2 hover:text-lm-primary"
          >
            <Archive className="h-3.5 w-3.5" />
            Arquivar
          </button>

          {confirmando ? (
            <button
              type="button"
              onClick={() => excluir.mutate(row.id)}
              className="flex items-center gap-1.5 rounded-lm-sm bg-lm-danger px-2 py-1 text-xs text-lm-inverse"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Confirmar exclusao?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="flex items-center gap-1.5 rounded-lm-sm px-2 py-1 text-xs text-lm-muted transition hover:bg-lm-card2 hover:text-lm-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
          )}

          {done && propConclusao && (
            <button
              type="button"
              onClick={() => toggleFinal.mutate({
                page: row,
                database_id: databaseId,
                property_id: propConclusao.id,
                doneOptionId: done.id,
                voltarParaOptionId: voltarPara?.id ?? null,
                finalizar: !finalizada,
              })}
              className={`flex items-center gap-1.5 rounded-lm-sm px-3 py-1.5 text-xs font-medium transition ${
                finalizada
                  ? 'bg-lm-success/15 text-lm-success hover:bg-lm-card2'
                  : 'bg-lm-success text-lm-inverse hover:opacity-90'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {finalizada ? 'Finalizada — reabrir' : 'Finalizar tarefa'}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
