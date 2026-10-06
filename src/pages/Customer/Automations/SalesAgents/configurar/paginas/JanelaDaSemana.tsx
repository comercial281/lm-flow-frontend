// Uma janela de horário: dias + das/até (Horário, Agendamento, Follow-up). Edita a
// PRIMEIRA janela da lista; as outras (faixas extras criadas na tela antiga, como
// "fechar no almoço") continuam valendo e o aviso diz isso — sumir com elas
// mudaria o atendimento calado. Dia grava no clique; hora ao sair do campo.
import DiasDaSemana from '@/components/base/DiasDaSemana';
import type { ScheduleWindow } from '@/components/schedule/scheduleWindows';
import { plural } from '@/lib/formato';
import TextoNaHora from '../TextoNaHora';

const TODOS = [0, 1, 2, 3, 4, 5, 6];

export default function JanelaDaSemana({ idBase, rotuloDias, janelas, aoGravar }: {
  idBase: string;
  rotuloDias: string;
  janelas: ScheduleWindow[];
  aoGravar: (janelas: ScheduleWindow[]) => unknown;
}) {
  const [primeira, ...resto] = janelas;
  const trocar = (p: Partial<ScheduleWindow>) => aoGravar([{ ...primeira, ...p }, ...resto]);
  return (
    <div className="space-y-3">
      {/* Lista vazia no servidor = todos os dias: aparece tudo marcado. */}
      <DiasDaSemana rotulo={rotuloDias} dias={primeira.days?.length ? primeira.days : TODOS} aoMudar={(days) => trocar({ days })} />
      <div className="flex flex-wrap items-end gap-3">
        <TextoNaHora id={`${idBase}-inicio`} tipo="hora" rotulo="Das" salvo={primeira.start} className="w-36"
          aoGravar={(v) => (v ? trocar({ start: v }) : undefined)} />
        <TextoNaHora id={`${idBase}-fim`} tipo="hora" rotulo="Até" salvo={primeira.end} className="w-36"
          aoGravar={(v) => (v ? trocar({ end: v }) : undefined)} />
      </div>
      {resto.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Esta IA tem mais {plural(resto.length, 'faixa', 'faixas')} de horário, da tela antiga. {resto.length === 1 ? 'Ela continua' : 'Elas continuam'} valendo.
        </p>
      )}
    </div>
  );
}
