// Condução (Tarefa 70, casca): a Tarefa 73 junta a Abertura (sem `openings`), o que descobrir, o
// formato das respostas e as restrições. Por enquanto, as páginas de sempre uma em cima da outra.
import type { PropsDaPagina } from '../paginas';
import Qualificacao from './Qualificacao';
import Personalidade from './Personalidade';
import Restricoes from './Restricoes';

export default function Conducao(props: PropsDaPagina) {
  return (
    <div className="space-y-5">
      <Qualificacao {...props} />
      <Personalidade {...props} />
      <Restricoes {...props} />
    </div>
  );
}
