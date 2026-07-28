import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDateTimeBR } from '@/utils/dateUtils';
import { toast } from 'sonner';
import {
  Button, Input, Label as UILabel, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/ds';
import {
  Shuffle, Plus, Trash2, GripVertical, Save, Phone,
  Clock, Bell, ToggleLeft, ToggleRight, Users, BarChart2,
  Gavel, Hand, Wifi,
} from 'lucide-react';
import { roletaConfigService, RoletaConfig, RoletaMember, BrokerAssignment, DistributionMode } from '@/services/roletaConfig/roletaConfigService';
import usersService from '@/services/users/usersService';
import { leadAutomationService, WaGroup } from '@/services/leadAutomation/leadAutomationService';
import inboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';
import { accountService } from '@/services/account';
import { leadAdsFormsService, MetaForm, LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';

// Normaliza pra comparar nome de grupo x nome do CRM (ignora acento/pontuação/caixa).
function normalizeName(s: string): string {
  // NFD decompõe os acentos; o strip de não-alfanumérico remove marcas/pontuação/espaço.
  return (s || '').normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Instância central da Leal Mídia que está em todos os grupos de cliente.
// Os grupos de aviso (grupo interno com o nome do CRM) são listados e enviados por ela.
const CENTRAL_GROUP_INSTANCE = 'Operacional (LM01)';

// Variáveis disponíveis nos avisos editáveis (1 clique joga no texto).
const ROLETA_VARS: { v: string; label: string }[] = [
  { v: 'nome', label: 'Nome do lead' },
  { v: 'telefone', label: 'Telefone' },
  { v: 'corretor', label: 'Corretor' },
  { v: 'prazo', label: 'Prazo (min)' },
  { v: 'prazo_hora', label: 'Horário limite' },
  { v: 'data', label: 'Data de chegada' },
  { v: 'link_aceite', label: 'Link de aceite' },
];
import type { User } from '@/types/users';

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-orange-100 text-orange-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  passed:   'bg-blue-100 text-blue-700',
  expired:  'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending:  'Aguardando',
  accepted: 'Aceito',
  passed:   'Passado',
  expired:  'Expirado',
};

// Os 4 modos, com nome de gente e explicação do que cada um faz.
// Esta tela é o ÚNICO lugar que configura distribuição de lead.
const MODES: { value: DistributionMode; label: string; icon: typeof Shuffle; desc: string }[] = [
  {
    value: 'rodizio',
    label: 'Rodízio',
    icon: Shuffle,
    desc: 'Oferece para um corretor por vez, na vez dele (respeita o peso). Se ele não assumir no prazo, passa para o próximo.',
  },
  {
    value: 'leilao',
    label: 'Leilão',
    icon: Gavel,
    desc: 'Oferece para todos ao mesmo tempo. O primeiro que assumir leva. Bom para lead quente e para acabar com quem senta em cima do lead.',
  },
  {
    value: 'manual',
    label: 'Manual',
    icon: Hand,
    desc: 'O lead chega sem dono e o gerente escolhe quem atende.',
  },
  {
    value: 'disponibilidade',
    label: 'Por disponibilidade',
    icon: Wifi,
    desc: 'Entrega para o corretor que está Online e tem menos conversas abertas.',
  },
];

const MODE_LABEL: Record<string, string> = Object.fromEntries(MODES.map(m => [m.value, m.label]));

interface MemberRow extends Omit<RoletaMember, 'id'> {
  localId: string;
}

function mkLocal(m?: Partial<RoletaMember>): MemberRow {
  return {
    localId: Math.random().toString(36).slice(2),
    user_id: m?.user_id ?? '',
    weight: m?.weight ?? 10,
    is_active: m?.is_active ?? true,
    position: m?.position ?? 0,
    personal_whatsapp_number: m?.personal_whatsapp_number ?? '',
  };
}

export default function RoletaConfigPage() {
  const [configs, setConfigs]         = useState<RoletaConfig[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<RoletaConfig | null>(null);
  const [tab, setTab]                 = useState<'configs' | 'assignments'>('configs');
  const [assignments, setAssignments] = useState<BrokerAssignment[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);

  // form state
  const [inboxId, setInboxId]               = useState('');
  const [isActive, setIsActive]             = useState(true);
  const [mode, setMode]                     = useState<DistributionMode>('rodizio');
  const [timeoutMin, setTimeoutMin]         = useState(30);
  const [gestorNum, setGestorNum]           = useState('');
  const [gestorGroupJid, setGestorGroupJid] = useState('');
  const [notifInboxId, setNotifInboxId]     = useState('');
  const [members, setMembers]               = useState<MemberRow[]>([]);
  const [groups, setGroups]                 = useState<WaGroup[]>([]);
  const [loadingGroups, setLoadingGroups]   = useState(false);
  const [crmName, setCrmName]               = useState('');
  // Avisos editáveis (templates). Vazio = usa o texto padrão.
  const [msgCorretor, setMsgCorretor]       = useState('');
  const [msgGestor, setMsgGestor]           = useState('');
  const [msgGrupo, setMsgGrupo]             = useState('');
  const corretorRef = useRef<HTMLTextAreaElement>(null);
  const gestorRef   = useRef<HTMLTextAreaElement>(null);
  const grupoRef    = useRef<HTMLTextAreaElement>(null);
  const [activeMsg, setActiveMsg]           = useState<'corretor' | 'gestor' | 'grupo'>('corretor');
  // Fontes: formulários do FB roteados pra esta roleta.
  const [metaForms, setMetaForms]           = useState<MetaForm[]>([]);
  const [formConfigs, setFormConfigs]       = useState<LeadAdsFormConfig[]>([]);
  const [loadingForms, setLoadingForms]     = useState(false);
  const [formsError, setFormsError]         = useState<string | null>(null);
  const [inboxes, setInboxes]               = useState<Inbox[]>([]);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await roletaConfigService.getAll());
    } catch {
      toast.error('Erro ao carregar configuracoes da roleta');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await usersService.getUsers();
      setUsers(res.data ?? []);
    } catch { /* silencioso */ }
  }, []);

  const loadInboxes = useCallback(async () => {
    try {
      const res = await inboxesService.list();
      setInboxes(res.data ?? []);
    } catch { /* silencioso */ }
  }, []);

  const loadAccount = useCallback(async () => {
    try {
      const acc = await accountService.getAccount();
      setCrmName(acc?.name ?? '');
    } catch { /* silencioso */ }
  }, []);

  const loadAssignments = useCallback(async () => {
    setLoadingAssign(true);
    try {
      setAssignments(await roletaConfigService.getAssignments());
    } catch {
      toast.error('Erro ao carregar atribuicoes');
    } finally {
      setLoadingAssign(false);
    }
  }, []);

  useEffect(() => { loadConfigs(); loadUsers(); loadInboxes(); loadAccount(); }, [loadConfigs, loadUsers, loadInboxes, loadAccount]);
  useEffect(() => { if (tab === 'assignments') loadAssignments(); }, [tab, loadAssignments]);

  function openCreate() {
    setEditing(null);
    setInboxId('');
    setIsActive(true);
    setMode('rodizio');
    setTimeoutMin(30);
    setGestorNum('');
    setGestorGroupJid('');
    setNotifInboxId('');
    setMsgCorretor(''); setMsgGestor(''); setMsgGrupo('');
    setMembers([mkLocal()]);
    setGroups([]);
    setModalOpen(true);
  }

  function openEdit(c: RoletaConfig) {
    setEditing(c);
    setInboxId(c.inbox_id);
    setIsActive(c.is_active);
    setMode(c.distribution_mode ?? 'rodizio');
    setTimeoutMin(c.timeout_minutes);
    setGestorNum(c.gestor_whatsapp_number ?? '');
    setGestorGroupJid(c.gestor_group_jid ?? '');
    setNotifInboxId(c.notification_inbox_id ?? '');
    setMsgCorretor(c.msg_corretor_template ?? '');
    setMsgGestor(c.msg_gestor_template ?? '');
    setMsgGrupo(c.msg_grupo_template ?? '');
    setMembers(c.members.length ? c.members.map(m => mkLocal(m)) : [mkLocal()]);
    setModalOpen(true);
  }

  // Busca os grupos da central Operacional (onde vive o grupo interno do cliente,
  // com o nome do CRM). Independe do inbox da roleta.
  useEffect(() => {
    if (!modalOpen) { setGroups([]); return; }
    let cancelled = false;
    setLoadingGroups(true);
    // all=true: TODOS os grupos da Operacional. O(s) com nome parecido ao do CRM
    // sobem pro topo como sugeridos.
    leadAutomationService.getGroups(CENTRAL_GROUP_INSTANCE, true)
      .then(g => {
        if (cancelled) return;
        const crm = normalizeName(crmName);
        const suggested = (x: WaGroup) => {
          if (!crm) return false;
          const n = normalizeName(x.name);
          return n.includes(crm) || crm.includes(n);
        };
        const sorted = [...g].sort((a, b) => {
          const sa = suggested(a) ? 0 : 1;
          const sb = suggested(b) ? 0 : 1;
          if (sa !== sb) return sa - sb;
          return a.name.localeCompare(b.name);
        });
        setGroups(sorted);
      })
      .catch(() => { if (!cancelled) setGroups([]); })
      .finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
  }, [modalOpen, crmName]);

  // Fontes: carrega os formulários do FB + as configs (só faz sentido editando roleta salva).
  useEffect(() => {
    if (!modalOpen || !editing) { setMetaForms([]); setFormConfigs([]); setFormsError(null); return; }
    let cancelled = false;
    setLoadingForms(true);
    Promise.all([leadAdsFormsService.syncMetaForms(), leadAdsFormsService.getAll()])
      .then(([res, cfgs]) => {
        if (cancelled) return;
        setMetaForms(res.data ?? []);
        setFormsError(res.error ?? null);
        setFormConfigs(cfgs ?? []);
      })
      .catch(() => { if (!cancelled) { setMetaForms([]); setFormConfigs([]); } })
      .finally(() => { if (!cancelled) setLoadingForms(false); });
    return () => { cancelled = true; };
  }, [modalOpen, editing]);

  async function toggleFormRoleta(form: MetaForm) {
    if (!editing) return;
    const existing = formConfigs.find(c => c.form_id === form.id);
    const routedHere = existing?.roleta_config_id === editing.id;
    try {
      if (existing) {
        await leadAdsFormsService.update(existing.id, {
          form_id: existing.form_id, form_name: existing.form_name || form.name,
          pipeline_id: existing.pipeline_id, pipeline_stage_id: existing.pipeline_stage_id,
          is_active: true, label_ids: existing.label_ids ?? [],
          roleta_config_id: routedHere ? null : editing.id,
        });
      } else {
        await leadAdsFormsService.create({
          form_id: form.id, form_name: form.name,
          pipeline_id: null, pipeline_stage_id: null, is_active: true, label_ids: [],
          roleta_config_id: editing.id,
        });
      }
      setFormConfigs(await leadAdsFormsService.getAll());
      toast.success(routedHere ? 'Formulário desvinculado desta roleta' : 'Formulário vinculado a esta roleta');
    } catch {
      toast.error('Não foi possível atualizar a fonte');
    }
  }

  async function save() {
    if (!inboxId.trim()) { toast.error('Inbox ID obrigatorio'); return; }
    if (!gestorNum.trim()) { toast.error('Numero do gestor obrigatorio'); return; }
    const membersValid = members.filter(m => m.user_id && m.personal_whatsapp_number);
    // No modo Manual o gerente distribui na mão, então não precisa de corretor cadastrado.
    if (mode !== 'manual' && membersValid.length === 0) {
      toast.error('Adicione ao menos um corretor com numero de WhatsApp');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        inbox_id:               inboxId,
        is_active:              isActive,
        distribution_mode:      mode,
        timeout_minutes:        timeoutMin,
        gestor_whatsapp_number: gestorNum,
        gestor_group_jid:       gestorGroupJid || null,
        gestor_group_instance:  gestorGroupJid ? CENTRAL_GROUP_INSTANCE : null,
        msg_corretor_template:  msgCorretor.trim() || null,
        msg_gestor_template:    msgGestor.trim() || null,
        msg_grupo_template:     msgGrupo.trim() || null,
        notification_inbox_id:  notifInboxId || null,
        members:                membersValid.map((m, i) => ({
          user_id:                  m.user_id,
          weight:                   m.weight,
          is_active:                m.is_active,
          position:                 i,
          personal_whatsapp_number: m.personal_whatsapp_number,
        })),
      };
      if (editing) {
        await roletaConfigService.update(editing.id, payload);
        toast.success('Roleta atualizada');
      } else {
        await roletaConfigService.create(payload);
        toast.success('Roleta criada');
      }
      setModalOpen(false);
      loadConfigs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteConfig(id: string) {
    if (!window.confirm('Excluir esta configuracao de roleta?')) return;
    try {
      await roletaConfigService.destroy(id);
      toast.success('Removida');
      loadConfigs();
    } catch {
      toast.error('Erro ao excluir');
    }
  }

  function addMember() {
    setMembers(prev => [...prev, mkLocal()]);
  }

  function updateMember(localId: string, key: keyof MemberRow, value: string | number | boolean) {
    setMembers(prev => prev.map(m => m.localId === localId ? { ...m, [key]: value } : m));
  }

  // Ao escolher o corretor, puxa o WhatsApp cadastrado dele (se tiver e o campo
  // estiver vazio). Sem cadastro, deixa em branco pra preencher na mão.
  function selectCorretor(localId: string, userId: string) {
    const u = users.find(x => x.id === userId) as
      (User & { whatsapp_number?: string; custom_attributes?: { whatsapp_number?: string } }) | undefined;
    const registered = String(u?.whatsapp_number ?? u?.custom_attributes?.whatsapp_number ?? '').trim();
    setMembers(prev => prev.map(m => {
      if (m.localId !== localId) return m;
      const next: MemberRow = { ...m, user_id: userId };
      if (registered && !String(m.personal_whatsapp_number ?? '').trim()) {
        next.personal_whatsapp_number = registered;
      }
      return next;
    }));
  }

  function removeMember(localId: string) {
    setMembers(prev => prev.filter(m => m.localId !== localId));
  }

  // 1 clique joga a variável no texto do aviso focado (na posição do cursor).
  function insertVar(v: string) {
    const token = `{{${v}}}`;
    const map = {
      corretor: { ref: corretorRef, val: msgCorretor, set: setMsgCorretor },
      gestor:   { ref: gestorRef,   val: msgGestor,   set: setMsgGestor },
      grupo:    { ref: grupoRef,    val: msgGrupo,    set: setMsgGrupo },
    } as const;
    const t = map[activeMsg];
    const el = t.ref.current;
    if (!el) { t.set(t.val + token); return; }
    const start = el.selectionStart ?? t.val.length;
    const end = el.selectionEnd ?? t.val.length;
    t.set(t.val.slice(0, start) + token + t.val.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const totalWeight = members.reduce((s, m) => s + (m.is_active ? m.weight : 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-[#7c3aed]" />
            Distribuição de Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            O único lugar que decide quem atende cada lead: o modo, quem participa, o prazo e o aviso do gestor.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white gap-2">
          <Plus className="h-4 w-4" />
          Nova distribuição
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['configs', 'assignments'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-[#7c3aed] text-[#7c3aed]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'configs' ? 'Configuracoes' : 'Atribuicoes Recentes'}
          </button>
        ))}
      </div>

      {tab === 'configs' && (
        <div className="space-y-3">
          {loading && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          {!loading && configs.length === 0 && (
            <div className="border rounded-lg p-12 text-center text-muted-foreground">
              <Shuffle className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhuma roleta configurada</p>
              <p className="text-sm mt-1">Crie uma para comecar a distribuir leads automaticamente.</p>
            </div>
          )}
          {configs.map(c => (
            <div key={c.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{c.inbox_name || `Inbox: ${c.inbox_id}`}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {MODE_LABEL[c.distribution_mode] ?? 'Rodízio'}
                      </Badge>
                      {!c.is_active && <span className="text-xs text-muted-foreground">(desativada)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.distribution_mode === 'manual'
                        ? 'Gerente distribui na mão'
                        : `Prazo: ${c.timeout_minutes} min`}
                      {' — Gestor: '}{c.gestor_whatsapp_number || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteConfig(c.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {c.members.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.members.map(m => (
                    <div key={m.id ?? m.user_id} className="flex items-center gap-1.5 text-xs bg-muted rounded px-2 py-1">
                      <Users className="h-3 w-3" />
                      <span>{m.user_name ?? m.user_id}</span>
                      <Badge variant="outline" className="text-[10px] px-1">{m.weight}x</Badge>
                      {!m.is_active && <span className="text-muted-foreground">(inativo)</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'assignments' && (
        <div className="space-y-2">
          {loadingAssign && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loadingAssign && assignments.length === 0 && (
            <div className="border rounded-lg p-12 text-center text-muted-foreground">
              <BarChart2 className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>Nenhuma atribuicao recente</p>
            </div>
          )}
          {assignments.map(a => (
            <div key={a.id} className="border rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{a.contact_name ?? a.contact_phone ?? a.contact_id}</p>
                <p className="text-xs text-muted-foreground">
                  Corretor: {a.assigned_user.name ?? a.assigned_user.id} — Round {a.round}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[a.status]}`}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateTimeBR(a.assigned_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criacao/edicao */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar roleta' : 'Nova roleta'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Instância (inbox) */}
            <div>
              <UILabel>Instância (WhatsApp) *</UILabel>
              <select
                value={inboxId}
                onChange={e => setInboxId(e.target.value)}
                disabled={!!editing}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Selecione a instância...</option>
                {inboxId && !inboxes.some(i => i.id === inboxId) && (
                  <option value={inboxId}>{inboxId}</option>
                )}
                {inboxes.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                A caixa de entrada (número de WhatsApp) que essa roleta distribui.
              </p>
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsActive(!isActive)} className="text-[#7c3aed]">
                {isActive
                  ? <ToggleRight className="h-7 w-7 text-green-500" />
                  : <ToggleLeft className="h-7 w-7 text-red-500" />}
              </button>
              <div>
                <p className="text-sm font-medium">Roleta {isActive ? 'ativa' : 'desativada'}</p>
                <p className="text-xs text-muted-foreground">Desativar para nao distribuir leads neste inbox.</p>
              </div>
            </div>

            {/* Modo de distribuicao — o coracao da tela */}
            <div>
              <UILabel className="flex items-center gap-1.5 mb-2">
                <Shuffle className="h-4 w-4" />
                Como o lead é distribuído *
              </UILabel>
              <div className="space-y-2">
                {MODES.map(opt => {
                  const Icon = opt.icon;
                  const active = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                        active ? 'border-[#7c3aed] bg-[#7c3aed]/5' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${active ? 'text-[#7c3aed]' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prazo — nao se aplica ao modo Manual */}
            {mode !== 'manual' && (
              <div>
                <UILabel className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {mode === 'leilao' ? 'Prazo do leilão (minutos) *' : 'Tempo limite para aceite (minutos) *'}
                </UILabel>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={timeoutMin}
                  onChange={e => setTimeoutMin(parseInt(e.target.value) || 30)}
                  className="mt-1 w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === 'leilao'
                    ? `Se ninguém assumir em ${timeoutMin} min, o lead cai no rodízio para não ficar sem dono.`
                    : `Se o corretor não assumir em ${timeoutMin} min, o lead passa para o próximo.`}
                </p>
              </div>
            )}

            {/* Numero do gestor */}
            <div>
              <UILabel className="flex items-center gap-1.5">
                <Bell className="h-4 w-4" />
                Numero do gestor (WhatsApp) *
              </UILabel>
              <Input
                value={gestorNum}
                onChange={e => setGestorNum(e.target.value)}
                placeholder="5511999990000"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recebera alertas de atribuicao, timeout e relatorios diarios/semanais.
              </p>
            </div>

            {/* Grupo de avisos (opcional) */}
            <div>
              <UILabel className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Grupo de avisos (opcional)
              </UILabel>
              <select
                value={gestorGroupJid}
                onChange={e => setGestorGroupJid(e.target.value)}
                disabled={loadingGroups}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Nenhum</option>
                {gestorGroupJid && !groups.some(g => g.id === gestorGroupJid) && (
                  <option value={gestorGroupJid}>{gestorGroupJid}</option>
                )}
                {groups.map(g => {
                  const crm = normalizeName(crmName);
                  const n = normalizeName(g.name);
                  const suggested = !!crm && (n.includes(crm) || crm.includes(n));
                  return (
                    <option key={g.id} value={g.id}>{g.name}{suggested ? '  ⭐ (sugerido)' : ''}</option>
                  );
                })}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {loadingGroups
                  ? 'Carregando grupos...'
                  : groups.length === 0
                    ? 'Nenhum grupo encontrado na central Operacional.'
                    : 'Todos os grupos da central Operacional. O do CRM aparece no topo como ⭐ sugerido. O aviso é enviado por ela.'}
              </p>
            </div>

            {/* Inbox de notificacao */}
            <div>
              <UILabel className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                Inbox para notificacoes (opcional)
              </UILabel>
              <select
                value={notifInboxId}
                onChange={e => setNotifInboxId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Mesma instância da roleta</option>
                {notifInboxId && !inboxes.some(i => i.id === notifInboxId) && (
                  <option value={notifInboxId}>{notifInboxId}</option>
                )}
                {inboxes.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Instância que ENVIA os alertas. Se vazio, usa a mesma da roleta.
              </p>
            </div>

            {/* Mensagens dos avisos (editáveis) */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <UILabel className="flex items-center gap-1.5">
                <Bell className="h-4 w-4" />
                Mensagens dos avisos (opcional)
              </UILabel>
              <p className="text-xs text-muted-foreground">
                Em branco = usa o texto padrão. Clique numa variável pra jogar no texto do aviso focado:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ROLETA_VARS.map(x => (
                  <button
                    key={x.v}
                    type="button"
                    onClick={() => insertVar(x.v)}
                    title={x.label}
                    className="text-xs rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-2 py-0.5 text-[#9333EA] hover:bg-[#7c3aed]/20"
                  >
                    {`{{${x.v}}}`}
                  </button>
                ))}
              </div>
              <div>
                <UILabel className="text-xs">Aviso do corretor</UILabel>
                <textarea
                  ref={corretorRef}
                  value={msgCorretor}
                  onFocus={() => setActiveMsg('corretor')}
                  onChange={e => setMsgCorretor(e.target.value)}
                  rows={3}
                  placeholder="Padrão: 🔔 Novo lead na sua fila... + link de aceite"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <UILabel className="text-xs">Aviso do gestor</UILabel>
                <textarea
                  ref={gestorRef}
                  value={msgGestor}
                  onFocus={() => setActiveMsg('gestor')}
                  onChange={e => setMsgGestor(e.target.value)}
                  rows={3}
                  placeholder="Padrão: 🚨 Lead Novo na Roleta — Aguardando Aceite..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <UILabel className="text-xs">Aviso do grupo</UILabel>
                <textarea
                  ref={grupoRef}
                  value={msgGrupo}
                  onFocus={() => setActiveMsg('grupo')}
                  onChange={e => setMsgGrupo(e.target.value)}
                  rows={3}
                  placeholder="Padrão: 🎯 Lead distribuído pela roleta..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Fontes de leads (gatilhos por formulário) */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <UILabel className="flex items-center gap-1.5">
                <Shuffle className="h-4 w-4" />
                Fontes de leads (gatilhos)
              </UILabel>
              <p className="text-xs text-muted-foreground">
                Por padrão, <b>todo lead de campanha</b> (WhatsApp + formulários) cai nesta roleta.
                Pra rotear formulários específicos do Facebook só pra ela, marque abaixo:
              </p>
              {!editing ? (
                <p className="text-xs text-amber-500">Salve a roleta primeiro pra poder vincular formulários.</p>
              ) : loadingForms ? (
                <p className="text-xs text-muted-foreground">Carregando formulários do Facebook...</p>
              ) : formsError ? (
                <p className="text-xs text-red-400">{formsError}</p>
              ) : metaForms.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum formulário do Facebook (conecte a página em Configurações &rarr; Formulários (Meta)).</p>
              ) : (
                <div className="space-y-1.5">
                  {metaForms.map(f => {
                    const cfg = formConfigs.find(c => c.form_id === f.id);
                    const routedHere = cfg?.roleta_config_id === editing.id;
                    const routedOther = !!cfg?.roleta_config_id && !routedHere;
                    return (
                      <label key={f.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={routedHere}
                          disabled={routedOther}
                          onChange={() => toggleFormRoleta(f)}
                        />
                        <span className={routedOther ? 'text-muted-foreground line-through' : ''}>{f.name}</span>
                        {routedOther && <span className="text-xs text-amber-500">(já em outra roleta)</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Corretores */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <UILabel className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Corretores da roleta
                </UILabel>
                <button
                  type="button"
                  onClick={addMember}
                  className="text-xs text-[#7c3aed] hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>

              {totalWeight > 0 && (
                <div className="text-xs text-muted-foreground mb-2">
                  Distribuicao real (peso / soma):
                  {members.filter(m => m.is_active && m.user_id).map(m => {
                    const pct = ((m.weight / totalWeight) * 100).toFixed(0);
                    const u = users.find(u => u.id === m.user_id);
                    return ` ${u?.name ?? m.user_id} ${pct}%`;
                  })}
                </div>
              )}

              <div className="space-y-3">
                {members.map((m, idx) => (
                  <div key={m.localId} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateMember(m.localId, 'is_active', !m.is_active)}
                          className={m.is_active ? 'text-green-500' : 'text-red-500'}
                        >
                          {m.is_active
                            ? <ToggleRight className="h-5 w-5" />
                            : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMember(m.localId)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <UILabel className="text-xs">Corretor *</UILabel>
                        <select
                          value={m.user_id}
                          onChange={e => selectCorretor(m.localId, e.target.value)}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Selecione...</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <UILabel className="text-xs">Peso (probabilidade relativa)</UILabel>
                        <Input
                          type="number"
                          min={0}
                          value={m.weight}
                          onChange={e => updateMember(m.localId, 'weight', parseInt(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <UILabel className="text-xs">WhatsApp pessoal * (com DDI)</UILabel>
                      <Input
                        value={m.personal_whatsapp_number}
                        onChange={e => updateMember(m.localId, 'personal_whatsapp_number', e.target.value)}
                        placeholder="5511999990000"
                        className="mt-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white gap-2">
              {saving ? 'Salvando...' : <><Save className="h-4 w-4" /> Salvar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
