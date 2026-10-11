// Configurar pela ordem da conversa (onda 3, 06/10/2026): trilho agrupado à
// esquerda (5 grupos, 15 páginas curtas) e a página aberta à direita, com UM
// cabeçalho (grupo, título, frase). Cada página grava na hora (useGravarNaHora):
// sem Salvar, sem "Sair sem salvar?".
//
// ⚠️ ROLAGEM: ver o comentário em ../moldura/PaginasComTrilho.tsx (trilho sticky, nada no meio gruda).
//
// ⚠️ Sem `?pagina=`: abre na primeira página com pendência e grava no endereço
// (replace: o Voltar sai da IA). Trocar de página empurra no histórico (o Voltar
// volta pra página anterior, como no passo a passo).
// ⚠️ A página sai do endereço por `paginaDaUrl` (o MESMO da casca): traduz o
// `?passo=N` antigo e não acha `constructor`/`toString` na cadeia do objeto. O RR7
// troca o endereço em transição, então este componente pode renderizar ANTES da
// casca reescrever o `?passo=`: lendo só `pagina`, escrevia a página inicial por
// cima da tradução.
import { useCallback, useEffect, useMemo, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { salesAgentsService, type HealthReport, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { paginasComPendencia } from '@/features/salesAgents/pendencias';
import type { InboxOption } from '../configuracao/comum';
import {
  GRUPOS_DE_PAGINAS, PAGINAS, agendamentoTravado, conferirCamposDaPagina, paginaDaUrl, paginaInicial,
  type PaginaId, type PropsDaPagina,
} from './paginas';
import PaginasComTrilho from '../moldura/PaginasComTrilho';
import { camposDaMudanca, useGravarNaHora, type Gravar } from './useGravarNaHora';
import Canal from './paginas/Canal';
import Horario from './paginas/Horario';
import Identidade from './paginas/Identidade';
import Abertura from './paginas/Abertura';
import Intencao from './paginas/Intencao';
import Personalidade from './paginas/Personalidade';
import Qualificacao from './paginas/Qualificacao';
import Catalogo from './paginas/Catalogo';
import Restricoes from './paginas/Restricoes';
import Objetivo from './paginas/Objetivo';
import Criterio from './paginas/Criterio';
import Destino from './paginas/Destino';
import Funil from './paginas/Funil';
import Agendamento from './paginas/Agendamento';
import Followup from './paginas/Followup';

const COMPONENTES: Record<PaginaId, ComponentType<PropsDaPagina>> = {
  canal: Canal, horario: Horario, identidade: Identidade, abertura: Abertura, intencao: Intencao,
  personalidade: Personalidade, qualificacao: Qualificacao, catalogo: Catalogo, restricoes: Restricoes,
  objetivo: Objetivo, criterio: Criterio, destino: Destino, funil: Funil, agendamento: Agendamento, followup: Followup,
};

export interface ConfigurarPaginasProps {
  agent: SalesAgent;
  inboxes: InboxOption[];
  aoSalvo: (a: SalesAgent) => void;
  diagnostico: HealthReport | null;
}

export default function ConfigurarPaginas({ agent, inboxes, aoSalvo, diagnostico }: ConfigurarPaginasProps) {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('pagina');
  const daUrl = paginaDaUrl(params);
  const atual: PaginaId = daUrl ?? paginaInicial(agent);
  const pendentes = useMemo(() => paginasComPendencia(agent), [agent]);
  const travado = agendamentoTravado(agent);
  const { gravar } = useGravarNaHora(agent, aoSalvo);

  const escrever = useCallback((p: PaginaId, replace: boolean) => setParams((velhos) => {
    const n = new URLSearchParams(velhos);
    n.set('pagina', p);
    n.delete('passo');
    return n;
  }, { replace }), [setParams]);

  // Endereço sem página, com página que não existe ou com o `?passo=` antigo: grava a
  // página aberta (replace), a mesma que a casca escreveria.
  useEffect(() => {
    if (pedida !== atual) escrever(atual, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o endereço muda
  }, [daUrl, pedida]);

  const irPara = useCallback((p: PaginaId) => { if (p !== atual) escrever(p, false); }, [atual, escrever]);

  // Cada página só grava os campos dela (paginas.ts). Fora disso é erro de
  // programação: vira promessa recusada (o teste reprova; nada vai pro servidor).
  const gravarNaPagina = useCallback<Gravar>(async (mudanca, subchaves) => {
    conferirCamposDaPagina(atual, camposDaMudanca(mudanca, subchaves));
    return gravar(mudanca, subchaves);
  }, [atual, gravar]);

  // A chave do Sistema do cliente foi gerada (fora do PATCH da IA): relê a IA.
  // ⚠️ Nunca uma cópia (`{ ...agent, handoff_webhook_secret_state: 'ready' }`) pro
  // aoSalvo: o registro do "último salvo" reconhece a cópia otimista pela identidade,
  // e uma cópia montada aqui com outra gravação na fila passaria por "salva".
  // Falha na leitura: a tela fica como estava até a próxima leitura da IA.
  const aoChaveGerada = useCallback(() => {
    salesAgentsService.get(agent.id).then(aoSalvo).catch(() => undefined);
  }, [agent.id, aoSalvo]);

  const Pagina = COMPONENTES[atual];

  const grupos = GRUPOS_DE_PAGINAS.map((g) => ({
    id: g.id,
    rotulo: g.rotulo,
    itens: g.paginas.map((p) => ({
      id: p,
      titulo: PAGINAS[p].titulo,
      frase: PAGINAS[p].frase,
      icone: PAGINAS[p].icone,
      pendente: pendentes.has(p),
      trava: p === 'agendamento' && travado
        ? { dica: 'Só quando o objetivo é agendar visita', leitor: '(travada: só com o objetivo Agendar visita)' }
        : undefined,
    })),
  }));

  return (
    <PaginasComTrilho rotulo="Páginas da configuração" grupos={grupos} atual={atual} aoIr={irPara}>
      <Pagina key={atual} agent={agent} inboxes={inboxes} gravar={gravarNaPagina} irPara={irPara} diagnostico={diagnostico}
        aoChaveGerada={aoChaveGerada} />
    </PaginasComTrilho>
  );
}
