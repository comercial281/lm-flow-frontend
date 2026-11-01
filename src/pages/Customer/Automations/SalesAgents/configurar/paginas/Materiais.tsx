// Materiais (Tarefa 70, casca): a Tarefa 74 enche "da casa" e "de cada imóvel", com o "quando mandar".
import { Secao, Secoes } from '@/components/base/Secao';

export default function Materiais() {
  return (
    <Secoes>
      <Secao titulo="Da casa" descricao="O que vale pra qualquer conversa.">
        <p className="text-sm text-muted-foreground">Os blocos desta página entram na próxima entrega do Configurar.</p>
      </Secao>
    </Secoes>
  );
}
