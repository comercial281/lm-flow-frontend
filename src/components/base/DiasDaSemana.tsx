// ── DIAS DA SEMANA ───────────────────────────────────────────────────────────
//
// Os dias em botões redondos, segunda primeiro (como o gestor lê uma escala). Um
// só lugar pra Horário, Agendamento e Follow-up da IA. Mesmo contrato do servidor
// (Scheduling::WindowGate): 0=domingo … 6=sábado, e lista VAZIA quer dizer todos os
// dias — por isso não deixa desmarcar o último.
import { useState } from 'react';
import { WEEKDAYS } from '@/components/schedule/scheduleWindows';
import { cn } from '@/lib/utils';

const NOME: Record<number, string> = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
const LETRA: Record<number, string> = { 0: 'D', 1: 'S', 2: 'T', 3: 'Q', 4: 'Q', 5: 'S', 6: 'S' };

export interface DiasDaSemanaProps {
  rotulo: string;
  dias: number[];
  aoMudar: (dias: number[]) => void;
  desabilitado?: boolean;
}

export default function DiasDaSemana({ rotulo, dias, aoMudar, desabilitado = false }: DiasDaSemanaProps) {
  const [aviso, setAviso] = useState(false);
  const trocar = (d: number) => {
    const proximo = dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d];
    if (proximo.length === 0) { setAviso(true); return; }
    setAviso(false);
    aoMudar([...proximo].sort((a, b) => a - b));
  };
  return (
    <div className="space-y-1.5">
      <div role="group" aria-label={rotulo} className="flex flex-wrap gap-2">
        {WEEKDAYS.map(([d]) => {
          const on = dias.includes(d);
          return (
            <button key={d} type="button" aria-pressed={on} aria-label={NOME[d]} title={NOME[d]} disabled={desabilitado}
              onClick={() => trocar(d)}
              className={cn('h-10 w-10 rounded-xl border-[1.5px] text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40')}>
              {LETRA[d]}
            </button>
          );
        })}
      </div>
      {aviso && <p className="text-sm text-amber-700 dark:text-amber-400">Deixe pelo menos um dia.</p>}
    </div>
  );
}
