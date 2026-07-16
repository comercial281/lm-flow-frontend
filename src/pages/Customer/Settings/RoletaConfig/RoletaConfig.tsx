import { useState, useEffect, useCallback } from 'react';
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
  const [notifInboxId, setNotifInboxId]     = useState('');
  const [members, setMembers]               = useState<MemberRow[]>([]);

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

  useEffect(() => { loadConfigs(); loadUsers(); }, [loadConfigs, loadUsers]);
  useEffect(() => { if (tab === 'assignments') loadAssignments(); }, [tab, loadAssignments]);

  function openCreate() {
    setEditing(null);
    setInboxId('');
    setIsActive(true);
    setMode('rodizio');
    setTimeoutMin(30);
    setGestorNum('');
    setNotifInboxId('');
    setMembers([mkLocal()]);
    setModalOpen(true);
  }

  function openEdit(c: RoletaConfig) {
    setEditing(c);
    setInboxId(c.inbox_id);
    setIsActive(c.is_active);
    setMode(c.distribution_mode ?? 'rodizio');
    setTimeoutMin(c.timeout_minutes);
    setGestorNum(c.gestor_whatsapp_number ?? '');
    setNotifInboxId(c.notification_inbox_id ?? '');
    setMembers(c.members.length ? c.members.map(m => mkLocal(m)) : [mkLocal()]);
    setModalOpen(true);
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

  function removeMember(localId: string) {
    setMembers(prev => prev.filter(m => m.localId !== localId));
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
            {/* Inbox ID */}
            <div>
              <UILabel>Inbox ID *</UILabel>
              <Input
                value={inboxId}
                onChange={e => setInboxId(e.target.value)}
                placeholder="ID numerico do inbox"
                className="mt-1"
                disabled={!!editing}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Encontre em Configuracoes &rarr; Inboxes &rarr; ID da caixa de entrada.
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

            {/* Inbox de notificacao */}
            <div>
              <UILabel className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                Inbox para notificacoes (opcional)
              </UILabel>
              <Input
                value={notifInboxId}
                onChange={e => setNotifInboxId(e.target.value)}
                placeholder="ID do inbox de saida para alertas"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se vazio, usa o mesmo inbox da roleta.
              </p>
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
                          onChange={e => updateMember(m.localId, 'user_id', e.target.value)}
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
