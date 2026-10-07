// Atendimento · Horário (onda 3). Quando ela responde (24 horas / fora do
// comercial / personalizado) e o aviso pra quem escreve fora do horário. O aviso
// só aparece fora do "24 horas" (com 24 horas não existe "fora do horário").
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import { DEFAULT_WINDOW, type ScheduleWindow } from '@/components/schedule/scheduleWindows';
import type { ActiveHours, ActiveHoursMode } from '@/services/salesAgents/salesAgentsService';
import TextoNaHora from '../TextoNaHora';
import JanelaDaSemana from './JanelaDaSemana';
import type { PropsDaPagina } from '../paginas';

const MODOS: { valor: ActiveHoursMode; rotulo: string }[] = [
  { valor: 'always', rotulo: '24 horas' },
  { valor: 'outside_business', rotulo: 'Fora do comercial' },
  { valor: 'custom', rotulo: 'Personalizado' },
];

export default function Horario({ agent, gravar }: PropsDaPagina) {
  const horas: ActiveHours = agent.active_hours ?? {};
  const modo = horas.mode ?? 'always';
  const janelas = (horas.windows?.length ? horas.windows : [DEFAULT_WINDOW]) as ScheduleWindow[];
  // `tz` sempre explícito (servidor e tela não divergem no dia em que o padrão mudar).
  const gravarHoras = (p: Partial<ActiveHours>) => gravar({ active_hours: { ...horas, tz: horas.tz ?? 'America/Sao_Paulo', ...p } });

  return (
    <Secoes>
      <Secao titulo="Horário de atendimento" descricao="Quando ela responde. Fora disso ela fica quieta (ou manda o aviso abaixo).">
        <BotoesDeEscolha rotulo="Horário de atendimento" valor={modo} opcoes={MODOS}
          aoEscolher={(m) => void gravarHoras({ mode: m, ...(m === 'custom' ? { windows: janelas } : {}) })} />
        {modo === 'outside_business' && <p className="text-sm text-muted-foreground">Das 18:00 às 07:00, quando não tem ninguém do time.</p>}
        {modo === 'custom' && (
          <JanelaDaSemana idBase="horario" rotuloDias="Dias de atendimento" janelas={janelas}
            aoGravar={(next) => gravarHoras({ mode: 'custom', windows: next })} />
        )}
      </Secao>

      {modo !== 'always' && (
        <Secao titulo="Aviso fora do horário" descricao="Uma vez por dia por conversa. Sem isso, quem escreve de madrugada não recebe nada.">
          <LinhaComChave rotulo="Avisar quem escrever fora do horário" ligada={!!agent.out_of_hours_reply}
            aoMudar={(v) => gravar({ out_of_hours_reply: v })}>
            <TextoNaHora id="horario-aviso" tipo="varias" rows={2} rotulo="Mensagem fora do horário" salvo={agent.out_of_hours_message ?? ''}
              placeholder="Vazio: ela escreve sozinha e já diz quando volta."
              aoGravar={(v) => gravar({ out_of_hours_message: v.trim() ? v : null })} />
          </LinhaComChave>
        </Secao>
      )}
    </Secoes>
  );
}
