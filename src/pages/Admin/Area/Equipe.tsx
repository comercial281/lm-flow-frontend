import { useState, useEffect, useCallback } from 'react';
import { UsersRound, Loader2, Plus, Trash2, ShieldCheck, EyeOff, Crown } from 'lucide-react';
import { toast } from 'sonner';
import superLogsService, { TeamMember, SupportReview, SupportReviewPerson } from '@/services/superLogs/superLogsService';
import { plural } from '@/lib/formato';
import { criterionLabel, tenantsToShow, personDetail, reviewTotals, accountCreatedLabel } from './supportReviewRules';

/**
 * Equipe Leal Mídia. Uma lista que faz duas coisas:
 *  - quem está aqui SOME dos logs (Uso/Auditoria) por padrão — não polui o que
 *    o cliente fez com o teu uso do sistema;
 *  - quem tem "acesso ao admin" pode entrar nesta Área do Admin com login próprio.
 * Só o dono (você) gerencia esta lista.
 */
export default function AdminEquipe() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [canAdmin, setCanAdmin] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [review, setReview] = useState<SupportReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await superLogsService.team();
      setMembers(r.data.data.members);
    } catch (e: unknown) {
      if ((e as { response?: { status?: number } })?.response?.status === 403) setForbidden(true);
      else toast.error('Falha ao carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadReview = useCallback(async () => {
    setReviewLoading(true);
    try {
      const r = await superLogsService.supportReview();
      setReview(r.data.data);
    } catch {
      setReview(null);
    } finally {
      setReviewLoading(false);
    }
  }, []);

  useEffect(() => { loadReview(); }, [loadReview]);

  // "Colocar na Equipe": a pessoa continua suporte quando o critério novo ligar.
  // Entra SEM acesso ao painel de admin — dar acesso é outra decisão, no botão
  // "Dar acesso" da lista de cima.
  const addFromReview = async (p: SupportReviewPerson) => {
    setBusyId(p.id);
    try {
      await superLogsService.addMember({ email: p.email, name: p.name || undefined, can_access_admin: false });
      toast.success(`${p.email} agora está na Equipe.`);
      load();
      loadReview();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Falha ao adicionar.');
    } finally {
      setBusyId(null);
    }
  };

  const add = async () => {
    if (!email.trim()) { toast.error('Informe o e-mail.'); return; }
    setSaving(true);
    try {
      await superLogsService.addMember({ email: email.trim(), name: name.trim() || undefined, can_access_admin: canAdmin });
      setEmail(''); setName(''); setCanAdmin(true);
      toast.success('Pessoa adicionada.');
      load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Falha ao adicionar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAdmin = async (m: TeamMember) => {
    setBusyId(m.id);
    try {
      await superLogsService.updateMember(m.id, { can_access_admin: !m.can_access_admin });
      load();
    } catch {
      toast.error('Falha ao atualizar.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: TeamMember) => {
    setBusyId(m.id);
    try {
      await superLogsService.removeMember(m.id);
      toast.success('Removido.');
      load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Falha ao remover.');
    } finally {
      setBusyId(null);
    }
  };

  if (forbidden) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          Só o dono da conta (comercial@lealmidia.com.br) pode gerenciar a equipe.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4 border-l-4 border-primary pl-3">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <UsersRound className="h-5 w-5" /> Equipe Leal Mídia
        </h1>
        <p className="text-sm text-muted-foreground">
          Quem está aqui some dos logs por padrão. Quem tem "acesso ao admin" entra nesta área com login próprio.
        </p>
      </div>

      {/* Adicionar */}
      <div className="rounded-xl border bg-card p-4 mb-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground">E-mail</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="pessoa@lealmidia.com.br"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome (opcional)</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tony"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={add}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={canAdmin} onChange={e => setCanAdmin(e.target.checked)} className="h-4 w-4" />
          Pode acessar o painel de admin (não só sumir do log)
        </label>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{m.name || m.email}</span>
                  {m.owner && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30 px-2 py-0.5 text-[11px]">
                      <Crown className="h-3 w-3" /> Dono
                    </span>
                  )}
                </div>
                {m.name && <div className="text-xs text-muted-foreground truncate">{m.email}</div>}
              </div>

              <span
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                  m.can_access_admin
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
                title={m.can_access_admin ? 'Acessa o painel de admin' : 'Só some dos logs'}
              >
                {m.can_access_admin ? <ShieldCheck className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {m.can_access_admin ? 'Acessa admin' : 'Só oculto no log'}
              </span>

              {!m.owner && (
                <>
                  <button
                    onClick={() => toggleAdmin(m)}
                    disabled={busyId === m.id}
                    className="text-xs rounded-md border px-2 py-1 hover:bg-muted disabled:opacity-60"
                  >
                    {m.can_access_admin ? 'Tirar acesso' : 'Dar acesso'}
                  </button>
                  <button
                    onClick={() => remove(m)}
                    disabled={busyId === m.id}
                    className="text-red-500 hover:text-red-600 disabled:opacity-60"
                    title="Remover"
                  >
                    {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fase 1 (Cargos): quem deixa de ser suporte quando o critério novo ligar */}
      <div className="mt-8 border-l-4 border-amber-500 pl-3">
        <h2 className="text-base font-semibold">E-mails @lealmidia.com.br nos clientes, fora desta Equipe</h2>
        <p className="text-sm text-muted-foreground">
          Quando o critério novo ligar, estas pessoas deixam de ser suporte e passam a usar só o cargo que têm no cliente.
          Para cada uma: coloque nesta Equipe, deixe como usuário comum, ou desative pela tela Equipe do próprio cliente.
        </p>
      </div>
      {reviewLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Lendo os clientes...
        </div>
      ) : !review ? (
        <p className="py-4 text-sm text-muted-foreground">Não consegui ler os clientes agora.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-medium">{criterionLabel(review.team_list_enabled)}</p>
          {(() => {
            const t = reviewTotals(review.tenants);
            return (
              <p className="text-xs text-muted-foreground">
                {plural(t.people, 'pessoa para decidir', 'pessoas para decidir')} ·{' '}
                {plural(t.withoutRoles, 'cliente sem cargos gravados', 'clientes sem cargos gravados')} ·{' '}
                {plural(t.failed, 'cliente sem leitura', 'clientes sem leitura')}
              </p>
            );
          })()}
          {tenantsToShow(review.tenants).map(tenant => (
            <div key={tenant.schema} className="rounded-lg border bg-card p-3">
              <div className="text-sm font-semibold">{tenant.name}</div>
              {tenant.error ? (
                <p className="text-xs text-red-500">Não consegui ler este cliente: {tenant.error}</p>
              ) : (
                <>
                  {tenant.people.map(p => (
                    <div key={p.id} className="mt-2 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{p.name || p.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.email} · {personDetail(p)}</div>
                      </div>
                      {!p.stays_support && (
                        <button
                          onClick={() => addFromReview(p)}
                          disabled={busyId === p.id}
                          className="text-xs rounded-md border px-2 py-1 hover:bg-muted disabled:opacity-60"
                        >
                          Colocar na Equipe
                        </button>
                      )}
                    </div>
                  ))}
                  {tenant.team_accounts.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <div className="text-xs font-semibold">Contas que passam a ser suporte quando o critério ligar</div>
                      <p className="text-xs text-muted-foreground">
                        Estes e-mails estão na Equipe, mas a conta no cliente não é @lealmidia.com.br. Confira se a conta é mesmo da pessoa antes de ligar.
                      </p>
                      {tenant.team_accounts.map(ta => (
                        <div key={ta.id} className="mt-2 min-w-0">
                          <div className="text-sm truncate">{ta.name || ta.email}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {ta.email} · {personDetail(ta)}
                            {accountCreatedLabel(ta.created_at) && ` · ${accountCreatedLabel(ta.created_at)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
