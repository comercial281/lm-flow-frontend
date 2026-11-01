// Gatilhos por número (Tarefa 73, 01/11/2026): um cartão por número do agente com a escolha
// "Os do agente · Todo lead do número · Só alguns". Grava pela API própria dos números
// (`useNumerosDoAgente.mudar`, que relê o agente): nunca pelo `gravar` da página.
//
// ⚠️ NULO NÃO É LISTA VAZIA. `triggers: null` = o número herda os do agente; `[]` = atende todo lead.
// Voltar pra "Os do agente" grava nulo (`gatilhosDoEstado`); gravar `[]` ali trocaria os gatilhos do
// agente por "todo lead" sem ninguém ver.
// ⚠️ "Só alguns" sem condição completa NÃO grava: a linha em branco mora só na tela (como no agente),
// senão o número ficaria sem lead nenhum. O cartão fica "aberto" até outra escolha.
import { useMemo, useRef, useState } from 'react';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import type { SalesAgent, AgentNumber } from '@/services/salesAgents/salesAgentsService';
import { estadoDosGatilhos, gatilhosDoEstado, type EstadoDosGatilhos } from '@/features/salesAgents/gatilhosDoNumero';
import { restricaoDosGatilhos } from '@/features/salesAgents/situacao';
import { TriggersSection } from '../blocos/TriggersSection';
import type { NumerosDoAgente } from '../useNumerosDoAgente';

export const FRASE_DO_NUMERO_DIVIDIDO = 'No mesmo número, a mesma campanha não fica em dois agentes. Lead sem gatilho fica com o corretor.';

const OPCOES: { valor: EstadoDosGatilhos; rotulo: string }[] = [
  { valor: 'do_agente', rotulo: 'Os do agente' },
  { valor: 'todo_lead', rotulo: 'Todo lead do número' },
  { valor: 'proprios', rotulo: 'Só alguns' },
];

/** Os outros agentes LIGADOS que atendem o mesmo número (só agente ligado conta pra divisão). */
export function agentesQueDividem(numero: AgentNumber, agent: SalesAgent, outros: SalesAgent[]): SalesAgent[] {
  return outros.filter((o) => o.id !== agent.id && o.enabled && !o.absorbed_into_id
    && (o.numbers ?? []).some((n) => String(n.inbox_id) === String(numero.inbox_id)));
}

function CartaoDoNumero({ agent, numero, mudar }: { agent: SalesAgent; numero: AgentNumber; mudar: NumerosDoAgente['mudar'] }) {
  const doServidor = estadoDosGatilhos(numero);
  const [aberto, setAberto] = useState(doServidor === 'proprios');
  // Escolheu outra opção: a palavra pendente do bloco não pode gravar ao desmontar (ressuscitaria o que saiu).
  const escolheuOutra = useRef(false);
  const estado: EstadoDosGatilhos = aberto ? 'proprios' : doServidor;
  const nome = numero.owner_name ?? numero.inbox_name;
  const triggers = useMemo(() => numero.triggers ?? [], [numero.triggers]);
  const doNumero = useMemo(() => ({ ...agent, triggers }) as SalesAgent, [agent, triggers]);

  const escolher = async (novo: EstadoDosGatilhos) => {
    escolheuOutra.current = novo !== 'proprios';
    setAberto(novo === 'proprios');
    const alvo = gatilhosDoEstado(novo, numero.triggers);
    if (novo === 'proprios') {
      // Sem condição completa não há o que gravar: a linha nasce na tela.
      if (doServidor !== 'proprios' && alvo && alvo.length > 0) await mudar(numero.id, { triggers: alvo });
      return;
    }
    if (doServidor !== novo) await mudar(numero.id, { triggers: alvo });
  };

  const regra = restricaoDosGatilhos(agent);
  const frase = estado === 'do_agente'
    ? `Usa os gatilhos do agente: atende ${regra ? regra.frase : 'todo lead do número'}.`
    : estado === 'todo_lead' ? 'Atende todo lead do número, sem olhar os gatilhos do agente.' : null;

  return (
    <div className="space-y-3 rounded-2xl border-[1.5px] border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{nome}</p>
          {numero.owner_name && <p className="truncate text-[13px] text-muted-foreground">{numero.inbox_name}</p>}
        </div>
        <BotoesDeEscolha<EstadoDosGatilhos> rotulo={`Gatilhos de ${nome}`} valor={estado} opcoes={OPCOES}
          aoEscolher={(e) => void escolher(e)} />
      </div>
      {frase && <p className="text-[13px] text-muted-foreground">{frase}</p>}
      {estado === 'proprios' && (
        <TriggersSection agent={doNumero} nome={`Condições de ${nome}`} semModo escolheuTodos={escolheuOutra}
          onSave={(p) => { if (p.triggers) void mudar(numero.id, { triggers: p.triggers }); }} />
      )}
    </div>
  );
}

export default function GatilhosDoNumero({ agent, outros, mudar }: { agent: SalesAgent; outros: SalesAgent[]; mudar: NumerosDoAgente['mudar'] }) {
  const numeros = agent.numbers ?? [];
  if (numeros.length === 0) {
    return <p className="text-sm text-muted-foreground">Este agente ainda não tem número. Adicione em Números e usuários.</p>;
  }
  const dividido = numeros.some((n) => agentesQueDividem(n, agent, outros).length > 0);
  return (
    <>
      <div className="space-y-3">
        {numeros.map((n) => <CartaoDoNumero key={n.id} agent={agent} numero={n} mudar={mudar} />)}
      </div>
      {dividido && <p className="text-[13px] text-muted-foreground">{FRASE_DO_NUMERO_DIVIDIDO}</p>}
    </>
  );
}
