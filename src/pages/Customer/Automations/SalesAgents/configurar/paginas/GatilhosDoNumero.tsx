// Gatilhos por número (Tarefa 73, 01/11/2026): um cartão por número do agente com a escolha
// "Os do agente · Todo lead do número · Só alguns". Grava pela API própria dos números
// (`useNumerosDoAgente.mudar`, que relê o agente): nunca pelo `gravar` da página.
//
// ⚠️ NULO NÃO É LISTA VAZIA. `triggers: null` = o número herda os do agente; `[]` = atende todo lead.
// Voltar pra "Os do agente" grava nulo (`gatilhosDoEstado`); gravar `[]` ali trocaria os gatilhos do
// agente por "todo lead" sem ninguém ver.
// ⚠️ "Só alguns" sem condição completa NÃO grava: a linha em branco mora só na tela (como no agente),
// senão o número ficaria sem lead nenhum. O cartão fica "aberto" até outra escolha.
import { useEffect, useMemo, useRef, useState } from 'react';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import type { SalesAgent, AgentNumber, SalesAgentTrigger } from '@/services/salesAgents/salesAgentsService';
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

/** Os outros agentes LIGADOS que atendem o mesmo número com ele LIGADO (número desligado não divide). */
export function agentesQueDividem(numero: AgentNumber, agent: SalesAgent, outros: SalesAgent[]): SalesAgent[] {
  return outros.filter((o) => o.id !== agent.id && o.enabled && !o.absorbed_into_id
    && (o.numbers ?? []).some((n) => n.enabled !== false && String(n.inbox_id) === String(numero.inbox_id)));
}

function CartaoDoNumero({ agent, numero, mudar }: { agent: SalesAgent; numero: AgentNumber; mudar: NumerosDoAgente['mudar'] }) {
  // ⚠️ O ÚLTIMO VALOR ENVIADO, não o do render: o blur da palavra grava antes do clique em "Os do agente",
  // e o agente só volta relido depois. Comparar com o servidor velho deixava a palavra gravada.
  // Zera quando o servidor devolve o número (a releitura é a verdade de novo).
  const enviado = useRef<{ v: SalesAgentTrigger[] | null } | null>(null);
  useEffect(() => { enviado.current = null; }, [numero.triggers]);
  const atuais = enviado.current ? enviado.current.v : numero.triggers;
  const doServidor = estadoDosGatilhos({ triggers: atuais });
  // Gravação que falhou não relê o agente: o "último enviado" volta pro do servidor, senão a
  // próxima escolha compara com um valor que nunca foi gravado e não reenvia.
  const gravarTriggers = async (v: SalesAgentTrigger[] | null) => {
    const marca = { v };
    enviado.current = marca;
    const ok = await mudar(numero.id, { triggers: v });
    if (!ok && enviado.current === marca) enviado.current = null;
    return ok;
  };
  const [aberto, setAberto] = useState(estadoDosGatilhos(numero) === 'proprios');
  // Escolheu outra opção: a palavra pendente do bloco não pode gravar ao desmontar (ressuscitaria o que saiu).
  const escolheuOutra = useRef(false);
  const estado: EstadoDosGatilhos = aberto ? 'proprios' : doServidor;
  const nome = numero.owner_name ?? numero.inbox_name;
  const triggers = useMemo(() => numero.triggers ?? [], [numero.triggers]);
  const herda = numero.triggers === null || numero.triggers === undefined;
  const doNumero = useMemo(() => ({ ...agent, triggers }) as SalesAgent, [agent, triggers]);

  const escolher = async (novo: EstadoDosGatilhos) => {
    escolheuOutra.current = novo !== 'proprios';
    setAberto(novo === 'proprios');
    // Lido AGORA (não do render): o blur que acabou de gravar não passou por um render ainda.
    const agora = enviado.current ? enviado.current.v : numero.triggers;
    const estadoAgora = estadoDosGatilhos({ triggers: agora });
    const alvo = gatilhosDoEstado(novo, agora);
    if (novo === 'proprios') {
      // Sem condição completa não há o que gravar: a linha nasce na tela.
      if (estadoAgora !== 'proprios' && alvo && alvo.length > 0) await gravarTriggers(alvo);
      return;
    }
    if (estadoAgora !== novo) await gravarTriggers(alvo);
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
        <TriggersSection agent={doNumero} nome={`Condições de ${nome}`} semModo ultimaFica herdaDoAgente={herda} escolheuTodos={escolheuOutra}
          onSave={(p) => { if (p.triggers) void gravarTriggers(p.triggers); }} />
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
