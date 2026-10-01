import React, { useEffect, useId, useState } from 'react';
import { Bot } from 'lucide-react';
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';
import { CampoFiltro } from './CampoFiltro';

interface Props {
  active: boolean;
  salesAgentId?: string;
  onChange: (next: { active: boolean; salesAgentId?: string; salesAgentName?: string }) => void;
  /** Com rótulo, desenha o campo da Dashboard nova (rótulo em cima, caixa de 40 px). Sem, o de sempre. */
  rotulo?: string;
}

/**
 * Filtro "quem atendeu pela IA".
 *
 * Era um botão liga/desliga só — "não um select: é binário". Deixou de ser
 * binário no tenant que tem mais de uma IA Vendedora (`SalesAgent` é uma
 * LISTA por tenant, não singleton — dois agentes no mesmo inbox já era
 * previsto, ver `SalesAgent.for_inbox`). Pedido do Giovani (19/08): poder
 * escolher QUAL agente ver nas métricas, não só "teve IA ou não".
 *
 * Com 0 ou 1 agente cadastrado o seletor por agente não tem o que escolher
 * — fica o botão liga/desliga de sempre, mesmo comportamento de antes. Com
 * 2+, vira `<select>` (mesmo padrão do `InstancePicker`): "Todos os
 * atendimentos" (desliga), "Todas as IAs" (liga sem escolher uma) e um item
 * por agente. Escolher um agente já liga o filtro sozinho — não precisa dos
 * dois cliques.
 */
export const AiToggle: React.FC<Props> = ({ active, salesAgentId, onChange, rotulo }) => {
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const id = useId();

  useEffect(() => {
    let alive = true;
    salesAgentsService
      .list()
      .then(list => {
        if (!alive) return;
        setAgents(list.filter(a => a.enabled).map(a => ({ id: a.id, name: a.name })));
      })
      .catch(() => { /* silencioso — fica no botão liga/desliga */ });
    return () => { alive = false; };
  }, []);

  if (agents.length < 2 && rotulo) {
    // Botão liga/desliga: sem seta (não abre lista). O rótulo dá nome ao grupo;
    // o botão continua se chamando "Só IA".
    return (
      <CampoFiltro rotulo={rotulo} idRotulo={`${id}-rotulo`} icone={<Bot size={14} />} seta={false}>
        <button
          type="button"
          className="lmf-campo-controle"
          data-active={active || undefined}
          onClick={() => onChange({ active: !active, salesAgentId: undefined })}
          aria-pressed={active}
          title="Mostrar só leads atendidos pela IA"
        >
          Só IA
        </button>
      </CampoFiltro>
    );
  }

  if (agents.length < 2) {
    return (
      <button
        type="button"
        className="lmf-select flex items-center gap-2"
        data-active={active || undefined}
        onClick={() => onChange({ active: !active, salesAgentId: undefined })}
        aria-pressed={active}
        title="Mostrar só leads atendidos pela IA"
      >
        <Bot size={14} aria-hidden />
        Só IA
      </button>
    );
  }

  const ANY_AI = '__any__';
  const value = !active ? '' : salesAgentId || ANY_AI;

  const handleChange = (next: string) => {
    if (!next) {
      onChange({ active: false, salesAgentId: undefined, salesAgentName: undefined });
    } else if (next === ANY_AI) {
      onChange({ active: true, salesAgentId: undefined, salesAgentName: undefined });
    } else {
      onChange({ active: true, salesAgentId: next, salesAgentName: agents.find(a => a.id === next)?.name });
    }
  };

  const opcoes = (
    <>
      <option value="">Todos os atendimentos</option>
      <option value={ANY_AI}>Todas as IAs</option>
      {agents.map(a => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </>
  );

  if (rotulo) {
    return (
      <CampoFiltro id={id} rotulo={rotulo} icone={<Bot size={14} />}>
        <select id={id} className="lmf-campo-controle" data-active={active || undefined}
          value={value} onChange={e => handleChange(e.target.value)}>
          {opcoes}
        </select>
      </CampoFiltro>
    );
  }

  return (
    <label className="lmf-select flex items-center gap-2" title="Filtrar por IA que atendeu">
      <Bot size={14} aria-hidden />
      <span className="sr-only">IA</span>
      <select
        value={value}
        onChange={e => handleChange(e.target.value)}
        style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', outline: 'none' }}
      >
        {opcoes}
      </select>
    </label>
  );
};

export default AiToggle;
