// Condução (Tarefa 72, 01/11/2026): como ela conduz a conversa. Quatro blocos, nesta ordem:
// Abertura · O que descobrir · Formato das respostas · Restrições. Cada um é um fragmento de
// blocos (a moldura é o Card da página; o divisor entre eles é dela).
import type { PropsDaPagina } from '../paginas';
import Abertura from './Abertura';
import Qualificacao from './Qualificacao';
import Personalidade from './Personalidade';
import Restricoes from './Restricoes';

export default function Conducao(props: PropsDaPagina) {
  return (
    <>
      <Abertura {...props} />
      <Qualificacao {...props} />
      <Personalidade {...props} />
      <Restricoes {...props} />
    </>
  );
}
