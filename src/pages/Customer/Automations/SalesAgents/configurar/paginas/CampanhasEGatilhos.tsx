// Campanhas e gatilhos (Tarefa 70, casca): a Tarefa 73 enche os gatilhos por número e o começo por
// campanha (`openings`, que pede `campaign_links.read`).
import { Secao, Secoes } from '@/components/base/Secao';

export default function CampanhasEGatilhos() {
  return (
    <Secoes>
      <Secao titulo="Gatilhos" descricao="Quais leads entram com este agente, número por número.">
        <p className="text-sm text-muted-foreground">Os blocos desta página entram na próxima entrega do Configurar.</p>
      </Secao>
    </Secoes>
  );
}
