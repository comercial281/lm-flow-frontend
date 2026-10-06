// Conversa · Restrições (onda 3). O que ela nunca informa sozinha: 4 etiquetas
// fixas (subchaves de `ai_limits`) + as próprias (`ai_limits.custom`), que entram
// pelo campo e saem com "Tirar". Se o lead pedir, ela diz que o corretor confirma.
import { Secao, Secoes } from '@/components/base/Secao';
import EtiquetasDeEscolha from '@/components/base/EtiquetasDeEscolha';
import type { PropsDaPagina } from '../paginas';

const FIXAS = [
  { valor: 'address', rotulo: 'Endereço exato' },
  { valor: 'discount', rotulo: 'Desconto' },
  { valor: 'price', rotulo: 'Preço final' },
  { valor: 'iptu', rotulo: 'Valor do IPTU' },
] as const;
type Fixa = (typeof FIXAS)[number]['valor'];
const SUBCHAVES_FIXAS = FIXAS.map((f) => `ai_limits.${f.valor}`);

export default function Restricoes({ agent, gravar }: PropsDaPagina) {
  const limites = agent.ai_limits ?? {};
  const proprias = limites.custom ?? [];
  const escolhidas = FIXAS.filter((f) => !!limites[f.valor]).map((f) => f.valor as string);

  const trocarFixas = (lista: string[]) => {
    const proximo = { ...limites };
    FIXAS.forEach((f) => { proximo[f.valor as Fixa] = lista.includes(f.valor); });
    return gravar({ ai_limits: proximo }, SUBCHAVES_FIXAS);
  };
  const trocarProprias = (lista: string[]) => gravar({ ai_limits: { ...limites, custom: lista } }, ['ai_limits.custom']);

  return (
    <Secoes>
      <Secao titulo="O que ela não informa" descricao="Se o lead pedir, ela diz que o corretor confirma. Clique pra ligar ou desligar.">
        <EtiquetasDeEscolha rotulo="O que ela não informa" opcoes={[...FIXAS]} escolhidas={escolhidas}
          aoMudar={(l) => void trocarFixas(l)} proprias={proprias}
          aoTirarPropria={(t) => void trocarProprias(proprias.filter((x) => x !== t))}
          adicionar={{ rotulo: 'Nova restrição', placeholder: 'Outra coisa que ela não faz…', aoAdicionar: (t) => void trocarProprias([...proprias, t]) }} />
      </Secao>
    </Secoes>
  );
}
