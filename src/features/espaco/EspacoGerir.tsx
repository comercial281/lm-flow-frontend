// EspacoGerir — painel de GESTÃO do Espaço (aba "Gerir"), só pra admin.
// Portado do DashAdmin do LM Hub, mantendo SÓ o que faz sentido no LM Flow:
//   - Funções & Visibilidade: pausa global + liga/desliga cada seção e decide
//     se o cliente vê ou se é só interna. Ops: dash_set_paused, section_config_save.
//   - Acessos: links compartilháveis (/espaco/:token) — listar, gerar, revogar,
//     editar validade e permissão por seção. Ops: access_list/create/revoke/update.
//   - Pessoas: aqui "pessoas" são os usuários cadastrados do tenant (op members,
//     só leitura) + atalho pra tela de gestão de usuários (/settings/users).
// NÃO porta WhatsApp & Lembrete (específico do LM Hub) nem cadastro de membros.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  SlidersHorizontal, KeyRound, Users, Plus, Trash2, Copy, Check, Power, ExternalLink,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  useSpace, useMembers,
  useSetDashPaused, useSaveSectionConfig,
  useEspacoAccesses, useCreateAccess, useRevokeAccess, useUpdateAccess,
  SECTION_LABEL, ALL_SECTIONS,
  type DashSectionId, type EspacoAccess,
} from './useDashNotion'

type Tab = 'funcoes' | 'acessos' | 'pessoas'

const inputCls =
  'bg-lm-bg border border-lm-border rounded-lm-sm px-3 py-2 text-sm text-lm-primary placeholder:text-lm-subtle focus:outline-none focus:border-lm-neon/60 transition-colors'
const btnPrimary =
  'flex items-center gap-1.5 bg-lm-neon hover:bg-lm-mid disabled:opacity-40 text-lm-inverse text-sm font-semibold px-4 py-2 rounded-lm-sm transition-colors'

// datetime-local (hora local) <-> ISO.
function localToIso(v: string): string | null {
  if (!v) return null
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}
function isoToLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EspacoGerir() {
  const [tab, setTab] = useState<Tab>('funcoes')

  const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'funcoes', label: 'Funções & Visibilidade', icon: SlidersHorizontal },
    { id: 'acessos', label: 'Acessos', icon: KeyRound },
    { id: 'pessoas', label: 'Pessoas', icon: Users },
  ]

  return (
    <section className="bg-lm-card border border-lm-border rounded-lm-lg p-3 sm:p-5 space-y-4 m-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lm-sm text-xs font-semibold border transition-colors ${
              tab === t.id
                ? 'bg-lm-neon/15 border-lm-neon/40 text-lm-neon'
                : 'bg-lm-deep border-lm-border text-lm-muted hover:text-lm-primary'
            }`}
          >
            <t.icon size={13} strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'funcoes' && <TabFuncoes />}
      {tab === 'acessos' && <TabAcessos />}
      {tab === 'pessoas' && <TabPessoas />}
    </section>
  )
}

// ── Funções & Visibilidade ───────────────────────────────────────────────────

function TabFuncoes() {
  const { data: space, isLoading } = useSpace()
  const pauseMut = useSetDashPaused()
  const sectionMut = useSaveSectionConfig()

  const dashPaused = space?.dash_paused ?? false
  const cfgOf = (s: DashSectionId) => {
    const row = (space?.section_config ?? []).find((c) => c.section === s)
    return { enabled: row?.enabled ?? true, client_visible: row?.client_visible ?? true }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => <div key={i} className="h-12 bg-lm-border/25 rounded-lm-sm animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Ativo / Pausado do Espaço inteiro */}
      <div className="flex items-center justify-between gap-3 bg-lm-deep border border-lm-border rounded-lm-sm px-3 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lm-sm ${dashPaused ? 'bg-lm-border/40 text-lm-subtle' : 'bg-lm-neon/15 text-lm-neon'}`}>
            <Power size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-lm-primary">{dashPaused ? 'Espaço pausado' : 'Espaço ativo'}</p>
            <p className="text-[11px] text-lm-subtle">Pausado, os links param de mostrar dados pro cliente. Você (admin) continua entrando.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => pauseMut.mutate(!dashPaused)}
          disabled={pauseMut.isPending}
          className={`px-3 py-1.5 rounded-lm-sm text-xs font-semibold border transition-colors disabled:opacity-40 ${
            dashPaused ? 'bg-lm-deep border-lm-border text-lm-muted hover:text-lm-primary' : 'bg-lm-neon/15 border-lm-neon/40 text-lm-neon'
          }`}
        >
          {dashPaused ? 'Reativar' : 'Pausar'}
        </button>
      </div>

      {/* Por seção: master on/off + cliente vê / só interna */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-lm-subtle uppercase tracking-wider">Seções do Espaço</p>
        <p className="text-[11px] text-lm-subtle">Ligue/desligue cada seção e escolha se o cliente vê ou se é só interna. Você admin sempre enxerga tudo.</p>
        <div className="space-y-1.5">
          {ALL_SECTIONS.map((s) => {
            const c = cfgOf(s)
            return (
              <div key={s} className="flex items-center gap-3 bg-lm-deep border border-lm-border rounded-lm-sm px-3 py-2">
                <p className="text-sm text-lm-primary flex-1 min-w-0 truncate">{SECTION_LABEL[s]}</p>
                <button
                  type="button"
                  onClick={() => sectionMut.mutate({ section: s, enabled: !c.enabled })}
                  disabled={sectionMut.isPending}
                  title={c.enabled ? 'Seção ligada' : 'Seção desligada (ninguém vê, exceto admin)'}
                  className={`px-2.5 py-1 rounded-lm-sm text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                    c.enabled ? 'bg-lm-neon/15 border-lm-neon/40 text-lm-neon' : 'bg-lm-card2 border-lm-border text-lm-subtle'
                  }`}
                >
                  {c.enabled ? 'Ligada' : 'Desligada'}
                </button>
                <button
                  type="button"
                  onClick={() => sectionMut.mutate({ section: s, client_visible: !c.client_visible })}
                  disabled={sectionMut.isPending || !c.enabled}
                  title={c.client_visible ? 'Cliente vê esta seção' : 'Só interna'}
                  className={`px-2.5 py-1 rounded-lm-sm text-[11px] font-semibold border transition-colors disabled:opacity-40 ${
                    c.client_visible ? 'bg-lm-neon/15 border-lm-neon/40 text-lm-neon' : 'bg-lm-card2 border-lm-border text-lm-subtle'
                  }`}
                >
                  {c.client_visible ? 'Cliente vê' : 'Só interna'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Acessos ──────────────────────────────────────────────────────────────────

function TabAcessos() {
  const { data: accesses = [], isLoading } = useEspacoAccesses()
  const createMut = useCreateAccess()

  const [aLabel, setALabel] = useState('')
  const [aRole, setARole] = useState<'admin' | 'client'>('client')
  const [aExpiry, setAExpiry] = useState('')

  function gerar() {
    createMut.mutate(
      {
        label: aLabel.trim() || null,
        role: aRole,
        expires_at: aRole === 'client' ? localToIso(aExpiry) : null,
      },
      { onSuccess: () => { setALabel(''); setAExpiry('') } },
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-lm-subtle">
        Cada link é um acesso ao Espaço. <span className="text-lm-muted">Admin</span> gere tudo por aqui;{' '}
        <span className="text-lm-muted">Cliente</span> vê só o que você liberar.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <input value={aLabel} onChange={(e) => setALabel(e.target.value)} placeholder="Rótulo (ex: Márcio - diretor)" className={`${inputCls} flex-1 min-w-[180px]`} />
        <div className="flex gap-1">
          {(['client', 'admin'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setARole(r)}
              className={`px-3 py-2 rounded-lm-sm text-sm border transition-colors ${aRole === r ? 'bg-lm-neon/15 border-lm-neon/40 text-lm-neon' : 'bg-lm-deep border-lm-border text-lm-muted'}`}
            >
              {r === 'admin' ? 'Admin' : 'Cliente'}
            </button>
          ))}
        </div>
        {aRole === 'client' && (
          <div className="flex flex-col">
            <label className="text-[10px] text-lm-subtle mb-0.5">Expira em (opcional)</label>
            <input type="datetime-local" value={aExpiry} onChange={(e) => setAExpiry(e.target.value)} className={inputCls} />
          </div>
        )}
        <button type="button" onClick={gerar} disabled={createMut.isPending} className={btnPrimary}>
          <Plus size={14} strokeWidth={2.5} /> Gerar link
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-lm-border/25 rounded-lm-sm animate-pulse" />)}</div>
      ) : accesses.length === 0 ? (
        <p className="text-xs text-lm-subtle italic">Nenhum link gerado ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {accesses.map((a) => <AccessRow key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}

function AccessRow({ a }: { a: EspacoAccess }) {
  const revokeMut = useRevokeAccess()
  const updateMut = useUpdateAccess()
  const [copied, setCopied] = useState(false)

  function copyLink() {
    const url = `${window.location.origin}/espaco/${a.token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  function toggleSection(s: DashSectionId) {
    const base = a.allowed_sections ?? ALL_SECTIONS
    const next = base.includes(s) ? base.filter((x) => x !== s) : [...base, s]
    updateMut.mutate({ access_id: a.id, allowed_sections: next.length === ALL_SECTIONS.length ? null : next })
  }

  const expired = a.expires_at ? Date.parse(a.expires_at) < Date.now() : false

  return (
    <div className="bg-lm-deep border border-lm-border rounded-lm-sm px-3 py-2 space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-lm-primary truncate">
            {a.label || 'Sem rótulo'}
            <span className={`text-[10px] ml-2 px-1.5 py-0.5 rounded-lm-sm ${a.role === 'admin' ? 'bg-lm-neon/15 text-lm-neon' : 'bg-lm-border/40 text-lm-subtle'}`}>
              {a.role === 'admin' ? 'Admin' : 'Cliente'}
            </span>
          </p>
          <p className="text-[10px] text-lm-subtle">
            {a.access_count} acesso{a.access_count !== 1 ? 's' : ''}
            {a.last_accessed_at && ` · último ${format(parseISO(a.last_accessed_at), 'dd/MM HH:mm')}`}
            {a.expires_at && (
              expired
                ? <span className="text-lm-danger"> · expirado</span>
                : <span> · expira {format(parseISO(a.expires_at), 'dd/MM HH:mm')}</span>
            )}
          </p>
        </div>
        <button type="button" onClick={copyLink} title="Copiar link" className="p-1.5 text-lm-muted hover:text-lm-primary rounded-lm-sm transition-colors">
          {copied ? <Check size={14} className="text-lm-neon" /> : <Copy size={14} />}
        </button>
        <button type="button" onClick={() => revokeMut.mutate(a.id)} disabled={revokeMut.isPending} title="Revogar" className="p-1.5 text-lm-muted hover:text-lm-danger rounded-lm-sm transition-colors disabled:opacity-40">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Permissão por seção (admin vê tudo sempre) */}
      {a.role !== 'admin' && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-lm-subtle uppercase tracking-wider mr-1">Vê:</span>
          {ALL_SECTIONS.map((s) => {
            const on = !a.allowed_sections || a.allowed_sections.includes(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSection(s)}
                disabled={updateMut.isPending}
                className={`px-2 py-0.5 rounded-lm-sm text-[10px] font-medium border transition-colors disabled:opacity-50 ${
                  on ? 'bg-lm-neon/15 border-lm-neon/40 text-lm-neon' : 'bg-lm-card2 border-lm-border text-lm-subtle line-through'
                }`}
              >
                {SECTION_LABEL[s]}
              </button>
            )
          })}
        </div>
      )}

      {/* Validade (só cliente; admin nunca expira) */}
      {a.role !== 'admin' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-lm-subtle uppercase tracking-wider">Validade:</span>
          <input
            type="datetime-local"
            defaultValue={isoToLocal(a.expires_at)}
            onChange={(e) => updateMut.mutate({ access_id: a.id, allowed_sections: a.allowed_sections, expires_at: localToIso(e.target.value) })}
            disabled={updateMut.isPending}
            className={`${inputCls} text-[11px] py-1`}
          />
          {a.expires_at && (
            <button
              type="button"
              onClick={() => updateMut.mutate({ access_id: a.id, allowed_sections: a.allowed_sections, expires_at: null })}
              disabled={updateMut.isPending}
              className="text-[10px] text-lm-subtle hover:text-lm-primary underline disabled:opacity-50"
            >
              tornar permanente
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pessoas (usuários cadastrados do tenant — só leitura + atalho) ───────────

function TabPessoas() {
  const { data: members = [], isLoading } = useMembers()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-lm-subtle max-w-md">
          As pessoas do Espaço são os usuários cadastrados do tenant. Pra adicionar, editar ou remover, use a tela de gestão de usuários.
        </p>
        <Link to="/equipe" className={btnPrimary}>
          <ExternalLink size={14} strokeWidth={2.5} /> Gerenciar usuários
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-10 bg-lm-border/25 rounded-lm-sm animate-pulse" />)}</div>
      ) : members.length === 0 ? (
        <p className="text-xs text-lm-subtle italic">Nenhum usuário cadastrado ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-lm-deep border border-lm-border rounded-lm-sm px-3 py-2">
              <div className="grid place-items-center w-7 h-7 rounded-full bg-lm-neon/15 text-lm-neon text-xs font-semibold shrink-0">
                {(m.full_name || '?').trim().charAt(0).toUpperCase()}
              </div>
              <p className="text-sm text-lm-primary truncate">{m.full_name || 'Sem nome'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
