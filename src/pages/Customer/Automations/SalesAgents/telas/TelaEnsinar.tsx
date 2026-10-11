// Ensinar (11/10/2026): 5 páginas curtas no mesmo arranjo do Configurar
// (moldura/PaginasComTrilho). Lições e arquivos carregam UMA vez aqui (o trilho conta
// e marca pendência) e descem pras páginas. Grava na hora; Excluir confirma.
// Spec: LM FLOW/specs/2026-10-11-ia-ensinar-refatoracao-design.md.
import { useCallback, useEffect, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import PaginasComTrilho from '../moldura/PaginasComTrilho';
import { useGravarNaHora } from '../configurar/useGravarNaHora';
import {
  GRUPOS_DO_ENSINAR, PAGINAS_DO_ENSINAR, PAGINA_INICIAL_DO_ENSINAR, arquivosSemQuando, casosDe, paginaDoEnsinarDaUrl, regrasForaDoLimite,
  type PaginaDoEnsinar,
} from './ensinar/paginas';
import { useLicoes } from './ensinar/useLicoes';
import { useArquivos } from './ensinar/useArquivos';
import type { PropsDaPaginaDoEnsinar } from './ensinar/paginas/tipos';
import Instrucoes from './ensinar/paginas/Instrucoes';
import Regras from './ensinar/paginas/Regras';
import Exemplos from './ensinar/paginas/Exemplos';
import Arquivos from './ensinar/paginas/Arquivos';
import ProvaSocial from './ensinar/paginas/ProvaSocial';

const COMPONENTES: Record<PaginaDoEnsinar, ComponentType<PropsDaPaginaDoEnsinar>> = {
  instrucoes: Instrucoes, regras: Regras, exemplos: Exemplos, arquivos: Arquivos, prova: ProvaSocial,
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

  const regras = licoes.licoes.filter((l) => l.kind === 'rule').length;
  const exemplos = licoes.licoes.filter((l) => l.kind !== 'rule').length + (agent.example_conversations?.length ?? 0);
  const contagem: Record<PaginaDoEnsinar, number | undefined> = {
    instrucoes: undefined, regras, exemplos, arquivos: arquivos.docs.length, prova: casosDe(agent.social_proof).length,
  };
  const pendente: Record<PaginaDoEnsinar, boolean> = {
    instrucoes: false, regras: regrasForaDoLimite(licoes.licoes) > 0, exemplos: false,
    arquivos: arquivosSemQuando(arquivos.docs) > 0, prova: false,
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
