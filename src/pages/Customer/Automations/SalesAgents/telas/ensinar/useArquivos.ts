/**
 * Os arquivos da IA aberta no Ensinar. Relê sozinho a cada 4 s enquanto algum está
 * "Processando" (sem isto o "Lendo o arquivo…" ficava pra sempre: o upload relê a
 * lista milissegundos depois de criar o item, quando ele AINDA está pendente).
 *
 * ⚠️ Só a leitura mais nova entra (`vigente` = mesma IA, `pedido` = último pedido): a
 * releitura do relógio e a de depois de excluir podem voltar fora de ordem.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { salesAgentsService, type SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import type { EstadoDaLista } from './useLicoes';

export const DOC_POLL_MS = 4000;

export interface Arquivos {
  docs: SalesAgentDocument[];
  estado: EstadoDaLista;
  carregar: () => Promise<void>;
  apagar: (doc: SalesAgentDocument) => Promise<boolean>;
  reprocessar: (doc: SalesAgentDocument) => Promise<void>;
  /** Depois de subir arquivo ou escrever texto: relê a lista e avisa a contagem da IA. */
  aoCriar: () => Promise<void>;
}

export function useArquivos(agentId: string, aoMudarContagem: () => void): Arquivos {
  const [docs, setDocs] = useState<SalesAgentDocument[]>([]);
  const [estado, setEstado] = useState<EstadoDaLista>('carregando');
  const vigente = useRef(agentId);
  vigente.current = agentId;

  const pedido = useRef(0);

  const carregar = useCallback(async () => {
    const pedida = agentId;
    const n = ++pedido.current;
    const valeAinda = () => vigente.current === pedida && pedido.current === n;
    try {
      const lista = await salesAgentsService.listDocuments(pedida);
      if (!valeAinda()) return;
      setDocs(lista);
      setEstado('pronto');
    } catch {
      if (valeAinda()) setEstado('erro');
    }
  }, [agentId]);

  useEffect(() => { setDocs([]); setEstado('carregando'); void carregar(); }, [carregar]);

  const temPendente = docs.some((d) => d.status === 'pending');
  useEffect(() => {
    if (!temPendente) return;
    const id = setInterval(() => { void carregar(); }, DOC_POLL_MS);
    return () => clearInterval(id);
  }, [temPendente, carregar]);

  const apagar = useCallback(async (doc: SalesAgentDocument) => {
    try {
      await salesAgentsService.destroyDocument(agentId, doc.id);
      await carregar();
      aoMudarContagem();
      return true;
    } catch {
      toast.error('Não deu pra excluir. Tente de novo.');
      return false;
    }
  }, [agentId, carregar, aoMudarContagem]);

  const reprocessar = useCallback(async (doc: SalesAgentDocument) => {
    try { await salesAgentsService.reprocessDocument(agentId, doc.id); } finally { await carregar(); }
  }, [agentId, carregar]);

  const aoCriar = useCallback(async () => {
    await carregar();
    aoMudarContagem();
  }, [carregar, aoMudarContagem]);

  return { docs, estado, carregar, apagar, reprocessar, aoCriar };
}
