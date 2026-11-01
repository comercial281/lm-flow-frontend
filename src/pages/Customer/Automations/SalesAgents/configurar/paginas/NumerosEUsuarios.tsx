// Números e usuários (Tarefa 70, casca): a Tarefa 71 enche o padrão da casa e um cartão por
// número (a API dos números do agente). O Horário, que mora aqui, é o de sempre.
import type { PropsDaPagina } from '../paginas';
import Horario from './Horario';

export default function NumerosEUsuarios(props: PropsDaPagina) {
  return <Horario {...props} />;
}
