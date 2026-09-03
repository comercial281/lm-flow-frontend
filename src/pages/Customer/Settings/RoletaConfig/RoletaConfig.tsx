import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { formatDateTimeBR } from '@/utils/dateUtils';
import { toast } from 'sonner';
import {
  Button, Input, Label as UILabel, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/ds';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Shuffle, Plus, Trash2, Save, Phone,
  Clock, Bell, ToggleLeft, ToggleRight, Users, BarChart2,
  Gavel, Hand, Wifi, Send, Loader2, Eye, EyeOff, AlertTriangle, Copy,
} from 'lucide-react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { roletaFormProblems, roletaFormWarnings, backendProblems } from './roletaFormChecks';
import { instanciasComAcesso } from './roletaEquipe';
import {
  roletaConfigService, RoletaConfig, RoletaMember, RoletaInstance, BrokerAssignment, DistributionMode,
  RoletaDiagnostic, RepairOwnersResult, RepairInboxAccessResult, RoletaQueue,
  RoletaHoursWindow, RoletaBusinessHours, RoletaDefaults,
} from '@/services/roletaConfig/roletaConfigService';
import RemoveFromRoletaDialog from '@/components/roleta/RemoveFromRoletaDialog';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { DEFAULT_WINDOW } from '@/components/schedule/scheduleWindows';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
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

import { useConfirmacao } from '@/hooks/useConfirmacao';
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

// Todo corretor entra com o mesmo peso. É o mesmo valor que o campo já usava de
// default — o que mudou é que ele deixou de ser uma pergunta na tela.
const PESO_PADRAO = 10;

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
    // O número que está no CADASTRO da pessoa (Equipe). Não é editável aqui —
    // serve para a tela mostrar de onde vem o aviso quando o campo acima está
    // vazio, em vez de deixar parecer que o corretor está sem WhatsApp.
    whatsapp_from_profile: m?.whatsapp_from_profile ?? '',
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
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [configs, setConfigs]         = useState<RoletaConfig[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<RoletaConfig | null>(null);
  const [tab, setTab]                 = useState<'configs' | 'padroes' | 'assignments' | 'diagnostico'>('configs');
  // Os padrões da casa: o que a roleta NOVA já vem preenchida.
  // ⚠️ Herdar aqui é SEMEAR — o valor vira dado da roleta no momento em que ela
  // nasce. Roleta que já existe não muda nada, hoje nem quando o padrão mudar.
  const [padroes, setPadroes]         = useState<RoletaDefaults>({});
  const [salvandoPadroes, setSalvandoPadroes] = useState(false);

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
  // O lead que o gestor está tirando da roleta. A oferta some da lista assim que
  // o diálogo confirma — por isso guardamos nome e contato, não a oferta.
  const [tirandoDaRoleta, setTirandoDaRoleta] = useState<{ contactId: string; nome: string } | null>(null);
  const [loadingAssign, setLoadingAssign] = useState(false);

  // Fila ao vivo. O prazo corre em minutos, então recarregar de minuto em minuto
  // é o suficiente pro cronômetro não mentir.
  const [queue, setQueue]             = useState<RoletaQueue | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  // "Não deu pra carregar" ≠ "não há roleta". O bloco de quem está no sorteio
  // sumia da tela nos dois casos, e quem abria o Diagnóstico pra entender por que
  // um lead não foi distribuído não via nem a lista nem o motivo de ela faltar.
  const [queueError, setQueueError]   = useState(false);

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
  // ⚠️ `useClientToggle`, não `useFeature`. Os dois são OPOSTOS: `useFeature`
  // trata chave AUSENTE como ligada, e esta é a única chave `DEFAULT_OFF` do
  // repo que era lida assim. Funcionava porque o servidor devolve `false`
  // explícito — mas quando a busca de funcionalidades FALHA o fallback é `{}`,
  // e aí o bloco de números aparecia para quem não tem a liberação (o servidor
  // recusava com 422, então o sintoma era um erro sem sentido na tela).
  const multiFeature = useClientToggle('roleta_multi_instancia');
  // O payload continua valendo como reforço: é a verdade do backend, e cobre o
  // super-admin no domínio raiz, onde não há slug de tenant para resolver — e
  // onde, com o `useClientToggle`, a chave nunca chegaria.
  const [multiFromConfig, setMultiFromConfig]   = useState(false);
  const multiEnabled = multiFeature || multiFromConfig;

  // O MODELO desta roleta: um número compartilhado por todos, ou um número por
  // corretor.
  //
  // ⚠️ É a FORMA DA TELA, não um tipo guardado. Quem sabe qual é o modelo
  // continua sendo a quantidade de números ativos — guardar um campo criaria
  // duas verdades (uma roleta dizendo "sou compartilhada" com três números), e
  // trocar de modelo depois viraria migração. Ao editar, ele é DERIVADO do que
  // está lá.
  const [modeloMulti, setModeloMulti] = useState(false);
  // O bloco de números só existe no modelo de um número por corretor — e só
  // para quem tem a liberação.
  const mostrarNumeros = multiEnabled && modeloMulti;
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
  // A lista de corretores: busca, peso escondido e quem está sendo liberado.
  //
  // O peso fica ATRÁS de um link quando todo mundo é igual — que é o caso de
  // quase toda roleta. Ele só se abre sozinho quando os pesos JÁ são diferentes,
  // senão quem usa distribuição desigual abriria a tela sem ver a própria
  // configuração.
  const [buscaCorretor, setBuscaCorretor]   = useState('');
  const [mostrarPesos, setMostrarPesos]     = useState(false);
  const [liberandoId, setLiberandoId]       = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await roletaConfigService.getAll();
      setConfigs(lista);
      // Se QUALQUER roleta deste cliente diz que o multinúmero está liberado, ele
      // está — é a resposta do próprio servidor, e não um chute. Cobre o
      // super-admin no domínio raiz na hora de CRIAR, onde antes só o editar
      // sabia (o `openCreate` zera a flag vinda do payload).
      if (lista.some(c => c.multi_instance_enabled)) setMultiFromConfig(true);
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
    setQueueError(false);
    try {
      setQueue(await roletaConfigService.getQueue());
    } catch {
      // Bloco secundário do Diagnóstico: não derruba a tela nem joga um erro na
      // cara de quem veio ver a trilha dos leads — mas também não some calado.
      // A linha discreta abaixo é o que diferencia "seu cargo não alcança" de
      // "esta conta não tem roleta nenhuma".
      setQueue(null);
      setQueueError(true);
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

  const loadDefaults = useCallback(async () => {
    try {
      setPadroes(await roletaConfigService.getDefaults());
    } catch {
      // Leitura de fundo recusada não grita — quem não alcança os padrões
      // simplesmente não os vê. É a regra do app desde 31/08/2026.
    }
  }, []);

  useEffect(() => {
    loadConfigs(); loadUsers(); loadInboxes(); loadAccount(); loadDefaults();
  }, [loadConfigs, loadUsers, loadInboxes, loadAccount, loadDefaults]);
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
    if (mostrarNumeros) {
      setInstances([mkInstance({ inbox_id: inboxId, weight: 10, position: 0 })]);
      return;
    }
    if (!inboxId) return;
    setInstances([mkInstance({ inbox_id: inboxId, weight: 10, position: 0 })]);
  }, [modalOpen, inboxId, instances.length, mostrarNumeros]);

  // Com o bloco de números visível, o seletor separado de instância some — então
  // a ENTRADA passa a ser a primeira linha do bloco, e é dela que sai o
  // `inbox_id` da roleta (a chave que o `for_inbox` procura primeiro).
  //
  // Só ao CRIAR: numa roleta que já existe, trocar o inbox mudaria a chave, e o
  // seletor da primeira linha fica travado justamente por isso.
  useEffect(() => {
    if (!modalOpen || editing || !mostrarNumeros) return;
    const entrada = instances[0]?.inbox_id;
    if (entrada && entrada !== inboxId) setInboxId(entrada);
  }, [modalOpen, editing, mostrarNumeros, instances, inboxId]);

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

  // Joga os padrões da casa nos campos do formulário.
  //
  // A tela preenche para o gestor VER o que vai ser gravado; o servidor semeia
  // de novo no salvamento, como rede de segurança para quem cria a roleta por
  // outra porta (o atalho do quadro de funil).
  const aplicarPadroes = useCallback((d: RoletaDefaults) => {
    if (d.gestor_whatsapp_number != null) setGestorNum(d.gestor_whatsapp_number);
    if (d.gestor_group_jid != null) setGestorGroupJid(d.gestor_group_jid);
    if (d.notification_inbox_id != null) setNotifInboxId(d.notification_inbox_id);
    if (d.timeout_minutes != null) setTimeoutMin(d.timeout_minutes);
    if (d.msg_corretor_template != null) setMsgCorretor(d.msg_corretor_template);
    if (d.msg_gestor_template != null) setMsgGestor(d.msg_gestor_template);
    if (d.msg_grupo_template != null) setMsgGrupo(d.msg_grupo_template);
    if (d.msg_grupo_repasse_template != null) setMsgRepasse(d.msg_grupo_repasse_template);
    // `!== undefined` e não `??`: `false` é escolha (aviso desligado), e um `??`
    // ou um `||` o trocaria pelo ligado. É a mesma armadilha que o servidor
    // trava do lado dele.
    if (d.msg_corretor_enabled !== undefined) setMsgCorretorOn(d.msg_corretor_enabled);
    if (d.msg_gestor_enabled !== undefined) setMsgGestorOn(d.msg_gestor_enabled);
    if (d.msg_grupo_enabled !== undefined) setMsgGrupoOn(d.msg_grupo_enabled);
    if (d.msg_grupo_repasse_enabled !== undefined) setMsgRepasseOn(d.msg_grupo_repasse_enabled);

    const h = d.business_hours_config;
    if (h && h.mode === 'custom') {
      setHorarioOn(true);
      setJanelas(h.windows?.length ? h.windows : [DEFAULT_WINDOW]);
      setPlantaoInboxId(h.after_hours_inbox_id ?? '');
      setAutoNaAbertura(!!h.auto_distribute_on_open);
    }
  }, []);

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
    // Nasce VAZIA: a lista de marcar mostra a equipe, e nenhuma linha em branco
    // pedindo para ser preenchida.
    setMembers([]);
    setBuscaCorretor('');
    setMostrarPesos(false);
    setInstances([]);
    // Toda roleta nasce no modelo de NÚMERO COMPARTILHADO, que é o de quase
    // todas. Quem quer um número por corretor escolhe no cartão.
    setModeloMulti(false);
    // NÃO zera `multiFromConfig`: desde que ele passou a significar "este
    // CLIENTE tem o multinúmero liberado" (e não "esta roleta é multinúmero"),
    // zerar aqui esconderia o bloco de números justamente na criação — que é o
    // defeito que a flag foi criada para consertar.
    setGroups([]);
    setSaveErrors([]);
    // Os padrões DEPOIS dos zeros: eles é que ficam na tela.
    aplicarPadroes(padroes);
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
    const membros = c.members.map(m => mkLocal(m));
    setMembers(membros);
    setBuscaCorretor('');
    // O peso só se abre sozinho quando JÁ é desigual — senão quem usa
    // distribuição desigual abriria a tela sem ver a própria configuração.
    // Abre sozinho quando QUALQUER peso já é desigual — o do corretor no modelo
    // compartilhado, o do número no de um por corretor. Senão o gestor abriria a
    // tela sem ver a própria configuração.
    const numeros = (c.instances ?? []).filter(i => i.is_active).map(i => i.weight);
    setMostrarPesos(new Set(membros.map(m => m.weight)).size > 1
      || new Set(numeros).size > 1);
    // Roleta antiga (antes das instâncias) chega sem `instances`: monta a de
    // entrada a partir do próprio inbox dela, que é o que o backfill fez no banco.
    setInstances(
      c.instances?.length
        ? c.instances.map(i => mkInstance(i))
        : [mkInstance({ inbox_id: c.inbox_id, weight: 10, position: 0 })],
    );
    // Só LIGA, nunca desliga: uma roleta de um número só neste cliente não
    // prova que o cliente perdeu a liberação.
    if (c.multi_instance_enabled) setMultiFromConfig(true);
    // O modelo é DERIVADO do que está gravado — nunca de um campo. Mais de um
    // número ativo = um número por corretor.
    setModeloMulti((c.instances ?? []).filter(i => i.is_active).length > 1);
    setSaveErrors([]);
    setModalOpen(true);
  }

  // "Criar a partir de": abre a Nova distribuição já preenchida com o que se
  // REPETE de uma roleta para a outra — modo, prazo, horário, avisos e textos.
  //
  // Não copia o número nem os corretores de propósito: são as duas únicas coisas
  // que necessariamente mudam, e trazê-las faria a roleta nova nascer
  // distribuindo para a equipe da antiga sem ninguém ter escolhido — e, pior,
  // apontando para uma instância que já tem roleta (o servidor recusaria, ou
  // o gestor salvaria duas roletas no mesmo número sem perceber).
  //
  // Reaproveita o `openCreate` para não repetir a lista de zeros: os `set` daqui
  // são enfileirados DEPOIS e é o valor deles que fica na tela. Os padrões da
  // casa também são sobrescritos — quem manda "a partir de" está dizendo que a
  // referência é aquela roleta, não o padrão.
  function openDuplicate(c: RoletaConfig) {
    openCreate();
    setMode(c.distribution_mode ?? 'rodizio');
    setTimeoutMin(c.timeout_minutes);
    setGestorNum(c.gestor_whatsapp_number ?? '');
    setGestorGroupJid(c.gestor_group_jid ?? '');
    setNotifInboxId(c.notification_inbox_id ?? '');
    setMsgCorretor(c.msg_corretor_template ?? '');
    setMsgGestor(c.msg_gestor_template ?? '');
    setMsgGrupo(c.msg_grupo_template ?? '');
    setMsgRepasse(c.msg_grupo_repasse_template ?? '');
    // `!== false` pelo mesmo motivo do `openEdit`: roleta salva antes das chaves
    // existirem volta sem o campo, e o estado real dela é LIGADO.
    setMsgCorretorOn(c.msg_corretor_enabled !== false);
    setMsgGestorOn(c.msg_gestor_enabled !== false);
    setMsgGrupoOn(c.msg_grupo_enabled !== false);
    setMsgRepasseOn(c.msg_grupo_repasse_enabled !== false);
    const bh: RoletaBusinessHours = c.business_hours_config ?? {};
    setHorarioOn(bh.mode === 'custom');
    setJanelas(bh.windows?.length ? bh.windows : [DEFAULT_WINDOW]);
    setPlantaoInboxId(bh.after_hours_inbox_id ?? '');
    setAutoNaAbertura(!!bh.auto_distribute_on_open);
    toast.info('Copiei os ajustes. Falta escolher o número e os corretores.');
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
    // Só o corretor escolhido importa. O número deixou de ser obrigatório aqui:
    // quando o campo está vazio, o servidor usa o do cadastro da pessoa. Antes
    // esta linha DESCARTAVA em silêncio quem não tivesse número digitado nesta
    // roleta — o corretor sumia da lista depois de um "Salvo" com sucesso.
    const membersValid = members.filter(m => m.user_id);

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
          // Vazio vai como null: é assim que o servidor entende "usa o do
          // cadastro". String vazia gravada seria uma exceção em branco.
          personal_whatsapp_number: (m.personal_whatsapp_number ?? '').trim() || null,
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
    if (!(await confirmar({
      titulo: 'Excluir roleta',
      descricao: 'Excluir esta configuração de roleta?',
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await roletaConfigService.destroy(id);
      toast.success('Removida');
      loadConfigs();
    } catch {
      toast.error('Erro ao excluir');
    }
  }

  function updateMember(localId: string, key: keyof MemberRow, value: string | number | boolean) {
    setMembers(prev => prev.map(m => m.localId === localId ? { ...m, [key]: value } : m));
  }

  // Em qual número este corretor atende. Vazio cai na instância de entrada —
  // que é o que toda roleta de um número só tem.
  const memberInbox = useCallback((m: MemberRow) => m.inbox_id || inboxId, [inboxId]);

  // A quais NÚMEROS DESTA ROLETA a pessoa tem acesso liberado.
  //
  // É o que permite não perguntar "atende pelo quê?" quando não há dúvida: com
  // acesso a um número só, o sistema resolve. A relação já existe no sistema
  // (a equipe de cada instância); a tela antiga a usava ao contrário, obrigando
  // a escolher o número primeiro para só então filtrar a gente.
  const instanciasDoCorretor = useCallback(
    (userId: string) => instanciasComAcesso(userId, {
      instances,
      inboxDeEntrada: inboxId,
      membrosPorInstancia: membersByInbox,
    }),
    [instances, membersByInbox, inboxId],
  );

  // O número que a pessoa tem no CADASTRO (Equipe).
  //
  // ⚠️ FUNDE as duas fontes, não escolhe uma. O código anterior fazia
  // `pool.find(...) ?? users.find(...)` e nunca chegava ao fallback: `??` só cai
  // com null/undefined, e a lista de membros da instância devolve um objeto
  // VERDADEIRO — só que sem o número. Resultado: o preenchimento automático
  // existia e nunca funcionou, e o gestor redigitava o número toda vez.
  // Reordenar não bastaria: o pool pode ter alguém que a lista de usuários não
  // tem, e vice-versa.
  const cadastroDe = useCallback((userId: string) => {
    const pool = Object.values(membersByInbox).flat() as (User & { whatsapp_number?: string })[];
    const daLista = users.find(x => x.id === userId) as (User & { whatsapp_number?: string }) | undefined;
    const doPool  = pool.find(x => x.id === userId);
    return String(daLista?.whatsapp_number ?? doPool?.whatsapp_number ?? '').trim();
  }, [membersByInbox, users]);

  // MARCAR / DESMARCAR uma pessoa na roleta.
  //
  // Substituiu a linha-a-linha (Adicionar → escolher na lista → escolher o
  // número → conferir o peso, N vezes). O peso entra no padrão e o número em
  // que ela atende é RESOLVIDO quando não há dúvida: com acesso a um número só,
  // não há o que perguntar.
  //
  // ⚠️ O campo de WhatsApp da roleta NÃO é preenchido com o do cadastro: ele é a
  // exceção ("me avise em outro número neste caso"), e preenchê-lo faria toda
  // linha virar exceção — quem trocasse de celular teria que ser corrigido
  // roleta por roleta, que é o problema de origem. O cadastro fica à vista, e é
  // o servidor que o usa quando o campo está vazio.
  const marcarCorretor = useCallback((userId: string, on: boolean) => {
    setMembers(prev => {
      if (!on) return prev.filter(m => m.user_id !== userId);
      if (prev.some(m => m.user_id === userId)) return prev;

      const acessos = instanciasDoCorretor(userId);
      return [...prev, mkLocal({
        user_id: userId,
        weight: PESO_PADRAO,
        is_active: true,
        position: prev.length,
        whatsapp_from_profile: cadastroDe(userId),
        // Um acesso só = resolvido. Vários = fica em branco e a tela pergunta.
        inbox_id: acessos.length === 1 ? acessos[0] : '',
      })];
    });
  }, [instanciasDoCorretor, cadastroDe]);

  // Liberar o acesso à instância SEM sair da tela.
  //
  // A barreira de 30/07/2026 continua de pé (só quem foi liberado por um humano
  // recebe lead); o que muda é que o humano não precisa mais ir até a equipe do
  // número, liberar, e voltar.
  //
  // ⚠️ O endpoint SUBSTITUI a lista inteira de atendentes do número. Mandar só o
  // id novo REMOVERIA todos os outros. Por isso lê a lista atual e acrescenta.
  async function liberarEAdicionar(userId: string, inboxAlvo: string) {
    const nome = userName(userId);
    const numero = instanceName(inboxAlvo);
    if (!(await confirmar({
      titulo: 'Liberar acesso e adicionar',
      descricao: `${nome} vai passar a atender pelo número ${numero} — e a receber lead da roleta por ele.`,
      rotuloDaAcao: 'Liberar e adicionar',
    }))) return;

    setLiberandoId(userId);
    try {
      const atuais = await inboxMembersService.get(inboxAlvo);
      // Só os EXPLÍCITOS + o novo. O endpoint promove a explícito todo id que
      // receber, então mandar a lista inteira transformava cada acesso
      // automático daquele número (gente que só vê o próprio lead) em acesso
      // completo — e em candidato a receber lead novo — por efeito colateral
      // de liberar UMA pessoa.
      const explicitos = atuais.filter(a => a.auto_granted !== true).map(a => String(a.id));
      const ids = Array.from(new Set([...explicitos, userId]));
      await inboxMembersService.update(inboxAlvo, ids);
      await loadInboxMembers(instanceInboxKey ? instanceInboxKey.split(',') : []);
      marcarCorretor(userId, true);
      toast.success(`${nome} liberado em ${numero} e adicionado à roleta.`);
    } catch (e) {
      toast.error(apiErrorMessage(e, `Não consegui liberar o acesso de ${nome}.`));
    } finally {
      setLiberandoId(null);
    }
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
  const userName = useCallback(
    (id: string) => users.find(u => u.id === id)?.name ?? 'o corretor escolhido',
    [users],
  );

  const entradaDasConferencias = useCallback(() => ({
    inboxId, multiEnabled, configs, editingId: editing?.id ?? null,
    instances, members, mode, gestorNum, horarioOn, janelas,
    instanceLabel: instanceName,
    userName,
  }), [inboxId, multiEnabled, configs, editing, instances, members, mode,
       gestorNum, horarioOn, janelas, instanceName, userName]);

  const problemasDoFormulario = useCallback(
    (): string[] => roletaFormProblems(entradaDasConferencias()),
    [entradaDasConferencias],
  );

  // O que merece aviso mas NÃO impede salvar — hoje, corretor sem WhatsApp em
  // lugar nenhum. Ele entra na roleta e recebe a oferta pelo app; barrar o
  // salvamento por isso impediria uma configuração legítima.
  const avisosDoFormulario = useCallback(
    (): string[] => roletaFormWarnings(entradaDasConferencias()),
    [entradaDasConferencias],
  );

  // O que está no formulário AGORA, na forma dos padrões da casa.
  //
  // Salvar daqui (e não numa tela separada) é o que faz o grupo de avisos caber:
  // ele só pode ser escolhido depois de haver uma instância, e o seletor de
  // grupos vive neste formulário. Uma tela de padrões isolada teria que
  // reconstruir isso e mostraria uma lista vazia.
  const padroesDoFormulario = useCallback((): RoletaDefaults => ({
    gestor_whatsapp_number: gestorNum.trim() || null,
    gestor_group_jid:       gestorGroupJid || null,
    gestor_group_instance:  gestorGroupJid ? CENTRAL_GROUP_INSTANCE : null,
    notification_inbox_id:  notifInboxId || null,
    timeout_minutes:        timeoutMin,
    business_hours_config:  horarioOn
      ? {
          mode: 'custom' as const,
          tz: 'America/Sao_Paulo',
          windows: janelas,
          after_hours_inbox_id: plantaoInboxId || null,
          auto_distribute_on_open: autoNaAbertura,
        }
      : null,
    msg_corretor_template:  msgCorretor.trim() || null,
    msg_gestor_template:    msgGestor.trim() || null,
    msg_grupo_template:     msgGrupo.trim() || null,
    msg_grupo_repasse_template: msgRepasse.trim() || null,
    msg_corretor_enabled:   msgCorretorOn,
    msg_gestor_enabled:     msgGestorOn,
    msg_grupo_enabled:      msgGrupoOn,
    msg_grupo_repasse_enabled: msgRepasseOn,
  }), [gestorNum, gestorGroupJid, notifInboxId, timeoutMin, horarioOn, janelas,
       plantaoInboxId, autoNaAbertura, msgCorretor, msgGestor, msgGrupo, msgRepasse,
       msgCorretorOn, msgGestorOn, msgGrupoOn, msgRepasseOn]);

  async function salvarComoPadrao() {
    setSalvandoPadroes(true);
    try {
      setPadroes(await roletaConfigService.saveDefaults(padroesDoFormulario()));
      toast.success('Padrões salvos. Toda roleta NOVA já vem assim — as que existem não mudam.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui salvar os padrões.'));
    } finally {
      setSalvandoPadroes(false);
    }
  }

  async function limparPadroes() {
    const ok = await confirmar({
      titulo: 'Apagar os padrões da casa?',
      descricao: 'As roletas que já existem não mudam nada — elas guardam os próprios valores. '
        + 'O que muda é que a próxima roleta nova vai nascer com os campos em branco.',
      rotuloDaAcao: 'Apagar padrões',
      destrutivo: true,
    });
    if (!ok) return;

    setSalvandoPadroes(true);
    try {
      // Todo campo em branco: é assim que o servidor entende "apagar o padrão".
      const vazio: RoletaDefaults = {
        gestor_whatsapp_number: null, gestor_group_jid: null, gestor_group_instance: null,
        notification_inbox_id: null, timeout_minutes: null, business_hours_config: null,
        msg_corretor_template: null, msg_gestor_template: null,
        msg_grupo_template: null, msg_grupo_repasse_template: null,
      };
      setPadroes(await roletaConfigService.saveDefaults(vazio));
      toast.success('Padrões apagados.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui apagar os padrões.'));
    } finally {
      setSalvandoPadroes(false);
    }
  }

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

  // A EQUIPE, já com o que a tela precisa saber de cada pessoa: se ela está na
  // roleta, a quais números da roleta ela tem acesso, e se está de fora por
  // falta de acesso.
  //
  // ⚠️ Inclui quem está GRAVADO na roleta mas não aparece mais na equipe (saiu
  // do CRM, ou o cargo mudou). Sem isso ele sumiria da lista e continuaria no
  // payload — invisível e sendo salvo, que é a falha muda que esta tela já
  // tinha com a linha descartada em silêncio.
  const equipeFiltrada = useMemo(() => {
    const porId = new Map(users.map(u => [u.id, u.name] as const));
    const ids = [
      ...users.map(u => u.id),
      ...members.map(m => m.user_id).filter(id => id && !porId.has(id)),
    ];
    const busca = buscaCorretor.trim().toLowerCase();

    return ids.map(id => {
      const membro = members.find(m => m.user_id === id);
      const acessos = instanciasDoCorretor(id);
      return {
        id,
        name: porId.get(id) ?? 'Fora da equipe',
        membro,
        acessos,
        semAcesso: acessos.length === 0,
      };
    }).filter(u => !busca || u.name.toLowerCase().includes(busca));
  }, [users, members, buscaCorretor, instanciasDoCorretor]);
  // O sorteio de instância só existe no rodízio. Em leilão e disponibilidade o
  // critério já É o corretor (quem responde primeiro / quem está online), então
  // o número é derivado do escolhido — mostrar peso de instância ali seria
  // prometer um controle que o motor não tem.
  // ⚠️ `mostrarPesos` na conta: antes o peso do número aparecia SEMPRE no modelo
  // de um número por corretor, enquanto o do corretor só saía atrás do "Ajustar
  // quanto cada um recebe". Eram dois critérios para a mesma pergunta, e o campo
  // que aparecia sozinho era justo o que quase ninguém precisa mexer. Quem já
  // tem peso desigual não perde nada: o `openEdit` abre os pesos por conta
  // própria nesse caso.
  const showInstanceWeights = isMulti && mode === 'rodizio' && mostrarPesos;

  // O peso que a linha do corretor edita: o do NÚMERO dele no modelo de um
  // número por corretor, o dele mesmo no compartilhado.
  //
  // ⚠️ Não é preferência de layout. No modelo de um número por corretor o peso
  // do CORRETOR não faz nada: ele está sozinho no número dele, então a fatia
  // dele DENTRO do número é sempre 100% — quem decide quantos leads ele recebe é
  // o peso do NÚMERO. Editar o do corretor ali era mexer no que não tem efeito.
  // O campo da linha do número continua existindo e edita o mesmo valor: número
  // sem nenhum corretor marcado não tem outra porta.
  const pesoDe = useCallback((m: MemberRow) => {
    if (!mostrarNumeros) return m.weight;
    return activeInstances.find(i => i.inbox_id === memberInbox(m))?.weight ?? m.weight;
  }, [mostrarNumeros, activeInstances, memberInbox]);

  const setPesoDe = useCallback((m: MemberRow, valor: number) => {
    if (!mostrarNumeros) {
      setMembers(prev => prev.map(x => (x.localId === m.localId ? { ...x, weight: valor } : x)));
      return;
    }
    const alvo = memberInbox(m);
    setInstances(prev => prev.map(i => (i.inbox_id === alvo ? { ...i, weight: valor } : i)));
  }, [mostrarNumeros, memberInbox]);

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
    <>
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
        {(['configs', 'padroes', 'assignments', 'diagnostico'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-[#7c3aed] text-[#7c3aed]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'configs' ? 'Configuracoes'
              : t === 'padroes' ? 'Padrões'
              : t === 'assignments' ? 'Atribuicoes Recentes' : 'Diagnóstico'}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openDuplicate(c)}
                    title="Cria uma distribuição nova com os mesmos ajustes desta — sem o número e sem os corretores"
                  >
                    <Copy className="h-4 w-4" />
                    Criar a partir de
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

      {/* PADRÕES DA CASA.
          O que toda roleta NOVA já vem preenchida, para o gestor parar de
          redigitar o número dele, o grupo, o prazo e os quatro textos a cada
          roleta. Não é uma tela de edição: os valores são capturados do
          formulário de uma roleta (botão "Salvar como padrão"), porque o grupo
          de avisos só pode ser escolhido depois de haver uma instância — e o
          seletor de grupos vive lá. Uma tela isolada mostraria lista vazia. */}
      {tab === 'padroes' && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <h2 className="font-medium">O que a roleta nova já vem preenchida</h2>
            <p className="text-sm text-muted-foreground">
              Estes valores são copiados para toda distribuição <strong>nova</strong> que você criar.
              As que já existem <strong>não mudam</strong> — nem agora, nem quando você trocar os
              padrões: cada uma guarda os próprios valores.
            </p>
            <p className="text-sm text-muted-foreground">
              Para definir: abra uma distribuição (ou crie uma), deixe os campos do jeito que você
              quer que os próximos nasçam, e clique em <strong>Salvar como padrão</strong> no fim do
              formulário.
            </p>
          </div>

          {Object.keys(padroes).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum padrão definido ainda. Toda distribuição nova nasce com os campos em branco.
            </p>
          ) : (
            <div className="rounded-lg border divide-y">
              {([
                ['Número do gestor', padroes.gestor_whatsapp_number],
                ['Grupo de avisos', padroes.gestor_group_jid],
                ['Instância que envia os avisos',
                  inboxes.find(i => i.id === padroes.notification_inbox_id)?.name ?? padroes.notification_inbox_id],
                ['Prazo de aceite', padroes.timeout_minutes != null ? `${padroes.timeout_minutes} min` : null],
                ['Horário de funcionamento',
                  padroes.business_hours_config?.mode === 'custom' ? 'Faixa própria' : null],
                ['Aviso do corretor', padroes.msg_corretor_enabled === false ? 'desligado' : null],
                ['Aviso do gestor', padroes.msg_gestor_enabled === false ? 'desligado' : null],
                ['Aviso do grupo', padroes.msg_grupo_enabled === false ? 'desligado' : null],
                ['Aviso de repasse no grupo', padroes.msg_grupo_repasse_enabled === false ? 'desligado' : null],
                ['Textos próprios', [
                  padroes.msg_corretor_template && 'corretor',
                  padroes.msg_gestor_template && 'gestor',
                  padroes.msg_grupo_template && 'grupo',
                  padroes.msg_grupo_repasse_template && 'repasse',
                ].filter(Boolean).join(', ') || null],
              ] as [string, string | null | undefined][])
                .filter(([, valor]) => valor)
                .map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex items-center justify-between gap-4 p-3 text-sm">
                    <span className="text-muted-foreground">{rotulo}</span>
                    <span className="font-medium text-right break-all">{valor}</span>
                  </div>
                ))}
            </div>
          )}

          {Object.keys(padroes).length > 0 && (
            <Button variant="outline" onClick={limparPadroes} disabled={salvandoPadroes}>
              Apagar padrões
            </Button>
          )}
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
              <div className="flex items-center gap-3">
                {/* Só na oferta EM ABERTO: é a única que ainda tem prazo correndo
                    e corretor esperando — nas demais não há o que tirar. */}
                {a.status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTirandoDaRoleta({
                      contactId: String(a.contact_id),
                      nome: a.contact_name ?? a.contact_phone ?? 'Lead',
                    })}
                  >
                    Tirar da roleta
                  </Button>
                )}
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[a.status]}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTimeBR(a.assigned_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {tirandoDaRoleta && (
            <RemoveFromRoletaDialog
              open
              onOpenChange={(aberto) => { if (!aberto) setTirandoDaRoleta(null); }}
              contactId={tirandoDaRoleta.contactId}
              leadName={tirandoDaRoleta.nome}
              onDone={loadAssignments}
            />
          )}
        </div>
      )}

      {tab === 'diagnostico' && (
        <div className="space-y-3">
          {/* Quem está de fato concorrendo. Vem do backend, não do formulário: a
              tela de configuração mostra quem foi ESCOLHIDO, e aqui aparece quem
              o sorteio realmente alcança — a diferença entre os dois é a causa
              silenciosa de "por que fulano nunca recebe lead?". */}
          {/* Não conseguiu carregar: uma linha discreta, com o botão de tentar de
              novo. Some de vez só quando a resposta vem certa e vazia — aí a
              informação verdadeira é "não há roleta", e ela já está na aba
              Configurações. */}
          {!loadingQueue && queueError && (
            <div className="border rounded-lg p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Não consegui carregar quem está recebendo lead hoje. Pode ser permissão do seu cargo
                (Gerente e Administrador enxergam) ou uma falha momentânea.
              </p>
              <Button variant="outline" size="sm" onClick={loadQueue} className="shrink-0">
                Tentar de novo
              </Button>
            </div>
          )}

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
                        {/* O NOME da roleta vem primeiro; o número entra como
                            legenda. Antes só havia o nome do número de entrada, e
                            quem tem várias roletas via blocos quase idênticos sem
                            saber de qual eram. */}
                        <span className="text-sm font-medium">{r.nome ?? r.instancia ?? r.id}</span>
                        {r.instancia && r.instancia !== r.nome && (
                          <span className="text-xs text-muted-foreground">· {r.instancia}</span>
                        )}
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
                      {/* De QUAL roleta é esta linha. O backend já mandava e a
                          tela não mostrava: com várias roletas, "o lead não
                          entrou" sem dizer onde não é diagnóstico. */}
                      {d.roleta && <span>Roleta: {d.roleta}</span>}
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
            {/* COMO ESTA ROLETA FUNCIONA — só na criação, e só para quem tem a
                roleta multinúmero liberada.
                Ao EDITAR não aparece: o modelo é derivado do que está gravado, e
                trocá-lo ali seria apagar ou criar números por baixo. Quem quiser
                mudar mexe direto no bloco de números.
                Sem a liberação também não aparece: existiria um cartão só, e
                cartão único não é escolha — é enfeite. */}
            {!editing && multiEnabled && (
              <div className="lg:col-span-2">
                <UILabel className="mb-2 flex items-center gap-1.5">
                  <Shuffle className="h-4 w-4" />
                  Como esta roleta funciona *
                </UILabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    {
                      v: false,
                      titulo: 'Número compartilhado',
                      texto: 'Um WhatsApp só, e vários corretores atendendo por ele.',
                    },
                    {
                      v: true,
                      titulo: 'Um número por corretor',
                      texto: 'Cada corretor atende pelo WhatsApp dele. A roleta sorteia entre eles.',
                    },
                  ] as const).map(op => (
                    <button
                      key={String(op.v)}
                      type="button"
                      onClick={() => setModeloMulti(op.v)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        modeloMulti === op.v
                          ? 'border-[#7c3aed] bg-[#7c3aed]/5'
                          : 'border-border hover:border-[#7c3aed]/50'
                      }`}
                    >
                      <span className="block text-sm font-medium">{op.titulo}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{op.texto}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!mostrarNumeros && (
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
            {mostrarNumeros && (
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

            {/* QUEM ENTRA NA ROLETA — lista de marcar.
                Substituiu a linha-a-linha (Adicionar → escolher na lista →
                escolher o número → conferir o peso, uma vez por pessoa). O
                gestor marca os nomes e acabou: o peso entra no padrão e o
                número em que cada um atende é resolvido quando não há dúvida.
                A lista mostra a EQUIPE INTEIRA, com quem não tem acesso ao
                número em cinza — mostrar só quem já tem acesso é o que fazia o
                corretor "sumir" da lista sem o gestor entender por quê. */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <UILabel className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Quem entra na roleta
                </UILabel>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {members.length} {members.length === 1 ? 'escolhido' : 'escolhidos'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarPesos(v => !v)}
                    className="text-[#7c3aed] hover:underline"
                  >
                    {mostrarPesos ? 'Ocultar pesos' : 'Ajustar peso'}
                  </button>
                </div>
              </div>

              {!inboxId ? (
                <p className="text-sm text-muted-foreground">
                  Escolha o número da roleta primeiro — a lista mostra quem atende por ele.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={buscaCorretor}
                      onChange={e => setBuscaCorretor(e.target.value)}
                      placeholder="Buscar pessoa..."
                      className="max-w-xs"
                    />
                    <button
                      type="button"
                      onClick={() => equipeFiltrada
                        .filter(u => !u.semAcesso && !u.membro)
                        .forEach(u => marcarCorretor(u.id, true))}
                      className="text-xs text-[#7c3aed] hover:underline"
                    >
                      Marcar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setMembers([])}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Limpar
                    </button>
                  </div>

                  {loadingMembers && (
                    <p className="mt-2 text-xs text-muted-foreground">Carregando a equipe...</p>
                  )}

                  <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border divide-y">
                    {equipeFiltrada.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground">
                        {buscaCorretor.trim() ? 'Ninguém com esse nome.' : 'Nenhuma pessoa na equipe.'}
                      </p>
                    )}
                    {equipeFiltrada.map(u => {
                      const m = u.membro;
                      return (
                        <div key={u.id} className="p-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-[#7c3aed]"
                              checked={!!m}
                              disabled={u.semAcesso && !m}
                              onChange={e => marcarCorretor(u.id, e.target.checked)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-sm ${u.semAcesso && !m ? 'text-muted-foreground' : ''}`}>
                                  {u.name}
                                </span>
                                {m && !m.is_active && (
                                  <span className="text-xs text-amber-500">pausado</span>
                                )}
                              </div>
                              {/* Uma linha só, dizendo o que já está resolvido —
                                  ou o que impede. */}
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {u.semAcesso && !m
                                  ? `Sem acesso a ${instanceName(inboxId)} — não pode receber lead por ele.`
                                  : m
                                    ? [
                                      isMulti ? `atende pelo ${instanceName(memberInbox(m))}` : null,
                                      (m.personal_whatsapp_number ?? '').trim()
                                        ? `avisado no ${(m.personal_whatsapp_number ?? '').trim()}`
                                        : (m.whatsapp_from_profile ?? '').trim()
                                          ? `avisado no ${(m.whatsapp_from_profile ?? '').trim()} (do cadastro)`
                                          : 'sem WhatsApp — recebe a oferta pelo app',
                                    ].filter(Boolean).join(' · ')
                                    : 'Tem acesso ao número. Marque para incluir na roleta.'}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {u.semAcesso && !m && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={liberandoId === u.id}
                                  onClick={() => liberarEAdicionar(u.id, inboxId)}
                                >
                                  {liberandoId === u.id ? 'Liberando...' : 'Liberar e adicionar'}
                                </Button>
                              )}
                              {m && (
                                <button
                                  type="button"
                                  title={m.is_active ? 'Pausar (fica na roleta e para de receber)' : 'Voltar a receber'}
                                  onClick={() => updateMember(m.localId, 'is_active', !m.is_active)}
                                  className={m.is_active ? 'text-green-500' : 'text-amber-500'}
                                >
                                  {m.is_active
                                    ? <ToggleRight className="h-5 w-5" />
                                    : <ToggleLeft className="h-5 w-5" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Só aparece o que ainda é PERGUNTA: o número, quando
                              a pessoa tem acesso a mais de um; o peso, quando o
                              gestor abriu os pesos. */}
                          {m && (u.acessos.length > 1 || mostrarPesos) && (
                            <div className="mt-2 grid grid-cols-1 gap-3 pl-7 sm:grid-cols-2">
                              {u.acessos.length > 1 && (
                                <div>
                                  <UILabel className="text-xs">Atende pelo número</UILabel>
                                  <div className="mt-1">
                                    <NativeSelect
                                      value={memberInbox(m)}
                                      onChange={e => updateMember(m.localId, 'inbox_id', e.target.value)}
                                    >
                                      {u.acessos.map(id => (
                                        <option key={id} value={id}>{instanceName(id)}</option>
                                      ))}
                                    </NativeSelect>
                                  </div>
                                </div>
                              )}
                              {mostrarPesos && (
                                <div>
                                  <UILabel className="text-xs">
                                    {mostrarNumeros ? 'Peso do número dele' : 'Peso'}
                                  </UILabel>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={pesoDe(m)}
                                    onChange={e => setPesoDe(m, parseInt(e.target.value) || 0)}
                                    className="mt-1"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* O WhatsApp da roleta é a EXCEÇÃO. Fica atrás dos
                              pesos porque quase ninguém precisa dele: o número
                              vem do cadastro da pessoa, em Equipe. */}
                          {m && mostrarPesos && (
                            <div className="mt-2 pl-7">
                              <UILabel className="text-xs">
                                Avisar em outro número (só nesta roleta)
                              </UILabel>
                              <Input
                                value={m.personal_whatsapp_number}
                                onChange={e => updateMember(m.localId, 'personal_whatsapp_number', e.target.value)}
                                placeholder={(m.whatsapp_from_profile ?? '').trim() || 'Ex.: 11 99999-0000'}
                                className="mt-1 max-w-xs"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {totalWeight > 0 && members.length > 1 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {/* Percentual EFETIVO: com dois números ele é o produto
                          das duas fatias. Mostrar só peso/soma faria o gestor
                          ler números que não acontecem. */}
                      {isMulti ? 'Distribuição real (número × corretor):' : 'Distribuição real:'}
                      {members.filter(m => m.is_active && m.user_id).map(m => {
                        const pct = effectivePct(m);
                        const nome = userName(m.user_id);
                        if (pct === null) return ` ${nome} —`;
                        return isMulti
                          ? ` ${nome} (${instanceName(memberInbox(m))}) ${pct.toFixed(0)}%`
                          : ` ${nome} ${pct.toFixed(0)}%`;
                      })}
                    </div>
                  )}
                </>
              )}
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

          {/* AVISO, não impedimento. Corretor sem WhatsApp em lugar nenhum é
              configuração legítima — ele entra na roleta e recebe a oferta pelo
              app. Barrar o salvamento por isso impediria quem ainda não
              cadastrou o número de todo mundo de configurar a roleta. */}
          {avisosDoFormulario().length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Dá para salvar, mas confira
              </div>
              <ul className="mt-2 space-y-1 pl-6 text-amber-200/90 list-disc">
                {avisosDoFormulario().map((aviso, i) => <li key={i}>{aviso}</li>)}
              </ul>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {/* Os padrões ficam à ESQUERDA, separados do Salvar: eles não salvam
                esta roleta, e o gestor não pode achar que salvou clicando aqui. */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={salvarComoPadrao} disabled={salvandoPadroes}>
                {salvandoPadroes ? 'Salvando...' : 'Salvar como padrão'}
              </Button>
              {editing && Object.keys(padroes).length > 0 && (
                <Button variant="ghost" onClick={() => aplicarPadroes(padroes)}>
                  Preencher com os padrões
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white gap-2">
                {saving ? 'Salvando...' : <><Save className="h-4 w-4" /> Salvar</>}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      {dialogoDeConfirmacao}
    </>
  );
}
