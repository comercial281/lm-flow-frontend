// DashNotion — sidebar do modulo (bases, arvore de paginas, busca, lixeira).
// Duplicata adaptada de _internal/NotionSidebar.tsx: hooks do dash e navegacao
// de base por ID (nao slug). Sem favoritos (a edge nao tem essa action).

import { useMemo, useRef, useState } from 'react'
import {
  ChevronRight, Plus, Trash2, Search, Database,
  MoreHorizontal, Copy, RotateCcw, X, Pencil, Smile, Check,
} from 'lucide-react'
import type { NotionDatabase } from '@/features/espaco/internal/types'
import { useResizable, ResizeHandle } from '@/features/espaco/lib/useResizable'
import PageIcon from '@/features/espaco/internal/PageIcon'
import Dropdown from '@/features/espaco/internal/Dropdown'
import IconPicker from '@/features/espaco/internal/page/IconPicker'
import {
  useDatabases, usePageTree, useCreatePage,
  useArchivePage, useDeletePageForever, useTrash, useDuplicatePage,
  useSearchPages, useCreateDatabase, useUpdateDatabase,
  useTrashDatabases, useArchiveDatabase, useDeleteDatabaseForever,
} from './useDashNotion'

interface DashSidebarProps {
  activePageId: string | null
  activeDatabaseId: string | null
  onOpenPage: (pageId: string) => void
  onOpenDatabase: (databaseId: string) => void
}

interface TreeNode {
  id: string
  title: string
  icon: string | null
  children: TreeNode[]
}

export default function DashSidebar({
  activePageId, activeDatabaseId, onOpenPage, onOpenDatabase,
}: DashSidebarProps) {
  const { data: databases = [] } = useDatabases()
  const { data: pages = [] } = usePageTree()
  const createPage = useCreatePage()
  const createDatabase = useCreateDatabase()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [term, setTerm] = useState('')
  const [showTrash, setShowTrash] = useState(false)
  const [novaBase, setNovaBase] = useState<string | null>(null)

  const { width, dragging, startDrag } = useResizable('lm_dash_notion_sidebar_w', 240, 180, 480, 'right')

  const { data: results = [] } = useSearchPages(term)

  const dbPageIds = useMemo(
    () => new Set(databases.map(d => d.page_id).filter(Boolean) as string[]),
    [databases],
  )

  const tree = useMemo<TreeNode[]>(() => {
    const byId = new Map<string, TreeNode>()
    for (const p of pages) {
      if (dbPageIds.has(p.id)) continue
      byId.set(p.id, { id: p.id, title: p.title, icon: p.icon, children: [] })
    }
    const roots: TreeNode[] = []
    for (const p of pages) {
      const node = byId.get(p.id)
      if (!node) continue
      const parent = p.parent_page_id ? byId.get(p.parent_page_id) : null
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
    return roots
  }, [pages, dbPageIds])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  function criarBase() {
    const nome = (novaBase ?? '').trim() || 'Nova base'
    createDatabase.mutate({ name: nome }, { onSuccess: db => onOpenDatabase(db.id) })
    setNovaBase(null)
  }

  const searching = term.trim().length >= 2

  return (
    <aside
      style={{ width }}
      className="relative shrink-0 border-r border-lm-border bg-lm-dark flex flex-col min-h-0"
    >
      <ResizeHandle onMouseDown={startDrag} side="right" dragging={dragging} />
      <div className="p-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-lm-subtle" />
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Buscar"
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lm-sm bg-lm-bg border border-lm-border text-lm-primary placeholder:text-lm-subtle focus:outline-none focus:border-lm-neon/50"
          />
          {term && (
            <button
              onClick={() => setTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-lm-subtle hover:text-lm-primary"
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-0">
        {searching ? (
          <Section title="Resultados">
            {results.length === 0 && <Empty>Nada encontrado</Empty>}
            {results.map(r => (
              <Row
                key={r.id}
                active={r.id === activePageId}
                icon={<PageIcon icon={r.icon} size={14} />}
                label={r.title || 'Sem titulo'}
                onClick={() => onOpenPage(r.id)}
              />
            ))}
          </Section>
        ) : (
          <>
            <Section
              title="Bases"
              action={
                <button
                  onClick={() => setNovaBase('')}
                  disabled={createDatabase.isPending}
                  className="text-lm-subtle hover:text-lm-primary p-0.5 rounded hover:bg-lm-card2 disabled:opacity-40"
                  title="Nova base"
                >
                  <Plus size={13} />
                </button>
              }
            >
              {databases.map(d => (
                <DatabaseRow
                  key={d.id}
                  db={d}
                  ativa={d.id === activeDatabaseId}
                  onOpen={() => onOpenDatabase(d.id)}
                />
              ))}
              {novaBase !== null && (
                <InlineNome
                  placeholder="Nome da base"
                  onConfirm={criarBase}
                  onCancel={() => setNovaBase(null)}
                  value={novaBase}
                  onChange={setNovaBase}
                />
              )}
              {databases.length === 0 && novaBase === null && <Empty>Nenhuma base ainda</Empty>}
            </Section>

            <Section
              title="Paginas"
              action={
                <button
                  onClick={() => createPage.mutate({ title: '' }, { onSuccess: p => onOpenPage(p.id) })}
                  className="text-lm-subtle hover:text-lm-primary p-0.5 rounded hover:bg-lm-card2"
                  title="Nova pagina"
                >
                  <Plus size={13} />
                </button>
              }
            >
              {tree.length === 0 && <Empty>Nenhuma pagina ainda</Empty>}
              {tree.map(node => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  activePageId={activePageId}
                  expanded={expanded}
                  onToggle={toggle}
                  onOpenPage={onOpenPage}
                />
              ))}
            </Section>
          </>
        )}
      </div>

      <button
        onClick={() => setShowTrash(true)}
        className="flex items-center gap-2 px-4 py-2.5 text-xs text-lm-subtle hover:text-lm-primary border-t border-lm-border hover:bg-lm-card2 transition-colors"
      >
        <Trash2 size={13} />
        Lixeira
      </button>

      {showTrash && <TrashModal onClose={() => setShowTrash(false)} onOpenPage={onOpenPage} />}
    </aside>
  )
}

function DatabaseRow({ db, ativa, onOpen }: { db: NotionDatabase; ativa: boolean; onOpen: () => void }) {
  const updateDatabase = useUpdateDatabase()
  const archiveDatabase = useArchiveDatabase()
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickIcon, setPickIcon] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const menuBtn = useRef<HTMLButtonElement>(null)
  const iconBtn = useRef<HTMLButtonElement>(null)

  if (renaming !== null) {
    return (
      <InlineNome
        placeholder="Nome da base"
        value={renaming}
        onChange={setRenaming}
        onConfirm={() => {
          const nome = renaming.trim()
          if (nome && nome !== db.name) updateDatabase.mutate({ id: db.id, name: nome })
          setRenaming(null)
        }}
        onCancel={() => setRenaming(null)}
      />
    )
  }

  return (
    <div
      className={`group flex items-center gap-1 rounded-lm-sm pr-1 transition-colors ${
        ativa ? 'bg-lm-neon/15 text-lm-neon' : 'text-lm-muted hover:bg-lm-card2'
      }`}
    >
      <button onClick={onOpen} className="flex items-center gap-1.5 flex-1 min-w-0 px-1.5 py-1 text-left text-xs">
        <PageIcon icon={db.icon} size={14} fallback={Database} />
        <span className="truncate">{db.name}</span>
      </button>

      <button
        ref={menuBtn}
        onClick={() => setMenuOpen(v => !v)}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-lm-card2"
        title="Opcoes da base"
      >
        <MoreHorizontal size={12} />
      </button>

      <button ref={iconBtn} className="sr-only" tabIndex={-1} aria-hidden />

      <Dropdown anchorRef={menuBtn} open={menuOpen} onClose={() => setMenuOpen(false)} align="right">
        <div className="w-40 py-1">
          <MenuButton icon={Pencil} label="Renomear" onClick={() => { setMenuOpen(false); setRenaming(db.name) }} />
          <MenuButton icon={Smile} label="Icone" onClick={() => { setMenuOpen(false); setPickIcon(true) }} />
          <MenuButton
            icon={Trash2}
            label="Excluir base"
            danger
            onClick={() => { setMenuOpen(false); archiveDatabase.mutate({ id: db.id }) }}
          />
        </div>
      </Dropdown>

      <Dropdown anchorRef={iconBtn} open={pickIcon} onClose={() => setPickIcon(false)} align="left">
        <IconPicker
          value={db.icon}
          onPick={(icon) => updateDatabase.mutate({ id: db.id, icon })}
          onClose={() => setPickIcon(false)}
        />
      </Dropdown>
    </div>
  )
}

function TreeRow({
  node, depth, activePageId, expanded, onToggle, onOpenPage,
}: {
  node: TreeNode; depth: number; activePageId: string | null
  expanded: Set<string>; onToggle: (id: string) => void; onOpenPage: (id: string) => void
}) {
  const createPage = useCreatePage()
  const archive = useArchivePage()
  const duplicate = useDuplicatePage()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)

  const isOpen = expanded.has(node.id)
  const hasChildren = node.children.length > 0

  return (
    <>
      <div
        className={`group flex items-center gap-1 rounded-lm-sm pr-1 transition-colors ${
          node.id === activePageId ? 'bg-lm-neon/15 text-lm-neon' : 'text-lm-muted hover:bg-lm-card2'
        }`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          onClick={() => onToggle(node.id)}
          className={`p-0.5 rounded hover:bg-lm-card2 shrink-0 ${hasChildren ? '' : 'invisible'}`}
          aria-label={isOpen ? 'Recolher' : 'Expandir'}
        >
          <ChevronRight size={12} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>

        <button
          onClick={() => onOpenPage(node.id)}
          className="flex items-center gap-1.5 flex-1 min-w-0 py-1 text-left text-xs"
        >
          <PageIcon icon={node.icon} size={14} />
          <span className="truncate">{node.title || 'Sem titulo'}</span>
        </button>

        <button
          onClick={() => createPage.mutate(
            { title: '', parent_page_id: node.id },
            { onSuccess: p => { onToggle(node.id); onOpenPage(p.id) } },
          )}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-lm-card2 shrink-0"
          title="Adicionar subpagina"
        >
          <Plus size={12} />
        </button>

        <button
          ref={menuBtn}
          onClick={() => setMenuOpen(v => !v)}
          className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-lm-card2"
          title="Opcoes"
        >
          <MoreHorizontal size={12} />
        </button>
        <Dropdown anchorRef={menuBtn} open={menuOpen} onClose={() => setMenuOpen(false)} align="right">
          <div className="w-40 py-1">
            <MenuButton
              icon={Copy}
              label="Duplicar"
              onClick={() => { setMenuOpen(false); duplicate.mutate({ id: node.id }) }}
            />
            <MenuButton
              icon={Trash2}
              label="Mover p/ lixeira"
              danger
              onClick={() => { setMenuOpen(false); archive.mutate({ id: node.id }) }}
            />
          </div>
        </Dropdown>
      </div>

      {isOpen && node.children.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          activePageId={activePageId}
          expanded={expanded}
          onToggle={onToggle}
          onOpenPage={onOpenPage}
        />
      ))}
      {isOpen && !hasChildren && (
        <div className="text-[11px] text-lm-disabled py-1" style={{ paddingLeft: `${(depth + 1) * 12 + 22}px` }}>
          Sem subpaginas
        </div>
      )}
    </>
  )
}

function TrashModal({ onClose, onOpenPage }: { onClose: () => void; onOpenPage: (id: string) => void }) {
  const { data: trash = [], isLoading } = useTrash()
  const { data: trashDbs = [] } = useTrashDatabases()
  const archive = useArchivePage()
  const del = useDeletePageForever()
  const archiveDb = useArchiveDatabase()
  const delDb = useDeleteDatabaseForever()
  const [term, setTerm] = useState('')
  const [confirmarDb, setConfirmarDb] = useState<string | null>(null)
  const [confirmarPg, setConfirmarPg] = useState<string | null>(null)

  const t = term.toLowerCase()
  const filtered = trash.filter(p => (p.title || 'Sem titulo').toLowerCase().includes(t))
  const filteredDbs = trashDbs.filter(d => (d.name || 'Sem nome').toLowerCase().includes(t))
  const vazio = filtered.length === 0 && filteredDbs.length === 0

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 bg-black/60" onClick={onClose}>
      <div
        className="w-[520px] max-h-[60vh] flex flex-col rounded-lm-xl bg-lm-card border border-lm-border shadow-lm-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b border-lm-border">
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Buscar na lixeira"
            autoFocus
            className="w-full px-3 py-2 text-sm rounded-lm-sm bg-lm-bg border border-lm-border text-lm-primary placeholder:text-lm-subtle focus:outline-none focus:border-lm-neon/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && <div className="p-4 text-xs text-lm-subtle">Carregando...</div>}
          {!isLoading && vazio && <div className="p-6 text-center text-xs text-lm-subtle">A lixeira esta vazia</div>}

          {filteredDbs.length > 0 && (
            <div className="px-1 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-lm-subtle">Bases</div>
          )}
          {filteredDbs.map(d => (
            <div key={d.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lm-sm hover:bg-lm-card2">
              <PageIcon icon={d.icon} size={14} fallback={Database} />
              <span className="flex-1 text-left text-xs text-lm-muted truncate">{d.name || 'Sem nome'}</span>
              {confirmarDb === d.id ? (
                <>
                  <span className="text-[11px] text-lm-danger">Sem volta?</span>
                  <button onClick={() => { delDb.mutate(d.id); setConfirmarDb(null) }} className="p-1 rounded text-lm-danger hover:bg-lm-card" title="Confirmar exclusao definitiva">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setConfirmarDb(null)} className="p-1 rounded text-lm-subtle hover:bg-lm-card" title="Cancelar">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => archiveDb.mutate({ id: d.id, archived: false })} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-lm-card text-lm-subtle hover:text-lm-primary" title="Restaurar base">
                    <RotateCcw size={13} />
                  </button>
                  <button onClick={() => setConfirmarDb(d.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-lm-card text-lm-subtle hover:text-lm-danger" title="Excluir base definitivamente">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}

          {filteredDbs.length > 0 && filtered.length > 0 && (
            <div className="px-1 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-lm-subtle">Paginas</div>
          )}
          {filtered.map(p => (
            <div key={p.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lm-sm hover:bg-lm-card2">
              <PageIcon icon={p.icon} size={14} />
              <button onClick={() => { onOpenPage(p.id); onClose() }} className="flex-1 text-left text-xs text-lm-muted truncate">
                {p.title || 'Sem titulo'}
              </button>
              {confirmarPg === p.id ? (
                <>
                  <span className="text-[11px] text-lm-danger">Sem volta?</span>
                  <button onClick={() => { del.mutate(p.id); setConfirmarPg(null) }} className="p-1 rounded text-lm-danger hover:bg-lm-card" title="Confirmar exclusao">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setConfirmarPg(null)} className="p-1 rounded text-lm-subtle hover:bg-lm-card" title="Cancelar">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => archive.mutate({ id: p.id, database_id: p.database_id, archived: false })} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-lm-card text-lm-subtle hover:text-lm-primary" title="Restaurar">
                    <RotateCcw size={13} />
                  </button>
                  <button onClick={() => setConfirmarPg(p.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-lm-card text-lm-subtle hover:text-lm-danger" title="Excluir definitivamente">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function InlineNome({ value, onChange, onConfirm, onCancel, placeholder }: {
  value: string; onChange: (v: string) => void
  onConfirm: () => void; onCancel: () => void; placeholder: string
}) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-1">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onConfirm()
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={onConfirm}
        placeholder={placeholder}
        autoFocus
        className="flex-1 min-w-0 rounded-lm-sm border border-lm-neon/50 bg-lm-bg px-2 py-1 text-xs text-lm-primary outline-none placeholder:text-lm-subtle"
      />
    </div>
  )
}

function Section({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-lm-subtle">{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({ active, icon, label, onClick }: {
  active?: boolean; icon: React.ReactNode; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lm-sm text-xs text-left transition-colors ${
        active ? 'bg-lm-neon/15 text-lm-neon' : 'text-lm-muted hover:bg-lm-card2'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

function MenuButton({ icon: Icon, label, onClick, danger }: {
  icon: typeof Copy; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-lm-card2 ${
        danger ? 'text-lm-danger' : 'text-lm-muted'
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-1.5 py-1 text-[11px] text-lm-disabled">{children}</div>
}
