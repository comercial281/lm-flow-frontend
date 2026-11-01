// Modo operante (Tarefa 70, casca): o que ela faz, o próximo passo e quando passa o lead antes
// da hora. A Tarefa 71 enche os três blocos (job, next_steps, handoff_exceptions) e a ficha do
// escritório; por enquanto a página só traz a agenda de hoje, que é dela e só vale no Leva até a visita.
import { agendamentoTravado, type PropsDaPagina } from '../paginas';
import Agendamento from './Agendamento';

export default function ModoOperante(props: PropsDaPagina) {
  return agendamentoTravado(props.agent) ? null : <Agendamento {...props} />;
}
