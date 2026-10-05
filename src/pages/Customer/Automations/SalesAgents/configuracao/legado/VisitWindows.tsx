import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Label } from '@/components/ui/ds';
import { Plus, Trash2 } from 'lucide-react';
import { type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { useAgendaLigada } from '@/features/visits/useAgendaLigada';
import { WEEKDAYS } from '@/components/schedule/scheduleWindows';
import { antecedenciaResumo } from '@/features/salesAgents/visitWindow';
import { Toggle } from '../comum';

// ---------------- Janelas de disponibilidade da visita ----------------
// Com a agenda ligada no servidor (`GET /visit_settings` com `enabled: true`),
// dias, faixa e datas bloqueadas saem daqui: a IA usa o horário de visita da
// Agenda (a mesma regra de quem marca à mão). Sem resposta, desligada ou erro:
// os campos de sempre. Os valores antigos continuam guardados em `visit_config`
// (o `patch` espalha o que já existe) e voltam a valer se a agenda desligar.

export function VisitWindows({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const agendaLigada = useAgendaLigada().ligada === true;
  const c = agent.visit_config ?? {};
  const days = c.days ?? [1, 2, 3, 4, 5];
  const blockedDates = c.blocked_dates ?? [];
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const patch = (p: Partial<NonNullable<SalesAgent['visit_config']>>) => onSave({ visit_config: { ...c, ...p } });
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    patch({ days: next });
  };
  const addBlockedDate = () => {
    if (!newBlockedDate || blockedDates.includes(newBlockedDate)) return;
    patch({ blocked_dates: [...blockedDates, newBlockedDate].sort() });
    setNewBlockedDate('');
  };
  const removeBlockedDate = (d: string) => patch({ blocked_dates: blockedDates.filter((x) => x !== d) });

  return (
    <div className="space-y-2">
      <Label className="text-xs">Quando a IA pode marcar visita</Label>
      {agendaLigada ? (
        <p className="text-xs text-muted-foreground">
          Usa o horário de visita da Agenda — <Link to="/visits" className="text-primary underline">editar</Link>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map(([d, label]) => (
              <button key={d} type="button" onClick={() => toggleDay(d)}
                className={`px-2 py-1 rounded text-xs border ${days.includes(d) ? 'bg-primary/10 text-primary border-primary/40' : 'border-sidebar-border text-muted-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <Label htmlFor="vw_start" className="text-xs">Das</Label>
              <Input id="vw_start" type="time" value={c.start ?? '09:00'} className="mt-1 w-28"
                onChange={(e) => patch({ start: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="vw_end" className="text-xs">até</Label>
              <Input id="vw_end" type="time" value={c.end ?? '18:00'} className="mt-1 w-28"
                onChange={(e) => patch({ end: e.target.value })} />
            </div>
          </div>
        </>
      )}
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <Label htmlFor="vw_min" className="text-xs">Antecedência mín. (horas)</Label>
          <Input id="vw_min" type="number" min={0} max={720} value={c.min_advance_hours ?? 24} className="mt-1 w-24"
            onChange={(e) => patch({ min_advance_hours: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="vw_max" className="text-xs">máx. (dias)</Label>
          <Input id="vw_max" type="number" min={1} max={365} value={c.max_advance_days ?? 30} className="mt-1 w-24"
            onChange={(e) => patch({ max_advance_days: Number(e.target.value) })} />
        </div>
      </div>
      {/* A antecedência era um número solto: ninguém lia "24" e pensava "o primeiro
          horário que ela oferece é amanhã". O servidor faz essa conta e manda pronto
          pra IA; a frase aqui é a mesma leitura, pra quem configura. */}
      <p className="text-xs text-muted-foreground">
        {antecedenciaResumo(c.min_advance_hours ?? 24)}
      </p>

      {/* ⚠️ A regra que esta leva veio criar (21/09/2026): a IA vinha confirmando
          visita para o mesmo dia e chegou a dizer a um lead que já estava no imóvel
          que havia alguém lá esperando por ele. */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          <Label className="text-xs">Visita para hoje só com o corretor confirmando</Label>
          <p className="text-xs text-muted-foreground">
            A IA nunca marca visita para o mesmo dia por conta própria: ela diz que vai confirmar
            com o corretor e passa o lead na hora. Ela também nunca afirma que alguém está no local
            esperando — quem confirma presença é o corretor.
          </p>
        </div>
        <Toggle on={c.same_day_requires_human !== false} onChange={(v) => patch({ same_day_requires_human: v })} rotulo="visita para hoje só com o corretor confirmando" />
      </div>

      {/* Granularidade de CALENDÁRIO, além do dia da semana recorrente: feriado,
          plantão fechado, manutenção — datas específicas que nunca aparecem como
          opção pra IA, mesmo caindo num dia da semana liberado acima. */}
      {!agendaLigada && (
        <div className="pt-2">
          <Label className="text-xs">Datas bloqueadas no calendário (feriado, plantão fechado etc)</Label>
          <div className="flex items-end gap-2 mt-1">
            <Input type="date" value={newBlockedDate} className="w-40"
              onChange={(e) => setNewBlockedDate(e.target.value)} />
            <Button type="button" variant="outline" size="sm" onClick={addBlockedDate} disabled={!newBlockedDate}>
              <Plus className="h-3 w-3 mr-1" /> Bloquear data
            </Button>
          </div>
          {blockedDates.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-1">Nenhuma data bloqueada.</p>
          ) : (
            <div className="flex flex-wrap gap-1 mt-2">
              {blockedDates.map((d) => (
                <span key={d} className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-sidebar-border">
                  {d}
                  <button
                    type="button"
                    onClick={() => removeBlockedDate(d)}
                    aria-label={`Remover ${d} das datas bloqueadas`}
                    title={`Remover ${d} das datas bloqueadas`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sem isto, dois leads diferentes podiam sair com o MESMO horário marcado
          pro mesmo imóvel — a IA não enxergava a visita agendada pelo OUTRO lead. */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          <Label className="text-xs">Evitar dois leads no mesmo horário</Label>
          <p className="text-xs text-muted-foreground">Antes de marcar, confere se já não tem outra visita no mesmo imóvel no mesmo horário.</p>
        </div>
        <Toggle on={c.avoid_double_booking !== false} onChange={(v) => patch({ avoid_double_booking: v })} rotulo="evitar dois leads no mesmo horário" />
      </div>
    </div>
  );
}
