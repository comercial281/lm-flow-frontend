// Público-alvo e produto (Tarefa 70, casca): a Tarefa 72 enche o Produto (as marcas) e os caminhos
// do público. Por enquanto, a pergunta de intenção e os caminhos de sempre.
import type { PropsDaPagina } from '../paginas';
import Intencao from './Intencao';

export default function PublicoEProduto(props: PropsDaPagina) {
  return <Intencao {...props} />;
}
