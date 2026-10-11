/**
 * As lições (regras e exemplos) da IA aberta no Ensinar. Carrega uma vez na tela
 * (o trilho conta e marca pendência) e relê depois de cada mudança: quem diz se a
 * lição "está valendo" é o servidor (`in_use`), nunca a tela.
 *
 * ⚠️ Resposta atrasada de OUTRA IA é descartada (`vigente`): trocar de IA com a lista
 * carregando não pode mostrar as lições da anterior. E só a leitura MAIS NOVA entra
 * (`pedido`): duas releituras seguidas (editar duas vezes rápido) podem voltar fora de
 * ordem, e a antiga chegando por último mostraria a lista de antes da segunda mudança.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  LIMITES_PADRAO, salesAgentsService,
  type LimitesDasLicoes, type SalesAgentLesson, type SalesAgentLessonKind,
} from '@/services/salesAgents/salesAgentsService';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';
import { TEMPO_DO_DESFAZER_MS, TOAST_SALVO } from '../../configurar/useGravarNaHora';

export type EstadoDaLista = 'carregando' | 'pronto' | 'erro';
type Patch = Partial<Pick<SalesAgentLesson, 'content' | 'context' | 'enabled' | 'kind'>>;

export interface Licoes {
  licoes: SalesAgentLesson[];
  limites: LimitesDasLicoes;
  estado: EstadoDaLista;
  carregar: () => Promise<void>;
  criar: (kind: SalesAgentLessonKind, content: string, context?: string) => Promise<boolean>;
  atualizar: (id: string, patch: Patch, desfazivel?: boolean) => Promise<boolean>;
  apagar: (id: string) => Promise<boolean>;
}

const falhou = (e: unknown) => { toast.error(motivoEscrito(e) ?? 'Não deu pra salvar. Tente de novo.'); return false; };

export function useLicoes(agentId: string): Licoes {
  const [licoes, setLicoes] = useState<SalesAgentLesson[]>([]);
  const [limites, setLimites] = useState<LimitesDasLicoes>(LIMITES_PADRAO);
  const [estado, setEstado] = useState<EstadoDaLista>('carregando');
  const vigente = useRef(agentId);
  vigente.current = agentId;
  const atuais = useRef(licoes);
  atuais.current = licoes;

  const pedido = useRef(0);

  const carregar = useCallback(async () => {
    const pedida = agentId;
    const n = ++pedido.current;
    const valeAinda = () => vigente.current === pedida && pedido.current === n;
    try {
      const r = await salesAgentsService.listLessons(pedida);
      if (!valeAinda()) return;
      setLicoes(r.licoes);
      setLimites(r.limites);
      setEstado('pronto');
    } catch {
      if (valeAinda()) setEstado('erro');
    }
  }, [agentId]);

  useEffect(() => {
    setLicoes([]);
    setEstado('carregando');
    void carregar();
  }, [carregar]);

  const criar = useCallback<Licoes['criar']>(async (kind, content, context) => {
    try {
      await salesAgentsService.createLesson(agentId, kind, content, context);
      await carregar();
      return true;
    } catch (e) { return falhou(e); }
  }, [agentId, carregar]);

  const atualizar = useCallback<Licoes['atualizar']>(async (id, patch, desfazivel = true) => {
    const antes = atuais.current.find((l) => l.id === id);
    try {
      await salesAgentsService.updateLesson(agentId, id, patch);
      await carregar();
    } catch (e) { return falhou(e); }
    if (desfazivel && antes) {
      const volta: Patch = {};
      (Object.keys(patch) as (keyof Patch)[]).forEach((k) => { (volta as Record<string, unknown>)[k] = antes[k]; });
      toast('Salvo', {
        id: TOAST_SALVO,
        duration: TEMPO_DO_DESFAZER_MS,
        action: { label: 'Desfazer', onClick: () => { void atualizar(id, volta, false); } },
      });
    }
    return true;
  }, [agentId, carregar]);

  const apagar = useCallback<Licoes['apagar']>(async (id) => {
    try {
      await salesAgentsService.destroyLesson(agentId, id);
      await carregar();
      return true;
    } catch (e) { return falhou(e); }
  }, [agentId, carregar]);

  return { licoes, limites, estado, carregar, criar, atualizar, apagar };
}
