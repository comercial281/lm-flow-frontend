import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label as UILabel,
  Textarea,
} from '@/components/ui/ds';
import {
  Plus,
  CalendarClock,
  Building2,
  User as UserIcon,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Star,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  MessageSquare,
  CalendarOff,
} from 'lucide-react';
import {
  visitsService,
  Visit,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_COLORS,
} from '@/services/visits/visitsService';

import { ScheduleVisitDialog } from '@/components/visits/ScheduleVisitDialog';
import { HorarioVisitaDialog } from '@/components/visits/HorarioVisitaDialog';
import { FolgasDialog } from '@/components/visits/FolgasDialog';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { useAgendaLigada } from '@/features/visits/useAgendaLigada';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import { telefone, hora } from '@/lib/formato';
import { lerFiltroAgenda, type FiltroAgenda } from '@/features/dashboard/links';
import { ChipDaDashboard } from '@/features/dashboard/ChipDaDashboard';
import { intervaloDosDias, rotuloContador, lerContador } from '@/features/visits/contagem';
import type { AgendaSettings } from '@/features/visits/agenda';
import {
  type VisaoCalendario,
  blocosDoDia,
  diasDaVisao,
  faixaAberta,
  horaDeAbertura,
  horarioDoClique,
  limitesDaVisao,
  navegar,
  periodoDoContador,
  tituloDaVisao,
} from '@/features/visits/gradeDoCalendario';
import { acaoDaVisita, temRetorno, type AcaoDaVisita } from '@/features/visits/acaoDaVisita';

const FILTER_TABS = [
  { key: '', label: 'Todas' },
  { key: 'scheduled', label: 'Agendadas' },
  { key: 'confirmed', label: 'Confirmadas' },
  { key: 'completed', label: 'Realizadas' },
  { key: 'cancelled', label: 'Canceladas' },
];

function groupByDate(visits: Visit[]): Map<string, Visit[]> {
  const map = new Map<string, Visit[]>();
  visits.forEach(v => {
    const date = new Date(v.scheduled_at).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(v);
  });
  return map;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return d.toDateString() === t.toDateString();
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}

type ViewMode = 'calendar' | 'list';

// Mês / Semana / Dia fica guardado no navegador (conveniência de quem usa).
const CHAVE_VISAO = 'lm-visitas-visao';
function lerVisao(): VisaoCalendario {
  try {
    const v = localStorage.getItem(CHAVE_VISAO);
    return v === 'semana' || v === 'dia' ? v : 'mes';
  } catch {
    return 'mes';
  }
}

// Pill de evento por status — cores espelhando o protótipo (accent/info/warn/good).
const PILL_STYLES: Record<string, string> = {
  scheduled:   'text-violet-300 bg-violet-500/15 hover:bg-violet-500/25',
  confirmed:   'text-blue-300 bg-blue-500/15 hover:bg-blue-500/25',
  in_progress: 'text-orange-300 bg-orange-500/15 hover:bg-orange-500/25',
  completed:   'text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25',
  rescheduled: 'text-amber-300 bg-amber-500/15 hover:bg-amber-500/25',
  cancelled:   'text-red-300 bg-red-500/15 hover:bg-red-500/25',
  no_show:     'text-gray-400 bg-gray-500/15 hover:bg-gray-500/25',
};
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Calendário de mês idêntico ao protótipo: grade 7 colunas, células com dia +
 *  pills coloridos por status. Dados reais das visitas. */
function MonthGrid({ date, visits, onDayClick, onVisitClick, destacadaId }: {
  date: Date;
  visits: Visit[];
  onDayClick: (d: Date) => void;
  onVisitClick: (v: Visit) => void;
  /** Visita que veio pelo link: ganha contorno. */
  destacadaId?: string | null;
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const today = new Date();

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay = new Map<string, Visit[]>();
  visits.forEach(v => {
    const k = dayKey(new Date(v.scheduled_at));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(v);
  });

  const cells: Array<{ date: Date; out: boolean }> = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ date: new Date(year, month, 1 - (firstDow - i)), out: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), out: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), out: true });
  }

  return (
    <div>
      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {DOW.map(d => (
          <div key={d} className="text-[10.5px] font-semibold uppercase text-muted-foreground text-center pb-0.5">{d}</div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell, i) => {
          const dayVisits = (byDay.get(dayKey(cell.date)) || [])
            .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
          const isTodayCell = cell.date.toDateString() === today.toDateString();
          return (
            <div
              key={i}
              onClick={() => onDayClick(cell.date)}
              className={`min-h-[96px] rounded-[10px] border p-2 flex flex-col gap-1 cursor-pointer transition-colors ${
                cell.out ? 'opacity-40 bg-muted/20 border-border/50' : 'bg-muted/30 border-border hover:border-primary/40'
              } ${isTodayCell ? '!border-primary !bg-primary/10' : ''}`}
            >
              <span className={`text-[12.5px] font-semibold ${isTodayCell ? 'text-primary' : 'text-muted-foreground'}`}>
                {cell.date.getDate()}
              </span>
              {dayVisits.slice(0, 3).map(v => {
                const time = new Date(v.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const who = v.contact?.name || v.property?.title || 'Visita';
                return (
                  <button
                    key={v.id}
                    id={`visita-${v.id}`}
                    onClick={e => { e.stopPropagation(); onVisitClick(v); }}
                    className={`text-[10px] font-semibold px-1.5 py-[3px] rounded-md truncate text-left transition-colors ${PILL_STYLES[v.status] || PILL_STYLES.scheduled} ${destacadaId === v.id ? 'ring-2 ring-primary' : ''}`}
                    title={`${time} · ${who}`}
                  >
                    {time} · {who}
                  </button>
                );
              })}
              {dayVisits.length > 3 && (
                <span className="text-[10px] text-muted-foreground pl-1">+{dayVisits.length - 3} mais</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ALTURA_HORA = 48;
const HORAS = Array.from({ length: 24 }, (_, h) => h);

/** Barra do calendário: Hoje, ‹ ›, o período e Mês / Semana / Dia (como na Lais). */
function BarraDoCalendario({ visao, date, onVisao, onNavigate }: {
  visao: VisaoCalendario;
  date: Date;
  onVisao: (v: VisaoCalendario) => void;
  onNavigate: (d: Date) => void;
}) {
  const nomes: Record<VisaoCalendario, { anterior: string; proximo: string }> = {
    mes: { anterior: 'Mês anterior', proximo: 'Próximo mês' },
    semana: { anterior: 'Semana anterior', proximo: 'Próxima semana' },
    dia: { anterior: 'Dia anterior', proximo: 'Próximo dia' },
  };
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div className="flex items-center gap-2 min-w-0">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onNavigate(new Date())}>Hoje</Button>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onNavigate(navegar(visao, date, -1))} aria-label={nomes[visao].anterior} title={nomes[visao].anterior}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onNavigate(navegar(visao, date, 1))} aria-label={nomes[visao].proximo} title={nomes[visao].proximo}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-1 h-6 rounded-full shrink-0 ml-1" style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }} />
        <h2 className="text-base font-bold truncate">{tituloDaVisao(visao, date)}</h2>
      </div>
      <div className="inline-flex rounded-md border border-border bg-background p-0.5" role="group" aria-label="Visão do calendário">
        {VISOES.map(v => (
          <button
            key={v.key}
            type="button"
            aria-pressed={visao === v.key}
            onClick={() => onVisao(v.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
              visao === v.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const VISOES: { key: VisaoCalendario; label: string }[] = [
  { key: 'mes', label: 'Mês' },
  { key: 'semana', label: 'Semana' },
  { key: 'dia', label: 'Dia' },
];

const mesmoDiaQue = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Identifica o período na tela (a visão + o primeiro dia dela). */
const chaveDoPeriodo = (visao: VisaoCalendario, d: Date) => `${visao}-${limitesDaVisao(visao, d).primeiro.toDateString()}`;

/** Grade de horas da Semana e do Dia: colunas por dia, visitas em blocos pelo horário e duração. */
function GradeDeHoras({ visao, date, visits, carregadoPara, podeAgendar, ajustes, onDayHeaderClick, onSlotClick, onVisitClick, destacadaId }: {
  visao: 'semana' | 'dia';
  date: Date;
  visits: Visit[];
  /** Período da última lista que chegou (`chaveDoPeriodo`): só rola com a lista certa na mão. */
  carregadoPara: string | null;
  /** Sem permissão de agendar, clicar na grade não abre nada. */
  podeAgendar: boolean;
  /** Horário de visita da Agenda (agenda ligada): o que fica fora dele sai em cinza. */
  ajustes: AgendaSettings | null;
  onDayHeaderClick: (d: Date) => void;
  onSlotClick: (inicio: Date) => void;
  onVisitClick: (v: Visit) => void;
  destacadaId?: string | null;
}) {
  const dias = diasDaVisao(visao, date);
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const blocosPorDia = dias.map(d => blocosDoDia(visits, d));

  // Rola até a primeira visita (ou o começo do horário de visita) UMA vez por
  // período, depois que a lista dele chega. Recarregar a mesma semana (agendar,
  // cancelar) não tira a pessoa de onde ela estava.
  const rolagem = useRef<HTMLDivElement>(null);
  const rolouPara = useRef<string | null>(null);
  const chave = chaveDoPeriodo(visao, date);
  useLayoutEffect(() => {
    if (carregadoPara !== chave || rolouPara.current === chave || !rolagem.current) return;
    rolouPara.current = chave;
    const inicioDoHorario = ajustes ? Number(ajustes.start.split(':')[0]) * 60 : undefined;
    rolagem.current.scrollTop = horaDeAbertura(blocosPorDia.flat(), inicioDoHorario) * ALTURA_HORA;
  });

  const colunas = `3.5rem repeat(${dias.length}, minmax(0, 1fr))`;

  return (
    <div ref={rolagem} className="relative overflow-auto rounded-[10px] border border-border max-h-[calc(100dvh-300px)] min-h-[420px]">
      <div className={visao === 'semana' ? 'min-w-[640px]' : ''}>
        {visao === 'semana' && (
          <div className="grid sticky top-0 z-20 bg-card border-b border-border" style={{ gridTemplateColumns: colunas }}>
            <div />
            {dias.map(d => {
              const hoje = mesmoDiaQue(d, agora);
              return (
                <button
                  key={d.toDateString()}
                  type="button"
                  onClick={() => onDayHeaderClick(d)}
                  className={`py-2 flex flex-col items-center border-l border-border transition-colors hover:bg-muted/40 ${hoje ? 'text-primary' : 'text-muted-foreground'}`}
                  aria-label={`Ver o dia ${d.getDate()}`}
                  title={`Ver o dia ${d.getDate()}`}
                >
                  <span className="text-[10.5px] font-semibold uppercase">{DOW[d.getDay()]}</span>
                  <span className={`text-lg leading-tight ${hoje ? 'font-bold' : 'font-medium text-foreground'}`}>{d.getDate()}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="grid relative" style={{ gridTemplateColumns: colunas, height: 24 * ALTURA_HORA }}>
          {/* Horas */}
          <div className="relative">
            {HORAS.map(h => (
              <span
                key={h}
                className="absolute right-2 text-[11px] text-muted-foreground tabular-nums"
                style={{ top: h === 0 ? 2 : h * ALTURA_HORA - 7 }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {dias.map((d, i) => {
            const hoje = mesmoDiaQue(d, agora);
            const faixa = ajustes ? faixaAberta(d, ajustes) : undefined;
            const agoraMin = agora.getHours() * 60 + agora.getMinutes();
            return (
              <div
                key={d.toDateString()}
                className={`relative border-l border-border ${podeAgendar ? 'cursor-pointer' : ''} ${hoje ? 'bg-primary/5' : ''}`}
                onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onSlotClick(horarioDoClique(d, e.clientY - r.top, ALTURA_HORA));
                }}
              >
                {/* Fora do horário de visita (agenda ligada): cinza */}
                {faixa === null && <div className="absolute inset-0 bg-muted/50 pointer-events-none" />}
                {faixa && faixa.de > 0 && (
                  <div className="absolute inset-x-0 top-0 bg-muted/50 pointer-events-none" style={{ height: (faixa.de / 60) * ALTURA_HORA }} />
                )}
                {faixa && faixa.ate < 24 * 60 && (
                  <div className="absolute inset-x-0 bottom-0 bg-muted/50 pointer-events-none" style={{ top: (faixa.ate / 60) * ALTURA_HORA }} />
                )}

                {HORAS.map(h => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/70 pointer-events-none" style={{ top: h * ALTURA_HORA }} />
                ))}

                {blocosPorDia[i].map(b => {
                  const v = b.visita;
                  const inicio = new Date(v.scheduled_at);
                  const fim = new Date(inicio.getTime() + b.duracaoMin * 60000);
                  const time = hora(inicio);
                  const who = v.contact?.name || v.property?.title || 'Visita';
                  const altura = Math.max((b.duracaoMin / 60) * ALTURA_HORA - 2, 20);
                  const detalhe = [
                    `${time}–${hora(fim)}`,
                    who,
                    v.realtor?.name ? `Corretor: ${v.realtor.name}` : null,
                    VISIT_STATUS_LABELS[v.status] ?? v.status,
                  ].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={v.id}
                      id={`visita-${v.id}`}
                      type="button"
                      onClick={e => { e.stopPropagation(); onVisitClick(v); }}
                      className={`absolute z-10 rounded-md px-1.5 py-1 text-left overflow-hidden border border-border/60 transition-colors ${PILL_STYLES[v.status] || PILL_STYLES.scheduled} ${destacadaId === v.id ? 'ring-2 ring-primary' : ''}`}
                      style={{
                        top: (b.inicioMin / 60) * ALTURA_HORA + 1,
                        height: altura,
                        left: `calc(${(b.coluna / b.colunas) * 100}% + 2px)`,
                        width: `calc(${100 / b.colunas}% - 4px)`,
                      }}
                      title={detalhe}
                      aria-label={detalhe}
                    >
                      {altura < 36 ? (
                        <span className="block text-[10.5px] font-semibold truncate">{time} · {who}</span>
                      ) : (
                        <>
                          <span className="block text-[10.5px] opacity-80 tabular-nums">{time}</span>
                          <span className="block text-[11.5px] font-semibold truncate">{who}</span>
                        </>
                      )}
                    </button>
                  );
                })}

                {/* Agora */}
                {hoje && (
                  <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: (agoraMin / 60) * ALTURA_HORA }}>
                    <div className="relative h-0.5 bg-primary">
                      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-primary" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Visits() {
  const canCreate = useFeature('visits_create');
  // Agenda do corretor (horário de visita + folgas): ligada quando o servidor
  // diz (`GET /visit_settings`). Sem resposta, desligada ou erro: sem os botões.
  const agenda = useAgendaLigada();
  const agendaLigada = agenda.ligada === true;
  const [visits, setVisits]         = useState<Visit[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState('');
  // O estado inicial do modo respeita o link: chegando com filtro, abre na lista.
  const [viewMode, setViewMode]     = useState<ViewMode>(() => {
    const f = lerFiltroAgenda(new URLSearchParams(window.location.search));
    return f && Object.keys(f.params).length > 0 ? 'list' : 'calendar';
  });
  const [recusado, setRecusado]     = useState(false);

  const [calDate, setCalDate]       = useState<Date>(new Date());
  const [visaoCal, setVisaoCal]     = useState<VisaoCalendario>(lerVisao);
  // Período da última lista que chegou do calendário (a grade de horas espera
  // por ela para rolar até a primeira visita).
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // Filtro que veio de um clique na Dashboard (?situacao=, ?desde=, ?visita=).
  const [filtroLink, setFiltroLink] = useState<FiltroAgenda | null>(() => lerFiltroAgenda(searchParams));
  const [soMinhas, setSoMinhas] = useState(false);
  // `soMinhas` nasce false: até a 1ª resposta, o corretor pareceria gestor e
  // veria o botão "Horário de visita" piscar. Os botões da agenda esperam isto.
  const [cargoConhecido, setCargoConhecido] = useState(false);
  const [horarioAberto, setHorarioAberto] = useState(false);
  const [folgasAbertas, setFolgasAbertas] = useState(false);
  // Só o servidor novo entende o mês pedido; o antigo devolve a história toda,
  // e aí o rótulo não pode dizer "em setembro".
  const [servidorNovo, setServidorNovo] = useState(false);
  const temFiltroNoLink = !!filtroLink && Object.keys(filtroLink.params).length > 0;

  const [modalOpen, setModalOpen]   = useState(false);
  const [diaDoModal, setDiaDoModal] = useState<Date | null>(null);
  const [inicioDoModal, setInicioDoModal] = useState<Date | null>(null);

  const [actionModal, setActionModal] = useState<{ visit: Visit; action: AcaoDaVisita } | null>(null);
  const [rating, setRating]           = useState(0);
  const [feedback, setFeedback]       = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  // Visita cujo resumo (Confirmar / Realizada / Cancelar) está aberto pelo
  // clique no calendário. Guarda o id: o card lê a versão de `visits`, então
  // Confirmar atualiza o resumo sem fechar.
  const [resumoId, setResumoId] = useState<string | null>(null);
  const visitaDoResumo = resumoId ? visits.find(v => v.id === resumoId) ?? null : null;

  // Abre um diálogo de ação. "Dar retorno" já vem com a nota e o comentário que
  // a visita tem; os outros começam vazios.
  const abrirAcao = (visit: Visit, action: AcaoDaVisita) => {
    setRating(action === 'retorno' ? (visit.rating ?? 0) : 0);
    setFeedback(action === 'retorno' ? (visit.feedback_notes ?? '') : '');
    setCancelReason('');
    setActionModal({ visit, action });
  };

  const handleVisitClick = (visit: Visit) => {
    const acao = acaoDaVisita(visit, 'clique');
    if (acao === 'resumo') setResumoId(visit.id);
    else if (acao) abrirAcao(visit, acao);
    else toast.info(`Visita ${VISIT_STATUS_LABELS[visit.status] ?? visit.status}`);
  };

  // Trocar de mês rápido (‹ › ‹ ›) dispara pedidos que se cruzam: só a resposta
  // do pedido mais recente entra na tela, senão outubro chega atrasado e o
  // contador diz "N visitas em novembro" com o N de outubro.
  const ultimoPedido = useRef(0);

  const load = useCallback(async (status = activeTab) => {
    const pedido = ++ultimoPedido.current;
    const atual = () => pedido === ultimoPedido.current;
    setLoading(true);
    setRecusado(false);
    try {
      // No calendário, pede SÓ o período visível (mês, semana ou dia): é o
      // escopo do contador do cabeçalho. Com o período inteiro (sem aba de
      // situação), o contador soma as
      // visitas ATIVAS (meta.active_total, sem canceladas) — a grade continua
      // desenhando a pílula cancelada, então o número pode ficar menor que a
      // quantidade de pílulas. Na lista, o que o link ou a aba pedirem, e o
      // contador é o total do que veio. Regra em features/visits/contagem.ts.
      const doMes = viewMode === 'calendar' && !temFiltroNoLink
        ? (() => {
          const { primeiro, ultimo } = limitesDaVisao(visaoCal, calDate);
          const p = intervaloDosDias(primeiro, ultimo);
          return { since: p.desde, until: p.ate };
        })()
        : {};
      const res = await visitsService.list({
        status: status || undefined,
        ...doMes,
        ...(filtroLink?.params ?? {}),
        per_page: 500,
      });
      if (!atual()) return;
      setVisits(res.data ?? []);
      setCarregadoPara(viewMode === 'calendar' && !temFiltroNoLink ? chaveDoPeriodo(visaoCal, calDate) : null);
      const contador = lerContador(res.meta, {
        mesInteiro: viewMode === 'calendar' && !temFiltroNoLink && !status,
      });
      setTotal(contador.total);
      setServidorNovo(contador.servidorNovo);
      setSoMinhas(!!res.meta?.only_mine);
      setCargoConhecido(true);
    } catch (e) {
      if (!atual()) return;
      if (isForbiddenError(e)) setRecusado(true);
      else toast.error('Erro ao carregar visitas');
    } finally {
      if (atual()) setLoading(false);
    }
  }, [activeTab, viewMode, calDate, visaoCal, filtroLink, temFiltroNoLink]);

  useEffect(() => { load(); }, [viewMode, calDate, visaoCal, filtroLink]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocarVisao = (v: VisaoCalendario) => {
    try { localStorage.setItem(CHAVE_VISAO, v); } catch { /* sem armazenamento: só não lembra */ }
    // Do mês para a semana/dia: se hoje está no mês da tela, vai pra hoje
    // (senão o 1º do mês, que é onde a navegação do mês deixa a data).
    if (visaoCal === 'mes' && v !== 'mes') {
      const hoje = new Date();
      if (hoje.getFullYear() === calDate.getFullYear() && hoje.getMonth() === calDate.getMonth()) setCalDate(hoje);
    }
    setVisaoCal(v);
  };

  // A visita que veio pelo link fica com contorno por 2 s, e a tela rola até ela.
  const [visitaDestacada, setVisitaDestacada] = useState<string | null>(null);

  // ?visita= : MOSTRA a visita, não age sobre ela. Quem chega de "A confirmar"
  // quer o card com Confirmar / Realizada / Cancelar, não o diálogo de
  // "Confirmar realização" (que grava e dispara automação). Quando a visita está
  // fora do recorte carregado (ex.: "Próximas visitas" em 30/09 apontando pra
  // 02/10), busca pelo id e leva o calendário até o mês dela.
  const buscandoVisita = useRef<string | null>(null);
  useEffect(() => {
    const alvo = filtroLink?.visita;
    if (!alvo || loading) return;
    if (buscandoVisita.current === alvo) return; // já em voo pra este id

    // Tira o parâmetro do endereço uma única vez, aconteça o que acontecer. Lê o
    // endereço de agora (não o da primeira renderização), pra não ressuscitar
    // parâmetro que outra coisa já tirou.
    const limpar = () => {
      const resto = new URLSearchParams(window.location.search);
      resto.delete('visita');
      setSearchParams(resto, { replace: true });
      setFiltroLink(f => (f ? { ...f, visita: null } : f));
    };

    const mostrar = (v: Visit) => {
      // Exceções (regra em features/visits/acaoDaVisita.ts): visita que já passou
      // e segue Agendada/Confirmada abre o diálogo de "realizada"; Realizada é
      // mostrada e abre "Dar retorno" (é o que baixa "Visitas sem feedback").
      const acao = acaoDaVisita(v, 'link');
      if (acao === 'complete') {
        abrirAcao(v, 'complete');
        return;
      }
      // Sem filtro do link, o calendário vai pro período da visita (e recarrega
      // esse período). Com filtro, a pessoa fica na lista filtrada.
      if (!temFiltroNoLink) {
        const quando = new Date(v.scheduled_at);
        setCalDate(d => {
          const { primeiro, ultimo } = limitesDaVisao(visaoCal, d);
          const fimDoUltimo = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() + 1);
          return quando >= primeiro && quando < fimDoUltimo ? d : quando;
        });
      }
      setVisitaDestacada(v.id);
      if (acao === 'retorno') abrirAcao(v, 'retorno');
    };

    const naLista = visits.find(x => x.id === alvo);
    if (naLista) {
      mostrar(naLista);
      limpar();
      return;
    }

    buscandoVisita.current = alvo;
    visitsService.get(alvo)
      .then(mostrar)
      .catch(() => toast.error('Visita não encontrada'))
      .finally(() => {
        buscandoVisita.current = null;
        limpar();
      });
  }, [filtroLink?.visita, loading, visits]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rola até a visita destacada quando ela aparece na tela (o mês certo pode
  // ainda estar carregando) e solta o contorno depois de 2 s.
  useEffect(() => {
    if (!visitaDestacada || loading) return;
    const el = document.getElementById(`visita-${visitaDestacada}`);
    if (!el) return;
    el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setVisitaDestacada(null), 2000);
    return () => clearTimeout(t);
  }, [visitaDestacada, loading, visits]);

  const tirarFiltroLink = () => {
    setFiltroLink(null);
    setSearchParams({}, { replace: true });
  };

  const switchTab = (key: string) => {
    setActiveTab(key);
    load(key);
  };

  const openScheduleModal = (dia?: Date, inicio?: Date) => {
    setDiaDoModal(dia ?? null);
    setInicioDoModal(inicio ?? null);
    setModalOpen(true);
  };

  // Clique num dia (Mês) ou num horário (Semana/Dia). Dia que já passou não
  // abre: o servidor recusaria e o modal abriria com data vencida.
  const agendarNoCalendario = (d: Date, inicio?: Date) => {
    if (!canCreate) return;
    const hoje = new Date();
    if (d < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) return;
    openScheduleModal(new Date(d.getFullYear(), d.getMonth(), d.getDate()), inicio);
  };

  const handleConfirm = async (visit: Visit) => {
    try {
      const updated = await visitsService.confirm(visit.id);
      setVisits(prev => prev.map(v => v.id === updated.id ? updated : v));
      toast.success('Visita confirmada');
    } catch {
      toast.error('Erro ao confirmar visita');
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      let updated: Visit;
      if (actionModal.action === 'retorno') {
        // Só nota e comentário: não muda a data da realização nem dispara automação.
        updated = await visitsService.feedback(actionModal.visit.id, rating || undefined, feedback.trim() ? feedback : undefined);
        toast.success('Retorno salvo');
      } else if (actionModal.action === 'complete') {
        updated = await visitsService.complete(actionModal.visit.id, rating || undefined, feedback || undefined);
        toast.success('Visita marcada como realizada');
      } else {
        updated = await visitsService.cancel(actionModal.visit.id, cancelReason || undefined);
        toast.success('Visita cancelada');
      }
      setVisits(prev => prev.map(v => v.id === updated.id ? updated : v));
      // Cancelar tira a visita do contador (que não conta canceladas): recarrega.
      if (actionModal.action === 'cancel') load();
      setActionModal(null);
      setRating(0);
      setFeedback('');
      setCancelReason('');
    } catch (e) {
      if (actionModal.action === 'retorno') {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 422) toast.error('Não deu para salvar: o retorno só vale para visita realizada, com nota ou comentário');
        else if (status === 404) toast.error('Visita não encontrada');
        else toast.error('Erro ao salvar retorno');
      } else {
        toast.error('Erro ao executar ação');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const semNadaParaSalvar = actionModal?.action === 'retorno' && !rating && !feedback.trim();

  const grouped = groupByDate(visits);

  if (recusado) return <NoAccessState />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-start gap-3">
            <div
              className="w-1 h-9 rounded-full shrink-0"
              style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
            />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 leading-tight">
                <CalendarClock className="h-6 w-6 text-primary" />
                Agenda de Visitas
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {(() => {
                  const comPeriodo = servidorNovo && viewMode === 'calendar' && !temFiltroNoLink;
                  return rotuloContador(total, {
                    soMinhas,
                    mes: comPeriodo && visaoCal === 'mes' ? calDate : undefined,
                    periodo: comPeriodo && visaoCal !== 'mes' ? periodoDoContador(visaoCal, calDate) : undefined,
                  });
                })()}
              </p>
              {filtroLink?.rotulo && (
                <div className="mt-1.5">
                  <ChipDaDashboard rotulo={filtroLink.rotulo} onTirar={tirarFiltroLink} />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="inline-flex rounded-md border border-border bg-background p-0.5">
              <button
                onClick={() => {
                  // O calendário sempre mostra o mês visível inteiro — um filtro
                  // da Dashboard ativo (ex.: "A confirmar") não sobrevive à troca.
                  if (temFiltroNoLink) tirarFiltroLink();
                  setViewMode('calendar');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                  viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Calendário
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                  viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
            </div>
            {agendaLigada && cargoConhecido && !soMinhas && (
              <Button variant="outline" onClick={() => setHorarioAberto(true)}>
                <Clock className="h-4 w-4 mr-2" />
                Horário de visita
              </Button>
            )}
            {agendaLigada && cargoConhecido && (
              <Button variant="outline" onClick={() => setFolgasAbertas(true)}>
                <CalendarOff className="h-4 w-4 mr-2" />
                {soMinhas ? 'Minhas folgas' : 'Folgas'}
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => openScheduleModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Agendar visita
              </Button>
            )}
          </div>
        </div>

        {/* Filtros — só na lista */}
        {viewMode === 'list' && (
          <div className="flex gap-1 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {viewMode === 'calendar' ? (
          <div className="rounded-xl border bg-card p-4">
            <BarraDoCalendario visao={visaoCal} date={calDate} onVisao={trocarVisao} onNavigate={setCalDate} />
            {visaoCal === 'mes' ? (
              <MonthGrid
                date={calDate}
                visits={visits}
                onDayClick={d => agendarNoCalendario(d)}
                onVisitClick={handleVisitClick}
                destacadaId={visitaDestacada}
              />
            ) : (
              <GradeDeHoras
                visao={visaoCal}
                date={calDate}
                visits={visits}
                carregadoPara={carregadoPara}
                podeAgendar={canCreate}
                ajustes={agendaLigada ? agenda.ajustes : null}
                onDayHeaderClick={d => { setCalDate(d); trocarVisao('dia'); }}
                onSlotClick={inicio => agendarNoCalendario(inicio, inicio)}
                onVisitClick={handleVisitClick}
                destacadaId={visitaDestacada}
              />
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando visitas...
          </div>
        ) : visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarClock className="h-12 w-12 mb-3" />
            <p className="text-sm font-medium">Nenhuma visita encontrada</p>
            {canCreate && (
              <Button className="mt-4" onClick={() => openScheduleModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Agendar primeira visita
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {Array.from(grouped.entries()).map(([date, dayVisits]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`text-sm font-semibold capitalize ${
                    dayVisits.some(v => isToday(v.scheduled_at)) ? 'text-primary' : 'text-foreground'
                  }`}>
                    {date}
                  </div>
                  {dayVisits.some(v => isToday(v.scheduled_at)) && (
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">Hoje</Badge>
                  )}
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-3">
                  {dayVisits.map(visit => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      destacada={visitaDestacada === visit.id}
                      onConfirm={handleConfirm}
                      onComplete={() => abrirAcao(visit, 'complete')}
                      onCancel={() => abrirAcao(visit, 'cancel')}
                      onRetorno={() => abrirAcao(visit, 'retorno')}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ScheduleVisitDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        diaInicial={diaDoModal}
        inicioInicial={inicioDoModal}
        // Recarrega em vez de somar 1 na mão: a visita nova pode ser de outro mês
        // ou de outro corretor, e aí o contador do mês não muda.
        onCreated={() => load()}
      />

      {agendaLigada && (
        <>
          <HorarioVisitaDialog open={horarioAberto} onOpenChange={setHorarioAberto} />
          <FolgasDialog open={folgasAbertas} onOpenChange={setFolgasAbertas} soMinhas={soMinhas} />
        </>
      )}

      {/* Resumo da visita clicada no calendário: o mesmo card da Lista */}
      <Dialog open={!!visitaDoResumo} onOpenChange={aberto => { if (!aberto) setResumoId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {visitaDoResumo && new Date(visitaDoResumo.scheduled_at).toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </DialogTitle>
          </DialogHeader>
          {visitaDoResumo && (
            <VisitCard
              visit={visitaDoResumo}
              ancorada={false}
              onConfirm={handleConfirm}
              onComplete={v => { setResumoId(null); abrirAcao(v, 'complete'); }}
              onCancel={v => { setResumoId(null); abrirAcao(v, 'cancel'); }}
              onRetorno={v => { setResumoId(null); abrirAcao(v, 'retorno'); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Complete / Retorno / Cancel action modal */}
      <Dialog open={!!actionModal} onOpenChange={() => setActionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionModal?.action === 'complete'
                ? 'Marcar visita como realizada'
                : actionModal?.action === 'retorno' ? 'Dar retorno da visita' : 'Cancelar visita'}
            </DialogTitle>
          </DialogHeader>
          {actionModal?.action === 'complete' || actionModal?.action === 'retorno' ? (
            <div className="space-y-4 py-2">
              <div>
                <UILabel>Avaliação (1-5)</UILabel>
                <div className="flex gap-1 mt-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setRating(n)} aria-label={`Avaliar com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`} title={`Avaliar com ${n} ${n === 1 ? 'estrela' : 'estrelas'}`}>
                      <Star className={`h-6 w-6 ${n <= rating ? 'text-violet-400 fill-violet-400' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <UILabel>Feedback do cliente</UILabel>
                <Textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="Como foi a visita? Interesse do cliente?"
                  className="mt-1 resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="py-2">
              <UILabel>Motivo do cancelamento</UILabel>
              <Textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Opcional"
                className="mt-1 resize-none"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Voltar</Button>
            <Button
              variant={actionModal?.action === 'cancel' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={actionLoading || semNadaParaSalvar}
            >
              {actionLoading
                ? 'Salvando...'
                : actionModal?.action === 'complete'
                  ? 'Confirmar realização'
                  : actionModal?.action === 'retorno' ? 'Salvar retorno' : 'Cancelar visita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VisitCard({
  visit,
  destacada = false,
  ancorada = true,
  onConfirm,
  onComplete,
  onCancel,
  onRetorno,
}: {
  visit: Visit;
  /** Visita que veio pelo link: ganha contorno. */
  destacada?: boolean;
  /** Leva o id `visita-<id>` (alvo do destaque). O resumo do calendário não leva: a pílula já tem. */
  ancorada?: boolean;
  onConfirm: (v: Visit) => void;
  onComplete: (v: Visit) => void;
  onCancel: (v: Visit) => void;
  /** Realizada sem nota nem comentário: abre "Dar retorno". */
  onRetorno: (v: Visit) => void;
}) {
  const isPastVisit = isPast(visit.scheduled_at);
  const isActive = ['scheduled', 'confirmed', 'in_progress'].includes(visit.status);

  return (
    <div id={ancorada ? `visita-${visit.id}` : undefined} className={`flex gap-4 p-4 rounded-xl border border-border bg-card transition-shadow ${
      isPastVisit && isActive ? 'border-orange-300 dark:border-orange-700' : ''
    } ${destacada ? 'ring-2 ring-primary' : ''}`}>
      {/* Time column */}
      <div className="flex-shrink-0 w-16 text-center">
        <div className="text-lg font-bold text-foreground">
          {new Date(visit.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        {visit.duration_minutes && (
          <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            {visit.duration_minutes}min
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium ${VISIT_STATUS_COLORS[visit.status] ?? ''}`}>
              {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
            </span>
            {isPastVisit && isActive && (
              <span className="ml-2 text-xs text-orange-600 dark:text-orange-400 font-medium">Atrasada</span>
            )}
          </div>
          {visit.rating != null && (
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(n => (
                <Star key={n} className={`h-3.5 w-3.5 ${n <= (visit.rating ?? 0) ? 'text-violet-400 fill-violet-400' : 'text-muted-foreground'}`} />
              ))}
            </div>
          )}
        </div>

        {visit.property && (
          <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="truncate">{visit.property.title}</span>
            <span className="text-xs text-muted-foreground">· {visit.property.code}</span>
          </div>
        )}

        {visit.property && (visit.property.address_neighborhood || visit.property.address_city) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {[visit.property.address_neighborhood, visit.property.address_city].filter(Boolean).join(', ')}
          </div>
        )}

        {visit.contact && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <UserIcon className="h-3 w-3 flex-shrink-0" />
            <span>{visit.contact.name}</span>
            {visit.contact.phone_number && (
              <>
                <span>·</span>
                <Phone className="h-3 w-3" />
                <span>{telefone(visit.contact.phone_number)}</span>
              </>
            )}
          </div>
        )}

        {visit.realtor && (
          <div className="text-xs text-muted-foreground">Corretor: {visit.realtor.name}</div>
        )}

        {visit.realtor_notes && (
          <p className="text-xs text-muted-foreground mt-1 italic">{visit.realtor_notes}</p>
        )}

        {/* Actions */}
        {isActive && (
          <div className="flex gap-2 mt-3">
            {visit.status === 'scheduled' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onConfirm(visit)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Confirmar
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800"
              onClick={() => onComplete(visit)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Realizada
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800"
              onClick={() => onCancel(visit)}>
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Cancelar
            </Button>
          </div>
        )}
        {visit.status === 'completed' && !temRetorno(visit) && (
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRetorno(visit)}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Dar retorno
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
