import { useEffect, useState } from 'react';
import { Bot, Send, Timer, RotateCcw, Zap, Bell, Loader2 } from 'lucide-react';
import { formatSeconds } from './dashboardUtils';
import {
  automationsKpiService,
  type AutomationsKpiResponse,
} from '@/services/dashboard/automationsKpiService';
import type { CustomerDashboardParams } from '@/types/analytics/dashboard';

interface Card {
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  numColor: string;
  value: string;
  /** linha extra abaixo do número (taxa, fila, falhas) */
  footnote?: string;
}

function KpiCard({ card }: { card: Card }) {
  const Icon = card.icon;
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-card/60 p-5 backdrop-blur-sm min-h-[124px]">
      <div className="flex items-center gap-2.5">
        <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
          <Icon className={`h-4 w-4 ${card.iconColor}`} />
        </div>
        <p className="text-sm font-medium leading-tight text-muted-foreground">{card.label}</p>
      </div>
      <div>
        <p className={`text-3xl font-bold leading-none tracking-tight ${card.numColor}`}>{card.value}</p>
        <p className="mt-1.5 text-xs leading-tight text-muted-foreground">{card.description}</p>
        {card.footnote && (
          <p className="mt-1 text-xs leading-tight text-muted-foreground/70">{card.footnote}</p>
        )}
      </div>
    </div>
  );
}

/** Queda por passo: mostra onde o lead responde (ou o funil perde força). */
function StepFunnel({ steps }: { steps: AutomationsKpiResponse['step_funnel'] }) {
  if (!steps.length) return null;
  const max = Math.max(...steps.map(s => s.sent), 1);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/60 p-5 backdrop-blur-sm">
      <p className="text-sm font-medium">Disparos por passo do funil</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A queda entre um passo e o seguinte é o lead respondendo — quando responde, o resto é cancelado.
      </p>
      <div className="mt-4 space-y-2">
        {steps.map(s => (
          <div key={s.position} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">Passo {s.position}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
              <div
                className="h-full rounded-full bg-violet-500/70"
                style={{ width: `${(s.sent / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums">{s.sent}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SequenceBreakdown({ rows }: { rows: AutomationsKpiResponse['by_sequence'] }) {
  if (!rows.length) return null;
  const total = rows.reduce((acc, r) => acc + r.sent, 0) || 1;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/60 p-5 backdrop-blur-sm">
      <p className="text-sm font-medium">Disparos por funil</p>
      <div className="mt-4 space-y-2.5">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm text-muted-foreground">{r.name}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {r.sent}
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({Math.round((r.sent / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Quais regras mais dispararam. Uma regra concentrando quase tudo costuma ser
 *  reprocessamento (a mesma conversa avaliada de novo a cada rodada), não volume. */
function TopRules({ rows, total }: { rows: AutomationsKpiResponse['rules']['top']; total: number }) {
  if (!rows?.length) return null;
  const dominant = total > 0 && rows[0].fired / total > 0.8 && rows[0].fired > 500;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/60 p-5 backdrop-blur-sm">
      <p className="text-sm font-medium">Regras que mais dispararam</p>
      <div className="mt-4 space-y-2.5">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm text-muted-foreground">{r.name}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {r.fired.toLocaleString('pt-BR')}
            </span>
          </div>
        ))}
      </div>
      {dominant && (
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-amber-400/90">
          &ldquo;{rows[0].name}&rdquo; concentra quase todos os disparos. Normalmente isso é a
          mesma conversa sendo reavaliada a cada rodada, não leads diferentes.
        </p>
      )}
    </div>
  );
}

interface Props {
  params?: CustomerDashboardParams;
}

const AutomationsKPISection = ({ params = {} }: Props) => {
  const [data, setData] = useState<AutomationsKpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Carrega separado do dashboard principal: se esta seção falhar ou demorar, o
  // resto da tela não fica esperando por ela.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    automationsKpiService
      .get(params)
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Automações</h2>
        <div className="flex h-32 items-center justify-center rounded-xl border border-white/[0.06] bg-card/60">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (failed || !data) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Automações</h2>
        <div className="rounded-xl border border-white/[0.06] bg-card/60 p-5 text-sm text-muted-foreground">
          Não foi possível carregar os indicadores de automação agora.
        </div>
      </section>
    );
  }

  const { followups, first_response: fr, recovery, rules, reminders } = data;

  const excluded = fr.excluded_automated ?? 0;
  const excludedNote =
    excluded > 0
      ? `${excluded} resposta(s) automática(s) fora da conta`
      : null;

  const cards: Card[] = [
    {
      label: 'Primeiro atendimento',
      description: 'Tempo típico até a primeira resposta ao lead',
      icon: Timer,
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-400',
      numColor: 'text-blue-400',
      value: fr.median_seconds !== null ? formatSeconds(fr.median_seconds) : '—',
      // O backend já descarta o eco do robô da conta (inclusive o histórico anterior
      // à correção). Aqui só damos transparência do que saiu, pra ninguém achar que
      // o número mudou sozinho.
      footnote:
        fr.count === 0
          ? excludedNote ?? 'Sem atendimento medido no período'
          : `${fr.count} atendimento(s)${
              fr.under_5min_rate !== null ? ` · ${fr.under_5min_rate}% em até 5min` : ''
            }${excludedNote ? ` · ${excludedNote}` : ''}`,
    },
    {
      label: 'Follow-ups enviados',
      description: 'Mensagens que o sistema mandou sozinho',
      icon: Send,
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-400',
      numColor: 'text-violet-400',
      value: followups.sent.toLocaleString('pt-BR'),
      footnote:
        followups.success_rate !== null
          ? `${followups.success_rate}% entregues${followups.failed > 0 ? ` · ${followups.failed} falha(s)` : ''}`
          : undefined,
    },
    {
      label: 'Leads recuperados',
      description: 'Responderam depois de um follow-up',
      icon: RotateCcw,
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      numColor: 'text-emerald-400',
      value: recovery.recovered.toLocaleString('pt-BR'),
      footnote:
        recovery.recovery_rate !== null
          ? `${recovery.recovery_rate}% de quem recebeu follow-up`
          : 'Sem follow-up enviado no período',
    },
    {
      label: 'Na fila',
      description: 'Disparos agendados aguardando a hora',
      icon: Bot,
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      numColor: 'text-amber-400',
      value: followups.pending.toLocaleString('pt-BR'),
      footnote: followups.cancelled > 0 ? `${followups.cancelled} cancelado(s) no período` : undefined,
    },
    {
      label: 'Automações disparadas',
      description: 'Regras que rodaram e entregaram algo',
      icon: Zap,
      iconBg: 'bg-fuchsia-500/15',
      iconColor: 'text-fuchsia-400',
      numColor: 'text-fuchsia-400',
      value: rules.fired.toLocaleString('pt-BR'),
      footnote: `${rules.active} regra(s) ativa(s)${rules.failed > 0 ? ` · ${rules.failed} falha(s)` : ''}`,
    },
  ];

  if (reminders.available) {
    cards.push({
      label: 'Lembretes enviados',
      description: 'Avisos automáticos entregues no WhatsApp',
      icon: Bell,
      iconBg: 'bg-cyan-500/15',
      iconColor: 'text-cyan-400',
      numColor: 'text-cyan-400',
      value: reminders.sent.toLocaleString('pt-BR'),
      footnote:
        reminders.failed > 0 || reminders.skipped > 0
          ? `${reminders.failed} falha(s) · ${reminders.skipped} pulado(s)`
          : undefined,
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Automações</h2>
        <p className="text-sm text-muted-foreground">
          O que o sistema fez sozinho no período e o retorno disso.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <KpiCard key={c.label} card={c} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StepFunnel steps={data.step_funnel} />
        <div className="space-y-4">
          <SequenceBreakdown rows={data.by_sequence} />
          <TopRules rows={rules.top} total={rules.fired} />
        </div>
      </div>
    </section>
  );
};

export default AutomationsKPISection;
