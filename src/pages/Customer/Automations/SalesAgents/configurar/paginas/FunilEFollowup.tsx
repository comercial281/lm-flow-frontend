// Funil e follow-up (Tarefa 70, casca): o Funil e o Follow-up de sempre, um em cima do outro. A Tarefa 74
// junta os dois numa linha do tempo e traz a chave "Esta IA só faz follow-up".
import type { PropsDaPagina } from '../paginas';
import Funil from './Funil';
import Followup from './Followup';

export default function FunilEFollowup(props: PropsDaPagina) {
  return (
    <div className="space-y-5">
      <Funil {...props} />
      <Followup {...props} />
    </div>
  );
}
