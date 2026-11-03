// Ensinar (Tarefa 75, 01/11/2026): 5 páginas curtas no mesmo arranjo do Configurar
// (moldura/PaginasComTrilho, sem o emCard): Lições, Exemplos, Regras e objeções da casa,
// Conhecimentos de fábrica e Arquivos e prova social. Lições e arquivos carregam UMA vez aqui
// (o trilho conta e marca pendência) e descem pras páginas. Grava na hora; Excluir confirma.
// Spec: LM FLOW/docs/superpowers/ia-reestruturacao/specs/2026-10-31-fase-6-tela-design.md §4.
import { useCallback, useEffect, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import PaginasComTrilho from '../moldura/PaginasComTrilho';
import { useGravarNaHora } from '../configurar/useGravarNaHora';
import {
  GRUPOS_DO_ENSINAR, PAGINAS_DO_ENSINAR, PAGINA_INICIAL_DO_ENSINAR, casosDe, conversasReais, paginaDoEnsinarDaUrl,
  type PaginaDoEnsinar,
} from './ensinar/paginas';
import { useLicoes } from './ensinar/useLicoes';
import { useArquivos } from './ensinar/useArquivos';
import type { PropsDaPaginaDoEnsinar } from './ensinar/paginas/tipos';
import Licoes from './ensinar/paginas/Licoes';
import Exemplos from './ensinar/paginas/Exemplos';
import RegrasDaCasa from './ensinar/paginas/RegrasDaCasa';
import ConhecimentosDeFabrica from './ensinar/paginas/ConhecimentosDeFabrica';
import Arquivos from './ensinar/paginas/Arquivos';

const COMPONENTES: Record<PaginaDoEnsinar, ComponentType<PropsDaPaginaDoEnsinar>> = {
  licoes: Licoes, exemplos: Exemplos, casa: RegrasDaCasa, conhecimentos: ConhecimentosDeFabrica, arquivos: Arquivos,
};

export default function TelaEnsinar({ agent, onCountChange, aoSalvo }: { agent: SalesAgent; onCountChange: () => void; aoSalvo: (a: SalesAgent) => void }) {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('pagina');
  const atual = paginaDoEnsinarDaUrl(params) ?? PAGINA_INICIAL_DO_ENSINAR;
  const { gravar } = useGravarNaHora(agent, aoSalvo);
  const licoes = useLicoes(agent.id);
  const arquivos = useArquivos(agent.id, onCountChange);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const escrever = useCallback((p: PaginaDoEnsinar, replace: boolean) => setParams((velhos) => {
    const n = new URLSearchParams(velhos);
    n.set('pagina', p);
    return n;
  }, { replace }), [setParams]);

  // Endereço sem página (ou com página que não existe): grava a aberta, com replace.
  useEffect(() => {
    if (pedida !== atual) escrever(atual, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o endereço muda
  }, [pedida]);

  const irPara = useCallback((p: PaginaDoEnsinar) => { if (p !== atual) escrever(p, false); }, [atual, escrever]);

  // Contagem do trilho: as lições e exemplos que o servidor lê (a conversa real sem resposta não conta).
  const { regras: contaRegras, exemplos: contaExemplos } = licoes.contadores;
  const exemplos = licoes.licoes.filter((l) => l.kind !== 'rule').length + conversasReais(agent.example_conversations).length;
  const contagem: Record<PaginaDoEnsinar, number | undefined> = {
    licoes: licoes.licoes.filter((l) => l.kind === 'rule').length, exemplos,
    casa: (agent.house_rules?.length ?? 0) + (agent.house_objections?.length ?? 0) || undefined,
    conhecimentos: undefined, arquivos: arquivos.docs.length + casosDe(agent.social_proof).length,
  };
  // A bolinha é lição (ou exemplo) que o servidor deixou de fora por tamanho: nada sai calado.
  const pendente: Record<PaginaDoEnsinar, boolean> = {
    licoes: contaRegras.fora_por_tamanho > 0, exemplos: contaExemplos.fora_por_tamanho > 0,
    casa: false, conhecimentos: false, arquivos: false,
  };
  const grupos = GRUPOS_DO_ENSINAR.map((g) => ({
    id: g.id, rotulo: g.rotulo,
    itens: g.paginas.map((p) => ({ id: p, ...PAGINAS_DO_ENSINAR[p], contagem: contagem[p], pendente: pendente[p] })),
  }));

  const Pagina = COMPONENTES[atual];
  return (
    <>
      <PaginasComTrilho rotulo="Páginas do Ensinar" grupos={grupos} atual={atual} aoIr={irPara}>
        <Pagina key={atual} agent={agent} gravar={gravar} licoes={licoes} arquivos={arquivos} irPara={irPara} confirmar={confirmar} />
      </PaginasComTrilho>
      {dialogoDeConfirmacao}
    </>
  );
}
