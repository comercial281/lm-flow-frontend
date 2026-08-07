import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { formatDateTimeBR } from '@/utils/dateUtils';
import { toast } from 'sonner';
import {
  Button, Input, Label as UILabel, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/ds';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Shuffle, Plus, Trash2, GripVertical, Save, Phone,
  Clock, Bell, ToggleLeft, ToggleRight, Users, BarChart2,
  Gavel, Hand, Wifi, Send, Loader2, Eye, EyeOff, AlertTriangle,
} from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { roletaFormProblems, backendProblems } from './roletaFormChecks';
import {
  roletaConfigService, RoletaConfig, RoletaMember, RoletaInstance, BrokerAssignment, DistributionMode,
  RoletaDiagnostic, RepairOwnersResult, RepairInboxAccessResult, RoletaQueue,
  RoletaHoursWindow, RoletaBusinessHours,
} from '@/services/roletaConfig/roletaConfigService';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { DEFAULT_WINDOW } from '@/components/schedule/scheduleWindows';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import usersService from '@/services/users/usersService';
import { leadAutomationService, WaGroup } from '@/services/leadAutomation/leadAutomationService';
import inboxesService from '@/services/channels/inboxesService';
import inboxMembersService from '@/services/channels/inboxMembersService';
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
  // Vazio quando é lead novo; explica o repasse quando o prazo de alguém estourou.
  { v: 'motivo', label: 'Motivo do repasse' },
  // Por qual número o lead vai ser atendido. Sem ela o aviso do grupo não diz
  // isso, e com vários números o gestor não sabe onde procurar a conversa.
  { v: 'instancia', label: 'Número que atende' },
];

// Os avisos editáveis. `repasse` é o do prazo estourado — destino é o grupo, igual
// ao `grupo`, mas com texto próprio.
type MsgTarget = 'corretor' | 'gestor' | 'grupo' | 'repasse';

// O backend não tem alvo 'repasse' no teste (o destino é o grupo), então o teste
// com campo vazio manda este espelho do texto embutido — senão sairia o de lead
// novo e o teste mentiria justamente sobre o que veio consertar.
const DEFAULT_REPASSE_PREVIEW =
  '🔁 Lead repassado pela roleta\n\n{{motivo}}\nAgora com: {{corretor}}\n' +
  'Lead: {{nome}}\nTelefone: {{telefone}}\n\nPrazo de aceite: {{prazo}} min.';
import type { User } from '@/types/users';

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-orange-100 text-orange-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  passed:   'bg-blue-100 text-blue-700',
  expired:  'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending:  'Aguardando',
  accepted: 'Aceito',
  passed:   'Passado',
  expired:  'Expirado',
  // A gestão atribuiu o lead na mão antes do prazo — o sorteio parou aí.
  cancelled: 'Cancelado',
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

// Ocultar lead do Diagnóstico é preferência de quem olha, não estado do lead:
// mora no navegador de propósito.
const HIDDEN_KEY = 'roleta:diagnostico:ocultos';

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
    // Em qual número este corretor atende. Vazio = a instância de entrada.
    inbox_id: m?.inbox_id ?? '',
  };
}

interface InstanceRow extends Omit<RoletaInstance, 'id'> {
  localId: string;
}

function mkInstance(i?: Partial<RoletaInstance>): InstanceRow {
  return {
    localId: Math.random().toString(36).slice(2),
    inbox_id: i?.inbox_id ?? '',
    label: i?.label ?? '',
    weight: i?.weight ?? 10,
    is_active: i?.is_active ?? true,
    position: i?.position ?? 0,
    // Número novo nasce SEM a marcação: quem já atende os leads que escrevem
    // direto naquele número não pode ser trocado por um efeito colateral de
    // adicionar uma linha. O backend recusa a segunda marcação de qualquer jeito.
    answers_direct_inbound: i?.answers_direct_inbound ?? false,
    shared_with: i?.shared_with ?? [],
  };
}

export default function RoletaConfigPage() {
  const [configs, setConfigs]         = useState<RoletaConfig[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<RoletaConfig | null>(null);
  const [tab, setTab]                 = useState<'configs' | 'assignments' | 'diagnostico'>('configs');

  // Painel "Por que este lead não entrou na roleta?". Existe porque cada portão
  // do caminho formulário → roleta falhava calado num log do servidor: o gestor
  // via o aviso cair no grupo e o card sem responsável, sem nenhuma pista.
  const [diagnostics, setDiagnostics]   = useState<RoletaDiagnostic[]>([]);
  const [loadingDiag, setLoadingDiag]   = useState(false);
  const [onlyFailures, setOnlyFailures] = useState(true);
  const [repairBusy, setRepairBusy]     = useState(false);
  const [repairPreview, setRepairPreview] = useState<RepairOwnersResult | null>(null);
  const [acessoBusy, setAcessoBusy]       = useState(false);
  const [acessoPreview, setAcessoPreview] = useState<RepairInboxAccessResult | null>(null);

  // Leads que o gestor já resolveu e não quer mais ver na lista. Fica no
  // navegador: é preferência de quem está olhando, não estado do lead — esconder
  // pra todo mundo apagaria a trilha que este painel existe para preservar.
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  // Quando ligado, os ocultos voltam a aparecer (com botão de restaurar) — é o
  // "ver" do par ocultar/ver. Não desfaz nada sozinho.
  const [showHidden, setShowHidden] = useState(false);

  const hide = useCallback((id: string) => {
    setHiddenIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* cota cheia: só não persiste */ }
      return next;
    });
  }, []);

  const unhide = useCallback((id: string) => {
    setHiddenIds(prev => {
      const next = prev.filter(x => x !== id);
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* idem */ }
      return next;
    });
  }, []);

  // Limpar a lista de uma vez, em vez de clicar card a card. Some só o que está
  // CARREGADO agora: o que chegar depois é registro novo e aparece normalmente.
  const hideAll = useCallback((ids: string[]) => {
    setHiddenIds(prev => {
      const next = Array.from(new Set([...prev, ...ids]));
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* idem */ }
      return next;
    });
    setShowHidden(false);
  }, []);

  const unhideAll = useCallback(() => {
    setHiddenIds([]);
    try { localStorage.removeItem(HIDDEN_KEY); } catch { /* idem */ }
    setShowHidden(false);
  }, []);

  const loadDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    try {
      setDiagnostics(await roletaConfigService.getDiagnostics({ onlyFailures }));
    } catch {
      toast.error('Erro ao carregar o diagnóstico');
    } finally {
      setLoadingDiag(false);
    }
  }, [onlyFailures]);

  useEffect(() => { if (tab === 'diagnostico') loadDiagnostics(); }, [tab, loadDiagnostics]);

  // Primeiro em pré-visualização; só aplica depois que o gestor confirma —
  // mesmo padrão do backfill/cleanup da tela de Formulários Lead Ads.
  const runRepair = async (dryRun: boolean) => {
    setRepairBusy(true);
    try {
      const r = await roletaConfigService.repairOwners(dryRun);
      setRepairPreview(r);
      if (!dryRun) {
        toast.success(`${r.corrigidos} lead(s) com responsável restaurado`);
        loadDiagnostics();
      }
    } catch {
      toast.error('Erro ao corrigir os leads sem responsável');
    } finally {
      setRepairBusy(false);
    }
  };

  // Acesso à instância, nas duas pontas: liberar quem precisa e RETIRAR o vínculo
  // automático de quem não tem mais lead naquele número. Mesmo padrão de
  // pré-visualização do reparo acima — a lista é conferida antes de aplicar,
  // porque tirar acesso de alguém é o tipo de coisa que ninguém quer descobrir
  // depois.
  const runAcesso = async (dryRun: boolean) => {
    setAcessoBusy(true);
    try {
      const r = await roletaConfigService.repairInboxAccess(dryRun);
      setAcessoPreview(r);
      if (!dryRun) {
        toast.success(`${r.liberados} corretor(es) liberado(s), ${r.total_revogar} vínculo(s) removido(s)`);
      }
    } catch {
      toast.error('Erro ao ajustar o acesso às instâncias');
    } finally {
      setAcessoBusy(false);
    }
  };
  const [assignments, setAssignments] = useState<BrokerAssignment[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);

  // Fila ao vivo. O prazo corre em minutos, então recarregar de minuto em minuto
  // é o suficiente pro cronômetro não mentir.
  const [queue, setQueue]             = useState<RoletaQueue | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // form state
  const [nome, setNome]                     = useState('');
  const [inboxId, setInboxId]               = useState('');
  const [isActive, setIsActive]             = useState(true);
  const [mode, setMode]                     = useState<DistributionMode>('rodizio');
  const [timeoutMin, setTimeoutMin]         = useState(30);
  const [gestorNum, setGestorNum]           = useState('');
  const [gestorGroupJid, setGestorGroupJid] = useState('');
  const [notifInboxId, setNotifInboxId]     = useState('');
  // Horário de funcionamento. Desligado (o default e o estado de TODA roleta
  // existente) = 24h, e o campo nem é enviado no payload.
  const [horarioOn, setHorarioOn]           = useState(false);
  const [janelas, setJanelas]               = useState<RoletaHoursWindow[]>([DEFAULT_WINDOW]);
  const [plantaoInboxId, setPlantaoInboxId] = useState('');
  const [autoNaAbertura, setAutoNaAbertura] = useState(false);
  const [members, setMembers]               = useState<MemberRow[]>([]);
  // Só corretor com acesso à instância pode receber lead da roleta — a lista de
  // escolha vem dos membros do inbox, não de todos os usuários do CRM. Sortear
  // quem não tem acesso deixa o lead num limbo: o card aparece no funil dele,
  // mas a conversa é invisível na caixa. O backend agora recusa; a tela deixa de
  // oferecer.
  // Chaveado por inbox: com um número por corretor, "quem tem acesso" é uma
  // pergunta POR INSTÂNCIA. Uma lista só responderia pela instância de entrada e
  // ofereceria, no número do João, gente que só foi liberada no da Maria.
  const [membersByInbox, setMembersByInbox]     = useState<Record<string, User[]>>({});
  const [loadingMembers, setLoadingMembers]     = useState(false);
  // Os números desta roleta. Sempre pelo menos um — a instância de entrada.
  const [instances, setInstances]               = useState<InstanceRow[]>([]);
  // A flag do cliente (nasce desligada). Sem ela a tela é exatamente a de antes.
  // A flag do cliente vem das features do tenant — a MESMA fonte que o resto do
  // app usa. Antes ela só chegava pelo payload da config, e `openCreate` a
  // zerava: criar uma roleta nova nunca mostrava o bloco de números, só editar
  // uma existente mostrava.
  const multiFeature = useFeature('roleta_multi_instancia');
  // O payload continua valendo como reforço: é a verdade do backend, e cobre o
  // super-admin no domínio raiz, onde não há slug de tenant para resolver.
  const [multiFromConfig, setMultiFromConfig]   = useState(false);
  const multiEnabled = multiFeature || multiFromConfig;
  const [groups, setGroups]                 = useState<WaGroup[]>([]);
  const [loadingGroups, setLoadingGroups]   = useState(false);
  const [crmName, setCrmName]               = useState('');
  // Avisos editáveis (templates). Vazio = usa o texto padrão.
  const [msgCorretor, setMsgCorretor]       = useState('');
  const [msgGestor, setMsgGestor]           = useState('');
  const [msgGrupo, setMsgGrupo]             = useState('');
  // Aviso de repasse: campo próprio porque nenhum texto serve para lead novo e
  // para repasse ao mesmo tempo.
  const [msgRepasse, setMsgRepasse]         = useState('');
  // Liga/desliga de cada aviso. Deixar o texto em branco NÃO desliga nada (vazio
  // = usa o padrão) — quem não quer enviar um dos avisos precisa destas chaves.
  const [msgCorretorOn, setMsgCorretorOn]   = useState(true);
  const [msgGestorOn, setMsgGestorOn]       = useState(true);
  const [msgGrupoOn, setMsgGrupoOn]         = useState(true);
  const [msgRepasseOn, setMsgRepasseOn]     = useState(true);
  const corretorRef = useRef<HTMLTextAreaElement>(null);
  const gestorRef   = useRef<HTMLTextAreaElement>(null);
  const grupoRef    = useRef<HTMLTextAreaElement>(null);
  const repasseRef  = useRef<HTMLTextAreaElement>(null);
  const [activeMsg, setActiveMsg]           = useState<MsgTarget>('corretor');
  // Qual aviso está sendo testado agora (envio de teste com dados fictícios).
  const [testingMsg, setTestingMsg]         = useState<MsgTarget | null>(null);
  // Fontes: formulários do FB roteados pra esta roleta.
  const [metaForms, setMetaForms]           = useState<MetaForm[]>([]);
  const [formConfigs, setFormConfigs]       = useState<LeadAdsFormConfig[]>([]);
  const [loadingForms, setLoadingForms]     = useState(false);
  const [formsError, setFormsError]         = useState<string | null>(null);
  const [inboxes, setInboxes]               = useState<Inbox[]>([]);
  // POR QUE A ROLETA NÃO SALVOU — a lista fica na tela até o gestor resolver.
  //
  // Antes toda recusa virava um toast que sumia em segundos, e a do servidor nem
  // isso: o `catch` lia a mensagem do axios ("Request failed with status code
  // 422") em vez do motivo que o backend mandava junto. Criar roleta podia
  // falhar duas vezes seguidas sem que a tela dissesse uma palavra sobre o quê.
  const [saveErrors, setSaveErrors]         = useState<string[]>([]);

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

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      setQueue(await roletaConfigService.getQueue());
    } catch {
      // Bloco secundário do Diagnóstico: se o cargo não alcança, some em silêncio
      // em vez de jogar um erro na cara de quem veio ver a trilha dos leads.
      setQueue(null);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  // Carrega a equipe de CADA instância da roleta, em paralelo. Uma instância que
  // falhar vira lista vazia — que a tela já sabe explicar ("ninguém tem acesso")
  // — em vez de derrubar o carregamento das outras.
  const loadInboxMembers = useCallback(async (ids: string[]) => {
    const alvos = Array.from(new Set(ids.filter(Boolean)));
    if (alvos.length === 0) { setMembersByInbox({}); return; }
    setLoadingMembers(true);
    try {
      const pares = await Promise.all(alvos.map(async id => {
        try {
          const list = await inboxMembersService.get(id);
          return [id, (list ?? []) as unknown as User[]] as const;
        } catch {
          return [id, [] as User[]] as const;
        }
      }));
      setMembersByInbox(Object.fromEntries(pares));
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => { loadConfigs(); loadUsers(); loadInboxes(); loadAccount(); }, [loadConfigs, loadUsers, loadInboxes, loadAccount]);
  // Depende dos ids concatenados, não do array: `instances` é recriado a cada
  // tecla digitada num rótulo, e depender dele relançaria as requisições sem
  // que nenhuma instância tivesse mudado.
  const instanceInboxIds = useMemo(
    () => Array.from(new Set([inboxId, ...instances.map(i => i.inbox_id)].filter(Boolean))),
    [inboxId, instances],
  );
  const instanceInboxKey = instanceInboxIds.join(',');
  useEffect(() => {
    loadInboxMembers(instanceInboxKey ? instanceInboxKey.split(',') : []);
  }, [instanceInboxKey, loadInboxMembers]);
  // Ao CRIAR, a lista de números nasce vazia: o gestor ainda não escolheu nada.
  // Assim que ele escolhe o número de entrada, ele vira a primeira linha — é o
  // que o backend faz de qualquer jeito (`after_create` cria a instância
  // primária), e ver a linha ali é o que deixa claro onde clicar para somar o
  // segundo número.
  //
  // Só semeia quando a lista está VAZIA: mexer depois disso apagaria o que o
  // gestor já configurou a cada tecla no formulário.
  //
  // Com o bloco visível a lista NUNCA pode ficar vazia: o seletor separado de
  // instância some, então sem nenhuma linha o gestor não teria onde escolher o
  // número de entrada.
  useEffect(() => {
    if (!modalOpen || instances.length > 0) return;
    if (multiEnabled) {
      setInstances([mkInstance({ inbox_id: inboxId, weight: 10, position: 0 })]);
      return;
    }
    if (!inboxId) return;
    setInstances([mkInstance({ inbox_id: inboxId, weight: 10, position: 0 })]);
  }, [modalOpen, inboxId, instances.length, multiEnabled]);

  // Com o bloco de números visível, o seletor separado de instância some — então
  // a ENTRADA passa a ser a primeira linha do bloco, e é dela que sai o
  // `inbox_id` da roleta (a chave que o `for_inbox` procura primeiro).
  //
  // Só ao CRIAR: numa roleta que já existe, trocar o inbox mudaria a chave, e o
  // seletor da primeira linha fica travado justamente por isso.
  useEffect(() => {
    if (!modalOpen || editing || !multiEnabled) return;
    const entrada = instances[0]?.inbox_id;
    if (entrada && entrada !== inboxId) setInboxId(entrada);
  }, [modalOpen, editing, multiEnabled, instances, inboxId]);

  useEffect(() => { if (tab === 'assignments') loadAssignments(); }, [tab, loadAssignments]);

  // Quem está concorrendo no sorteio agora — abre junto com o Diagnóstico, que é
  // onde o gestor confere se a roleta está com as pessoas certas.
  useEffect(() => {
    // Sem checar cargo no cliente: quem manda é a resposta da API. O `can()` lê um
    // catálogo de permissões cacheado por 30 min no navegador, então uma chave
    // recém-criada volta como "não tem" e a tela nem chegava a pedir os dados —
    // era isso que sumia o bloco para quem tinha acesso de verdade.
    if (tab === 'diagnostico') loadQueue();
  }, [tab, loadQueue]);

  function openCreate() {
    setEditing(null);
    setNome('');
    setInboxId('');
    setIsActive(true);
    setMode('rodizio');
    setTimeoutMin(30);
    setGestorNum('');
    setGestorGroupJid('');
    setNotifInboxId('');
    // setMsgRepasse junto: sem ele o texto de repasse da roleta que acabou de ser
    // editada vazava para a "Nova distribuição".
    setMsgCorretor(''); setMsgGestor(''); setMsgGrupo(''); setMsgRepasse('');
    setMsgCorretorOn(true); setMsgGestorOn(true); setMsgGrupoOn(true); setMsgRepasseOn(true);
    // Roleta nova nasce 24h — o campo nem vai no payload.
    setHorarioOn(false); setJanelas([DEFAULT_WINDOW]); setPlantaoInboxId(''); setAutoNaAbertura(false);
    setMembers([mkLocal()]);
    setInstances([]);
    setMultiFromConfig(false);
    setGroups([]);
    setSaveErrors([]);
    setModalOpen(true);
  }

  function openEdit(c: RoletaConfig) {
    setEditing(c);
    // `name` e não `display_name`: o campo tem que abrir VAZIO quando ninguém
    // batizou, senão o gestor salva sem querer o nome da instância como apelido
    // e a roleta para de acompanhar a instância se ela for renomeada.
    setNome(c.name ?? '');
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
    setMsgRepasse(c.msg_grupo_repasse_template ?? '');
    // `!== false` e não `?? true`: config salva antes das chaves existirem volta
    // sem o campo, e o estado real dela é LIGADO.
    setMsgCorretorOn(c.msg_corretor_enabled !== false);
    setMsgGestorOn(c.msg_gestor_enabled !== false);
    setMsgGrupoOn(c.msg_grupo_enabled !== false);
    setMsgRepasseOn(c.msg_grupo_repasse_enabled !== false);
    // Horário. `mode === 'custom'` e não "tem janela": o modo é quem manda, e é
    // o que o backend lê. Roleta sem horário (todas as de hoje) abre desligada,
    // com a janela padrão já preenchida caso o gestor ligue.
    const bh: RoletaBusinessHours = c.business_hours_config ?? {};
    setHorarioOn(bh.mode === 'custom');
    setJanelas(bh.windows?.length ? bh.windows : [DEFAULT_WINDOW]);
    setPlantaoInboxId(bh.after_hours_inbox_id ?? '');
    setAutoNaAbertura(!!bh.auto_distribute_on_open);
    setMembers(c.members.length ? c.members.map(m => mkLocal(m)) : [mkLocal()]);
    // Roleta antiga (antes das instâncias) chega sem `instances`: monta a de
    // entrada a partir do próprio inbox dela, que é o que o backfill fez no banco.
    setInstances(
      c.instances?.length
        ? c.instances.map(i => mkInstance(i))
        : [mkInstance({ inbox_id: c.inbox_id, weight: 10, position: 0 })],
    );
    setMultiFromConfig(!!c.multi_instance_enabled);
    setSaveErrors([]);
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
    const problemas = problemasDoFormulario();
    if (problemas.length > 0) {
      setSaveErrors(problemas);
      toast.error(problemas.length === 1 ? problemas[0] : `${problemas.length} coisas impedem o salvamento — veja no fim do formulário`);
      return;
    }
    setSaveErrors([]);
    const membersValid = members.filter(m => m.user_id && m.personal_whatsapp_number);

    setSaving(true);
    try {
      const payload = {
        // `|| null` e não a string vazia: apagar o campo tem que voltar a roleta
        // para o nome da instância, e '' gravado como apelido faria a listagem
        // cair no fallback errado ("Roleta").
        name:                   nome.trim() || null,
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
        msg_grupo_repasse_template: msgRepasse.trim() || null,
        msg_corretor_enabled:   msgCorretorOn,
        msg_gestor_enabled:     msgGestorOn,
        msg_grupo_enabled:      msgGrupoOn,
        msg_grupo_repasse_enabled: msgRepasseOn,
        notification_inbox_id:  notifInboxId || null,
        // Horário de funcionamento. Desligado manda `{ mode: 'always' }` em vez
        // de omitir: omitir num PATCH deixaria o horário antigo gravado, e
        // desligar a chave na tela não desligaria nada — a falha muda de novo.
        business_hours_config:  horarioOn
          ? {
              mode: 'custom' as const,
              tz: 'America/Sao_Paulo',
              windows: janelas,
              after_hours_inbox_id: plantaoInboxId || null,
              auto_distribute_on_open: autoNaAbertura,
            }
          : { mode: 'always' as const },
        // Só as que têm inbox escolhido. Lista vazia = "não mexe nas
        // instâncias", e o backend nunca deixa a roleta sem nenhuma.
        instances:              instances.filter(i => i.inbox_id).map((i, idx) => ({
          inbox_id:  i.inbox_id,
          label:     (i.label ?? '').trim() || null,
          weight:    i.weight,
          is_active: i.is_active,
          position:  idx,
          // Quem atende quem escreve DIRETO neste número. Só faz diferença
          // quando o número está em mais de uma roleta.
          answers_direct_inbound: i.answers_direct_inbound ?? false,
        })),
        members:                membersValid.map((m, i) => ({
          user_id:                  m.user_id,
          weight:                   m.weight,
          is_active:                m.is_active,
          position:                 i,
          personal_whatsapp_number: m.personal_whatsapp_number,
          // Em qual número ele atende. É por aqui que o backend amarra o membro
          // à instância — sem isso ele cairia na de entrada, ou seja, no número
          // de outra pessoa.
          inbox_id:                 memberInbox(m) || null,
        })),
      };
      if (editing) {
        await roletaConfigService.update(editing.id, payload);
        toast.success('Roleta atualizada');
      } else {
        await roletaConfigService.create(payload);
        toast.success('Roleta criada');
      }
      setSaveErrors([]);
      setModalOpen(false);
      loadConfigs();
    } catch (e: unknown) {
      // ⚠️ NÃO usar `e.message`: um erro do axios É um Error, e a mensagem dele
      // é sempre "Request failed with status code 422" — o motivo real, que o
      // backend manda no corpo da resposta, ia para o lixo. Era por isso que
      // criar roleta falhava sem dizer nada: o servidor explicava, a tela
      // trocava a explicação por um código HTTP.
      const msg = apiErrorMessage(e, 'Não foi possível salvar a roleta. Tente de novo.');
      // `details` junto: quando o estouro sobe pelo tratador global do backend a
      // mensagem é a string fixa "Validation failed", e o motivo real só existe ali.
      const details = (e as { response?: { data?: { error?: { details?: [] } } } })
        ?.response?.data?.error?.details;
      const linhas = backendProblems(msg, details);
      setSaveErrors(linhas);
      toast.error(linhas[0]);
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
  // Opções do seletor de corretor: os membros da instância escolhida. Quem já
  // está salvo mas perdeu o acesso continua aparecendo, marcado — some-lo faria
  // a linha ficar em branco sem explicar por quê, e é justamente o caso que
  // precisa ser visto e corrigido.
  // Em qual número este corretor atende. Vazio cai na instância de entrada —
  // que é o que toda roleta de um número só tem.
  const memberInbox = useCallback((m: MemberRow) => m.inbox_id || inboxId, [inboxId]);

  // As opções mudam POR INSTÂNCIA: no número do João só aparece quem foi
  // liberado no número do João. Quem já está salvo mas perdeu o acesso continua
  // aparecendo, marcado — sumir com ele deixaria a linha em branco sem explicar
  // por quê, e é justamente o caso que precisa ser visto e corrigido.
  const corretorOptionsFor = useCallback((targetInbox: string) => {
    const opts = (membersByInbox[targetInbox] ?? []).map(u => ({ id: u.id, name: u.name, hasAccess: true }));
    const seen = new Set(opts.map(o => o.id));
    members.forEach(m => {
      if (!m.user_id || seen.has(m.user_id)) return;
      if ((m.inbox_id || inboxId) !== targetInbox) return;
      seen.add(m.user_id);
      const known = users.find(u => u.id === m.user_id);
      opts.push({ id: m.user_id, name: known?.name ?? m.user_id, hasAccess: false });
    });
    return opts;
  }, [membersByInbox, members, users, inboxId]);

  function selectCorretor(localId: string, userId: string) {
    const pool = Object.values(membersByInbox).flat();
    const u = (pool.find(x => x.id === userId) ?? users.find(x => x.id === userId)) as
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

  function addInstance() {
    setInstances(prev => [...prev, mkInstance({ position: prev.length })]);
  }

  function updateInstance(localId: string, key: keyof InstanceRow, value: string | number | boolean) {
    setInstances(prev => prev.map(i => i.localId === localId ? { ...i, [key]: value } : i));
  }

  // Ao remover uma instância, os corretores dela voltam para a de entrada em vez
  // de ficarem apontando para um número que não existe mais — que é o caso em
  // que o membro sai do sorteio CALADO, sem erro e sem lead.
  function removeInstance(localId: string) {
    const alvo = instances.find(i => i.localId === localId);
    setInstances(prev => prev.filter(i => i.localId !== localId));
    if (!alvo?.inbox_id) return;
    setMembers(prev => prev.map(m => (m.inbox_id === alvo.inbox_id ? { ...m, inbox_id: '' } : m)));
  }

  const instanceName = useCallback((id: string) => {
    const inst = instances.find(i => i.inbox_id === id);
    return inst?.label?.trim() || inboxes.find(x => x.id === id)?.name || id;
  }, [instances, inboxes]);

  // TUDO que impede o salvamento, de uma vez só — a lista inteira vai para o
  // painel vermelho no fim do formulário, e fica lá até o gestor resolver.
  // As conferências em si moram fora do componente (roletaFormChecks), porque
  // são o miolo da resposta "o que falta preencher?" e precisam ser testáveis
  // sem montar o formulário inteiro.
  const problemasDoFormulario = useCallback((): string[] => roletaFormProblems({
    inboxId, multiEnabled, configs, editingId: editing?.id ?? null,
    instances, members, mode, gestorNum, horarioOn, janelas,
    instanceLabel: instanceName,
    userName: id => users.find(u => u.id === id)?.name ?? 'o corretor escolhido',
  }), [inboxId, multiEnabled, configs, editing, instances, members, mode,
       gestorNum, horarioOn, janelas, instanceName, users]);

  // 1 clique joga a variável no texto do aviso focado (na posição do cursor).
  function insertVar(v: string) {
    const token = `{{${v}}}`;
    const map = {
      corretor: { ref: corretorRef, val: msgCorretor, set: setMsgCorretor },
      gestor:   { ref: gestorRef,   val: msgGestor,   set: setMsgGestor },
      grupo:    { ref: grupoRef,    val: msgGrupo,    set: setMsgGrupo },
      repasse:  { ref: repasseRef,  val: msgRepasse,  set: setMsgRepasse },
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

  // Envia um aviso de TESTE com dados fictícios, usando o que está no formulário
  // (não precisa salvar antes). Corretor/gestor vão pro número do gestor (quem
  // configura vê no próprio zap); grupo vai pro grupo de avisos escolhido.
  async function sendTest(target: MsgTarget) {
    // O repasse vai pro mesmo destino do aviso de grupo — só o texto é outro.
    const destino = target === 'repasse' ? 'grupo' : target;

    if (!inboxId.trim()) { toast.error('Selecione a instância da roleta antes de testar'); return; }
    if (destino !== 'grupo' && !gestorNum.trim()) { toast.error('Preencha o número do gestor antes de testar'); return; }
    if (destino === 'grupo' && !gestorGroupJid) { toast.error('Selecione o grupo de avisos antes de testar'); return; }

    setTestingMsg(target);
    try {
      const template = {
        corretor: msgCorretor,
        gestor:   msgGestor,
        grupo:    msgGrupo,
        // Vazio cai no padrão do backend, que é o texto de repasse embutido.
        repasse:  msgRepasse || DEFAULT_REPASSE_PREVIEW,
      }[target];
      await roletaConfigService.testNotification({
        target: destino,
        inbox_id:               inboxId,
        notification_inbox_id:  notifInboxId || null,
        gestor_whatsapp_number: gestorNum,
        gestor_group_jid:       gestorGroupJid || null,
        gestor_group_instance:  gestorGroupJid ? CENTRAL_GROUP_INSTANCE : null,
        timeout_minutes:        timeoutMin,
        template:               template.trim() || null,
      });
      toast.success(destino === 'grupo'
        ? 'Teste enviado pro grupo de avisos'
        : 'Teste enviado pro número do gestor');
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message ?? 'Falha ao enviar o teste');
    } finally {
      setTestingMsg(null);
    }
  }

  const totalWeight = members.reduce((s, m) => s + (m.is_active ? m.weight : 0), 0);

  // A roleta REALMENTE sorteia entre números? Derivado do dado, não de uma
  // chave guardada: duas instâncias ativas == multinúmero, e é impossível
  // divergir do que o backend vê.
  const activeInstances = useMemo(() => instances.filter(i => i.is_active && i.inbox_id), [instances]);
  const isMulti = activeInstances.length > 1;
  // O sorteio de instância só existe no rodízio. Em leilão e disponibilidade o
  // critério já É o corretor (quem responde primeiro / quem está online), então
  // o número é derivado do escolhido — mostrar peso de instância ali seria
  // prometer um controle que o motor não tem.
  const showInstanceWeights = isMulti && mode === 'rodizio';

  // Percentual EFETIVO: (peso da instância / Σ) × (peso do corretor / Σ da
  // instância dele). Sem isso o gestor configura pesos e lê números que não
  // batem — com dois números, um corretor sozinho no seu número recebe metade
  // dos leads mesmo com peso 10 contra 90.
  const totalInstanceWeight = activeInstances.reduce((s, i) => s + (i.weight || 0), 0);
  const effectivePct = useCallback((m: MemberRow): number | null => {
    if (!m.is_active || !m.user_id) return null;
    const alvo = memberInbox(m);
    const doMesmoNumero = members.filter(x => x.is_active && x.user_id && memberInbox(x) === alvo);
    const somaNumero = doMesmoNumero.reduce((s, x) => s + (x.weight || 0), 0);
    // Peso zero em todo mundo é configuração válida ("desligamos os pesos"): o
    // motor cai no primeiro, então dividir igualmente é a leitura honesta.
    const fatiaCorretor = somaNumero > 0 ? (m.weight || 0) / somaNumero : 1 / (doMesmoNumero.length || 1);
    if (!isMulti) return fatiaCorretor * 100;

    const inst = activeInstances.find(i => i.inbox_id === alvo);
    if (!inst) return null;
    const fatiaInstancia = totalInstanceWeight > 0
      ? (inst.weight || 0) / totalInstanceWeight
      : 1 / activeInstances.length;
    return fatiaInstancia * fatiaCorretor * 100;
  }, [members, memberInbox, isMulti, activeInstances, totalInstanceWeight]);

  // Quantos dos registros CARREGADOS estão ocultos — não o tamanho do localStorage,
  // que acumula ids de leads que já saíram da janela do diagnóstico e faria o botão
  // "Ver N oculto(s)" prometer linhas que não existem mais.
  const ocultosNaLista = diagnostics.filter(d => hiddenIds.includes(d.id)).length;
  const diagnosticosVisiveis = showHidden ? diagnostics : diagnostics.filter(d => !hiddenIds.includes(d.id));

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
        {(['configs', 'assignments', 'diagnostico'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-[#7c3aed] text-[#7c3aed]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'configs' ? 'Configuracoes' : t === 'assignments' ? 'Atribuicoes Recentes' : 'Diagnóstico'}
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
                      <p className="font-medium text-sm">{c.display_name || c.inbox_name || `Inbox: ${c.inbox_id}`}</p>
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

      {tab === 'diagnostico' && (
        <div className="space-y-3">
          {/* Quem está de fato concorrendo. Vem do backend, não do formulário: a
              tela de configuração mostra quem foi ESCOLHIDO, e aqui aparece quem
              o sorteio realmente alcança — a diferença entre os dois é a causa
              silenciosa de "por que fulano nunca recebe lead?". */}
          {queue && queue.roletas.length > 0 && (
            <div className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Quem está recebendo lead hoje</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confira se são as pessoas certas. Quem aparece riscado está na lista mas
                    <strong> não entra no sorteio</strong>.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadQueue} disabled={loadingQueue} className="shrink-0">
                  {loadingQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
                </Button>
              </div>

              <div className="mt-3 space-y-3">
                {queue.roletas.map(r => {
                  const dentro = r.membros.filter(m => m.ativo && !m.sem_acesso_a_instancia);
                  const fora   = r.membros.filter(m => !m.ativo || m.sem_acesso_a_instancia);
                  return (
                    <div key={r.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${r.ativa ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <span className="text-sm font-medium">{r.instancia ?? r.id}</span>
                        <Badge variant="outline" className="text-[10px]">{MODE_LABEL[r.modo] ?? r.modo}</Badge>
                        {!r.ativa && <span className="text-xs text-red-600">desativada — não distribui nada</span>}
                      </div>

                      {dentro.length === 0 ? (
                        <p className="text-xs text-red-600 mt-1.5 ml-4">
                          Nenhum corretor no sorteio — todo lead desta instância cai sem dono.
                        </p>
                      ) : (
                        <div className="mt-1.5 ml-4 flex flex-wrap gap-1.5">
                          {dentro.map(m => (
                            <span
                              key={m.user_id}
                              className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded px-2 py-1"
                            >
                              {m.nome ?? m.user_id}
                              {m.chance_pct != null && (
                                <span className="opacity-70">{m.chance_pct}%</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {fora.length > 0 && (
                        <div className="mt-1.5 ml-4 flex flex-wrap gap-1.5">
                          {fora.map(m => (
                            <span
                              key={m.user_id}
                              className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground rounded px-2 py-1"
                            >
                              <span className="line-through">{m.nome ?? m.user_id}</span>
                              <span className="text-red-600">
                                {m.sem_acesso_a_instancia ? 'sem acesso à instância' : 'desligado da roleta'}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4 bg-muted/40">
            <p className="text-sm font-medium">Por que este lead não entrou na roleta?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cada lead que passou pela distribuição, com o que aconteceu em cada etapa:
              o formulário casou → achou a roleta → sorteou o corretor → gravou o responsável no card.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => setOnlyFailures(v => !v)}>
                {onlyFailures ? 'Só os que falharam' : 'Todos os leads'}
              </Button>
              <Button variant="outline" size="sm" onClick={loadDiagnostics} disabled={loadingDiag}>
                {loadingDiag ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => runRepair(true)} disabled={repairBusy}>
                {repairBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ver leads sem responsável'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => runAcesso(true)} disabled={acessoBusy}>
                {acessoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conferir acesso às instâncias'}
              </Button>
              {/* Ocultar em massa: limpa a lista inteira de uma vez. Some só o que
                  está carregado — registro novo continua aparecendo. */}
              {diagnosticosVisiveis.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => hideAll(diagnosticosVisiveis.map(d => d.id))}
                  className="gap-1.5"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Ocultar todos ({diagnosticosVisiveis.length})
                </Button>
              )}
              {ocultosNaLista > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowHidden(v => !v)} className="gap-1.5">
                  {showHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showHidden ? 'Esconder de novo' : `Ver ${ocultosNaLista} oculto(s)`}
                </Button>
              )}
              {hiddenIds.length > 0 && (
                <Button variant="outline" size="sm" onClick={unhideAll} className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Mostrar todos de novo
                </Button>
              )}
            </div>
          </div>

          {repairPreview && (
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium">
                {repairPreview.dry_run
                  ? `${repairPreview.total} lead(s) foram sorteados mas estão sem responsável no card`
                  : `${repairPreview.corrigidos} corrigido(s), ${repairPreview.falharam} falharam`}
              </p>
              <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                {repairPreview.leads.map(l => (
                  <div key={l.contact_id} className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                    <span className="font-medium text-foreground">{l.lead ?? l.contact_id}</span>
                    <span>→ {l.corretor ?? 'sem corretor'}</span>
                    <span>({l.acao})</span>
                    {l.motivo && <span className="text-red-600">{l.motivo}</span>}
                  </div>
                ))}
              </div>
              {repairPreview.dry_run && repairPreview.total > 0 && (
                <Button
                  size="sm"
                  className="mt-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
                  disabled={repairBusy}
                  onClick={() => runRepair(false)}
                >
                  Corrigir os {repairPreview.total} lead(s)
                </Button>
              )}
            </div>
          )}

          {acessoPreview && (
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium">
                {acessoPreview.dry_run
                  ? `${acessoPreview.total} corretor(es) a liberar e ${acessoPreview.total_revogar} vínculo(s) automático(s) a remover`
                  : `${acessoPreview.liberados} liberado(s), ${acessoPreview.total_revogar} removido(s), ${acessoPreview.falharam} falharam`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                O vínculo automático dá ao corretor acesso ao número do lead dele — nunca o coloca
                na fila de distribuição. Quem você adicionou na mão como atendente da instância não
                é tocado.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium">Vão ganhar acesso</p>
                  <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {acessoPreview.corretores.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ninguém — está tudo liberado.</p>
                    ) : acessoPreview.corretores.map(c => (
                      <div key={`grant-${c.user_id}`} className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        <span className="font-medium text-foreground">{c.corretor ?? c.user_id}</span>
                        <span>→ {c.instancias.join(', ') || `${c.total_instancias} instância(s)`}</span>
                        {c.motivo && <span className="text-red-600">{c.motivo}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium">Vão perder o acesso automático</p>
                  <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {acessoPreview.revogacoes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ninguém — não há vínculo sobrando.</p>
                    ) : acessoPreview.revogacoes.map(c => (
                      <div key={`revoke-${c.user_id}`} className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        <span className="font-medium text-foreground">{c.corretor ?? c.user_id}</span>
                        <span>→ {c.instancias.join(', ') || `${c.total_instancias} instância(s)`}</span>
                        {c.motivo && <span className="text-red-600">{c.motivo}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {acessoPreview.dry_run && (acessoPreview.total > 0 || acessoPreview.total_revogar > 0) && (
                <Button
                  size="sm"
                  className="mt-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
                  disabled={acessoBusy}
                  onClick={() => runAcesso(false)}
                >
                  Aplicar os ajustes
                </Button>
              )}
            </div>
          )}

          {loadingDiag && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loadingDiag && diagnosticosVisiveis.length === 0 && (
            <div className="border rounded-lg p-12 text-center text-muted-foreground">
              <Shuffle className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>
                {diagnostics.length > 0
                  ? 'Todos os registros estão ocultos'
                  : onlyFailures ? 'Nenhum problema registrado' : 'Nenhuma distribuição registrada ainda'}
              </p>
            </div>
          )}
          {diagnosticosVisiveis.map(d => {
            const oculto = hiddenIds.includes(d.id);
            return (
              <div key={d.id} className={`border rounded-lg p-3 ${oculto ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{d.lead ?? d.contact_id ?? 'Lead'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.explicacao}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      {d.formulario && <span>Formulário: {d.formulario}</span>}
                      {d.corretor && <span>Sorteado: {d.corretor}</span>}
                      <span>Responsável no card: {d.dono_atual ?? 'nenhum'}</span>
                    </div>
                    {d.erro_tecnico && (
                      <p className="text-[11px] text-red-600 mt-1 break-all">{d.erro_tecnico}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {d.ok ? 'OK' : 'Falhou'}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTimeBR(d.created_at)}</p>
                    {/* Some da lista sem apagar nada: a trilha continua no servidor,
                        e o botão "Ver ocultos" traz de volta. */}
                    <button
                      type="button"
                      onClick={() => (oculto ? unhide(d.id) : hide(d.id))}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {oculto ? <><Eye className="h-3 w-3" />Restaurar</> : <><EyeOff className="h-3 w-3" />Ocultar</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação/edição.

          Largura: os campos são curtos e os blocos são muitos, então em coluna
          única a tela virava uma tira comprida que só rolava. Em `lg` o corpo
          abre em DUAS colunas — os campos curtos emparelham e os blocos grandes
          (números, modo, mensagens, corretores) ocupam a linha inteira. */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl lg:max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar roleta' : 'Nova roleta'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 lg:grid-cols-2 lg:items-start">
            {/* Nome da roleta.
                Antes a roleta era identificada pelo nome da INSTÂNCIA de entrada
                ("apto-premium-bernardo-numero-principal"). Com um número por
                corretor a mesma roleta abrange vários, e chamar o conjunto pelo
                nome de um deles passou a mentir. Em branco continua caindo no
                nome da instância — nenhuma roleta existente muda de nome. */}
            <div className="lg:col-span-2">
              <UILabel>Nome da roleta</UILabel>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder={instanceName(inboxId) || 'Ex.: Plantão do fim de semana'}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Como ela aparece na lista e no diagnóstico. Em branco, usa o nome do número de entrada.
              </p>
            </div>

            {/* Instância de entrada.
                Escondida quando o bloco de números aparece: ali a PRIMEIRA linha
                já É a entrada, e pedir o mesmo número em dois seletores só faz o
                gestor escolher duas vezes a mesma coisa. O campo continua
                existindo no dado — `roleta_configs.inbox_id` é a chave da roleta
                (o `for_inbox` procura por ele antes das secundárias) — só deixa
                de ser perguntado em separado. */}
            {!multiEnabled && (
            <div className="lg:col-span-2">
              <UILabel>Instância (WhatsApp) *</UILabel>
              <div className="mt-1">
                <NativeSelect
                  value={inboxId}
                  onChange={e => setInboxId(e.target.value)}
                  disabled={!!editing}
                >
                  <option value="">Selecione a instância...</option>
                  {inboxId && !inboxes.some(i => i.id === inboxId) && (
                    <option value={inboxId}>{inboxId}</option>
                  )}
                  {inboxes.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                A caixa de entrada (número de WhatsApp) que essa roleta distribui.
              </p>
            </div>
            )}

            {/* Números da roleta.
                Com a flag desligada isto não aparece e a tela é exatamente a de
                antes — o cliente de número compartilhado não vê nada novo. */}
            {multiEnabled && (
              <div className="border rounded-lg p-3 lg:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <UILabel className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Números que atendem
                  </UILabel>
                  <button
                    type="button"
                    onClick={addInstance}
                    className="text-xs text-[#7c3aed] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Adicionar número
                  </button>
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  Com mais de um número, a roleta sorteia primeiro o número e depois o corretor
                  daquele número — o lead é atendido pelo WhatsApp de quem ganhou.
                </p>

                {/* Uma linha por número. No celular os campos empilham (as 12
                    colunas só entram a partir de `sm`); os rótulos ficam em
                    cima porque, empilhado, não dá pra adivinhar o que é cada
                    caixa pela posição. */}
                <div className="space-y-3 sm:space-y-2">
                  {instances.map((inst, idx) => (
                    <div
                      key={inst.localId}
                      className="grid grid-cols-1 items-start gap-2 rounded-md border border-border p-3 sm:grid-cols-12 sm:border-0 sm:p-0"
                    >
                      <div className="sm:col-span-5">
                        {/* A primeira linha é a instância de ENTRADA — a que vira
                            `roleta_configs.inbox_id`. Marcada porque, ao editar,
                            ela não pode mudar: trocá-la mudaria a chave da roleta. */}
                        <span
                          className={`mb-1 inline-block text-[10px] font-medium uppercase tracking-wide ${
                            idx === 0 ? 'text-[#7c3aed]' : 'text-muted-foreground sm:invisible'
                          }`}
                        >
                          {idx === 0 ? 'Entrada' : 'Número'}
                        </span>
                        <NativeSelect
                          value={inst.inbox_id}
                          onChange={e => updateInstance(inst.localId, 'inbox_id', e.target.value)}
                          disabled={idx === 0 && !!editing}
                        >
                          <option value="">Selecione o número...</option>
                          {inboxes.map(i => (
                            <option
                              key={i.id}
                              value={i.id}
                              /* Um número pertence a uma roleta só — oferecer o
                                 mesmo duas vezes daria erro só no save. */
                              disabled={instances.some(o => o.inbox_id === i.id && o.localId !== inst.localId)}
                            >
                              {i.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="sm:col-span-4 sm:pt-[22px]">
                        <Input
                          value={inst.label ?? ''}
                          onChange={e => updateInstance(inst.localId, 'label', e.target.value)}
                          placeholder="Apelido (ex: WhatsApp do João)"
                        />
                      </div>
                      {showInstanceWeights && (
                        <div className="sm:col-span-2 sm:pt-[22px]">
                          <Input
                            type="number"
                            min={0}
                            value={inst.weight}
                            onChange={e => updateInstance(inst.localId, 'weight', parseInt(e.target.value) || 0)}
                            placeholder="Peso"
                            aria-label="Peso do número"
                          />
                        </div>
                      )}
                      <div
                        className={`flex items-center gap-3 sm:gap-1 sm:pt-[26px] ${
                          showInstanceWeights ? 'sm:col-span-1' : 'sm:col-span-3'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => updateInstance(inst.localId, 'is_active', !inst.is_active)}
                          className={`flex items-center gap-1.5 text-xs ${inst.is_active ? 'text-green-500' : 'text-red-500'}`}
                          title={inst.is_active ? 'Número ativo' : 'Número desativado'}
                        >
                          {inst.is_active
                            ? <ToggleRight className="h-5 w-5" />
                            : <ToggleLeft className="h-5 w-5" />}
                          <span className="sm:hidden">{inst.is_active ? 'Ativo' : 'Desativado'}</span>
                        </button>
                        {instances.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInstance(inst.localId)}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sm:hidden">Remover</span>
                          </button>
                        )}
                      </div>

                      {/* NÚMERO DIVIDIDO COM OUTRA ROLETA.
                          Só aparece quando o número está mesmo em mais de uma
                          roleta — numa roleta só ela responde de qualquer jeito,
                          e a chave seria uma pergunta sem consequência.
                          Lead que chega por formulário ou portal não depende
                          disto: a fonte já diz a qual roleta pertence. */}
                      {inst.inbox_id && (inst.shared_with?.length ?? 0) > 0 && (
                        <div className="sm:col-span-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                          <p className="text-xs text-amber-200/90">
                            Este número também está {inst.shared_with!.length === 1 ? 'na roleta' : 'nas roletas'}{' '}
                            <strong>{inst.shared_with!.join(', ')}</strong>. Os leads que chegam por formulário ou
                            portal já sabem a qual roleta pertencem — a escolha abaixo vale só para quem manda
                            mensagem direto para este WhatsApp.
                          </p>
                          <button
                            type="button"
                            onClick={() => updateInstance(inst.localId, 'answers_direct_inbound', !inst.answers_direct_inbound)}
                            className={`mt-2 flex items-center gap-1.5 text-xs ${
                              inst.answers_direct_inbound ? 'text-green-500' : 'text-gray-400'
                            }`}
                          >
                            {inst.answers_direct_inbound
                              ? <ToggleRight className="h-5 w-5" />
                              : <ToggleLeft className="h-5 w-5" />}
                            Esta roleta atende quem escreve direto para este número
                          </button>
                          {!inst.answers_direct_inbound && (
                            <p className="mt-1 pl-[26px] text-[11px] text-gray-400">
                              Desmarcado, quem escrever direto para este número não entra nesta roleta.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Número sem ninguém liberado nunca recebe lead. É o erro
                          de 30/07/2026 repetido por número — e sem este aviso ele
                          voltaria a ser silencioso. */}
                      {inst.inbox_id && !loadingMembers && (membersByInbox[inst.inbox_id]?.length ?? 0) === 0 && (
                        <p className="text-xs text-destructive sm:col-span-12 sm:-mt-1">
                          Ninguém tem acesso a {instanceName(inst.inbox_id)}. Libere o acesso na equipe
                          desse inbox, senão este número fica fora do sorteio.
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {isMulti && mode !== 'rodizio' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No modo <strong>{MODE_LABEL[mode]}</strong> o número não é sorteado: quem define é o
                    corretor escolhido, e o lead é atendido pelo WhatsApp dele.
                  </p>
                )}
              </div>
            )}

            {/* Ativo */}
            <div className="flex items-center gap-3 lg:col-span-2">
              <button type="button" onClick={() => setIsActive(!isActive)} className="text-[#7c3aed]">
                {isActive
                  ? <ToggleRight className="h-7 w-7 text-green-500" />
                  : <ToggleLeft className="h-7 w-7 text-red-500" />}
              </button>
              <div>
                <p className="text-sm font-medium">Roleta {isActive ? 'ativa' : 'desativada'}</p>
                <p className="text-xs text-muted-foreground">Desativar para não distribuir leads neste inbox.</p>
              </div>
            </div>

            {/* Modo de distribuição — o coração da tela.
                Os quatro cartões em 2×2 a partir de `sm`: empilhados eles
                sozinhos ocupavam mais de uma tela de altura. */}
            <div className="lg:col-span-2">
              <UILabel className="flex items-center gap-1.5 mb-2">
                <Shuffle className="h-4 w-4" />
                Como o lead é distribuído *
              </UILabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODES.map(opt => {
                  const Icon = opt.icon;
                  const active = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`h-full w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
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

            {/* Horário de funcionamento.
                Fica junto do prazo, e não junto dos avisos, porque é regra de
                DISTRIBUIÇÃO: decide se haverá sorteio, não como o time é avisado.

                Não aparece no modo Manual — lá ninguém é sorteado em hora nenhuma,
                então um horário de funcionamento não teria o que governar. */}
            {mode !== 'manual' && (
              <div className="rounded-lg border border-border p-3 space-y-3 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <UILabel className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Horário de funcionamento
                    </UILabel>
                    <p className="text-xs text-muted-foreground mt-1">
                      Desligado = a roleta distribui 24h, a qualquer dia e hora.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHorarioOn(!horarioOn)}
                    className="flex items-center gap-2 text-sm"
                    aria-pressed={horarioOn}
                  >
                    {horarioOn
                      ? <ToggleRight className="h-6 w-6 text-primary" />
                      : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                    <span className={horarioOn ? 'text-primary' : 'text-muted-foreground'}>
                      {horarioOn ? 'Com horário' : '24 horas'}
                    </span>
                  </button>
                </div>

                {horarioOn && (
                  <>
                    <WeeklyWindowsEditor value={janelas} onChange={setJanelas} idPrefix="roleta_win" />

                    <div>
                      <UILabel className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4" />
                        Fora do horário, atender por
                      </UILabel>
                      <div className="mt-1">
                        <NativeSelect
                          value={plantaoInboxId}
                          onChange={e => setPlantaoInboxId(e.target.value)}
                        >
                          <option value="">Ninguém — o lead fica sem responsável</option>
                          {plantaoInboxId && !inboxes.some(i => i.id === plantaoInboxId) && (
                            <option value={plantaoInboxId}>{plantaoInboxId}</option>
                          )}
                          {inboxes.map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </NativeSelect>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fora do horário a roleta não sorteia corretor. O lead vai para o número escolhido,
                        onde a pessoa de plantão ou a IA daquele número atende. Pode ser um número que não
                        participa da roleta.
                      </p>
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={autoNaAbertura}
                        onChange={e => setAutoNaAbertura(e.target.checked)}
                      />
                      <span className="text-sm">
                        Distribuir automaticamente quando o horário abrir
                        <span className="block text-xs text-muted-foreground">
                          O lead que passou a noite no plantão entra no sorteio assim que a roleta reabre.
                          Quem já ganhou dono durante o plantão não é mexido.
                        </span>
                      </span>
                    </label>
                  </>
                )}
              </div>
            )}

            {/* Número do gestor */}
            <div>
              <UILabel className="flex items-center gap-1.5">
                <Bell className="h-4 w-4" />
                Número do gestor (WhatsApp) *
              </UILabel>
              <Input
                value={gestorNum}
                onChange={e => setGestorNum(e.target.value)}
                placeholder="5511999990000"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Receberá alertas de atribuição, timeout e relatórios diários/semanais.
              </p>
            </div>

            {/* Grupo de avisos (opcional) */}
            <div>
              <UILabel className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Grupo de avisos (opcional)
              </UILabel>
              <div className="mt-1">
                <NativeSelect
                  value={gestorGroupJid}
                  onChange={e => setGestorGroupJid(e.target.value)}
                  disabled={loadingGroups}
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
                </NativeSelect>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {loadingGroups
                  ? 'Carregando grupos...'
                  : groups.length === 0
                    ? 'Nenhum grupo encontrado na central Operacional.'
                    : 'Todos os grupos da central Operacional. O do CRM aparece no topo como ⭐ sugerido. O aviso é enviado por ela.'}
              </p>
            </div>

            {/* Número que envia os avisos */}
            <div>
              <UILabel className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                Número que envia os avisos (opcional)
              </UILabel>
              <div className="mt-1">
                <NativeSelect
                  value={notifInboxId}
                  onChange={e => setNotifInboxId(e.target.value)}
                >
                  <option value="">Mesma instância da roleta</option>
                  {notifInboxId && !inboxes.some(i => i.id === notifInboxId) && (
                    <option value={notifInboxId}>{notifInboxId}</option>
                  )}
                  {inboxes.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </NativeSelect>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Instância que ENVIA os alertas. Se vazio, usa a mesma da roleta.
              </p>
            </div>

            {/* Mensagens dos avisos (editáveis) */}
            <div className="rounded-lg border border-border p-3 space-y-3 lg:col-span-2">
              <UILabel className="flex items-center gap-1.5">
                <Bell className="h-4 w-4" />
                Mensagens dos avisos (opcional)
              </UILabel>
              <p className="text-xs text-muted-foreground">
                Em branco = usa o texto padrão (não desliga o aviso — pra isso use a chavinha ao lado de cada um).
                Clique numa variável pra jogar no texto do aviso focado.
                Use o <Send className="inline h-3 w-3" /> <b>Testar</b> pra receber o aviso com dados fictícios (não precisa salvar antes):
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
                <div className="flex items-center justify-between">
                  <UILabel className="text-xs">Aviso do corretor</UILabel>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMsgCorretorOn(!msgCorretorOn)}
                      title={msgCorretorOn ? 'Ligado — clique para NÃO enviar este aviso' : 'Desligado — clique para voltar a enviar'}
                      className="text-[#7c3aed]"
                    >
                      {msgCorretorOn
                        ? <ToggleRight className="h-5 w-5 text-green-500" />
                        : <ToggleLeft className="h-5 w-5 text-red-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendTest('corretor')}
                      disabled={testingMsg !== null || !msgCorretorOn}
                      title="Enviar um teste deste aviso (vai pro número do gestor)"
                      className="flex items-center gap-1 text-xs text-[#7c3aed] hover:underline disabled:opacity-50"
                    >
                      {testingMsg === 'corretor'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />}
                      Testar
                    </button>
                  </div>
                </div>
                <textarea
                  ref={corretorRef}
                  value={msgCorretor}
                  onFocus={() => setActiveMsg('corretor')}
                  onChange={e => setMsgCorretor(e.target.value)}
                  disabled={!msgCorretorOn}
                  rows={3}
                  placeholder="Padrão: 🔔 Novo lead na sua fila... + link de aceite"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
                {/* É este aviso que leva o {{link_aceite}}. Sem ele o corretor não
                    fica sabendo do lead, não aceita, e o prazo estoura sempre. */}
                {!msgCorretorOn && (
                  <p className="mt-1 text-xs text-amber-600">
                    Sem este aviso o corretor não recebe o link de aceite: ele não vai
                    saber do lead, o prazo estoura e o lead segue para o próximo.
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <UILabel className="text-xs">Aviso do gestor</UILabel>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMsgGestorOn(!msgGestorOn)}
                      title={msgGestorOn ? 'Ligado — clique para NÃO enviar este aviso' : 'Desligado — clique para voltar a enviar'}
                      className="text-[#7c3aed]"
                    >
                      {msgGestorOn
                        ? <ToggleRight className="h-5 w-5 text-green-500" />
                        : <ToggleLeft className="h-5 w-5 text-red-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendTest('gestor')}
                      disabled={testingMsg !== null || !msgGestorOn}
                      title="Enviar um teste deste aviso (vai pro número do gestor)"
                      className="flex items-center gap-1 text-xs text-[#7c3aed] hover:underline disabled:opacity-50"
                    >
                      {testingMsg === 'gestor'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />}
                      Testar
                    </button>
                  </div>
                </div>
                <textarea
                  ref={gestorRef}
                  value={msgGestor}
                  onFocus={() => setActiveMsg('gestor')}
                  onChange={e => setMsgGestor(e.target.value)}
                  disabled={!msgGestorOn}
                  rows={3}
                  placeholder="Padrão: 🚨 Lead Novo na Roleta — Aguardando Aceite..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
                {/* O gestor também recebe o texto de repasse por este mesmo caminho —
                    a chave de repasse abaixo é só do grupo. */}
                {!msgGestorOn && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    O gestor não recebe nada no zap dele — nem lead novo, nem repasse.
                    Os alertas de falha (lead sem responsável, ninguém assumiu) continuam saindo.
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <UILabel className="text-xs">Aviso do grupo</UILabel>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMsgGrupoOn(!msgGrupoOn)}
                      title={msgGrupoOn ? 'Ligado — clique para NÃO enviar este aviso' : 'Desligado — clique para voltar a enviar'}
                      className="text-[#7c3aed]"
                    >
                      {msgGrupoOn
                        ? <ToggleRight className="h-5 w-5 text-green-500" />
                        : <ToggleLeft className="h-5 w-5 text-red-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendTest('grupo')}
                      disabled={testingMsg !== null || !msgGrupoOn}
                      title="Enviar um teste deste aviso (vai pro grupo de avisos)"
                      className="flex items-center gap-1 text-xs text-[#7c3aed] hover:underline disabled:opacity-50"
                    >
                      {testingMsg === 'grupo'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />}
                      Testar
                    </button>
                  </div>
                </div>
                <textarea
                  ref={grupoRef}
                  value={msgGrupo}
                  onFocus={() => setActiveMsg('grupo')}
                  onChange={e => setMsgGrupo(e.target.value)}
                  disabled={!msgGrupoOn}
                  rows={3}
                  placeholder="Padrão: 🎯 Lead distribuído pela roleta..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Usado quando o lead <b>chega</b>. Quando o prazo estoura e o lead
                  passa para outro corretor, sai o aviso de repasse abaixo.
                  {' '}Desligar este <b>não</b> desliga o de repasse — são chaves separadas.
                </p>
              </div>

              {/* Campo separado porque nenhum texto serve para as duas situações:
                  antes o repasse reusava o aviso acima, e quem o personalizava
                  anunciava "lead novo" num lead que já era de outra pessoa. */}
              <div>
                <div className="flex items-center justify-between">
                  <UILabel className="text-xs">Aviso de repasse (grupo)</UILabel>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMsgRepasseOn(!msgRepasseOn)}
                      title={msgRepasseOn ? 'Ligado — clique para NÃO enviar este aviso' : 'Desligado — clique para voltar a enviar'}
                      className="text-[#7c3aed]"
                    >
                      {msgRepasseOn
                        ? <ToggleRight className="h-5 w-5 text-green-500" />
                        : <ToggleLeft className="h-5 w-5 text-red-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendTest('repasse')}
                      disabled={testingMsg !== null || !msgRepasseOn}
                      title="Enviar um teste deste aviso (vai pro grupo de avisos)"
                      className="flex items-center gap-1 text-xs text-[#7c3aed] hover:underline disabled:opacity-50"
                    >
                      {testingMsg === 'repasse'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />}
                      Testar
                    </button>
                  </div>
                </div>
                <textarea
                  ref={repasseRef}
                  value={msgRepasse}
                  onFocus={() => setActiveMsg('repasse')}
                  onChange={e => setMsgRepasse(e.target.value)}
                  disabled={!msgRepasseOn}
                  rows={3}
                  placeholder="Padrão: 🔁 Lead repassado pela roleta..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Sai quando o prazo estoura e o lead vai para o próximo corretor.
                  Use <code>{'{{motivo}}'}</code> para mostrar quem não assumiu.
                </p>
              </div>
            </div>

            {/* Fontes de leads (gatilhos por formulário) */}
            <div className="rounded-lg border border-border p-3 space-y-2 lg:col-span-2">
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
            <div className="lg:col-span-2">
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
                  {/* Percentual EFETIVO: com dois números ele é o produto das
                      duas fatias. Mostrar só peso/soma faria o gestor ler
                      números que não acontecem. */}
                  {isMulti ? 'Distribuição real (número × corretor):' : 'Distribuição real (peso / soma):'}
                  {members.filter(m => m.is_active && m.user_id).map(m => {
                    const pct = effectivePct(m);
                    const u = users.find(u => u.id === m.user_id);
                    const nome = u?.name ?? m.user_id;
                    if (pct === null) return ` ${nome} —`;
                    return isMulti
                      ? ` ${nome} (${instanceName(memberInbox(m))}) ${pct.toFixed(0)}%`
                      : ` ${nome} ${pct.toFixed(0)}%`;
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

                    {/* Os campos do corretor numa grade só: empilhados no
                        celular, lado a lado no monitor. Sem `isMulti` são três
                        campos, então a grade fecha em 3 colunas para não sobrar
                        um buraco na linha. */}
                    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isMulti ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                      <div>
                        <UILabel className="text-xs">Corretor *</UILabel>
                        <div className="mt-1">
                          <NativeSelect
                            value={m.user_id}
                            onChange={e => selectCorretor(m.localId, e.target.value)}
                          >
                            <option value="">
                              {!inboxId ? 'Escolha a instância primeiro...' : 'Selecione...'}
                            </option>
                            {corretorOptionsFor(memberInbox(m)).map(o => (
                              <option key={o.id} value={o.id}>
                                {o.hasAccess ? o.name : `${o.name} — sem acesso à instância`}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        {/* A mensagem é POR INSTÂNCIA: com números diferentes,
                            "ninguém tem acesso" precisa dizer a QUAL número, senão
                            manda o gestor liberar acesso no inbox errado. */}
                        {memberInbox(m) && !loadingMembers
                          && (membersByInbox[memberInbox(m)]?.length ?? 0) === 0 && (
                          <p className="mt-1 text-xs text-destructive">
                            Nenhum corretor tem acesso a {instanceName(memberInbox(m))}. Libere o acesso
                            na equipe do inbox — só quem tem acesso pode receber lead da roleta.
                          </p>
                        )}
                      </div>
                      {/* Em qual número ELE atende. Só aparece quando há mais de
                          um: com uma instância só a pergunta não existe. Trocar o
                          número limpa o corretor, porque a lista de quem pode ser
                          escolhido é outra — manter o antigo selecionado deixaria
                          um corretor sem acesso gravado sem ninguém perceber. */}
                      {isMulti && (
                        <div>
                          <UILabel className="text-xs">Atende pelo número</UILabel>
                          <div className="mt-1">
                            <NativeSelect
                              value={memberInbox(m)}
                              onChange={e => setMembers(prev => prev.map(x => (
                                x.localId === m.localId ? { ...x, inbox_id: e.target.value, user_id: '' } : x
                              )))}
                            >
                              {activeInstances.map(i => (
                                <option key={i.inbox_id} value={i.inbox_id}>{instanceName(i.inbox_id)}</option>
                              ))}
                            </NativeSelect>
                          </div>
                        </div>
                      )}
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
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* POR QUE NÃO SALVOU. Fica acima dos botões — é o último lugar por
              onde o olho passa antes de clicar em Salvar — e permanece na tela
              até o gestor resolver, ao contrário do toast que sumia sozinho.
              Vale tanto para o que a tela já sabe conferir quanto para o que só
              o servidor sabe (número já usado, corretor sem acesso ao número). */}
          {saveErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm"
            >
              <div className="flex items-center gap-2 font-medium text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {saveErrors.length === 1
                  ? 'A roleta não foi salva'
                  : `A roleta não foi salva — ${saveErrors.length} coisas precisam de ajuste`}
              </div>
              <ul className="mt-2 space-y-1 pl-6 text-red-200/90 list-disc">
                {saveErrors.map((erro, i) => <li key={i}>{erro}</li>)}
              </ul>
            </div>
          )}

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
