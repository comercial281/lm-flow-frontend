// Campanhas e gatilhos (Tarefa 73, 01/11/2026). Três blocos:
//  - Gatilhos do agente: o Público (todos os leads / só alguns), as condições, "Qualquer um / Todos"
//    (`trigger_match_mode`) e a palavra antiga (`trigger_keyword`) com "Tirar essa regra". Grava pelo `gravar`.
//  - Gatilhos por número: "Os do agente · Todo lead do número · Só alguns" em cada número do agente. Grava
//    pela API própria dos números (`useNumerosDoAgente`), que relê o agente: a página não guarda cópia.
//  - Começo por campanha (`openings`): só com `campaign_links.read` (gerente e diretor; corretor não vê).
// Entrega BLOCOS (a moldura é o Card da página; armadilha 7 do Configurar).
import { useEffect, useRef, useState } from 'react';
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import Aviso from '@/components/base/Aviso';
import { Button } from '@/components/ui/ds';
import { useCan } from '@/hooks/useCan';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { fraseDaPalavraAntiga } from '@/features/salesAgents/situacao';
import { TriggersSection } from '../blocos/TriggersSection';
import { useNumerosDoAgente } from '../useNumerosDoAgente';
import type { PropsDaPagina } from '../paginas';
import GatilhosDoNumero from './GatilhosDoNumero';
import ComecoPorCampanha from './ComecoPorCampanha';

const SEM_AVISO = () => undefined;
type Publico = 'todos' | 'alguns';

function GatilhosDoAgente({ agent, gravar }: Pick<PropsDaPagina, 'agent' | 'gravar'>) {
  const temCondicoes = (agent.triggers ?? []).length > 0;
  // ⚠️ Aberto uma vez, fica aberto até "Todos os leads": tirar a última condição na lixeira grava lista
  // vazia, e o bloco sumiria com a linha que a pessoa está preenchendo (ela só existe na tela).
  const [abrindoAlguns, setAbrindoAlguns] = useState(temCondicoes);
  // "Todos os leads" desmonta as condições: a palavra pendente não pode gravar no desmonte.
  const escolheuTodos = useRef(false);
  // As condições que o bloco acabou de mandar gravar: no clique de verdade em "Todos os leads" o campo
  // perde o foco ANTES e grava a palavra pendente, e o `temCondicoes` deste render ainda é o de antes.
  const condicoesEnviadas = useRef<SalesAgent['triggers'] | null>(null);
  const publico: Publico = temCondicoes || abrindoAlguns ? 'alguns' : 'todos';
  useEffect(() => { if (publico === 'alguns') escolheuTodos.current = false; }, [publico]);
  const frasePalavra = fraseDaPalavraAntiga(agent);

  const escolherPublico = async (p: Publico) => {
    escolheuTodos.current = p === 'todos';
    if (p === 'alguns') { setAbrindoAlguns(true); return; }
    setAbrindoAlguns(false);
    const pendentes = (condicoesEnviadas.current ?? []).length > 0;
    condicoesEnviadas.current = null;
    if (temCondicoes || pendentes) await gravar({ triggers: [] });
  };

  return (
    <>
      {frasePalavra && (
        <Aviso tom="atencao">
          <p>{frasePalavra}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void gravar({ trigger_keyword: null })}>
            Tirar essa regra
          </Button>
        </Aviso>
      )}
      <BotoesDeEscolha<Publico> rotulo="Quem ela atende" valor={publico}
        opcoes={[{ valor: 'todos', rotulo: 'Todos os leads' }, { valor: 'alguns', rotulo: 'Só alguns' }]}
        aoEscolher={(p) => void escolherPublico(p)} />
      {publico === 'alguns' && (
        <TriggersSection agent={agent} escolheuTodos={escolheuTodos}
          onSave={(p) => { if (p.triggers) condicoesEnviadas.current = p.triggers; void gravar(p); }} />
      )}
    </>
  );
}

export default function CampanhasEGatilhos(props: PropsDaPagina) {
  const { agent, gravar } = props;
  const can = useCan();
  const { mudar } = useNumerosDoAgente(agent, props.aoSalvo ?? SEM_AVISO);
  const [outros, setOutros] = useState<SalesAgent[]>([]);

  // Os outros agentes, pra saber quais números estão divididos. Falhou: a página funciona sem eles.
  useEffect(() => {
    let vivo = true;
    salesAgentsService.list().then((l) => { if (vivo) setOutros(l.filter((a) => a.id !== agent.id)); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [agent.id]);

  return (
    <Secoes>
      <Secao titulo="Gatilhos do agente"
        descricao="Quais leads entram com este agente. Vale pra todo número que usa os gatilhos do agente.">
        <GatilhosDoAgente agent={agent} gravar={gravar} />
      </Secao>
      <Secao titulo="Gatilhos por número"
        descricao="Cada número pode usar os do agente, atender todo lead ou ter os seus. Grava na hora.">
        <GatilhosDoNumero agent={agent} outros={outros} mudar={mudar} />
      </Secao>
      {can('campaign_links', 'read') && <ComecoPorCampanha agent={agent} gravar={gravar} />}
    </Secoes>
  );
}
